"""Run the predeclared 30-attempt XFOIL pressure feasibility pilot."""
import argparse
import json
from pathlib import Path
import re
import statistics
import sys
import time

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "python"))

from aeroforge.geometry import generate_geometry, parse_naca
from aeroforge.pilot import load_config, write_json
from aeroforge.pressure import (
    numeric_rows, pair_panels, parse_pressure, pressure_branches, pressure_forces,
    resample_branch, summarize_error,
)
from aeroforge.xfoil import classify, commands, run_point, sha256

PLAN = ROOT / "configs/pressure-pilot-v1.json"
SOLVER_CONFIG = ROOT / "configs/recovery-v1/final-locked.json"
SOURCE = ROOT / "tools/xfoil/Xfoil699src.zip"


def plan_cases(plan):
    primary = [
        (code, int(reynolds), alpha)
        for code in plan["geometry_codes"]
        for reynolds, angles in plan["operating_points"].items()
        for alpha in angles
    ]
    diagnostics = [tuple(row) for row in plan["diagnostic_cases"]]
    if (
        len(primary) != 24 or len(set(primary)) != 24 or len(plan["geometry_codes"]) != 4
        or sorted(map(int, plan["operating_points"])) != [100000, 250000, 500000]
        or any(len(angles) != 2 or any(not -4 <= alpha <= 8 for alpha in angles) for angles in plan["operating_points"].values())
        or len(diagnostics) != 3 or len(set(diagnostics)) != 3 or not set(diagnostics) <= set(primary)
        or plan["primary_panels"] != 160 or plan["diagnostic_panels"] != 320
        or plan["station_counts"] != [65, 129, 257]
    ):
        raise ValueError("unexpected pressure pilot scope")
    return primary, diagnostics


def pressure_commands(config, filename, reynolds, alpha):
    base = commands(config, filename, reynolds, alpha)
    solve = f"ALFA {alpha}\n"
    if base.count(solve) != 1:
        raise ValueError("expected exactly one operating-point solve")
    return base.replace(solve, solve + "CPWR pressure.dat\nCPMN\n", 1)


def evaluate_attempt(directory, raw, config, plan, case, geometry, name):
    code, reynolds, alpha = case
    polar = classify(
        raw["polar_text"], raw["stdout"], raw["returncode"], config,
        reynolds, alpha, geometry.parameters.m, raw["timed_out"], raw["launch_error"],
    )
    record = {"polar": polar, "pressure_eligible": False, "pressure_reasons": []}
    if not polar["eligible"]:
        record["pressure_reasons"].append("ineligible_polar")
    profiles = samples = None
    try:
        panels = numeric_rows((directory / "panels.dat").read_text(encoding="ascii").splitlines(), 2)
        dump = parse_pressure((directory / "pressure.dat").read_text(encoding="ascii"))
        if dump.name != name or abs(dump.alpha - alpha) > 0.0000051 or abs(dump.reynolds - reynolds) > 0.001:
            raise ValueError("CPWR case metadata mismatch")
        delta = pair_panels(panels, dump.samples, config["panel_nodes"], plan["paired_coordinate_tolerance"])
        cp = dump.samples[:, 2]
        branches, alignment = pressure_branches(panels, cp, geometry, plan["geometry_projection_tolerance"])
        forces = pressure_forces(panels, cp, alpha)
        accepted = polar["coefficients"]
        residual = {
            key: forces[key] - accepted[key] for key in ("cl", "cm")
        } if accepted and accepted["cl"] is not None and accepted["cm"] is not None else None
        if residual is not None and max(map(abs, residual.values())) > plan["force_tolerance"]:
            record["pressure_reasons"].append("pressure_force_mismatch")
        minimum = re.search(r"Minimum Viscous\s+Cp\s*=\s*([-\d.]+)\s+at x\s*=\s*([-\d.]+)", raw["stdout"])
        inviscid = re.search(r"Minimum Inviscid\s+Cp\s*=\s*([-\d.]+)\s+at x\s*=\s*([-\d.]+)", raw["stdout"])
        if minimum is None:
            record["pressure_reasons"].append("missing_viscous_minimum")
        elif abs(float(minimum[1]) - float(cp.min())) > 0.0000551:
            record["pressure_reasons"].append("viscous_minimum_mismatch")
        record.update({
            "cpwr_metadata": {"name": dump.name, "alpha_deg": dump.alpha, "reynolds": dump.reynolds, "flap_hinge": dump.flap_hinge},
            "panel_count": len(panels), "max_pair_rounding_difference": delta, "alignment": alignment,
            "surface_min_cp": float(cp.min()),
            "reported_min_viscous_cp": float(minimum[1]) if minimum else None,
            "reported_min_inviscid_cp": float(inviscid[1]) if inviscid else None,
            "pressure_integration": forces, "pressure_minus_polar": residual,
            "representation": {},
        })
        profiles = {}
        for side, branch in branches.items():
            record["representation"][side] = {}
            for count in plan["station_counts"]:
                grid, errors = resample_branch(branch, count)
                record["representation"][side][str(count)] = errors
            profiles[side] = grid
        samples = dump.samples
    except (ValueError, OSError) as error:
        record["pressure_reasons"].append(str(error))
    record["pressure_eligible"] = not record["pressure_reasons"]
    return record, profiles, samples


def compare_diagnostics(primary_id, repeat_id, refined_id, records, grids, raw_samples):
    primary, repeat, refined = (records[key] for key in (primary_id, repeat_id, refined_id))
    repeated = (
        primary["pressure_eligible"] and repeat["pressure_eligible"]
        and np.array_equal(raw_samples[primary_id], raw_samples[repeat_id])
        and primary["polar"]["coefficients"] == repeat["polar"]["coefficients"]
    )
    comparison = {"primary": primary_id, "repeat": repeat_id, "refined": refined_id, "repeat_matches_printed_precision": bool(repeated)}
    if primary["pressure_eligible"] and refined["pressure_eligible"]:
        station = (1 - np.cos(np.linspace(0, np.pi, len(grids[primary_id]["upper"])))) / 2
        comparison["refinement"] = {}
        for side in ("upper", "lower"):
            a, b = grids[primary_id][side], grids[refined_id][side]
            peak_a, peak_b = a[a[:, 2].argmin()], b[b[:, 2].argmin()]
            comparison["refinement"][side] = {
                **summarize_error(np.abs(a[:, 2] - b[:, 2]), station),
                "suction_peak_cp_delta_320_minus_160": float(peak_b[2] - peak_a[2]),
                "suction_peak_x_delta_320_minus_160": float(peak_b[0] - peak_a[0]),
                "max_coordinate_distance": float(np.max(np.linalg.norm(a[:, :2] - b[:, :2], axis=1))),
            }
        comparison["polar_delta_320_minus_160"] = {
            key: refined["polar"]["coefficients"][key] - primary["polar"]["coefficients"][key]
            for key in ("cl", "cd", "cm")
        }
    return comparison


def capture_plot(path, comparisons, records, grids):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    figure, axes = plt.subplots(2, len(comparisons), figsize=(12, 6.8), layout="constrained",
                               sharey="row", height_ratios=[2, 1])
    colors = {"upper": "#217583", "lower": "#99421d"}
    for column, pair in enumerate(comparisons):
        axis, residual = axes[:, column]
        key = pair["primary"]
        record = records[key]
        axis.set_title(f'NACA {record["geometry_code"]}\nRe {record["reynolds"]:,} · {record["alpha_deg"]}°')
        for label, key, style in [("160 panels", key, "-"), ("320 panels", pair["refined"], "--")]:
            if not records[key]["pressure_eligible"]:
                continue
            for side, color in colors.items():
                points = grids[key][side]
                axis.plot(points[:, 0], points[:, 2], style, color=color, label=f"{side.title()} · {label}")
        axis.set_xlabel("x/c")
        axis.grid(alpha=0.22)
        if "refinement" in pair:
            for side, color in colors.items():
                primary, refined = (grids[pair[role]][side] for role in ("primary", "refined"))
                stations = (1 - np.cos(np.linspace(0, np.pi, len(primary)))) / 2
                residual.plot(stations, refined[:, 2] - primary[:, 2], color=color)
        residual.axhline(0, color="#657079", linewidth=0.8)
        residual.set_xlabel("Normalized surface arc length, s")
        residual.grid(alpha=0.22)
    axes[0, 0].invert_yaxis()
    axes[0, 0].set_ylabel("Pressure coefficient, Cp")
    axes[1, 0].set_ylabel("Cp difference\n320 minus 160 panels")
    handles, labels = axes[0, 0].get_legend_handles_labels()
    if handles:
        axes[0, 0].legend(handles, labels, loc="upper right", fontsize=8)
    figure.suptitle("XFOIL 6.99 viscous surface pressure · panel sensitivity")
    figure.savefig(path, dpi=150)
    plt.close(figure)


def run(executable, output, plot_path=None):
    started = time.perf_counter()
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    primary, diagnostics = plan_cases(plan)
    config = load_config(SOLVER_CONFIG)
    executable = executable.resolve()
    if sha256(executable) != config["executable_sha256"]:
        raise ValueError("XFOIL binary hash does not match the pressure pilot")
    output.mkdir(parents=True, exist_ok=False)
    (output / "plan.json").write_bytes(PLAN.read_bytes())
    (output / "solver-config.json").write_bytes(SOLVER_CONFIG.read_bytes())
    write_json(output / "provenance.json", {
        "version": plan["version"], "solver_sha256": sha256(executable),
        "solver_source_archive_sha256": sha256(SOURCE),
        "plan_sha256": sha256(PLAN), "solver_config_sha256": sha256(SOLVER_CONFIG),
        "python": sys.version.split()[0], "numpy": np.__version__,
    })
    geometries = {}
    for code in plan["geometry_codes"]:
        geometry = generate_geometry(parse_naca(code), config["geometry_points_per_surface"])
        geometries[code] = geometry
        filename = output / f"naca-{code}.dat"
        filename.write_text(
            f"Pressure_{code}\n" + "".join(f"{x:.17g} {y:.17g}\n" for x, y in geometry.contour),
            encoding="ascii",
        )
    records, grids, raw_samples, ids = {}, {}, {}, {}
    for role, cases, count in [
        ("primary", primary, plan["primary_panels"]),
        ("repeat", diagnostics, plan["primary_panels"]),
        ("refined", diagnostics, plan["diagnostic_panels"]),
    ]:
        effective = dict(config, panel_nodes=count)
        for case in cases:
            code, reynolds, alpha = case
            attempt_id = f"{role}-{code}-{reynolds}-{alpha:+d}"
            ids[role, case] = attempt_id
            directory = output / attempt_id
            filename = f"naca-{code}.dat"
            raw = run_point(executable, directory, pressure_commands(effective, f"../{filename}", reynolds, alpha), effective["timeout_seconds"])
            geometry = geometries[code]
            result, profiles, samples = evaluate_attempt(directory, raw, effective, plan, case, geometry, f"Pressure_{code}")
            files = sorted(path for path in directory.iterdir() if path.is_file())
            record = {
                "id": attempt_id, "role": role, "geometry_code": code, "geometry_id": geometry.geometry_id,
                "reynolds": reynolds, "alpha_deg": alpha, "requested_panels": count,
                "geometry_sha256": sha256(output / filename), "elapsed_seconds": raw["elapsed_seconds"],
                "returncode": raw["returncode"], "timed_out": raw["timed_out"], "launch_error": raw["launch_error"],
                "raw_sha256": {path.name: sha256(path) for path in files}, "raw_bytes": sum(path.stat().st_size for path in files),
                **result,
            }
            records[attempt_id] = record
            grids[attempt_id], raw_samples[attempt_id] = profiles, samples
            with (output / "attempts.jsonl").open("a", encoding="utf-8") as stream:
                stream.write(json.dumps(record, allow_nan=False) + "\n")
            print(attempt_id, "eligible" if result["pressure_eligible"] else result["pressure_reasons"], flush=True)

    comparisons = [
        compare_diagnostics(*(ids[role, case] for role in ("primary", "repeat", "refined")), records, grids, raw_samples)
        for case in diagnostics
    ]
    main = [row for row in records.values() if row["role"] == "primary"]
    cells = {
        f"{code}/{reynolds}": sum(
            row["pressure_eligible"] for row in main if row["geometry_code"] == code and row["reynolds"] == int(reynolds)
        ) for code in plan["geometry_codes"] for reynolds in plan["operating_points"]
    }
    accepted = [row for row in main if row["pressure_eligible"]]
    np.savez_compressed(
        output / "primary-profiles.npz",
        ids=np.array([row["id"] for row in accepted]),
        station=(1 - np.cos(np.linspace(0, np.pi, 257))) / 2,
        profiles=np.array(
            [[grids[row["id"]][side] for side in ("upper", "lower")] for row in accepted],
        ).reshape(-1, 2, 257, 3),
    )
    raw_bytes = sum(row["raw_bytes"] for row in main)
    report = {
        "primary_attempts": len(main), "primary_eligible": len(accepted), "eligible_by_geometry_re": cells,
        "failed_primary": [row["id"] for row in main if not row["pressure_eligible"]],
        "comparisons": comparisons, "primary_raw_bytes": raw_bytes,
        "total_raw_bytes": sum(row["raw_bytes"] for row in records.values()),
        "primary_median_solver_seconds": statistics.median(row["elapsed_seconds"] for row in main),
        "primary_solver_seconds": sum(row["elapsed_seconds"] for row in main),
        "all_solver_seconds": sum(row["elapsed_seconds"] for row in records.values()),
        "elapsed_seconds": time.perf_counter() - started,
        "feasibility_floor_passed": (
            len(accepted) >= plan["minimum_eligible_primary"] and all(cells.values())
            and all(pair["repeat_matches_printed_precision"] for pair in comparisons)
        ),
        "derived_sha256": {name: sha256(output / name) for name in ("attempts.jsonl", "primary-profiles.npz")},
    }
    write_json(output / "report.json", report)
    if plot_path:
        capture_plot(plot_path, comparisons, records, grids)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--xfoil", type=Path, default=ROOT / "tools/xfoil/xfoil.exe")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--plot", type=Path)
    args = parser.parse_args()
    result = run(args.xfoil, args.output, args.plot)
    print(json.dumps(result, indent=2))
