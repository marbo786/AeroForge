import gzip
import json
from pathlib import Path

import numpy as np
import pytest

from aeroforge.geometry import generate_geometry, parse_naca
from aeroforge.pressure import (
    numeric_rows, pair_panels, parse_pressure, pressure_branches, pressure_forces, resample_branch,
)
from aeroforge.xfoil import sha256
from scripts.run_pressure_pilot import evaluate_attempt, plan_cases, pressure_commands

ROOT = Path(__file__).resolve().parents[2]
PILOT = ROOT / "data/pressure-pilot-v1"
CASE = PILOT / "primary-6618-500000-+8"


def read_json(path):
    return json.loads(path.read_bytes())


def test_pressure_pairing_checks_both_coordinates_traversal_and_uniqueness():
    panels = numeric_rows((CASE / "panels.dat").read_text().splitlines(), 2)
    dump = parse_pressure((CASE / "pressure.dat").read_text())
    assert dump.name == "Pressure_6618"
    assert (dump.alpha, dump.reynolds) == (8, 500000)
    assert pair_panels(panels, dump.samples, 160, 5.51e-6) <= 5.51e-6
    with pytest.raises(ValueError, match="traversal"):
        pair_panels(panels, dump.samples[::-1], 160, 5.51e-6)
    with pytest.raises(ValueError, match="panel count"):
        pair_panels(panels, dump.samples[:-1], 160, 5.51e-6)
    corrupt = dump.samples.copy()
    corrupt[30, 1] += 0.01
    with pytest.raises(ValueError, match="traversal"):
        pair_panels(panels, corrupt, 160, 5.51e-6)
    duplicates = panels.copy()
    duplicates[1] = duplicates[0]
    corrupt = dump.samples.copy()
    corrupt[1, :2] = corrupt[0, :2]
    with pytest.raises(ValueError, match="ambiguous"):
        pair_panels(duplicates, corrupt, 160, 5.51e-6)
    with pytest.raises(ValueError, match="nonfinite"):
        parse_pressure("case\nAlfa = 4 Re = 100000 Xflap,Yflap = 0 0\n# x y Cp\n1 0 NaN\n0 0 1\n1 0 1")


def test_surface_arc_from_ordered_geometry_retains_the_nose_and_trailing_edge():
    geometry = generate_geometry(parse_naca("6618"))
    panels = numeric_rows((CASE / "panels.dat").read_text().splitlines(), 2)
    dump = parse_pressure((CASE / "pressure.dat").read_text())
    branches, notes = pressure_branches(panels, dump.samples[:, 2], geometry, 0.0004)
    assert notes["minimum_panel_x"] < 0
    assert notes["interpolated_shared_le"]
    assert notes["upper_raw_count"] + notes["lower_raw_count"] == len(panels)
    upper, lower = branches["upper"], branches["lower"]
    np.testing.assert_array_equal(upper[0], lower[0])
    np.testing.assert_array_equal(upper[-1, :2], panels[0])
    np.testing.assert_array_equal(lower[-1, :2], panels[-1])
    assert not np.array_equal(upper[-1, :2], lower[-1, :2])
    for branch in (upper, lower):
        grid, error = resample_branch(branch, 257)
        assert grid.shape == (257, 3)
        np.testing.assert_array_equal(grid[[0, -1]], branch[[0, -1]])
        assert error["all"]["mae"] < 0.002
    with pytest.raises(ValueError, match="analytic contour"):
        pressure_branches(panels[::-1], dump.samples[::-1, 2], geometry, 0.0004)


def test_closed_contour_force_integration_has_expected_sign_and_pressure_offset_invariance():
    panels = np.array([[1.0, 0.1], [0.0, 0.1], [0.0, -0.1], [1.0, -0.1]])
    cp = np.array([-1.0, -1.0, 1.0, 1.0])
    forces = pressure_forces(panels, cp, 0)
    assert forces == pytest.approx({"cl": 2, "cm": -0.5, "integrated_pressure_drag": 0})
    assert pressure_forces(panels, cp + 0.3, 0) == pytest.approx(forces)


@pytest.mark.parametrize("damage,reason", [("flow", "CPWR case metadata mismatch"),
                                          ("cp", "pressure_force_mismatch")])
def test_aligned_but_stale_or_wrong_pressure_cannot_enter_labels(tmp_path, damage, reason):
    (tmp_path / "panels.dat").write_bytes((CASE / "panels.dat").read_bytes())
    cp = (CASE / "pressure.dat").read_text()
    if damage == "flow":
        cp = cp.replace("500000.000", "250000.000")
    else:
        lines = cp.splitlines()
        cp = "\n".join(lines[:3] + [" ".join([*line.split()[:2], "0.00000"]) for line in lines[3:]])
    (tmp_path / "pressure.dat").write_text(cp)
    raw = {
        "stdout": gzip.decompress((CASE / "stdout.txt.gz").read_bytes()).decode("ascii", errors="replace"),
        "polar_text": (CASE / "polar.txt").read_text(),
        "returncode": 0, "timed_out": False, "launch_error": None,
    }
    result, _, _ = evaluate_attempt(
        tmp_path, raw, read_json(PILOT / "solver-config.json"), read_json(PILOT / "plan.json"),
        ("6618", 500000, 8), generate_geometry(parse_naca("6618")), "Pressure_6618",
    )
    assert result["polar"]["eligible"]
    assert not result["pressure_eligible"]
    assert reason in result["pressure_reasons"]


def test_committed_pressure_pilot_replays_every_attempt_without_solver_execution():
    plan = read_json(PILOT / "plan.json")
    config = read_json(PILOT / "solver-config.json")
    provenance = read_json(PILOT / "provenance.json")
    report = read_json(PILOT / "report.json")
    assert sha256(PILOT / "plan.json") == provenance["plan_sha256"]
    assert sha256(PILOT / "solver-config.json") == provenance["solver_config_sha256"]
    for name, digest in report["derived_sha256"].items():
        assert sha256(PILOT / name) == digest
    rows = [json.loads(line) for line in (PILOT / "attempts.jsonl").read_text().splitlines()]
    primary, diagnostics = plan_cases(plan)
    assert len(rows) == len(primary) + 2 * len(diagnostics) == 30
    assert sum(row["pressure_eligible"] for row in rows if row["role"] == "primary") == 22
    assert all(report["eligible_by_geometry_re"].values())
    assert report["feasibility_floor_passed"]

    with np.load(PILOT / "primary-profiles.npz", allow_pickle=False) as package:
        assert package["profiles"].shape == (22, 2, 257, 3)
        assert np.all(np.diff(package["station"]) > 0)
        stored = dict(zip(package["ids"], package["profiles"]))
    parsed = {}
    for row in rows:
        directory = PILOT / row["id"]
        file = f'naca-{row["geometry_code"]}.dat'
        assert sha256(PILOT / file) == row["geometry_sha256"]
        assert {path.name: sha256(path) for path in directory.iterdir()} == row["raw_sha256"]
        config["panel_nodes"] = row["requested_panels"]
        code, reynolds, alpha = case = row["geometry_code"], row["reynolds"], row["alpha_deg"]
        assert (directory / "commands.in").read_text() == pressure_commands(config, f"../{file}", reynolds, alpha)
        raw = {
            **row,
            "stdout": gzip.decompress((directory / "stdout.txt.gz").read_bytes()).decode("ascii", errors="replace"),
            "polar_text": (directory / "polar.txt").read_text(),
        }
        result, profiles, samples = evaluate_attempt(
            directory, raw, config, plan, case, generate_geometry(parse_naca(code)), f"Pressure_{code}",
        )
        assert result["pressure_eligible"] is row["pressure_eligible"]
        assert result["pressure_reasons"] == row["pressure_reasons"]
        assert result["panel_count"] == row["requested_panels"]
        parsed[row["id"]] = samples
        if row["role"] == "primary" and row["pressure_eligible"]:
            np.testing.assert_allclose(stored[row["id"]], [profiles["upper"], profiles["lower"]], atol=1e-12)
        else:
            assert row["id"] not in stored
    for pair in report["comparisons"]:
        assert pair["repeat_matches_printed_precision"]
        np.testing.assert_array_equal(parsed[pair["primary"]], parsed[pair["repeat"]])
