"""Reproducible bounded pilot, raw evidence, traceable labels and quality report."""
from dataclasses import asdict
from datetime import datetime, timezone
import json
from pathlib import Path
import platform
import statistics
import time

from .geometry import SCHEMA_VERSION, generate_geometry, parse_naca
from .xfoil import classify, commands, run_point, sha256


def load_config(path: Path) -> dict:
    config = json.loads(path.read_text())
    # This pilot is deliberately bounded and uses a single explicit solver setup.
    if config['mode'] != 'viscous' or config['solver_version'] != '6.99':
        raise ValueError('unsupported pilot solver mode/version')
    if config['mach'] != 0 or config['ncrit'] != 9 or config['xtr_top'] != 1 or config['xtr_bottom'] != 1:
        raise ValueError('pilot must retain the documented transition and incompressible settings')
    if config['panel_nodes'] != 160 or config['geometry_points_per_surface'] != 201 or config['iteration_limit'] != 150:
        raise ValueError('pilot discretization and iteration settings must match pilot-v1')
    if not 0 < config['timeout_seconds'] <= 30:
        raise ValueError('bounded process timeout required')
    codes, reynolds, angles = config['geometry_codes'], config['reynolds_numbers'], config['angles_deg']
    if not codes or len(codes) > 20 or not reynolds or not angles or len(codes) * len(reynolds) * len(angles) > 500:
        raise ValueError('pilot must have 1-20 geometries and at most 500 attempts')
    ids = [generate_geometry(parse_naca(code), 3).geometry_id for code in codes]
    if len(set(ids)) != len(ids) or len(set(reynolds)) != len(reynolds) or len(set(angles)) != len(angles):
        raise ValueError('duplicate geometry or operating point in pilot plan')
    if any(isinstance(re, bool) or not isinstance(re, int) or not 100000 <= re <= 1000000 for re in reynolds):
        raise ValueError('Reynolds outside candidate bounds')
    if any(isinstance(a, bool) or not isinstance(a, (int, float)) or not -4 <= a <= 12 for a in angles):
        raise ValueError('angle outside candidate bounds')
    return config


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + '\n', encoding='utf-8')


def run_pilot(config_path: Path, executable: Path, output: Path) -> dict:
    import pandas as pd
    import pyarrow

    config = load_config(config_path)
    executable = executable.resolve(strict=True)
    if sha256(executable) != config['executable_sha256']:
        raise ValueError('solver executable hash mismatch; approve and document any different build')
    output = output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    (output / 'geometries').mkdir()
    (output / 'config.json').write_bytes(config_path.read_bytes())
    config_hash = sha256(output / 'config.json')
    manifest = {'schema_version': config['schema_version'], 'label_source': 'XFOIL viscous solver',
                'created_utc': datetime.now(timezone.utc).isoformat(),
                'solver_version': config['solver_version'], 'solver_sha256': sha256(executable),
                'solver_archive_url': 'https://web.mit.edu/drela/Public/web/xfoil/XFOIL6.99.zip',
                'solver_archive_sha256': 'e13e8fe5cc38d8ac2626e9d3b17643bdcfaa63791619f042afdaa7cd103bcb08',
                'geometry_schema': SCHEMA_VERSION, 'config_sha256': config_hash,
                'python_version': platform.python_version(), 'platform': platform.platform(),
                'pandas_version': pd.__version__, 'pyarrow_version': pyarrow.__version__,
                'license_note': 'XFOIL is GPL; executable/archive are local tools, not redistributed in this dataset.'}
    write_json(output / 'manifest.json', manifest)
    records = []
    start = time.perf_counter()
    for gi, code in enumerate(config['geometry_codes']):
        geometry = generate_geometry(parse_naca(code), config['geometry_points_per_surface'])
        geometry_path = output / f'geometries/g{gi:02d}.dat'
        geometry_path.write_text(f'AeroForge_{code}\n' + ''.join(f'{x:.17g} {y:.17g}\n' for x, y in geometry.contour), encoding='ascii')
        for reynolds in config['reynolds_numbers']:
            for alpha in config['angles_deg']:
                attempt_id = f'a{len(records):04d}'
                directory = output / 'raw' / attempt_id
                command_text = commands(config, f'../../geometries/g{gi:02d}.dat', reynolds, alpha)
                raw = run_point(executable, directory, command_text, config['timeout_seconds'])
                quality = classify(raw['polar_text'], raw['stdout'], raw['returncode'], config,
                                   reynolds, alpha, geometry.parameters.m, raw['timed_out'], raw['launch_error'])
                panel_file = directory / 'panels.dat'
                if not panel_file.exists() or len(panel_file.read_text().splitlines()) != config['panel_nodes']:
                    quality['reasons'].append('panel_geometry_missing_or_wrong_count')
                    quality.update(status='rejected', converged=False, eligible=False)
                record = {'attempt_id': attempt_id, 'geometry_code': code, 'geometry_id': geometry.geometry_id,
                          **asdict(geometry.parameters), 'reynolds': reynolds, 'alpha_deg': alpha,
                          'solver_version': config['solver_version'], 'solver_sha256': manifest['solver_sha256'],
                          'config_sha256': config_hash, 'geometry_file': str(geometry_path.relative_to(output)).replace('\\', '/'),
                          'geometry_sha256': sha256(geometry_path), 'raw_directory': f'raw/{attempt_id}',
                          'elapsed_seconds': raw['elapsed_seconds'], 'returncode': raw['returncode'],
                          'timed_out': raw['timed_out'], 'launch_error': raw['launch_error'], **quality,
                          'artifact_hashes': {path.name: sha256(path) for path in sorted(directory.iterdir()) if path.is_file()}}
                records.append(record)
                # Persist each attempted point immediately, including failure metadata.
                with (output / 'attempts.jsonl').open('a', encoding='utf-8') as stream:
                    stream.write(json.dumps(record, allow_nan=False) + '\n')
        print(f'{gi + 1}/{len(config["geometry_codes"])} geometries; {len(records)} attempts; '
              f'{sum(r["eligible"] for r in records)} eligible', flush=True)
    eligible = [r for r in records if r['eligible']]
    labels = [{key: r[key] for key in ('attempt_id', 'geometry_id', 'm', 'p', 't', 'reynolds', 'alpha_deg',
                                      'solver_version', 'solver_sha256', 'config_sha256', 'geometry_sha256', 'raw_directory')}
              | {key: r['coefficients'][key] for key in ('cl', 'cd')} for r in eligible]
    columns = ['attempt_id', 'geometry_id', 'm', 'p', 't', 'reynolds', 'alpha_deg', 'solver_version',
               'solver_sha256', 'config_sha256', 'geometry_sha256', 'raw_directory', 'cl', 'cd']
    frame = pd.DataFrame(labels, columns=columns)
    frame.to_parquet(output / 'labels.parquet', index=False, engine='pyarrow')
    frame.to_csv(output / 'labels.csv', index=False)
    pd.DataFrame(records).to_parquet(output / 'attempts.parquet', index=False, engine='pyarrow')
    repeat_results = []
    for record in eligible[:config['acceptance']['reproducibility_checks']]:
        gi = config['geometry_codes'].index(record['geometry_code'])
        directory = output / 'repeat' / record['attempt_id']
        raw = run_point(executable, directory, commands(config, f'../../geometries/g{gi:02d}.dat', record['reynolds'], record['alpha_deg']), config['timeout_seconds'])
        quality = classify(raw['polar_text'], raw['stdout'], raw['returncode'], config, record['reynolds'], record['alpha_deg'], record['m'], raw['timed_out'], raw['launch_error'])
        repeat_results.append({'attempt_id': record['attempt_id'], 'eligible': quality['eligible'],
                               'matches_polar_precision': quality['coefficients'] == record['coefficients'],
                               'raw_directory': f'repeat/{record["attempt_id"]}'})
    report = summarize(records, config, time.perf_counter() - start, repeat_results)
    report['artifact_hashes'] = {name: sha256(output / name) for name in ('attempts.jsonl', 'attempts.parquet', 'labels.csv', 'labels.parquet', 'config.json', 'manifest.json')}
    write_json(output / 'quality-report.json', report)
    return report


def summarize(records: list[dict], config: dict, elapsed: float, repeats: list[dict]) -> dict:
    eligible = [r for r in records if r['eligible']]
    count = len(records)
    def group(key):
        return {str(value): {'attempted': sum(r[key] == value for r in records),
                             'eligible': sum(r[key] == value for r in eligible)} for value in sorted({r[key] for r in records})}
    reasons = sorted({reason for r in records for reason in r['reasons'] + r['warnings']})
    eligible_fraction = len(eligible) / count if count else 0
    acceptance = config['acceptance']
    conditions = {
        'eligible_fraction': eligible_fraction >= acceptance['minimum_eligible_fraction'],
        'geometry_coverage': len({r['geometry_id'] for r in eligible}) >= acceptance['minimum_geometries_with_eligible_labels'],
        'reproducibility': len(repeats) == acceptance['reproducibility_checks'] and all(r['eligible'] and r['matches_polar_precision'] for r in repeats),
        'no_process_failures': not any(r['timed_out'] or r['launch_error'] or r['returncode'] != 0 for r in records),
    }
    return {'attempted': count, 'converged': sum(r['converged'] for r in records), 'eligible': len(eligible),
            'rejected': sum(r['status'] == 'rejected' for r in records), 'suspect': sum(r['status'] == 'suspect' for r in records),
            'eligible_fraction': eligible_fraction, 'elapsed_seconds': elapsed,
            'point_seconds_p50': statistics.median(r['elapsed_seconds'] for r in records) if records else None,
            'by_geometry': group('geometry_code'), 'by_reynolds': group('reynolds'), 'by_angle': group('alpha_deg'),
            'reason_counts': {reason: sum(reason in r['reasons'] + r['warnings'] for r in records) for reason in reasons},
            'repeat_checks': repeats, 'acceptance_checks': conditions, 'acceptance_passed': all(conditions.values()),
            'domain_note': 'Sparse pilot only. Points at alpha>=10 are excluded as unvalidated stall risk. No continuous prediction domain or physical accuracy is established.'}
