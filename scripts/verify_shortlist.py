"""Replay a browser optimizer shortlist with the pinned single-point XFOIL setup."""
import argparse
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "python"))

from aeroforge.geometry import generate_geometry, normalize_geometry
from aeroforge.pilot import write_json
from aeroforge.xfoil import classify, commands, parse_polar, run_point, sha256

CONFIG_PATH = ROOT / "configs/recovery-v1/final-locked.json"
POLICY_PATH = ROOT / "shared/optimizer-v1.json"
MODEL_PATH = ROOT / "artifacts/recovery-v1-complete/model.json"
COVERAGE_PATH = ROOT / "artifacts/reliability-v1/coverage-v1.json"
SUMMARY_PATH = ROOT / "artifacts/reliability-v1/summary.json"
AXES = ("m", "p", "t", "alpha")
OBJECTIVES = {"efficiency", "drag", "lift"}


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def within(value, bounds):
    return finite(value) and bounds[0] <= value <= bounds[1]


def design(value):
    if set(value) != {*AXES, "re"} or not all(map(finite, value.values())):
        raise ValueError("Each design needs finite m, p, t, alpha and re values.")
    geometry = normalize_geometry(value)
    if value["p"] != geometry.p:
        raise ValueError("Symmetric designs must have canonical camber position zero.")
    return value


def bounds(manifest):
    domain = manifest["domain"]
    return {
        "m": domain["m"], "p": domain["cambered_p"], "t": domain["t"],
        "alpha": domain["alpha_deg"], "re": (min(domain["sampled_reynolds"]), max(domain["sampled_reynolds"])),
    }


def matches(value, ranges):
    return all(
        (axis == "p" and value["m"] == 0) or within(value[axis], span)
        for axis, span in ranges.items()
    )


def coverage_distance(value, index, nominal):
    spans = {axis: hi - lo for axis, (lo, hi) in nominal.items()}
    log_span = math.log10(nominal["re"][1]) - math.log10(nominal["re"][0])
    best = math.inf
    for m, p, t, conditions in index["groups"]:
        dm = (value["m"] - m) / spans["m"]
        dp = (value["p"] - p) / spans["p"] if value["m"] and m else 0
        dt = (value["t"] - t) / spans["t"]
        for alpha, re in conditions:
            da = (value["alpha"] - alpha) / spans["alpha"]
            dr = (math.log10(value["re"]) - math.log10(re)) / log_span
            best = min(best, dm * dm + dp * dp + dt * dt + da * da + dr * dr)
    return math.sqrt(best)


def score(row, settings):
    if row is None or not finite(row["cl"]) or not finite(row["cd"]) or row["cd"] <= 0:
        return None
    objective = settings["objective"]
    if objective == "drag":
        return -row["cd"] if row["cl"] >= settings["minimumLift"] else None
    return row["cl"] if objective == "lift" else row["cl"] / row["cd"]


def validate_export(payload, manifest, policy, index, index_hash):
    if payload.get("schema") != "aeroforge-optimizer-v1" or payload.get("policy") != policy["version"]:
        raise ValueError("Unsupported optimizer export schema or search policy.")
    model = {"version": manifest["version"], "sha256": manifest["model_sha256"]}
    coverage = {"version": policy["coverage_version"], "sha256": index_hash}
    if payload.get("model") != model or payload.get("coverage") != coverage:
        raise ValueError("Shortlist model or coverage version does not match the frozen evidence.")
    if payload.get("status") not in {"finished", "cancelled", "failed"}:
        raise ValueError("Export a stopped search.")
    original = design(payload["original"])
    settings = payload["settings"]
    nominal = bounds(manifest)
    if settings["objective"] not in OBJECTIVES or settings["algorithm"] not in {"differential-evolution", "random"}:
        raise ValueError("Invalid objective or algorithm.")
    if type(settings["re"]) is not int or not within(settings["re"], nominal["re"]):
        raise ValueError("Reynolds number must be an integer inside the model bounds.")
    if type(settings["seed"]) is not int or not 0 <= settings["seed"] <= 0xffffffff:
        raise ValueError("Invalid seed.")
    if type(settings["evaluations"]) is not int or not 1 <= settings["evaluations"] <= policy["max_evaluations"]:
        raise ValueError("Invalid candidate evaluation limit.")
    if not finite(settings["minimumLift"]) or (settings["objective"] == "drag" and not within(settings["minimumLift"], policy["cl"])):
        raise ValueError("Invalid minimum lift.")
    ranges = settings["ranges"]
    if set(ranges) != set(AXES):
        raise ValueError("Missing search range.")
    for axis, (lo, hi) in ranges.items():
        if not within(lo, nominal[axis]) or not within(hi, nominal[axis]) or lo > hi:
            raise ValueError("Search ranges must be ordered and inside model bounds.")
    result = payload["result"]
    counts = result["counts"]
    keys = {"attempted", "duplicate", "sparse", "submitted", "completed", "rejected", "feasible", "baselineRows"}
    if set(counts) != keys or any(type(n) is not int or n < 0 for n in counts.values()):
        raise ValueError("Invalid evaluation counts.")
    if not (counts["feasible"] + counts["rejected"] == counts["completed"] <= counts["submitted"] <= settings["evaluations"]
            and counts["baselineRows"] <= 1
            and counts["duplicate"] + counts["sparse"] + counts["submitted"] <= counts["attempted"]
            <= max(policy["batch_size"], settings["evaluations"] * 20)):
        raise ValueError("Evaluation counts disagree.")

    shortlist = result["shortlist"]
    if not 1 <= len(shortlist) <= min(counts["feasible"], policy["shortlist_size"]):
        raise ValueError("Export must contain at least one feasible and no more than three shortlisted candidates.")
    cases = []
    previous = math.inf
    seen = set()
    for i, item in enumerate(shortlist, 1):
        value = design(item["design"])
        if value["re"] != settings["re"] or not matches(value, ranges):
            raise ValueError("Candidate is outside the selected search ranges.")
        key = tuple(value[axis] for axis in (*AXES, "re"))
        if key in seen:
            raise ValueError("Duplicate shortlist candidate.")
        seen.add(key)
        prediction = item["prediction"]
        if not all(within(prediction[target], policy[target]) for target in ("cl", "cd")):
            raise ValueError("Candidate prediction fails the optimizer screening policy.")
        expected_score = score(prediction, settings)
        distance = coverage_distance(value, index, nominal)
        if (expected_score is None or not finite(item["score"])
            or not math.isclose(expected_score, item["score"], abs_tol=1e-10)
            or item["score"] > previous or not finite(item["distance"])
            or not math.isclose(item["distance"], distance, abs_tol=1e-10)
            or distance > index["threshold"] + 1e-12):
            raise ValueError("Candidate rank, objective or training coverage is inconsistent.")
        previous = item["score"]
        cases.append({"id": f"candidate-{i}", "design": value, "predicted": prediction, "predicted_score": item["score"]})
    last_row, last_score = 0, -math.inf
    for point in result["history"]:
        row, value = point["evaluated"], point["score"]
        if type(row) is not int or not last_row < row <= counts["completed"] or not finite(value) or value <= last_score:
            raise ValueError("Best-objective history is inconsistent.")
        last_row, last_score = row, value
    if last_score != cases[0]["predicted_score"]:
        raise ValueError("Best-objective history does not match the shortlist.")
    baseline = result["baseline"]
    if baseline:
        value = design(baseline["design"])
        low, high = ranges["alpha"]
        expected = {**original, "re": settings["re"], "alpha": low if low == high else original["alpha"]}
        if value != expected:
            raise ValueError("Baseline does not match the original geometry at the reference flow.")
        prediction = baseline["prediction"]
        if ((prediction is not None and any(not finite(prediction[k]) for k in ("cl", "cd")))
            or (baseline["score"] is not None and not finite(baseline["score"]))):
            raise ValueError("Invalid baseline prediction.")
        cases.insert(0, {"id": "baseline", "design": value, "predicted": prediction, "predicted_score": baseline["score"]})
    return settings, cases


def solve_case(case, settings, nominal, config, executable, output):
    value = case["design"]
    record = {**case, "solver": None, "solver_score": None, "residual_predicted_minus_xfoil": None}
    if not matches(value, nominal):
        return {**record, "status": "outside_model_bounds", "eligible": False}
    case_id = case["id"]
    filename = f"{case_id}.dat"
    geometry_path = output / filename
    geometry = generate_geometry(value, config["geometry_points_per_surface"])
    geometry_path.write_text(
        f"AeroForge_{case_id}\n" + "".join(f"{x:.17g} {y:.17g}\n" for x, y in geometry.contour),
        encoding="ascii",
    )
    requested_re = int(value["re"])
    directory = output / case_id
    raw = run_point(executable, directory, commands(config, f"../{filename}", requested_re, value["alpha"]), config["timeout_seconds"])
    # XFOIL 6.99 prints Reynolds with three decimals before the e6 exponent.
    expected_header_re = requested_re
    if raw["polar_text"]:
        try:
            printed = parse_polar(raw["polar_text"]).reynolds
            if abs(printed - requested_re) <= 500:
                expected_header_re = printed
        except ValueError:
            pass
    classified = classify(
        raw["polar_text"], raw["stdout"], raw["returncode"], config,
        expected_header_re, value["alpha"], value["m"], raw["timed_out"], raw["launch_error"],
    )
    panel = directory / "panels.dat"
    panel_count = sum(1 for line in panel.read_text(encoding="ascii").splitlines() if line.strip()) if panel.exists() else 0
    if panel_count != config["panel_nodes"]:
        classified["eligible"] = False
        classified["status"] = "rejected"
        classified["reasons"].append("panel_count_mismatch")
    record.update({
        "status": classified["status"], "converged": classified["converged"],
        "eligible": classified["eligible"], "reasons": classified["reasons"], "warnings": classified["warnings"],
        "elapsed_seconds": raw["elapsed_seconds"], "panel_count": panel_count,
        "geometry_sha256": sha256(geometry_path),
        "raw_sha256": {file.name: sha256(file) for file in sorted(directory.iterdir()) if file.is_file()},
    })
    if record["eligible"]:
        record["solver"] = {key: classified["coefficients"][key] for key in ("cl", "cd")}
        if matches(value, settings["ranges"]):
            record["solver_score"] = score(record["solver"], settings)
        if case["predicted"]:
            record["residual_predicted_minus_xfoil"] = {
                key: case["predicted"][key] - record["solver"][key] for key in ("cl", "cd")
            }
    return record


def ranks(records):
    candidates = [record for record in records if record["id"] != "baseline"]
    for source in ("predicted", "solver"):
        key = f"{source}_score"
        eligible = sorted((row for row in candidates if row[key] is not None), key=lambda row: -row[key])
        scores = sorted({row[key] for row in eligible}, reverse=True)
        for row in candidates:
            row[f"{source}_rank"] = scores.index(row[key]) + 1 if row[key] is not None else None
    for row in candidates:
        a, b = row["predicted_rank"], row["solver_rank"]
        row["rank_change"] = b - a if a is not None and b is not None else None


def verify(shortlist, executable, output):
    config = read_json(CONFIG_PATH)
    manifest = read_json(MODEL_PATH)
    policy = read_json(POLICY_PATH)
    index_hash = sha256(COVERAGE_PATH)
    summary = read_json(SUMMARY_PATH)
    index = read_json(COVERAGE_PATH)
    if (index_hash != summary["coverage_sha256"] or index["model_sha256"] != manifest["model_sha256"]
        or policy["model_sha256"] != manifest["model_sha256"]):
        raise ValueError("Local model or coverage provenance mismatch.")
    if shortlist.stat().st_size > 512 * 1024:
        raise ValueError("Shortlist exceeds 512 KiB.")
    payload = read_json(shortlist)
    settings, cases = validate_export(payload, manifest, policy, index, index_hash)
    executable = executable.resolve()
    if sha256(executable) != config["executable_sha256"]:
        raise ValueError("XFOIL executable hash does not match the recovery protocol.")
    output.mkdir(parents=True, exist_ok=False)
    (output / "solver-config.json").write_bytes(CONFIG_PATH.read_bytes())
    records = [solve_case(case, settings, bounds(manifest), config, executable, output) for case in cases]
    ranks(records)
    report = {
        "schema": "aeroforge-xfoil-verification-v1", "shortlist_sha256": sha256(shortlist),
        "config_sha256": sha256(CONFIG_PATH), "solver_sha256": config["executable_sha256"],
        "model": payload["model"], "coverage": payload["coverage"], "policy": payload["policy"],
        "settings": settings, "results": records,
    }
    write_json(output / "verification.json", report)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("shortlist", type=Path)
    parser.add_argument("--xfoil", type=Path, default=ROOT / "tools/xfoil/xfoil.exe")
    parser.add_argument("--output", type=Path, required=True)
    options = parser.parse_args()
    try:
        report = verify(options.shortlist, options.xfoil, options.output)
    except (ValueError, OSError, KeyError, TypeError) as error:
        parser.exit(2, f"Verification could not run. {error}\n")
    results = report["results"]
    print(f"Verified {sum(row['eligible'] for row in results)} of {len(results)} rows against XFOIL.")
