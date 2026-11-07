"""Controlled recovery experiments; final simulation/labels are absent during tuning."""
from copy import deepcopy
import json
from pathlib import Path
import time

import numpy as np
import pandas as pd
import torch
from sklearn.ensemble import RandomForestRegressor
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, Matern
from sklearn.linear_model import Ridge

from .geometry import geometry_id, normalize_geometry, parse_naca
from .ml import benchmark, digest, make_mlp, metrics, slices, write_json


def raw_features(frame):
    result = []
    for row in frame.itertuples():
        p = normalize_geometry({'m': row.m, 'p': row.p, 't': row.t})
        if not -4 <= row.alpha_deg <= 8 or row.reynolds not in (100000, 250000, 500000):
            raise ValueError('outside sampled recovery conditions')
        result.append([p.m, p.p, p.t, row.alpha_deg, np.log10(row.reynolds)])
    return np.asarray(result, np.float32)


class PhysicsFeatures(torch.nn.Module):
    def forward(self, x):
        m, p, t, angle, re = [x[:, i:i+1] for i in range(5)]
        a = angle * (np.pi / 180)
        safe_p = torch.where(m == 0, torch.ones_like(p), p)
        return torch.cat([m, p, t, a, re, m*t, m/(1-p), m/safe_p,
                          a*a, a*(re-5), t*(re-5), a+2*m], dim=1)


def lift_prior(x):
    # Thin-airfoil-inspired trend only; learned residual can correct it freely.
    return 2*np.pi*(x[:, 3] * (np.pi/180) + 2*x[:, 0])


class TwoTargets(torch.nn.Module):
    def __init__(self, width):
        super().__init__()
        def head():
            return torch.nn.Sequential(torch.nn.Linear(12,width),torch.nn.SiLU(),
                torch.nn.Linear(width,width),torch.nn.SiLU(),torch.nn.Linear(width,1))
        self.lift, self.drag = head(), head()
    def forward(self,x):
        return torch.cat([self.lift(x),self.drag(x)],dim=1)


class GPCore(torch.nn.Module):
    def __init__(self, estimator):
        super().__init__()
        self.register_buffer('training_points',torch.tensor(estimator.X_train_,dtype=torch.float64))
        self.register_buffer('weights',torch.tensor(estimator.alpha_,dtype=torch.float64))
        self.length = float(estimator.kernel_.length_scale)
        self.nu = estimator.kernel_.nu if isinstance(estimator.kernel_,Matern) else 0
    def forward(self,x):
        distance2 = ((x[:,None,:]-self.training_points[None,:,:])**2).sum(dim=2)/(self.length**2)
        if self.nu == 0:
            k = torch.exp(-.5*distance2)
        else:
            r = torch.sqrt(torch.clamp(distance2,min=1e-24))
            if self.nu == 1.5:
                z = np.sqrt(3)*r; k = (1+z)*torch.exp(-z)
            else:
                z = np.sqrt(5)*r; k = (1+z+5*distance2/3)*torch.exp(-z)
        return k @ self.weights


class Predictor(torch.nn.Module):
    def __init__(self,core,scalers,double=False):
        super().__init__(); self.phi=PhysicsFeatures(); self.core=core
        dtype=torch.float64 if double else torch.float32
        for key,value in scalers.items(): self.register_buffer(key,torch.tensor(value,dtype=dtype))
    def forward(self,x):
        features=self.phi(x).to(self.x_mean.dtype)
        y=self.core((features-self.x_mean)/self.x_scale)*self.y_scale+self.y_mean
        prior=lift_prior(x).to(y.dtype)
        return torch.stack([y[:,0]+prior,torch.exp(y[:,1])],dim=1).to(torch.float32)


def predict(model,x):
    with torch.no_grad(): return model(torch.from_numpy(x)).numpy()


def assemble(root,plan):
    frames=[]; sources={}
    for name in ['pilot-v1','recovery-v1/train-new','recovery-v1/validation','recovery-v1/old-mid-re','recovery-v1/old-minus2']:
        directory=root/'data'/name
        report=json.loads((directory/'quality-report.json').read_text())
        if not report['acceptance_passed']: raise ValueError(f'data gate failed: {name}')
        file=directory/'labels.parquet'
        if digest(file)!=report['artifact_hashes']['labels.parquet']: raise ValueError('data hash mismatch')
        frame=pd.read_parquet(file); frame['source_dataset']=name
        frame['sample_id']=name+':'+frame.attempt_id
        frames.append(frame); sources[name]=digest(file)
    frame=pd.concat(frames,ignore_index=True)
    if frame.duplicated(['geometry_id','reynolds','alpha_deg']).any(): raise ValueError('duplicate point')
    ids=lambda codes:{geometry_id(parse_naca(c)) for c in codes}
    diagnostic=ids(plan['diagnostic_codes']); validation=ids(plan['validation_codes']); final=ids(plan['locked_final_codes'])
    if final & set(frame.geometry_id): raise ValueError('locked final geometry leaked into development')
    if diagnostic & validation: raise ValueError('diagnostic and validation overlap')
    parts={'train':frame[~frame.geometry_id.isin(diagnostic|validation)].copy(),
           'validation':frame[frame.geometry_id.isin(validation)].copy(),
           'diagnostic':frame[frame.geometry_id.isin(diagnostic)].copy()}
    if [p.geometry_id.nunique() for p in parts.values()] != [33,8,3]: raise ValueError('unexpected geometry allocation')
    return parts,sources


def tune(root:Path, output_name='recovery-v1-complete'):
    plan=json.loads((root/'configs/recovery-v1/plan.json').read_text())
    output=root/'artifacts'/output_name; output.mkdir(exist_ok=False)
    parts,sources=assemble(root,plan)
    write_json(output/'data-sources.json',sources)
    write_json(output/'plan.json',plan)
    write_json(output/'splits.json',{name:{'geometry_ids':sorted(set(p.geometry_id)),
        'sample_ids':list(p.sample_id),'rows':len(p)} for name,p in parts.items()})
    for name,part in parts.items(): part.to_parquet(output/f'{name}.parquet',index=False)
    torch.set_num_threads(1); torch.use_deterministic_algorithms(True); np.random.seed(plan['seed'])
    x={name:raw_features(part) for name,part in parts.items()}
    truth={name:part[['cl','cd']].to_numpy(np.float32) for name,part in parts.items()}
    with torch.no_grad(): phi=PhysicsFeatures()(torch.from_numpy(x['train'])).numpy().astype(np.float64)
    residual=truth['train'].astype(np.float64).copy()
    residual[:,0]-=lift_prior(torch.from_numpy(x['train'])).numpy()
    residual[:,1]=np.log(residual[:,1])
    scalers={'x_mean':phi.mean(0),'x_scale':phi.std(0),'y_mean':residual.mean(0),'y_scale':residual.std(0)}
    write_json(output/'preprocessing.json',{**{k:v.tolist() for k,v in scalers.items()},
        'raw_features':['m','canonical_p','t','alpha_deg','log10_reynolds'],
        'physics_features':12,'lift_residual_prior':'2*pi*(alpha_deg*pi/180+2*m)',
        'drag_transform':'natural_log','fit_partition':'train','embedded_in_onnx':True})
    z=(phi-scalers['x_mean'])/scalers['x_scale']; y=(residual-scalers['y_mean'])/scalers['y_scale']
    records=[]; candidates={}; native_estimators={}
    def add(name,model,parameters,start,estimator=None,history=None):
        model.eval(); val=metrics(truth['validation'],predict(model,x['validation']))
        train_metrics=metrics(truth['train'],predict(model,x['train']))
        score=.5*(val['cl']['mae']/.05+val['cd']['mae']/.0015)
        size=sum(v.numel()*v.element_size() for v in model.state_dict().values())
        record={'name':name,'parameters':parameters,'seed':plan['seed'],'validation':val,'train':train_metrics,
            'score':score,'training_seconds':time.perf_counter()-start,'state_bytes':size,
            'single_latency':benchmark(lambda rows:predict(model,rows),x['validation'][:1])}
        if history is not None: record['history']=history
        records.append(record); candidates[name]=model
        if estimator is not None: native_estimators[name]=estimator
        torch.save(model,output/f'{name}.pt')
        record['checkpoint_file_bytes']=(output/f'{name}.pt').stat().st_size
        write_json(output/'experiments.json',records)
        print(f'{name}: CL {val["cl"]["mae"]:.5f}, CD {val["cd"]["mae"]:.6f}, score {score:.3f}',flush=True)
    # Smooth tabular baselines: fixed covariance choices avoid a large optimizer search.
    for kernel_name,length,noise in [('rbf',2.,1e-3),('rbf',4.,1e-3),('matern15',3.,1e-3),
                                    ('matern25',3.,1e-3),('matern25',5.,1e-4),('matern15',5.,1e-4)]:
        start=time.perf_counter()
        kernel=RBF(length) if kernel_name=='rbf' else Matern(length,nu=1.5 if kernel_name=='matern15' else 2.5)
        estimator=GaussianProcessRegressor(kernel=kernel,alpha=noise,optimizer=None,normalize_y=False).fit(z,y)
        name=f'gp_{kernel_name}_{length}_{noise}'
        core=GPCore(estimator)
        with torch.no_grad(): error=np.max(np.abs(core(torch.tensor(z,dtype=torch.float64)).numpy()-estimator.predict(z)))
        if error>1e-7: raise ValueError('GP source bridge disagreement')
        add(name,Predictor(core,scalers,True),{'kernel':kernel_name,'length':length,'noise':noise,
            'sklearn_core_max_error':float(error)},start)
    for alpha in [.01,.1,1.]:
        start=time.perf_counter(); estimator=Ridge(alpha=alpha).fit(z,y)
        core=torch.nn.Linear(12,2)
        with torch.no_grad():
            core.weight.copy_(torch.tensor(estimator.coef_)); core.bias.copy_(torch.tensor(estimator.intercept_))
        add(f'ridge_{alpha}',Predictor(core,scalers),{'alpha':alpha},start)
    # Forest is retained for honest validation comparison, without forcing a neural winner.
    for leaf in [1,2,4]:
        start=time.perf_counter(); est=RandomForestRegressor(n_estimators=300,min_samples_leaf=leaf,random_state=plan['seed'],n_jobs=1).fit(z.astype(np.float32),y)
        with torch.no_grad(): vz=PhysicsFeatures()(torch.from_numpy(x['validation'])).numpy()
        vz=(vz-scalers['x_mean'])/scalers['x_scale']
        def forest_predict(raw):
            with torch.no_grad(): features=PhysicsFeatures()(torch.from_numpy(raw)).numpy()
            out=est.predict(((features-scalers['x_mean'])/scalers['x_scale']).astype(np.float32))*scalers['y_scale']+scalers['y_mean']
            return np.column_stack([out[:,0]+lift_prior(torch.from_numpy(raw)).numpy(),np.exp(out[:,1])])
        val=metrics(truth['validation'],forest_predict(x['validation']))
        records.append({'name':f'forest_{leaf}','parameters':{'trees':300,'min_samples_leaf':leaf},'seed':plan['seed'],
            'validation':val,'score':.5*(val['cl']['mae']/.05+val['cd']['mae']/.0015),
            'training_seconds':time.perf_counter()-start,'state_bytes':sum(t.tree_.node_count for t in est.estimators_)*64,
            'size_note':'forest uncompressed state estimate; frozen forest finalist is serialized separately',
            'single_latency':benchmark(forest_predict,x['validation'][:1])})
        native_estimators[f'forest_{leaf}']=est
        print(f'forest_{leaf}: CL {val["cl"]["mae"]:.5f}, CD {val["cd"]["mae"]:.6f}',flush=True)
    experiments=[('shared',64,'log_mse',.001,1e-4),('separate',64,'log_mse',.001,1e-4),
        ('separate',64,'absolute_mse',.001,1e-4),('separate',64,'huber',.001,1e-4),
        ('separate',64,'hybrid',.003,1e-4),('separate',128,'hybrid',.001,1e-3),
        ('shared',128,'hybrid',.003,1e-4)]
    tx=torch.from_numpy(x['train']); ty=torch.tensor(y,dtype=torch.float32); actual=torch.from_numpy(truth['train'])
    for architecture,width,loss_name,lr,wd in experiments:
        start=time.perf_counter(); torch.manual_seed(plan['seed'])
        core=TwoTargets(width) if architecture=='separate' else torch.nn.Sequential(torch.nn.Linear(12,width),torch.nn.SiLU(),torch.nn.Linear(width,width),torch.nn.SiLU(),torch.nn.Linear(width,2))
        model=Predictor(core,scalers)
        optimizer=torch.optim.AdamW(model.parameters(),lr=lr,weight_decay=wd)
        scheduler=torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer,factor=.5,patience=25)
        best=float('inf'); stale=0; state=None; history=[]
        generator=torch.Generator().manual_seed(plan['seed'])
        for epoch in range(800):
            model.train()
            for indices in torch.randperm(len(tx),generator=generator).split(64):
                optimizer.zero_grad(); batch_prediction=model(tx[indices])
                relative=torch.stack([(batch_prediction[:,0]-actual[indices,0])/.05,(batch_prediction[:,1]-actual[indices,1])/.0015],dim=1)
                transformed=torch.stack([batch_prediction[:,0]-lift_prior(tx[indices]),torch.log(batch_prediction[:,1])],dim=1)
                normalized=(transformed-model.y_mean)/model.y_scale
                logloss=torch.nn.functional.mse_loss(normalized,ty[indices])
                if loss_name=='log_mse': loss=logloss
                elif loss_name=='absolute_mse': loss=(relative**2).mean()
                elif loss_name=='huber': loss=torch.nn.functional.smooth_l1_loss(relative,torch.zeros_like(relative))
                else: loss=.7*torch.nn.functional.smooth_l1_loss(relative,torch.zeros_like(relative))+.3*logloss
                loss.backward(); optimizer.step()
            model.eval(); val=metrics(truth['validation'],predict(model,x['validation']))
            measured=.5*(val['cl']['mae']/.05+val['cd']['mae']/.0015)
            history.append({'epoch':epoch+1,'score':measured}); scheduler.step(measured)
            if measured<best: best=measured; state=deepcopy(model.state_dict()); stale=0
            else: stale+=1
            if stale>=80: break
        model.load_state_dict(state)
        add(f'nn_{architecture}_{width}_{loss_name}',model,{'architecture':architecture,'width':width,'loss':loss_name,
            'learning_rate':lr,'weight_decay':wd,'batch_size':64,'maximum_epochs':800,'patience':80},start,history=history)
    write_json(output/'experiments.json',records)
    winner=min(records,key=lambda r:r['score']); name=winner['name']
    passed=winner['validation']['cl']['mae']<=.05 and winner['validation']['cd']['mae']<=.0015
    write_json(output/'selection.json',{'winner':winner,'selection_gate_passed':passed,'final_test_evaluated':False,
        'plan_sha256':digest(root/'configs/recovery-v1/plan.json'),'final_simulations_locked':True})
    if name not in candidates: raise RuntimeError('forest won: implement its export without substituting an inferior model')
    torch.save(candidates[name],output/'selected.pt')
    print('FROZEN SELECTION:',name,'validation gate:',passed,flush=True)
    return passed
