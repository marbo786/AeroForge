from copy import deepcopy
import gzip
import json
from pathlib import Path

import pytest

from scripts import verify_shortlist as verifier

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data/recovery-v1/final-locked/raw/a0000"


@pytest.fixture
def shortlist():
    model = verifier.read_json(verifier.MODEL_PATH)
    index = verifier.read_json(verifier.COVERAGE_PATH)
    policy = verifier.read_json(verifier.POLICY_PATH)
    digest = verifier.sha256(verifier.COVERAGE_PATH)
    value = {"m": 0, "p": 0, "t": 0.1, "alpha": -4, "re": 100000}
    candidate = {
        "design": value, "prediction": {"cl": -0.49, "cd": 0.014}, "score": -0.49,
        "distance": verifier.coverage_distance(value, index, verifier.bounds(model)),
    }
    payload = {
        "schema": "aeroforge-optimizer-v1", "policy": policy["version"], "status": "finished",
        "model": {"version": model["version"], "sha256": model["model_sha256"]},
        "coverage": {"version": policy["coverage_version"], "sha256": digest},
        "original": deepcopy(value),
        "settings": {
            "objective": "lift", "algorithm": "differential-evolution", "re": 100000,
            "ranges": {"m": [0, 0.06], "p": [0.2, 0.6], "t": [0.08, 0.18], "alpha": [-4, -4]},
            "minimumLift": 0.7, "evaluations": 1, "seed": 42,
        },
        "result": {
            "baseline": None, "shortlist": [candidate],
            "history": [{"evaluated": 1, "score": candidate["score"]}],
            "counts": {
                "attempted": 1, "duplicate": 0, "sparse": 0, "submitted": 1,
                "completed": 1, "rejected": 0, "feasible": 1, "baselineRows": 0,
            },
        },
    }
    return payload, model, policy, index, digest


def test_shortlist_validation_checks_provenance_constraints_and_objective(shortlist):
    payload, *inputs = shortlist
    assert verifier.validate_export(payload, *inputs)[1][0]["id"] == "candidate-1"
    for mutation, error in [
        (lambda value: value["coverage"].update(sha256="wrong"), "version"),
        (lambda value: value["result"]["shortlist"][0]["design"].update(t=0.19), "between"),
        (lambda value: value["result"]["shortlist"][0].update(score=1), "rank"),
        (lambda value: value["result"]["shortlist"][0]["prediction"].update(cd=1e-7), "screening"),
        (lambda value: value["result"]["counts"].update(submitted=2), "counts"),
    ]:
        changed = deepcopy(payload)
        mutation(changed)
        with pytest.raises(ValueError, match=error):
            verifier.validate_export(changed, *inputs)


def test_xfoil_replay_uses_real_polar_fixture_and_excludes_rejected_rows(shortlist, tmp_path, monkeypatch):
    payload, model, *inputs = shortlist
    settings, [case] = verifier.validate_export(payload, model, *inputs)
    replay_stdout = gzip.decompress((RAW / "stdout.txt.gz").read_bytes()).decode("ascii", errors="replace")
    polar = (RAW / "polar.txt").read_text(encoding="ascii")
    rejected = False

    def fake_run(_exe, directory, command, _timeout):
        directory.mkdir()
        (directory / "commands.in").write_text(command, encoding="ascii")
        (directory / "panels.dat").write_bytes((RAW / "panels.dat").read_bytes())
        return {
            "polar_text": polar if not rejected else None, "stdout": replay_stdout,
            "timed_out": False, "launch_error": None, "returncode": 0, "elapsed_seconds": 0.1,
        }

    monkeypatch.setattr(verifier, "run_point", fake_run)
    config = verifier.read_json(verifier.CONFIG_PATH)
    first = verifier.solve_case(case, settings, verifier.bounds(model), config, Path("xfoil"), tmp_path)
    assert first["eligible"]
    assert first["solver"] == {"cl": -0.4996, "cd": 0.01399}
    assert first["residual_predicted_minus_xfoil"]["cl"] == pytest.approx(0.0096)
    assert len(first["raw_sha256"]["commands.in"]) == 64
    rejected = True
    second = verifier.solve_case({**case, "id": "candidate-2"}, settings, verifier.bounds(model), config, Path("xfoil"), tmp_path)
    assert not second["eligible"] and second["solver"] is None
    verifier.ranks([first, second])
    assert first["solver_rank"] == 1
    assert second["solver_rank"] is None
    assert "missing_polar" in second["reasons"]


def test_solver_rank_reports_reversal_and_lift_constraint_failure():
    settings = {"objective": "drag", "minimumLift": 0.8}
    records = [
        {"id": "candidate-1", "predicted_score": -0.01, "solver_score": -0.013},
        {"id": "candidate-2", "predicted_score": -0.011, "solver_score": -0.012},
        {"id": "candidate-3", "predicted_score": -0.012, "solver_score": verifier.score({"cl": 0.799, "cd": 0.009}, settings)},
    ]
    verifier.ranks(records)
    assert [row["rank_change"] for row in records] == [1, -1, None]
