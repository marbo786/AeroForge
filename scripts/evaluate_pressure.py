"""Open the untouched test partition after verifying the frozen selection."""
import argparse
from collections import Counter
import gzip
from itertools import product
import json
from pathlib import Path

import numpy as np

from run_pressure_dataset import (
    DATA, PLAN, SIDES, SOLVER_CONFIG, SOURCE, evaluate_attempt, generate_geometry,
    load_config, load_plan, parse_naca, sha256, write_json,
)
from train_pressure import features, ort_session, read_partition
from aeroforge.pressure import normalized_arc
from aeroforge.pressure_metrics import pressure_accuracy_gates, score_pressure


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def verify_frozen(data, model):
    selection = read_json(model / "selection.json")
    frozen = {
        PLAN: selection["plan_sha256"],
        model / "pressure-v1.onnx": selection["onnx_sha256"],
        model / f"{selection['selected']}.pt": selection["model_sha256"],
        model / "parity.json": selection["parity_vectors_sha256"],
        model / "validation.json": selection["validation_sha256"],
        Path(__file__).with_name("train_pressure.py"): selection["trainer_sha256"],
        Path(score_pressure.__code__.co_filename): selection["score_sha256"],
    }
    for split, digest in selection["fit_partition_sha256"].items():
        frozen[data / split / "manifest.json"] = digest
    for path, digest in frozen.items():
        if sha256(path) != digest:
            raise ValueError(f"frozen selection hash mismatch for {path.name}")
    return selection


def count_coverage(rows, keys, strata):
    counts = {}
    for values in strata:
        group = [row for row in rows if tuple(row[key] for key in keys) == values]
        eligible = [row for row in group if row["pressure_eligible"]]
        counts["/".join(map(str, values))] = {
            "attempted": len(group), "eligible": len(eligible),
            "eligible_fraction": len(eligible) / len(group),
            "eligible_geometries": len({row["geometry_id"] for row in eligible}),
        }
    return counts


def audit_partition(folder, partition, split, plan, config):
    rows = [json.loads(line) for line in (folder / "attempts.jsonl").read_text(encoding="utf-8").splitlines()]
    codes = plan["splits"][split]
    manifest = read_json(folder / "manifest.json")
    expected = list(product(codes, plan["reynolds_numbers"], plan["angles_deg"]))
    actual = [(row["geometry_code"], row["reynolds"], row["alpha_deg"]) for row in rows]
    if expected != actual or manifest["attempts"] != len(expected):
        raise ValueError(f"missing or duplicate operating points in {split}")
    eligible = [row for row in rows if row["pressure_eligible"]]
    if any(
        not np.array_equal(partition[field], [row[key] for row in eligible])
        for field, key in (
            ("ids", "id"), ("geometry_codes", "geometry_code"), ("geometry_ids", "geometry_id"),
            ("reynolds", "reynolds"), ("alpha", "alpha_deg"),
        )
    ):
        raise ValueError(f"eligible labels and attempt manifest disagree in {split}")
    station = (1 - np.cos(np.linspace(0, np.pi, 257))) / 2
    if not np.array_equal(partition["station"], station) or not np.isfinite(partition["profiles"]).all():
        raise ValueError(f"unexpected station grid or pressure values in {split}")
    geometries = {code: generate_geometry(parse_naca(code), config["geometry_points_per_surface"]) for code in codes}
    geometry_ids = {code: geometry.geometry_id for code, geometry in geometries.items()}
    if geometry_ids != manifest["geometry_ids"]:
        raise ValueError(f"canonical geometry IDs disagree in {split}")
    geometry_hashes = {code: sha256(folder / "geometries" / f"{code}.dat") for code in codes}
    label_index = 0
    max_alignment = {side: 0.0 for side in SIDES}
    max_gridding = {side: 0.0 for side in SIDES}
    analytic_coordinates = {
        code: np.array([
            np.column_stack([np.interp(station, normalized_arc(branch), axis) for axis in branch.T])
            for branch in (np.asarray(geometry.upper), np.asarray(geometry.lower))
        ])
        for code, geometry in geometries.items()
    }
    for row, case in zip(rows, expected):
        code, reynolds, alpha = case
        if (
            row["id"] != f"{code}-{reynolds}-{alpha:+d}"
            or geometry_ids[code] != row["geometry_id"] or geometry_hashes[code] != row["geometry_sha256"]
        ):
            raise ValueError(f"incorrect case provenance in {split}: {row['id']}")
        raw = folder / "raw" / row["id"]
        if {p.name for p in raw.iterdir() if p.is_file()} != {*row["raw_sha256"], "attempt.json"}:
            raise ValueError(f"missing or unlisted raw files for {row['id']}")
        for filename, digest in row["raw_sha256"].items():
            if sha256(raw / filename) != digest:
                raise ValueError(f"raw hash mismatch: {row['id']}/{filename}")
        raw_data = {key: row[key] for key in ("returncode", "timed_out", "launch_error")}
        polar = raw / "polar.txt"
        raw_data["polar_text"] = polar.read_text(encoding="ascii", errors="replace") if polar.exists() else None
        raw_data["stdout"] = gzip.decompress((raw / "stdout.txt.gz").read_bytes()).decode("ascii", errors="replace")
        recovered, profiles, _ = evaluate_attempt(raw, raw_data, config, plan, case, geometries[code], f"Pressure_{code}")
        if (
            recovered["pressure_eligible"] != row["pressure_eligible"]
            or recovered["pressure_reasons"] != row["pressure_reasons"]
            or recovered["polar"]["reasons"] != row["polar"]["reasons"]
            or recovered["polar"]["warnings"] != row["polar"]["warnings"]
        ):
            raise ValueError(f"run classification failed replay for {row['id']}")
        if row["pressure_eligible"]:
            grid = np.array([profiles[side] for side in SIDES])
            if not np.array_equal(grid, partition["profiles"][label_index]):
                raise ValueError(f"label differs from raw resampling for {row['id']}")
            delta = np.linalg.norm(grid[..., :2] - analytic_coordinates[code], axis=-1)
            for i, side in enumerate(SIDES):
                max_alignment[side] = max(max_alignment[side], float(delta[i].max()))
                max_gridding[side] = max(max_gridding[side], recovered["representation"][side]["257"]["all"]["max"])
            label_index += 1
        elif not row["pressure_reasons"]:
            raise ValueError(f"rejection reason missing for {row['id']}")

    return {
        "attempted": len(rows), "eligible": len(eligible), "geometries": len(geometry_ids),
        "geometry_re": count_coverage(rows, ("geometry_code", "reynolds"), product(codes, plan["reynolds_numbers"])),
        "reynolds": count_coverage(rows, ("reynolds",), ((re,) for re in plan["reynolds_numbers"])),
        "alpha": count_coverage(rows, ("alpha_deg",), ((alpha,) for alpha in plan["angles_deg"])),
        "pressure_rejections": dict(Counter(reason for row in rows for reason in row["pressure_reasons"])),
        "polar_rejections": dict(Counter(reason for row in rows for reason in row["polar"]["reasons"])),
        "polar_quality_flags": dict(Counter(flag for row in rows for flag in row["polar"]["warnings"])),
        "raw_bytes": sum(row["raw_bytes"] for row in rows),
        "solver_seconds_sum": sum(row["elapsed_seconds"] for row in rows),
        "max_analytic_to_solver_grid_distance_chord_units": max_alignment,
        "max_raw_to_grid_cp_error": max_gridding,
        "manifest_sha256": sha256(folder / "manifest.json"),
        "partition_hashes": manifest["sha256"],
        "rejected_ids": [row["id"] for row in rows if not row["pressure_eligible"]],
    }, set(geometry_ids.values())


def evaluate(data, model, output):
    plan = load_plan()
    config = load_config(SOLVER_CONFIG)
    selection = verify_frozen(data, model)
    provenance = read_json(data / "provenance.json")
    if (
        provenance["plan_sha256"] != sha256(PLAN)
        or provenance["solver_config_sha256"] != sha256(SOLVER_CONFIG)
        or provenance["solver_sha256"] != config["executable_sha256"]
        or provenance["solver_source_archive_sha256"] != sha256(SOURCE)
        or provenance["generator_sha256"] != sha256(Path(__file__).with_name("run_pressure_dataset.py"))
        or provenance["paired_evaluator_sha256"] != sha256(Path(__file__).with_name("run_pressure_pilot.py"))
    ):
        raise ValueError("solver provenance mismatch")
    output.mkdir(parents=True, exist_ok=False)
    write_json(output / "selection.json", selection)
    splits, geometry_ids = {}, set()
    for split in plan["splits"]:
        partition = read_partition(data, split, plan)
        splits[split], ids = audit_partition(data / split, partition, split, plan, config)
        if geometry_ids.intersection(ids):
            raise ValueError(f"geometry leakage in {split}")
        geometry_ids.update(ids)
        print(f"{split}: verified {splits[split]['eligible']}/{splits[split]['attempted']} labels against raw solver data", flush=True)

    test = partition
    if split != "test":
        raise ValueError("expected the sealed test split last")
    graph = model / "pressure-v1.onnx"
    predicted = ort_session(graph).run(["cp"], {"features": features(test)})[0]
    thickness = features(test)[:, 2]
    camber_position = features(test)[:, 1]
    symmetric = np.char.startswith(test["geometry_codes"], "00")

    def score(mask):
        return score_pressure(predicted[mask], test["profiles"][mask], test["geometry_ids"][mask], test["station"], plan)

    metrics = score(slice(None))
    coverage = {
        re: counts["eligible_fraction"] >= plan["minimum_held_out_fraction"]
        and counts["eligible_geometries"] >= plan["minimum_held_out_geometries"]
        for re, counts in splits["test"]["reynolds"].items()
    }
    accuracy = pressure_accuracy_gates(metrics, plan)
    report = {
        "provenance": provenance,
        "splits": splits,
        "test_metrics": metrics,
        "test_strata": {
            "reynolds": {str(re): score(test["reynolds"] == re) for re in plan["reynolds_numbers"]},
            "alpha": {str(alpha): score(test["alpha"] == alpha) for alpha in plan["angles_deg"]},
            "geometry_family": {
                family: score(mask) for family, mask in {
                    "symmetric": symmetric,
                    "cambered": ~symmetric,
                    "thinner (8–12%)": thickness <= 12,
                    "thicker (13–18%)": thickness >= 13,
                    **{f"camber position {p / 10:.1f}": camber_position == p for p in range(2, 7)
                       if (camber_position == p).any()},
                }.items()
            },
        },
        "gates": {
            "test_coverage": coverage,
            "test_accuracy": accuracy,
            "onnx_byte_budget": selection["onnx_bytes"] <= plan["graph_byte_limit"],
            "source_onnx_parity": selection["source_onnx_max_abs"] <= plan["limits"]["parity_max"],
        },
    }
    write_json(output / "report.json", report)
    np.savez_compressed(output / "test-predictions.npz", ids=test["ids"], cp=predicted)
    parity = read_json(model / "parity.json")
    index = next(i for i, vector in enumerate(parity["features"]) if vector[0])
    validation = read_partition(data, "validation", plan)
    profile = validation["profiles"][np.flatnonzero(validation["ids"] == parity["ids"][index]).item()]
    stations = [0, 9, 18, 27, 40, 64, 90, 128, 175, 232, 255, 256]
    write_json(output / "plot-coordinate-fixture.json", {
        "id": parity["ids"][index], "parityIndex": index, "stations": stations,
        "solverCoordinates": profile[:, stations, :2].tolist(),
    })
    if all(coverage.values()) and all(all(side.values()) for side in accuracy.values()) and (
        report["gates"]["onnx_byte_budget"] and report["gates"]["source_onnx_parity"]
    ):
        write_json(output / "model.json", {
            "version": plan["version"], "file": graph.name, "sha256": selection["onnx_sha256"],
            "bytes": selection["onnx_bytes"], "stations": plan["station_counts"][0],
            "reynolds": plan["reynolds_numbers"], "alpha": plan["angles_deg"],
            "rejected": sorted(key for group in splits.values() for key in group["rejected_ids"]),
        })
    print(json.dumps(report["gates"], indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DATA)
    parser.add_argument("--model", type=Path, default=DATA / "model")
    parser.add_argument("--output", type=Path, default=DATA / "evaluation")
    args = parser.parse_args()
    evaluate(args.data, args.model, args.output)
