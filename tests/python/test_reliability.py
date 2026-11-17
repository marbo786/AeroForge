import hashlib
import json
from pathlib import Path
import subprocess
import sys

import pandas as pd
import pytest


ROOT = Path(__file__).resolve().parents[2]
RECOVERY = ROOT / "artifacts/recovery-v1-complete"
EVIDENCE = ROOT / "artifacts/reliability-v1"


def test_coverage_index_has_exactly_the_frozen_training_rows():
    train_path = RECOVERY / "train.parquet"
    train = pd.read_parquet(train_path)
    frame = train[["m", "p", "t", "alpha_deg", "reynolds"]]
    index_path = EVIDENCE / "coverage-v1.json"
    index = json.loads(index_path.read_bytes())
    summary = json.loads((EVIDENCE / "summary.json").read_bytes())
    model = json.loads((RECOVERY / "model.json").read_bytes())
    assert index["training_sha256"] == summary["training_sha256"] == hashlib.sha256(train_path.read_bytes()).hexdigest()
    assert index["model_sha256"] == summary["model_sha256"] == model["model_sha256"]
    assert summary["coverage_sha256"] == hashlib.sha256(index_path.read_bytes()).hexdigest()
    actual = [
        (m, p, t, alpha, re)
        for m, p, t, conditions in index["groups"]
        for alpha, re in conditions
    ]
    assert sorted(actual) == sorted(frame.itertuples(index=False, name=None))
    assert len(index["groups"]) == summary["training_geometries"] == train.geometry_id.nunique()
    assert len(actual) == len(set(actual)) == summary["training_rows"]


def test_reliability_audit_reproduces_frozen_mae_slices_and_threshold(tmp_path):
    run = subprocess.run(
        [sys.executable, str(ROOT / "scripts/audit_reliability.py"), "--output", str(tmp_path)],
        cwd=ROOT, capture_output=True, text=True, timeout=60,
    )
    assert run.returncode == 0, run.stderr
    replay = json.loads((tmp_path / "diagnostics.json").read_bytes())
    expected = json.loads((EVIDENCE / "diagnostics.json").read_bytes())
    final = replay["final"]
    model_report = json.loads((RECOVERY / "final-evaluation.json").read_bytes())
    assert replay["hashes"] == expected["hashes"]
    assert replay["coverage_comparison"]["geometry_and_flow"]["threshold"] == pytest.approx(1 / 3)
    assert (tmp_path / "coverage-v1.json").read_bytes() == (EVIDENCE / "coverage-v1.json").read_bytes()
    assert final["attempted"] - final["eligible"] == len(final["excluded"]) == 3
    for target, values in final["overall"].items():
        assert values["mae"] == pytest.approx(model_report["selected_metrics"][target]["mae"], abs=1e-6)
        assert values["bias"] == pytest.approx(expected["final"]["overall"][target]["bias"], abs=1e-6)
    assert len(final["slices"]) == 8
    for axis, rows in final["slices"].items():
        assert sum(row["eligible"] for row in rows) == final["eligible"]
        if axis.startswith("xfoil_"):
            assert all(row["attempted"] is None for row in rows)
        else:
            assert sum(row["attempted"] for row in rows) == final["attempted"]
