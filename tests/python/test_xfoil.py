"""Parser/failure tests use explicitly synthetic format fixtures, not training data."""
import gzip
import json
from pathlib import Path
import subprocess
import sys

import pytest

from aeroforge.xfoil import classify, commands, parse_polar, run_point, sha256
from aeroforge.pilot import load_config, run_pilot
from aeroforge.geometry import geometry_id, parse_naca

ROOT = Path(__file__).resolve().parents[2]
CONFIG = json.loads((ROOT / 'configs/pilot-v1.json').read_text())
SYNTHETIC = '''
 XFOIL         Version 6.99
 Calculated polar for: synthetic parser unit test only
 xtrf = 1.000 (top) 1.000 (bottom)
 Mach = 0.000 Re = 0.500 e 6 Ncrit = 9.000
 alpha CL CD CDp CM Top_Xtr Bot_Xtr
 ------ -------- --------- --------- -------- -------- --------
 4.000 0.7000 0.00800 0.00300 -0.0500 0.4000 0.9999
'''
WRITE_EVIDENCE = 'Point added to stored polar 1\nPoint written to save file polar.txt'


def quality(text=SYNTHETIC, stdout=WRITE_EVIDENCE, **kwargs):
    return classify(text, stdout, 0, CONFIG, 500000, 4, .02, **kwargs)


def test_parse_metadata_and_seven_column_contract():
    p = parse_polar(SYNTHETIC)
    assert (p.version, p.mach, p.reynolds, p.ncrit) == ('6.99', 0, 500000, 9)
    assert p.rows[0]['cl'] == .7
    assert p.rows[0]['cd'] == .008
    assert parse_polar(SYNTHETIC.replace('0.00800', '8.000D-03')).rows == p.rows
    assert quality()['eligible']


@pytest.mark.parametrize('text', ['', SYNTHETIC.replace('XFOIL', 'other'), SYNTHETIC.replace('0.7000', '*******'), SYNTHETIC.replace('0.7000 ', '')])
def test_malformed_polar_rejected(text):
    with pytest.raises(ValueError):
        parse_polar(text)
    assert not quality(text)['eligible']


@pytest.mark.parametrize('bad', ['NaN', 'Inf', '-Inf'])
def test_nonfinite_coefficients_never_enter_labels(bad):
    result = quality(SYNTHETIC.replace('0.7000', bad))
    assert not result['eligible']
    assert 'nonfinite_coefficient' in result['reasons']
    assert result['coefficients']['cl'] is None
    json.dumps(result, allow_nan=False)


def test_final_failure_is_different_from_recovered_internal_warning():
    assert not quality(stdout=WRITE_EVIDENCE + '\nVISCAL:  Convergence failed')['eligible']
    recovered = quality(stdout=WRITE_EVIDENCE + '\nMRCHDU: Convergence failed at 74 side 2')
    assert recovered['eligible'] and recovered['internal_marching_warning']
    assert not quality(stdout='')['eligible']
    assert not quality(stdout=WRITE_EVIDENCE + '\nInput not recognized')['eligible']


def test_missing_duplicate_mismatched_points_and_solver_settings():
    assert not quality(None)['eligible']
    assert not quality(SYNTHETIC.split('4.000')[0])['eligible']
    assert not quality(SYNTHETIC + SYNTHETIC.splitlines()[-1] + '\n')['eligible']
    for old, new in [('Version 6.99', 'Version 6.98'), ('0.500 e 6', '0.100 e 6'),
                     ('Mach = 0.000', 'Mach = 0.100'), ('Ncrit = 9.000', 'Ncrit = 8.000'),
                     ('xtrf = 1.000', 'xtrf = 0.500'), ('4.000', '3.000')]:
        assert not quality(SYNTHETIC.replace(old, new))['eligible']


def test_process_failures_cannot_be_overridden_by_a_polar_row():
    assert not quality(timed_out=True)['eligible']
    assert not quality(launch_error='not found')['eligible']
    assert not classify(SYNTHETIC, WRITE_EVIDENCE, 1, CONFIG, 500000, 4, .02)['eligible']


@pytest.mark.parametrize('old,new,warning', [('0.00800', '-0.0080', 'nonphysical_drag'),
    ('0.7000', '4.0000', 'extreme_coefficient'), ('0.4000', '1.4000', 'invalid_transition_location')])
def test_suspicious_finite_outputs_flagged_and_excluded(old, new, warning):
    result = quality(SYNTHETIC.replace(old, new))
    assert result['converged'] and result['status'] == 'suspect' and not result['eligible']
    assert warning in result['warnings']


def test_stall_risk_is_not_physical_validation():
    result = classify(SYNTHETIC.replace('4.000', '12.000'), WRITE_EVIDENCE, 0, CONFIG, 500000, 12, .02)
    assert result['converged'] and not result['eligible']
    assert 'unvalidated_stall_region' in result['warnings']


def test_command_stream_explicit_configuration_and_single_point():
    text = commands(CONFIG, '../../geometries/g00.dat', 100000, -4)
    assert 'PPAR\nN 160' in text
    assert 'XB 1 1\n\n\nPANE' in text
    assert 'ITER 150\nVPAR\nN 9\nXTR 1 1' in text
    assert text.count('ALFA') == 1 and 'ALFA -4' in text
    assert 'PACC\npolar.txt\n\n' in text
    with pytest.raises(ValueError):
        commands(CONFIG, 'file\nQUIT', 100000, 0)


def test_configuration_deduplicates_canonical_geometries(tmp_path):
    assert len(load_config(ROOT / 'configs/pilot-v1.json')['geometry_codes']) == 20
    c = dict(CONFIG, geometry_codes=['0012', '0412'])
    path = tmp_path / 'config.json'
    path.write_text(json.dumps(c))
    with pytest.raises(ValueError, match='duplicate'):
        load_config(path)
    c['geometry_codes'] = ['0012']; c['angles_deg'] = [0, 0]
    path.write_text(json.dumps(c))
    with pytest.raises(ValueError, match='duplicate'):
        load_config(path)


def test_run_point_launch_error_and_no_overwrite(tmp_path):
    output = tmp_path / 'attempt'
    result = run_point(tmp_path / 'does-not-exist', output, 'QUIT\n', 1)
    assert result['launch_error']
    assert (output / 'commands.in').read_text() == 'QUIT\n'
    assert gzip.decompress((output / 'stdout.txt.gz').read_bytes()) == b''
    with pytest.raises(FileExistsError):
        run_point(tmp_path / 'does-not-exist', output, 'QUIT\n', 1)


def test_run_point_timeout_retains_partial_output(tmp_path, monkeypatch):
    def timeout(*args, **kwargs):
        raise subprocess.TimeoutExpired('synthetic process unit test', 1, output=b'partial log')
    monkeypatch.setattr(subprocess, 'run', timeout)
    output = tmp_path / 'timeout'
    result = run_point(Path(sys.executable), output, 'QUIT\n', 1)
    assert result['timed_out']
    assert gzip.decompress((output / 'stdout.txt.gz').read_bytes()) == b'partial log'


def test_committed_real_pilot_traceability():
    root = ROOT / 'data/pilot-v1'
    assert (root / 'quality-report.json').exists(), 'committed real pilot evidence is required'
    import pandas as pd
    records = [json.loads(line) for line in (root / 'attempts.jsonl').read_text().splitlines()]
    report = json.loads((root / 'quality-report.json').read_text())
    manifest = json.loads((root / 'manifest.json').read_text())
    config = load_config(root / 'config.json')
    assert report['acceptance_passed']
    assert len(records) == 280
    assert len({r['geometry_id'] for r in records}) == 20
    assert len({(r['geometry_id'], r['reynolds'], r['alpha_deg']) for r in records}) == len(records)
    assert manifest['config_sha256'] == sha256(root / 'config.json')
    for name, digest in report['artifact_hashes'].items():
        assert sha256(root / name) == digest
    for record in records:
        parameters = parse_naca(record['geometry_code'])
        assert record['geometry_id'] == geometry_id(parameters)
        assert (record['m'], record['p'], record['t']) == (parameters.m, parameters.p, parameters.t)
        assert record['solver_sha256'] == manifest['solver_sha256']
        assert record['config_sha256'] == manifest['config_sha256']
        assert sha256(root / record['geometry_file']) == record['geometry_sha256']
        directory = root / record['raw_directory']
        for name, digest in record['artifact_hashes'].items():
            assert sha256(directory / name) == digest
        stdout = gzip.decompress((directory / 'stdout.txt.gz').read_bytes()).decode('ascii', errors='replace')
        polar = (directory / 'polar.txt').read_text() if (directory / 'polar.txt').exists() else None
        actual = classify(polar, stdout, record['returncode'], config, record['reynolds'], record['alpha_deg'], record['m'], record['timed_out'], record['launch_error'])
        assert actual['eligible'] == record['eligible']
        assert actual['coefficients'] == record['coefficients']
    labels = pd.read_parquet(root / 'labels.parquet')
    assert len(labels) == sum(r['eligible'] for r in records) == report['eligible']
    assert set(labels.attempt_id) == {r['attempt_id'] for r in records if r['eligible']}
    assert all(labels.cd > 0)
    assert all(labels.alpha_deg < 10)
    lookup = {r['attempt_id']: r for r in records}
    for row in labels.itertuples():
        expected = lookup[row.attempt_id]
        assert (row.cl, row.cd) == (expected['coefficients']['cl'], expected['coefficients']['cd'])
    pd.testing.assert_frame_equal(labels, pd.read_csv(root / 'labels.csv', dtype={'solver_version': str}))
    for repeat in report['repeat_checks']:
        original = lookup[repeat['attempt_id']]
        directory = root / repeat['raw_directory']
        result = classify((directory / 'polar.txt').read_text(),
                          gzip.decompress((directory / 'stdout.txt.gz').read_bytes()).decode('ascii', errors='replace'),
                          0, config, original['reynolds'], original['alpha_deg'], original['m'])
        assert result['eligible'] and result['coefficients'] == original['coefficients']
    assert pd.read_parquet(root / 'attempts.parquet').shape[0] == len(records)


def test_pilot_refuses_unpinned_binary_and_existing_output(tmp_path):
    fake = tmp_path / 'not-a-solver.exe'
    fake.write_bytes(b'synthetic hash-guard unit test; never executed')
    output = tmp_path / 'output'
    with pytest.raises(ValueError, match='hash mismatch'):
        run_pilot(ROOT / 'configs/pilot-v1.json', fake, output)
    assert not output.exists()
    c = dict(CONFIG, executable_sha256=sha256(fake))
    config = tmp_path / 'config.json'
    config.write_text(json.dumps(c))
    output.mkdir()
    with pytest.raises(FileExistsError):
        run_pilot(config, fake, output)
    assert list(output.iterdir()) == []
