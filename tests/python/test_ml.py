import json
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import pandas as pd
import pytest
import torch

from aeroforge.ml import (ExportWrapper, digest, feature_matrix, fit_scalers, make_mlp,
                         metrics, score, split_dataset)

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / 'artifacts/pilot-surrogate-v1'
CONFIG = json.loads((ROOT / 'configs/training-v1.json').read_text())


def dataset():
    return pd.read_parquet(ROOT / CONFIG['dataset']).sort_values('attempt_id').reset_index(drop=True)


def test_geometry_disjoint_partition_and_canonical_features():
    partitions = split_dataset(dataset(), CONFIG)
    groups = [set(p.geometry_id) for p in partitions.values()]
    assert list(map(len, groups)) == [14, 3, 3]
    assert not (groups[0] & groups[1] or groups[0] & groups[2] or groups[1] & groups[2])
    assert sum(map(len, partitions.values())) == 227
    assert split_dataset(dataset().sample(frac=1, random_state=4), CONFIG)['test'].geometry_id.nunique() == 3
    x = feature_matrix(dataset())
    assert x.dtype == np.float32 and x.shape == (227, 5)
    assert (x[x[:, 0] == 0, 1] == 0).all()
    assert set(x[:, 4]) == {np.float32(5), np.float32(np.log10(500000))}


def test_split_rejects_leakage_and_duplicates():
    bad = dict(CONFIG, test_codes=CONFIG['validation_codes'])
    with pytest.raises(ValueError, match='overlapping'):
        split_dataset(dataset(), bad)
    with pytest.raises(ValueError, match='duplicate'):
        split_dataset(pd.concat([dataset(), dataset().iloc[:1]]), CONFIG)


def test_feature_validation_and_symmetric_canonicalization():
    sample = dataset().iloc[:1].copy()
    sample.loc[:, 'm'] = 0; sample.loc[:, 'p'] = .6
    assert feature_matrix(sample)[0, 1] == 0
    sample.loc[:, 'reynolds'] = 1000000
    with pytest.raises(ValueError):
        feature_matrix(sample)
    sample.loc[:, 'reynolds'] = 100000; sample.loc[:, 'alpha_deg'] = 12
    with pytest.raises(ValueError):
        feature_matrix(sample)


def test_preprocessing_fit_uses_only_training_partition():
    train = split_dataset(dataset(), CONFIG)['train']
    actual = fit_scalers(train)
    stored = json.loads((ARTIFACTS / 'preprocessing.json').read_text())
    for key in actual:
        np.testing.assert_array_equal(actual[key], np.asarray(stored[key], np.float32))
    np.testing.assert_allclose(actual['x_mean'], feature_matrix(train).astype(np.float64).mean(0), atol=1e-7)
    assert stored['fit_partition'] == 'train' and stored['embedded_in_onnx']


def test_selection_is_validation_only_and_accuracy_failure_not_hidden():
    selection = json.loads((ARTIFACTS / 'selection.json').read_text())
    evaluation = json.loads((ARTIFACTS / 'evaluation.json').read_text())
    model = json.loads((ARTIFACTS / 'model.json').read_text())
    best = min(selection['finalists'], key=lambda name: selection['finalists'][name]['validation_score'])
    assert selection['selected_family'] == evaluation['selected_family'] == best
    assert not selection['test_used_for_selection'] and not evaluation['test_used_for_selection']
    assert model['research_only'] and not model['accuracy_targets_passed']
    assert not model['domain']['continuous_domain_validated']
    assert score(selection['finalists'][best]['validation_metrics'], CONFIG) == selection['finalists'][best]['validation_score']


@pytest.mark.parametrize('family', ['ridge', 'forest', 'mlp'])
def test_real_onnx_models_check_and_match_source_golden(family):
    path = ARTIFACTS / f'{family}.onnx'
    onnx.checker.check_model(onnx.load(path))
    golden = json.loads((ARTIFACTS / 'golden.json').read_text())
    x = np.asarray(golden['features'], np.float32)
    opts = ort.SessionOptions(); opts.intra_op_num_threads = 1
    session = ort.InferenceSession(str(path), opts, providers=['CPUExecutionProvider'])
    output = session.run(None, {'features': x})[0]
    expected = np.asarray(golden['expected'][family], np.float32)
    assert output.shape == (len(x), 2) and np.isfinite(output).all() and (output[:, 1] > 0).all()
    assert np.max(np.abs(output - expected)) < 1e-5
    np.testing.assert_allclose(session.run(None, {'features': x[:1]})[0], output[:1], rtol=0, atol=1e-5)
    np.testing.assert_array_equal(session.run(None, {'features': x})[0], output)


def test_saved_pytorch_checkpoint_reproduces_export_in_original_coefficient_units():
    checkpoint = torch.load(ARTIFACTS / 'mlp.pt', map_location='cpu', weights_only=True)
    core = make_mlp(checkpoint['hidden']); core.load_state_dict(checkpoint['state_dict']); core.eval()
    preprocessing = json.loads((ARTIFACTS / 'preprocessing.json').read_text())
    scalers = {key: np.asarray(preprocessing[key], np.float32) for key in ('x_mean', 'x_scale', 'y_mean', 'y_scale')}
    golden = json.loads((ARTIFACTS / 'golden.json').read_text())
    x = np.asarray(golden['features'], np.float32)
    with torch.no_grad():
        output = ExportWrapper(core, scalers)(torch.from_numpy(x)).numpy()
    assert np.max(np.abs(output - np.asarray(golden['expected']['mlp'], np.float32))) < 1e-5
    assert np.max(np.abs(output - ort.InferenceSession(str(ARTIFACTS / 'mlp.onnx'), providers=['CPUExecutionProvider']).run(None, {'features': x})[0])) < 1e-5


def test_metadata_artifact_hashes_and_reported_native_metrics():
    model = json.loads((ARTIFACTS / 'model.json').read_text())
    report = json.loads((ARTIFACTS / 'evaluation.json').read_text())
    assert digest(ROOT / CONFIG['dataset']) == model['dataset_sha256']
    assert digest(ARTIFACTS / model['model_file']) == model['model_sha256']
    assert digest(ARTIFACTS / 'preprocessing.json') == model['preprocessing_sha256']
    assert digest(ARTIFACTS / 'training-config.json') == model['training_config_sha256']
    test = split_dataset(dataset(), CONFIG)['test']
    golden = json.loads((ARTIFACTS / 'golden.json').read_text())
    positions = dataset().index[dataset().attempt_id.isin(test.attempt_id)]
    for family, result in report['models'].items():
        assert digest(ARTIFACTS / f'{family}.onnx') == result['onnx_sha256']
        assert result['onnx_agreement_passed']
        assert result['source_single_row_latency']['p95_ms'] >= result['source_single_row_latency']['p50_ms']
        assert result['onnx_single_row_latency']['p50_ms'] > 0
        expected = np.asarray(golden['expected'][family], np.float32)[positions]
        observed = metrics(test[['cl', 'cd']].to_numpy(np.float32), expected)
        for target in ('cl', 'cd'):
            for metric in ('mae', 'rmse', 'r2'):
                assert abs(observed[target][metric] - result['test'][target][metric]) < 1e-6
    assert (ARTIFACTS / model['model_file']).stat().st_size < 1_000_000
