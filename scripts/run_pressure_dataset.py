"""Generate the frozen 2,016-case viscous pressure dataset."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from itertools import product
import json
from pathlib import Path
import sys

import numpy as np

from run_pressure_pilot import (
    ROOT, SOLVER_CONFIG, SOURCE, evaluate_attempt, pressure_commands,
    generate_geometry, load_config, parse_naca, run_point, sha256, write_json,
)

PLAN = ROOT / "configs/pressure-v1.json"
DATA = ROOT / "data/pressure-v1"
SIDES = ("upper", "lower")


def load_plan():
    plan = json.loads(PLAN.read_text(encoding="utf-8"))
    splits = plan["splits"]
    sizes = {key: len(codes) for key, codes in splits.items()}
    codes = [code for group in splits.values() for code in group]
    if (
        sizes != {"train": 64, "validation": 16, "test": 16}
        or len(set(codes)) != 96
        or set(codes).intersection(plan["excluded_geometries"])
        or plan["primary_attempt_cap"] != 2016
        or plan["reynolds_numbers"] != [100000, 250000, 500000]
        or plan["angles_deg"] != list(range(-4, 9, 2))
        or plan["primary_panels"] != 160
        or plan["station_counts"] != [257]
    ):
        raise ValueError("frozen pressure dataset scope mismatch")
    for code in codes:
        parse_naca(code)
    return plan


def generate(executable, output, workers):
    plan = load_plan()
    config = load_config(SOLVER_CONFIG)
    executable = executable.resolve(strict=True)
    if sha256(executable) != config["executable_sha256"] or config["panel_nodes"] != plan["primary_panels"]:
        raise ValueError("XFOIL executable or panel count differs from the locked configuration")
    output = output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    (output / "plan.json").write_bytes(PLAN.read_bytes())
    (output / "solver-config.json").write_bytes(SOLVER_CONFIG.read_bytes())
    write_json(output / "provenance.json", {
        "version": plan["version"],
        "label_source": "XFOIL 6.99 viscous CPWR and PSAV",
        "solver_sha256": sha256(executable),
        "solver_source_archive_sha256": sha256(SOURCE),
        "plan_sha256": sha256(PLAN),
        "solver_config_sha256": sha256(SOLVER_CONFIG),
        "generator_sha256": sha256(Path(__file__)),
        "paired_evaluator_sha256": sha256(Path(__file__).with_name("run_pressure_pilot.py")),
        "python": sys.version.split()[0],
        "numpy": np.__version__,
    })

    for split, codes in plan["splits"].items():
        destination = output / split
        geometry_dir = destination / "geometries"
        geometry_dir.mkdir(parents=True)
        geometries, hashes = {}, {}
        for code in codes:
            geometry = generate_geometry(parse_naca(code), config["geometry_points_per_surface"])
            geometries[code] = geometry
            path = geometry_dir / f"{code}.dat"
            path.write_text(
                f"Pressure_{code}\n" + "".join(f"{x:.17g} {y:.17g}\n" for x, y in geometry.contour),
                encoding="ascii",
            )
            hashes[code] = sha256(path)
        if len({geometry.geometry_id for geometry in geometries.values()}) != len(codes):
            raise ValueError(f"duplicate canonical geometry in {split}")

        def solve(case):
            code, reynolds, alpha = case
            attempt_id = f"{code}-{reynolds}-{alpha:+d}"
            directory = destination / "raw" / attempt_id
            command = pressure_commands(config, f"../../geometries/{code}.dat", reynolds, alpha)
            raw = run_point(executable, directory, command, config["timeout_seconds"])
            if raw["launch_error"]:
                raise RuntimeError(f"could not launch XFOIL for {attempt_id}: {raw['launch_error']}")
            geometry = geometries[code]
            result, profiles, _ = evaluate_attempt(directory, raw, config, plan, case, geometry, f"Pressure_{code}")
            files = sorted(path for path in directory.iterdir() if path.is_file())
            row = {
                "id": attempt_id, "geometry_code": code, "geometry_id": geometry.geometry_id,
                "reynolds": reynolds, "alpha_deg": alpha, "geometry_sha256": hashes[code],
                "raw_sha256": {path.name: sha256(path) for path in files},
                "raw_bytes": sum(path.stat().st_size for path in files),
                **{key: raw[key] for key in ("elapsed_seconds", "returncode", "timed_out", "launch_error")},
                **result,
            }
            write_json(directory / "attempt.json", row)
            grid = [profiles[side] for side in SIDES] if row["pressure_eligible"] else None
            return row, grid

        cases = list(product(codes, plan["reynolds_numbers"], plan["angles_deg"]))
        eligible, grids = [], []
        with ThreadPoolExecutor(max_workers=workers) as pool, (destination / "attempts.jsonl").open("x", encoding="utf-8") as stream:
            for index, (row, grid) in enumerate(pool.map(solve, cases), 1):
                stream.write(json.dumps(row, allow_nan=False) + "\n")
                if grid is not None:
                    eligible.append(row)
                    grids.append(grid)
                if index % 84 == 0:
                    stream.flush()
                    print(f"{split}: {index}/{len(cases)} attempts recorded", flush=True)

        np.savez_compressed(
            destination / "profiles.npz",
            ids=np.array([row["id"] for row in eligible]),
            geometry_codes=np.array([row["geometry_code"] for row in eligible]),
            geometry_ids=np.array([row["geometry_id"] for row in eligible]),
            reynolds=np.array([row["reynolds"] for row in eligible]),
            alpha=np.array([row["alpha_deg"] for row in eligible]),
            station=(1 - np.cos(np.linspace(0, np.pi, 257))) / 2,
            profiles=np.asarray(grids, dtype=np.float64).reshape(-1, 2, 257, 3),
        )
        write_json(destination / "manifest.json", {
            "attempts": len(cases),
            "geometry_ids": {code: geometries[code].geometry_id for code in codes},
            "sha256": {name: sha256(destination / name) for name in ("attempts.jsonl", "profiles.npz")},
        })


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--xfoil", type=Path, default=ROOT / "tools/xfoil/xfoil.exe")
    parser.add_argument("--output", type=Path, default=DATA)
    parser.add_argument("--workers", type=int, choices=range(1, 5), default=4)
    args = parser.parse_args()
    generate(args.xfoil, args.output, args.workers)
