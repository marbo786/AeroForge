"""Freeze deployable artifacts, unlock fresh simulation, then evaluate once."""
import argparse
from datetime import datetime,timezone
import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd
import torch
import onnx
import onnxruntime as ort

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'python'))
from aeroforge.ml import ExportWrapper,benchmark,digest,make_mlp,metrics,slices,write_json
from aeroforge.recovery import Predictor,PhysicsFeatures,predict,raw_features,assemble,lift_prior
from aeroforge.pilot import run_pilot
from sklearn.ensemble import RandomForestRegressor
import joblib

ART=ROOT/'artifacts/recovery-v1-complete'
parser=argparse.ArgumentParser(); parser.add_argument('stage',choices=['prepare','simulate','evaluate'])
args=parser.parse_args()
plan=json.loads((ROOT/'configs/recovery-v1/plan.json').read_text())
selection=json.loads((ART/'selection.json').read_text())
if not selection['selection_gate_passed']: raise SystemExit('Validation gate failed: final remains locked')
if selection['plan_sha256']!=digest(ROOT/'configs/recovery-v1/plan.json'): raise SystemExit('Plan changed after selection')
torch.set_num_threads(1)

def load(name):
    # These serialized modules are created locally by the controlled sweep, never downloaded.
    return torch.load(ART/(name+'.pt'),map_location='cpu',weights_only=False).eval()

if args.stage=='prepare':
    if (ROOT/'data/recovery-v1/final-locked').exists() or (ART/'unlock.json').exists():
        raise SystemExit('Final reservation already used or unlock already exists')
    model=load('selected'); path=ART/'selected.onnx'
    torch.onnx.export(model,torch.zeros((2,5)),str(path),dynamo=False,input_names=['features'],
        output_names=['coefficients'],dynamic_axes={'features':{0:'batch'},'coefficients':{0:'batch'}},opset_version=17)
    onnx.checker.check_model(onnx.load(path))
    parts,_=assemble(ROOT,plan)
    vectors=raw_features(pd.concat(list(parts.values()),ignore_index=True))
    expected=predict(model,vectors)
    options=ort.SessionOptions(); options.intra_op_num_threads=1
    session=ort.InferenceSession(str(path),options,providers=['CPUExecutionProvider'])
    observed=session.run(None,{'features':vectors})[0]
    error=float(np.max(np.abs(expected-observed)))
    if error>=1e-5: raise SystemExit('Numerical gate failed; final remains locked')
    records=json.loads((ART/'experiments.json').read_text())
    best=lambda prefix:min((r for r in records if r['name'].startswith(prefix)),key=lambda r:r['score'])
    finalists={family:best(prefix)['name'] for family,prefix in [('ridge','ridge_'),('forest','forest_'),('neural','nn_'),('gaussian_process','gp_')]}
    # Reconstruct the identical frozen forest on train only before unlocking final labels.
    pre=json.loads((ART/'preprocessing.json').read_text()); train=parts['train']
    with torch.no_grad(): phi=PhysicsFeatures()(torch.from_numpy(raw_features(train))).numpy()
    z=((phi-np.array(pre['x_mean']))/np.array(pre['x_scale'])).astype(np.float32)
    target=train[['cl','cd']].to_numpy(np.float32).astype(np.float64)
    target[:,0]-=lift_prior(torch.from_numpy(raw_features(train))).numpy(); target[:,1]=np.log(target[:,1])
    y=(target-np.array(pre['y_mean']))/np.array(pre['y_scale'])
    leaf=next(r['parameters']['min_samples_leaf'] for r in records if r['name']==finalists['forest'])
    forest=RandomForestRegressor(n_estimators=300,min_samples_leaf=leaf,random_state=plan['seed'],n_jobs=1).fit(z,y)
    joblib.dump(forest,ART/'forest-finalist.joblib',compress=3)
    write_json(ART/'finalists.json',finalists)
    write_json(ART/'golden.json',{'features':vectors.tolist(),'expected':{'selected':expected.tolist()},'absolute_tolerance':1e-5})
    write_json(ART/'unlock.json',{'created_utc':datetime.now(timezone.utc).isoformat(),
        'selection_sha256':digest(ART/'selection.json'),'plan_sha256':digest(ROOT/'configs/recovery-v1/plan.json'),
        'selected_checkpoint_sha256':digest(ART/'selected.pt'),'selected_onnx_sha256':digest(path),
        'forest_sha256':digest(ART/'forest-finalist.joblib'),'onnx_max_absolute_error':error,
        'locked_final_geometry_codes':plan['locked_final_codes'],'final_data_absent_at_unlock':True})
    print('Export passed; final reservation unlocked once. Native max error:',error)
elif args.stage=='simulate':
    unlock=json.loads((ART/'unlock.json').read_text())
    if digest(ART/'selection.json')!=unlock['selection_sha256']: raise SystemExit('Selection changed')
    report=run_pilot(ROOT/'configs/recovery-v1/final-locked.json',ROOT/'tools/xfoil/xfoil.exe',ROOT/'data/recovery-v1/final-locked')
    raise SystemExit(0 if report['acceptance_passed'] else 1)
else:
    if (ART/'final-evaluation.json').exists() or (ART/'final-evaluation-started.json').exists():
        raise SystemExit('Final already consumed; evaluation will not be repeated')
    unlock=json.loads((ART/'unlock.json').read_text())
    if digest(ART/'selection.json')!=unlock['selection_sha256'] or digest(ART/'selected.pt')!=unlock['selected_checkpoint_sha256']:
        raise SystemExit('Frozen model or selection changed')
    folder=ROOT/'data/recovery-v1/final-locked'
    quality=json.loads((folder/'quality-report.json').read_text())
    if not quality['acceptance_passed'] or digest(folder/'labels.parquet')!=quality['artifact_hashes']['labels.parquet']:
        raise SystemExit('Final data quality/hash failed')
    write_json(ART/'final-evaluation-started.json',{'created_utc':datetime.now(timezone.utc).isoformat(),
        'dataset_sha256':digest(folder/'labels.parquet'),'selection_sha256':digest(ART/'selection.json')})
    frame=pd.read_parquet(folder/'labels.parquet'); x=raw_features(frame); truth=frame[['cl','cd']].to_numpy(np.float32)
    finalists=json.loads((ART/'finalists.json').read_text())
    pre=json.loads((ART/'preprocessing.json').read_text())
    results={}
    chosen=selection['winner']['name']
    model=load('selected')
    for family,name in finalists.items():
        if family=='forest':
            estimator=joblib.load(ART/'forest-finalist.joblib')
            with torch.no_grad(): phi=PhysicsFeatures()(torch.from_numpy(x)).numpy()
            z=((phi-np.array(pre['x_mean']))/np.array(pre['x_scale'])).astype(np.float32)
            y=estimator.predict(z)*np.array(pre['y_scale'])+np.array(pre['y_mean'])
            pred=np.column_stack([y[:,0]+lift_prior(torch.from_numpy(x)).numpy(),np.exp(y[:,1])])
        else: pred=predict(load(name),x)
        results[family]={'name':name,'metrics':metrics(truth,pred),'slices':slices(frame,truth,pred)}
    old=ROOT/'artifacts/pilot-surrogate-v1'; checkpoint=torch.load(old/'mlp.pt',map_location='cpu',weights_only=True)
    core=make_mlp(checkpoint['hidden']); core.load_state_dict(checkpoint['state_dict']); core.eval()
    original_pre=json.loads((old/'preprocessing.json').read_text())
    original=ExportWrapper(core,{key:np.array(original_pre[key],np.float32) for key in ('x_mean','x_scale','y_mean','y_scale')}).eval()
    original_prediction=predict(original,x)
    selected_prediction=predict(model,x)
    measured=metrics(truth,selected_prediction)
    passed=measured['cl']['mae']<=.05 and measured['cd']['mae']<=.0015
    write_json(ART/'final-evaluation.json',{'selected_name':chosen,'selected_metrics':measured,'baselines':results,
        'original_mlp_same_final_set':metrics(truth,original_prediction),
        'rows':len(frame),'geometry_count':frame.geometry_id.nunique(),'accuracy_targets_passed':passed,
        'single_final_evaluation':True,'test_used_for_selection':False,'slices':slices(frame,truth,selected_prediction),
        'error_quantiles':{name:{str(q):float(np.quantile(abs(truth[:,i]-selected_prediction[:,i]),q)) for q in [.5,.9,.95,1]} for i,name in enumerate(['cl','cd'])}})
    write_json(ART/'model.json',{'version':'recovery-v1-complete','selected_family':chosen,'model_file':'selected.onnx',
        'model_sha256':digest(ART/'selected.onnx'),'preprocessing_sha256':digest(ART/'preprocessing.json'),
        'features':['m','canonical_p','t','alpha_deg','log10_reynolds'],'outputs':['cl','cd'],
        'input_shape':['batch',5],'output_shape':['batch',2],'research_only':not passed,
        'accuracy_targets_passed':passed,'onnx_agreement_passed':True,
        'domain':{'m':[0,.06],'cambered_p':[.2,.6],'t':[.08,.18],'alpha_deg':[-4,8],
            'sampled_reynolds':[100000,250000,500000],'continuous_domain_validated':False,
            'warning':'Validated on a finite new-geometry test panel against XFOIL; not experimental, post-stall or continuous-domain validation.'}})
    print(json.dumps({'selected':chosen,'final':measured,'accuracy_targets_passed':passed},indent=2))
    raise SystemExit(0 if passed else 1)
