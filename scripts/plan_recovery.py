"""Predeclare development coverage and a new final geometry reservation."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
base = json.loads((ROOT/'configs/pilot-v1.json').read_text())
train = ['0009','0011','0013','0016','1212','1616','2214','2410','3210','3414','3618','4216','4410','5214','5612','6418']
validation = ['0014','1416','2512','3318','4514','5310','6216','6512']
final = ['0010','1510','2316','3512','4314','5518','6416','6616']
plan = {'version':'recovery-v1','seed':20261107,
    'old_pilot_role':'17 old geometries train; three consumed old-test geometries remain diagnostic-only',
    'diagnostic_codes':['0012','4210','6618'],
    'new_training_codes':train, 'validation_codes':validation, 'locked_final_codes':final,
    'final_simulation_after_selection_only':True,
    'selection':'minimum validation mean(CL_MAE/0.05,CD_MAE/0.0015); both individual validation targets required before final evaluation',
    'cl_mae_target':.05,'cd_mae_target':.0015,
    'simulation_estimate':{'additional_attempts':852,'minutes_estimate':[5,10],'megabytes_estimate':[10,15],
        'cpu_workers':1,'downloads':0},
    'training_scope':'existing pilot plus controlled development expansion; no high-drag trimming; same solver settings',
    'reynolds':[100000,250000,500000],'angles_deg':[-4,-2,0,2,4,6,8]}
out=ROOT/'configs/recovery-v1'; out.mkdir(exist_ok=False)
(out/'plan.json').write_text(json.dumps(plan,indent=2)+'\n',encoding='utf-8')
for name,codes,reynolds,angles in [
    ('train-new',train,plan['reynolds'],plan['angles_deg']),
    ('validation',validation,plan['reynolds'],plan['angles_deg']),
    ('final-locked',final,plan['reynolds'],plan['angles_deg']),
    ('old-mid-re',base['geometry_codes'],[250000],plan['angles_deg']),
    ('old-minus2',base['geometry_codes'],[100000,500000],[-2])]:
    c=dict(base,schema_version='xfoil-recovery-v1',geometry_codes=codes,reynolds_numbers=reynolds,angles_deg=angles,
        acceptance={'minimum_eligible_fraction':.7,'minimum_geometries_with_eligible_labels':len(codes) if name!='old-minus2' else 18,'reproducibility_checks':3})
    (out/f'{name}.json').write_text(json.dumps(c,indent=2)+'\n',encoding='utf-8')
print('Predeclared 33 train / 8 validation / 8 final / 3 diagnostic geometries; final simulations remain locked.')
