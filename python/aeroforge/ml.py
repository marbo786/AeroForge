"""Phase 4 pilot-only training with immutable geometry partitions and export parity."""
from copy import deepcopy
import hashlib
import importlib.metadata
import json
from pathlib import Path
import random
import sys
import time

import numpy as np
import pandas as pd
import torch
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from .geometry import geometry_id, normalize_geometry, parse_naca


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + '\n', encoding='utf-8', newline='\n')


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def feature_matrix(frame):
    values = []
    for row in frame.itertuples():
        p = normalize_geometry({'m': row.m, 'p': row.p, 't': row.t})
        if not np.isfinite(row.alpha_deg) or not -4 <= row.alpha_deg <= 8:
            raise ValueError('angle outside pilot non-stall candidate bounds')
        if row.reynolds not in (100000, 500000):
            raise ValueError('Reynolds value has no pilot evidence')
        values.append([p.m, p.p, p.t, row.alpha_deg, np.log10(row.reynolds)])
    return np.asarray(values, dtype=np.float32)


def split_dataset(frame, config):
    val = {geometry_id(parse_naca(code)) for code in config['validation_codes']}
    test = {geometry_id(parse_naca(code)) for code in config['test_codes']}
    groups = set(frame.geometry_id)
    if val & test or not val <= groups or not test <= groups:
        raise ValueError('invalid or overlapping held-out geometry groups')
    if frame.duplicated(['geometry_id', 'reynolds', 'alpha_deg']).any():
        raise ValueError('duplicate operating point')
    for row in frame.itertuples():
        if geometry_id({'m': row.m, 'p': row.p, 't': row.t}) != row.geometry_id:
            raise ValueError('noncanonical geometry identity')
    partitions = {'train': frame[~frame.geometry_id.isin(val | test)].copy(),
                  'validation': frame[frame.geometry_id.isin(val)].copy(),
                  'test': frame[frame.geometry_id.isin(test)].copy()}
    if any(part.empty for part in partitions.values()):
        raise ValueError('empty partition')
    return partitions


def metrics(truth, prediction):
    if prediction.shape != truth.shape or not np.isfinite(prediction).all():
        raise ValueError('invalid model output')
    return {name: {'mae': float(mean_absolute_error(truth[:, i], prediction[:, i])),
                   'rmse': float(np.sqrt(mean_squared_error(truth[:, i], prediction[:, i]))),
                   'r2': float(r2_score(truth[:, i], prediction[:, i])) if len(truth) > 1 else None}
            for i, name in enumerate(('cl', 'cd'))}


def score(result, config):
    return .5 * (result['cl']['mae'] / config['cl_mae_target'] + result['cd']['mae'] / config['cd_mae_target'])


def fit_scalers(frame):
    x = feature_matrix(frame)
    y = frame[['cl', 'cd']].to_numpy(dtype=np.float64)
    if not np.isfinite(y).all() or (y[:, 1] <= 0).any():
        raise ValueError('invalid supervised coefficients')
    transformed = np.column_stack((y[:, 0], np.log(y[:, 1])))
    return {key: value.astype(np.float32) for key, value in {
        'x_mean': x.astype(np.float64).mean(0), 'x_scale': x.astype(np.float64).std(0),
        'y_mean': transformed.mean(0), 'y_scale': transformed.std(0)}.items()}


def normalized_data(frame, scalers):
    x = (feature_matrix(frame) - scalers['x_mean']) / scalers['x_scale']
    y = frame[['cl', 'cd']].to_numpy(dtype=np.float32)
    yt = np.column_stack((y[:, 0], np.log(y[:, 1])))
    return x, (yt - scalers['y_mean']) / scalers['y_scale'], y


def restore(values, scalers):
    output = np.asarray(values) * scalers['y_scale'] + scalers['y_mean']
    return np.column_stack((output[:, 0], np.exp(output[:, 1])))


def make_mlp(hidden):
    layers = []
    sizes = [5, *hidden]
    for a, b in zip(sizes, sizes[1:]):
        layers.extend([torch.nn.Linear(a, b), torch.nn.SiLU()])
    layers.append(torch.nn.Linear(sizes[-1], 2))
    return torch.nn.Sequential(*layers)


class ExportWrapper(torch.nn.Module):
    def __init__(self, core, scalers):
        super().__init__()
        self.core = core
        for key, value in scalers.items():
            self.register_buffer(key, torch.as_tensor(value))

    def forward(self, features):
        scaled = (features - self.x_mean) / self.x_scale
        y = self.core(scaled) * self.y_scale + self.y_mean
        return torch.stack((y[:, 0], torch.exp(y[:, 1])), dim=1)


def source_predict(model, x, scalers):
    if isinstance(model, torch.nn.Module):
        with torch.no_grad():
            y = model(torch.from_numpy(x)).numpy()
    else:
        y = model.predict(x)
    return restore(y, scalers)


def train_mlp(hidden, lr, train, validation, scalers, config):
    torch.manual_seed(config['seed'])
    model = make_mlp(hidden)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=config['weight_decay'])
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, factor=.5, patience=10)
    x, y, _ = train
    tx, ty = torch.from_numpy(x), torch.from_numpy(y)
    generator = torch.Generator().manual_seed(config['seed'])
    best, state, stale, history = float('inf'), None, 0, []
    for epoch in range(config['max_epochs']):
        model.train()
        for indices in torch.randperm(len(x), generator=generator).split(config['batch_size']):
            optimizer.zero_grad()
            loss = torch.nn.functional.mse_loss(model(tx[indices]), ty[indices])
            loss.backward()
            optimizer.step()
        model.eval()
        measured = metrics(validation[2], source_predict(model, validation[0], scalers))
        current = score(measured, config)
        history.append({'epoch': epoch + 1, 'validation_score': current, 'train_batch_loss': float(loss.detach())})
        scheduler.step(current)
        if current < best:
            best, state, stale = current, deepcopy(model.state_dict()), 0
        else:
            stale += 1
        if stale >= config['early_stopping_patience']:
            break
    model.load_state_dict(state)
    model.eval()
    return model, history


def export_model(model, scalers, filename, config):
    import onnx
    if isinstance(model, RandomForestRegressor):
        from skl2onnx import convert_sklearn
        from skl2onnx.common.data_types import FloatTensorType
        core = convert_sklearn(model, initial_types=[('normalized', FloatTensorType([None, 5]))], target_opset=config['opset'])
        # Pre/postprocessing around the converted regression graph, using core ONNX ops.
        from onnx import helper, numpy_helper, TensorProto
        initializers = list(core.graph.initializer)
        for name, value in scalers.items():
            initializers.append(numpy_helper.from_array(value, name))
        initializers.extend([numpy_helper.from_array(np.array([0], np.int64), 'cl_index'),
                             numpy_helper.from_array(np.array([1], np.int64), 'cd_index')])
        nodes = [helper.make_node('Sub', ['features', 'x_mean'], ['centered']),
                 helper.make_node('Div', ['centered', 'x_scale'], ['normalized']), *core.graph.node,
                 helper.make_node('Mul', [core.graph.output[0].name, 'y_scale'], ['y_scaled']),
                 helper.make_node('Add', ['y_scaled', 'y_mean'], ['y_original']),
                 helper.make_node('Gather', ['y_original', 'cl_index'], ['lift'], axis=1),
                 helper.make_node('Gather', ['y_original', 'cd_index'], ['log_drag'], axis=1),
                 helper.make_node('Exp', ['log_drag'], ['drag']),
                 helper.make_node('Concat', ['lift', 'drag'], ['coefficients'], axis=1)]
        graph = helper.make_graph(nodes, 'aeroforge_forest',
            [helper.make_tensor_value_info('features', TensorProto.FLOAT, [None, 5])],
            [helper.make_tensor_value_info('coefficients', TensorProto.FLOAT, [None, 2])], initializers)
        exported = helper.make_model(graph, opset_imports=list(core.opset_import), ir_version=8)
        onnx.checker.check_model(exported)
        onnx.save(exported, filename)
    else:
        if isinstance(model, Ridge):
            core = torch.nn.Linear(5, 2)
            with torch.no_grad():
                core.weight.copy_(torch.as_tensor(model.coef_.astype(np.float32)))
                core.bias.copy_(torch.as_tensor(model.intercept_.astype(np.float32)))
        else:
            core = model
        wrapper = ExportWrapper(core, scalers).eval()
        # Explicit legacy export avoids an unnecessary onnxscript dependency for this tiny MLP.
        torch.onnx.export(wrapper, torch.zeros((2, 5)), str(filename), dynamo=False,
                          input_names=['features'], output_names=['coefficients'],
                          dynamic_axes={'features': {0: 'batch'}, 'coefficients': {0: 'batch'}}, opset_version=config['opset'])
        onnx.checker.check_model(onnx.load(filename))


def slices(frame, truth, prediction):
    result = {}
    for key in ('alpha_deg', 'reynolds', 'geometry_id', 'm'):
        result[key] = {str(value): {'count': int(sum(frame[key].to_numpy() == value)),
                       'metrics': metrics(truth[frame[key].to_numpy() == value], prediction[frame[key].to_numpy() == value])}
                       for value in sorted(frame[key].unique())}
    return result


def benchmark(predict, x):
    for _ in range(10):
        predict(x)
    times = []
    for _ in range(100):
        start = time.perf_counter()
        predict(x)
        times.append((time.perf_counter() - start) * 1000)
    return {'p50_ms': float(np.percentile(times, 50)), 'p95_ms': float(np.percentile(times, 95)), 'samples': 100}


def run_training(root: Path, output: Path):
    import onnxruntime as ort
    config_path = root / 'configs/training-v1.json'
    config = json.loads(config_path.read_text())
    dataset = root / config['dataset']
    if digest(dataset) != config['dataset_sha256']:
        raise ValueError('dataset hash mismatch')
    output.mkdir(parents=True, exist_ok=False)
    write_json(output / 'training-config.json', config)
    write_json(output / 'environment.json', {'python': sys.version, 'torch': torch.__version__,
        'versions': {name: importlib.metadata.version(name) for name in ('numpy', 'pandas', 'pyarrow', 'scikit-learn',
                     'onnx', 'onnxruntime', 'skl2onnx', 'pytest')},
        'cpu_threads': 1, 'training_seed': config['seed'], 'inference_provider': 'CPUExecutionProvider',
        'test_retuning': False})
    random.seed(config['seed']); np.random.seed(config['seed']); torch.manual_seed(config['seed'])
    torch.set_num_threads(1); torch.use_deterministic_algorithms(True)
    frame = pd.read_parquet(dataset).sort_values('attempt_id').reset_index(drop=True)
    partitions = split_dataset(frame, config)
    scalers = fit_scalers(partitions['train'])
    if any((scalers[key] <= 0).any() for key in ('x_scale', 'y_scale')):
        raise ValueError('degenerate training scaler')
    train = normalized_data(partitions['train'], scalers)
    validation = normalized_data(partitions['validation'], scalers)
    # Test labels are not evaluated until family finalists and overall winner freeze.
    split_manifest = {name: {'geometry_ids': sorted(set(part.geometry_id)), 'attempt_ids': list(part.attempt_id),
                             'rows': len(part), 'geometries': part.geometry_id.nunique()}
                      for name, part in partitions.items()}
    write_json(output / 'splits.json', split_manifest)
    write_json(output / 'preprocessing.json', {**{key: value.tolist() for key, value in scalers.items()},
        'features': config['features'], 'targets': config['targets'], 'dtype': 'float32',
        'target_transform': config['target_transform'], 'embedded_in_onnx': True,
        'fit_partition': 'train', 'symmetric_p': 0, 'geometry_schema': 'naca4-open-v1'})
    candidates = []
    families = {'ridge': [], 'forest': [], 'mlp': []}
    def add(family, model, parameters, history=None):
        result = metrics(validation[2], source_predict(model, validation[0], scalers))
        record = {'family': family, 'parameters': parameters, 'validation_metrics': result,
                  'validation_score': score(result, config)}
        if history is not None:
            record['history'] = history
        candidates.append(record); families[family].append((record, model))
        print(f'{family} {parameters}: validation score {record["validation_score"]:.4f}', flush=True)
    for alpha in config['ridge_alphas']:
        add('ridge', Ridge(alpha=alpha).fit(train[0], train[1]), {'alpha': alpha})
    for leaf in config['forest_min_samples_leaf']:
        model = RandomForestRegressor(n_estimators=config['forest_trees'], min_samples_leaf=leaf,
                                      random_state=config['seed'], n_jobs=1).fit(train[0], train[1])
        add('forest', model, {'trees': config['forest_trees'], 'min_samples_leaf': leaf})
    for hidden in config['mlp_hidden_options']:
        for lr in config['mlp_learning_rates']:
            model, history = train_mlp(hidden, lr, train, validation, scalers, config)
            add('mlp', model, {'hidden': hidden, 'learning_rate': lr}, history)
    finalists = {family: min(entries, key=lambda pair: pair[0]['validation_score']) for family, entries in families.items()}
    selected = min(finalists, key=lambda family: finalists[family][0]['validation_score'])
    write_json(output / 'selection.json', {'selected_family': selected, 'criterion': config['selection'],
        'finalists': {family: record for family, (record, _) in finalists.items()},
        'test_used_for_selection': False})
    write_json(output / 'validation-candidates.json', candidates)
    # All hyperparameter decisions are now frozen. Single reporting pass on held-out labels.
    test = normalized_data(partitions['test'], scalers)
    reports, golden = {}, {}
    all_features = feature_matrix(frame)
    # Representative parity suite includes every dataset input plus nontraining interior/boundary points.
    extra = np.asarray([[m, p if m else 0, t, a, np.log10(re)]
                        for m in (0, .03, .06) for p in (.2, .6) for t in (.08, .18)
                        for a in (-4, 1, 8) for re in (100000, 500000)], np.float32)
    suite = np.concatenate([all_features, extra])
    normalized_suite = (suite - scalers['x_mean']) / scalers['x_scale']
    sessions = {}
    for family, (record, model) in finalists.items():
        filename = output / f'{family}.onnx'
        export_model(model, scalers, filename, config)
        opts = ort.SessionOptions(); opts.intra_op_num_threads = 1; opts.inter_op_num_threads = 1
        session = ort.InferenceSession(str(filename), opts, providers=['CPUExecutionProvider'])
        sessions[family] = session
        expected = source_predict(model, normalized_suite, scalers).astype(np.float32)
        actual = session.run(None, {'features': suite})[0]
        difference = float(np.max(np.abs(expected - actual)))
        pred = source_predict(model, test[0], scalers)
        reports[family] = {'parameters': record['parameters'], 'validation': record['validation_metrics'],
            'validation_score': record['validation_score'], 'test': metrics(test[2], pred),
            'test_slices': slices(partitions['test'], test[2], pred),
            'onnx_max_abs_error': difference, 'onnx_agreement_passed': difference < config['onnx_max_absolute_error'],
            'onnx_bytes': filename.stat().st_size, 'onnx_sha256': digest(filename),
            'source_single_row_latency': benchmark(lambda x: source_predict(model, x, scalers), test[0][:1]),
            'onnx_single_row_latency': benchmark(lambda x: session.run(None, {'features': x}), suite[:1]),
            'onnx_batch_latency': benchmark(lambda x: session.run(None, {'features': x}), suite[:17])}
        golden[family] = expected.tolist()
        if isinstance(model, torch.nn.Module):
            torch.save({'hidden': record['parameters']['hidden'], 'state_dict': model.state_dict()}, output / 'mlp.pt')
    write_json(output / 'evaluation.json', {'selected_family': selected, 'models': reports,
        'test_used_for_selection': False, 'rows': {name: len(part) for name, part in partitions.items()},
        'test_geometry_count': 3, 'label_source': 'XFOIL 6.99; solver agreement only'})
    write_json(output / 'golden.json', {'features': suite.tolist(), 'expected': golden,
        'absolute_tolerance': config['onnx_max_absolute_error']})
    selected_report = reports[selected]
    accuracy_passed = selected_report['test']['cl']['mae'] <= config['cl_mae_target'] and selected_report['test']['cd']['mae'] <= config['cd_mae_target']
    write_json(output / 'model.json', {'version': config['version'], 'selected_family': selected,
        'model_file': f'{selected}.onnx', 'model_sha256': selected_report['onnx_sha256'],
        'preprocessing_sha256': digest(output / 'preprocessing.json'), 'dataset_sha256': digest(dataset),
        'training_config_sha256': digest(output / 'training-config.json'),
        'features': config['features'], 'outputs': ['cl', 'cd'], 'input_shape': ['batch', 5],
        'output_shape': ['batch', 2], 'opset': config['opset'],
        'research_only': True, 'accuracy_targets_passed': accuracy_passed,
        'onnx_agreement_passed': selected_report['onnx_agreement_passed'],
        'domain': {'m': [0, .06], 'cambered_p': [.2, .6], 't': [.08, .18], 'alpha_deg': [-4, 8],
                   'sampled_reynolds': [100000, 500000], 'continuous_domain_validated': False,
                   'warning': 'Pilot research model only; missing solver cases, sparse geometry coverage and no post-stall validation.'}})
    print(json.dumps({'selected': selected, 'models': {key: {'validation_score': value['validation_score'],
        'test': value['test'], 'parity': value['onnx_max_abs_error']} for key, value in reports.items()},
        'accuracy_targets_passed': accuracy_passed}, indent=2), flush=True)
    return {'selected': selected, 'accuracy_targets_passed': accuracy_passed,
            'onnx_agreement_passed': selected_report['onnx_agreement_passed']}
