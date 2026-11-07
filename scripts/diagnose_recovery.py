"""Read-only diagnosis of the consumed pilot experiment before recovery tuning."""
import json
from pathlib import Path
import sys
import numpy as np
import pandas as pd
import torch
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'python'))
from aeroforge.ml import make_mlp, feature_matrix, metrics, normalized_data, source_predict, split_dataset, write_json

old = ROOT / 'artifacts/pilot-surrogate-v1'
config = json.loads((ROOT / 'configs/training-v1.json').read_text())
frame = pd.read_parquet(ROOT / config['dataset']).sort_values('attempt_id').reset_index(drop=True)
pre = json.loads((old / 'preprocessing.json').read_text())
scalers = {key: np.array(pre[key], np.float32) for key in ('x_mean', 'x_scale', 'y_mean', 'y_scale')}
checkpoint = torch.load(old / 'mlp.pt', map_location='cpu', weights_only=True)
model = make_mlp(checkpoint['hidden']); model.load_state_dict(checkpoint['state_dict']); model.eval()
torch.set_num_threads(1)
x = (feature_matrix(frame) - scalers['x_mean']) / scalers['x_scale']
prediction = source_predict(model, x, scalers)
frame['pred_cl'], frame['pred_cd'] = prediction[:, 0], prediction[:, 1]
frame['cl_abs_error'] = abs(frame.cl - frame.pred_cl)
frame['cd_abs_error'] = abs(frame.cd - frame.pred_cd)
partitions = split_dataset(frame, config)
report = {
    'old_test_status': 'consumed diagnostic set; excluded from new final test reservation',
    'rows': len(frame), 'geometries': frame.geometry_id.nunique(),
    'reynolds_counts': frame.reynolds.value_counts().sort_index().to_dict(),
    'angle_counts': frame.alpha_deg.value_counts().sort_index().to_dict(),
    'duplicate_operating_points': int(frame.duplicated(['geometry_id','reynolds','alpha_deg']).sum()),
    'duplicate_parameter_tuples': int(frame[['m','p','t']].drop_duplicates().shape[0]),
    'target_quantiles': {target: frame[target].quantile([0,.1,.5,.9,.95,1]).to_dict() for target in ('cl','cd')},
    'partition_errors': {name: metrics(part[['cl','cd']].to_numpy(), part[['pred_cl','pred_cd']].to_numpy()) for name,part in partitions.items()},
    'error_groups': {},
    'worst_drag_rows': frame.nlargest(12,'cd_abs_error')[['attempt_id','m','p','t','reynolds','alpha_deg','cl','cd','pred_cd','cd_abs_error']].to_dict('records'),
    'highest_drag_rows': frame.nlargest(12,'cd')[['attempt_id','m','p','t','reynolds','alpha_deg','cl','cd','pred_cd']].to_dict('records'),
    'pilot_quality': json.loads((ROOT / 'data/pilot-v1/quality-report.json').read_text()),
}
for key in ('reynolds','alpha_deg','geometry_id'):
    report['error_groups'][key] = {str(value): {'rows':len(part), 'mean_cd_error':float(part.cd_abs_error.mean()),
        'max_cd_error':float(part.cd_abs_error.max()), 'mean_cl_error':float(part.cl_abs_error.mean())}
        for value,part in frame.groupby(key)}
report['top5_drag_error_share'] = float(frame.cd_abs_error.nlargest(5).sum()/frame.cd_abs_error.sum())
output = ROOT / 'artifacts/recovery-diagnosis'
output.mkdir(exist_ok=False)
write_json(output/'diagnosis.json', report)
frame.to_csv(output/'pilot-predictions.csv',index=False)
print(json.dumps({k:v for k,v in report.items() if k not in ('pilot_quality','error_groups')},indent=2))
