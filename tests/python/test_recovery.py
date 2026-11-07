"""Recovery integrity and independent numerical/data audit; no model retuning."""
from datetime import datetime
import gzip
import json
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import pandas as pd
import pytest
import torch

from aeroforge.geometry import geometry_id,parse_naca
from aeroforge.ml import digest,metrics
from aeroforge.recovery import assemble,PhysicsFeatures,predict,raw_features
from aeroforge.xfoil import classify

ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'artifacts/recovery-v1-complete'
PLAN=json.loads((ROOT/'configs/recovery-v1/plan.json').read_text())


def selected():
    return torch.load(ART/'selected.pt',map_location='cpu',weights_only=False).eval()


def test_locked_geometry_groups_and_consumed_old_test_exclusion():
    parts,sources=assemble(ROOT,PLAN)
    groups={name:set(part.geometry_id) for name,part in parts.items()}
    final={geometry_id(parse_naca(code)) for code in PLAN['locked_final_codes']}
    assert [len(g) for g in groups.values()]==[33,8,3]
    assert len(groups['train']|groups['validation']|groups['diagnostic']|final)==52
    assert all(not (groups[a]&groups[b]) for a,b in [('train','validation'),('train','diagnostic'),('validation','diagnostic')])
    assert not final & set.union(*groups.values())
    assert groups['diagnostic']=={geometry_id(parse_naca(c)) for c in ['0012','4210','6618']}
    assert [len(p) for p in parts.values()]==[657,163,61]
    saved=json.loads((ART/'data-sources.json').read_text())
    assert sources==saved


def test_physical_features_are_safe_and_match_independent_equations():
    x=np.array([[0,0,.12,0,5],[.02,.4,.12,4,np.log10(250000)]],np.float32)
    actual=PhysicsFeatures()(torch.from_numpy(x)).numpy()
    expected=[]
    for m,p,t,angle,re in x.astype(np.float64):
        a=angle*np.pi/180
        expected.append([m,p,t,a,re,m*t,m/(1-p),m/p if m else 0,a*a,a*(re-5),t*(re-5),a+2*m])
    np.testing.assert_allclose(actual,expected,atol=1e-7,rtol=1e-6)
    assert actual.shape==(2,12) and np.isfinite(actual).all()
    frame=pd.DataFrame([{'m':0,'p':.6,'t':.12,'alpha_deg':0,'reynolds':250000}])
    assert raw_features(frame)[0,1]==0
    frame.loc[0,'reynolds']=1000000
    with pytest.raises(ValueError): raw_features(frame)


def test_scalers_fitted_on_training_only():
    train=pd.read_parquet(ART/'train.parquet')
    pre=json.loads((ART/'preprocessing.json').read_text())
    with torch.no_grad(): phi=PhysicsFeatures()(torch.from_numpy(raw_features(train))).numpy().astype(np.float64)
    np.testing.assert_allclose(phi.mean(0),pre['x_mean'],rtol=0,atol=1e-12)
    np.testing.assert_allclose(phi.std(0),pre['x_scale'],rtol=0,atol=1e-12)
    assert pre['fit_partition']=='train' and pre['embedded_in_onnx']


def test_selection_and_unlock_precede_final_simulations():
    selection=json.loads((ART/'selection.json').read_text())
    unlock=json.loads((ART/'unlock.json').read_text())
    final_manifest=json.loads((ROOT/'data/recovery-v1/final-locked/manifest.json').read_text())
    assert datetime.fromisoformat(unlock['created_utc'])<datetime.fromisoformat(final_manifest['created_utc'])
    assert unlock['final_data_absent_at_unlock']
    assert unlock['selection_sha256']==digest(ART/'selection.json')
    assert unlock['selected_checkpoint_sha256']==digest(ART/'selected.pt')
    assert unlock['selected_onnx_sha256']==digest(ART/'selected.onnx')
    assert unlock['plan_sha256']==digest(ROOT/'configs/recovery-v1/plan.json')
    records=json.loads((ART/'experiments.json').read_text())
    assert len(records)==19
    assert selection['winner']['name']==min(records,key=lambda r:r['score'])['name']
    assert selection['selection_gate_passed'] and not selection['final_test_evaluated']
    assert selection['winner']['validation']['cl']['mae']<=.05
    assert selection['winner']['validation']['cd']['mae']<=.0015
    for record in records:
        assert record['seed']==PLAN['seed'] and record['training_seconds']>0
        assert record['state_bytes']>0 and record['single_latency']['p95_ms']>=0


@pytest.mark.parametrize('name',['train-new','validation','old-mid-re','old-minus2','final-locked'])
def test_expanded_real_solver_data_is_traceable_and_consistently_filtered(name):
    folder=ROOT/'data/recovery-v1'/name
    config=json.loads((folder/'config.json').read_text())
    report=json.loads((folder/'quality-report.json').read_text())
    assert report['acceptance_passed']
    for file,expected in report['artifact_hashes'].items(): assert digest(folder/file)==expected
    rows=[json.loads(line) for line in (folder/'attempts.jsonl').read_text().splitlines()]
    assert len(rows)==report['attempted']
    assert len({(r['geometry_id'],r['reynolds'],r['alpha_deg']) for r in rows})==len(rows)
    eligible={}
    for row in rows:
        directory=folder/row['raw_directory']
        assert digest(folder/row['geometry_file'])==row['geometry_sha256']
        for file,expected in row['artifact_hashes'].items(): assert digest(directory/file)==expected
        stdout=gzip.decompress((directory/'stdout.txt.gz').read_bytes()).decode('ascii',errors='replace')
        polar=(directory/'polar.txt').read_text() if (directory/'polar.txt').exists() else None
        actual=classify(polar,stdout,row['returncode'],config,row['reynolds'],row['alpha_deg'],row['m'],row['timed_out'],row['launch_error'])
        assert actual['eligible']==row['eligible'] and actual['coefficients']==row['coefficients']
        assert len((directory/'panels.dat').read_text().splitlines())==160
        if row['eligible']: eligible[row['attempt_id']]=row
    labels=pd.read_parquet(folder/'labels.parquet')
    assert set(labels.attempt_id)==set(eligible) and len(labels)==report['eligible']
    for row in labels.itertuples():
        assert (row.cl,row.cd)==(eligible[row.attempt_id]['coefficients']['cl'],eligible[row.attempt_id]['coefficients']['cd'])


def test_final_metrics_targets_and_full_error_slices():
    report=json.loads((ART/'final-evaluation.json').read_text())
    frame=pd.read_parquet(ROOT/'data/recovery-v1/final-locked/labels.parquet')
    assert report['single_final_evaluation'] and not report['test_used_for_selection']
    assert report['accuracy_targets_passed'] and report['geometry_count']==8 and report['rows']==165
    measured=metrics(frame[['cl','cd']].to_numpy(np.float32),predict(selected(),raw_features(frame)))
    for target in ('cl','cd'):
        for key in ('mae','rmse','r2'):
            assert measured[target][key]==pytest.approx(report['selected_metrics'][target][key],abs=1e-6,rel=0)
    assert measured['cl']['mae']<=.05 and measured['cd']['mae']<=.0015
    assert set(report['slices'])=={'alpha_deg','reynolds','geometry_id','m'}
    assert len(report['baselines'])==4
    assert report['original_mlp_same_final_set']['cd']['mae']>measured['cd']['mae']


def test_selected_onnx_matches_pytorch_on_development_and_final_inputs():
    onnx.checker.check_model(onnx.load(ART/'selected.onnx'))
    golden=json.loads((ART/'golden.json').read_text())
    frame=pd.read_parquet(ROOT/'data/recovery-v1/final-locked/labels.parquet')
    x=np.concatenate([np.asarray(golden['features'],np.float32),raw_features(frame)])
    options=ort.SessionOptions(); options.intra_op_num_threads=1
    session=ort.InferenceSession(str(ART/'selected.onnx'),options,providers=['CPUExecutionProvider'])
    actual=session.run(None,{'features':x})[0]
    expected=predict(selected(),x)
    assert actual.shape==(len(x),2) and np.isfinite(actual).all() and (actual[:,1]>0).all()
    assert np.max(np.abs(actual-expected))<1e-5
    np.testing.assert_allclose(session.run(None,{'features':x[:1]})[0],actual[:1],rtol=0,atol=1e-5)
    np.testing.assert_array_equal(session.run(None,{'features':x})[0],actual)
    metadata=json.loads((ART/'model.json').read_text())
    assert metadata['accuracy_targets_passed'] and metadata['onnx_agreement_passed']
    assert metadata['model_sha256']==digest(ART/'selected.onnx')
    assert metadata['preprocessing_sha256']==digest(ART/'preprocessing.json')
    assert not metadata['domain']['continuous_domain_validated']
    assert (ART/'selected.onnx').stat().st_size<1_000_000
