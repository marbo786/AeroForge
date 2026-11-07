# Controlled recovery data

Source: the same hash-pinned native XFOIL 6.99 viscous solver and finite-edge Phase 2 geometry engine as the original pilot. The 160-panel, Mach-zero, Ncrit-9 setup and eligibility rules were not relaxed.

| Batch | Attempted | Eligible | Role |
| --- | ---: | ---: | --- |
| train-new | 336 | 325 | 16 new training geometries |
| validation | 168 | 163 | 8 fresh validation geometries |
| old-mid-re | 140 | 131 | Original geometries at Re 250,000 |
| old-minus2 | 40 | 35 | Original geometries at -2 degrees |
| final-locked | 168 | 165 | 8 reserved final geometries, generated after selection |

Each batch retains the same raw/manifest/Parquet/CSV/report structure documented in `../pilot-v1/README.md`. Combined with the original pilot, there are 1,046 eligible operating points over 52 geometries; no point is duplicated. The consumed original test geometries remain diagnostic-only, including their new operating points.

`configs/recovery-v1/plan.json` fixes geometry roles, random seed and generation estimates. The final model and selection were hashed in `artifacts/recovery-v1-complete/unlock.json` before the final dataset existed. The one-use final evaluation marker prevents rerunning the experiment for selection.

`solver-diagnostics/` contains four separate repeat/panel-sensitivity solves on the two worst old diagnostic cases. Two use 320 panels. These are never included in training labels, avoiding mixed solver discretization. They show repeatability at 160 nodes and nonzero discretization uncertainty.

All finite difficult labels remain eligible unless the unchanged solver-quality rules reject them. Nonconverged, nonfinite, suspicious-transition and failed points are retained as attempts rather than imputed. Git attributes preserve original bytes/padding/line endings and artifact hashes. The solver executable and distribution are not redistributed.
