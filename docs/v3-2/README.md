# Coefficient reliability evidence

This audit replays the accepted coefficient ONNX graph on the frozen final panel from XFOIL 6.99. Geometry, solver settings, preprocessing, held-out data and the original benchmark retain their original provenance. The report describes agreement on 165 eligible operating points from eight previously unseen NACA airfoils, out of 168 attempted solves. [Frozen benchmark](../../artifacts/recovery-v1-complete/final-evaluation.json) · [Machine-readable diagnostics](../../artifacts/reliability-v1/diagnostics.json)

## Frozen errors

Coefficients and errors are dimensionless. Bias is the mean of prediction minus XFOIL. The replay differs from the published CL and CD MAE by less than `4e-9` and `5e-10`, respectively, on the reviewed Windows CPU installation.

| Coefficient | Mean absolute error | Signed bias | Absolute error p95 | Maximum absolute error |
| --- | ---: | ---: | ---: | ---: |
| CL | 0.014843 | +0.002631 | 0.051869 | 0.125651 |
| CD | 0.000683 | +0.000127 | 0.002781 | 0.005219 |

| Reynolds number | Eligible / attempted | CL MAE | CD MAE |
| ---: | ---: | ---: | ---: |
| 100,000 | 54 / 56 | 0.026084 | 0.001293 |
| 250,000 | 55 / 56 | 0.011205 | 0.000531 |
| 500,000 | 56 / 56 | 0.007576 | 0.000244 |

At XFOIL CD ≥ 0.03, CL MAE was 0.039548 and CD MAE was 0.002736 over 15 points from five geometries. The largest per-airfoil CL MAE was 0.030754 on NACA 6616 across 20 eligible points. NACA 5518 had the largest per-airfoil CD MAE of 0.001424 across 21 eligible points. At −4° the panel had its highest angle-slice CD MAE, 0.000943 across 23 points. CL MAE peaked at 2°, 0.019124 across 24 points. The 5% camber and 18% thickness slices are the same NACA 5518 cases, and the 60% camber-position slice contains only NACA 6616. Those slices confound geometry factors. [CL plot](cl-errors.png) · [CD plot](cd-errors.png)

The report groups input slices by exact sampled values. Camber, position and thickness are in percent chord, with symmetric sections grouped separately for camber position. True XFOIL CL bins use cut points 0, 0.5 and 1, and true XFOIL CD bins use 0.01, 0.02 and 0.03. Each cut point belongs to the higher bin. Coefficient bins include eligible rows with known labels. Their attempted denominator is undefined. Every input slice reports eligible and attempted counts and the number of eligible geometries. The excluded attempts were NACA 3512 at Re 100k and −4° (suspect transition location), NACA 6416 at Re 250k and 8° (nonconvergence) and NACA 6616 at Re 100k and 6° (nonconvergence). Failure exclusions restrict what these error summaries cover.

A 4,000-draw bootstrap resamples eight whole geometries per draw with replacement, retains operating points within each geometry and recomputes the row-weighted MAE. The observed 2.5th–97.5th percentile ranges were 0.00915–0.02128 for CL MAE and 0.000425–0.000979 for CD MAE. These describe how much the aggregate changes when resampling this small panel. The estimates depend on the finite geometry set and eligible solver labels.

## Training coverage

The versioned browser index contains 657 eligible rows across 33 training geometries. Each group stores canonical m, p and t and the accepted alpha/Re pairs. The browser authenticates the index bytes by SHA-256 after the first eligible prediction completes or reaches an error. The accepted model hash and training Parquet hash bind its provenance. The index receives no development, diagnostic or final operating points.

For each training row, divide differences in m, p, t, alpha and log10(Re) by their corresponding manifest spans. When either input is symmetric, omit p from the sum. Take the square root of the minimum sum of squared normalized differences. The limited-coverage threshold is the 90th percentile of distances from training rows to rows belonging to other training geometries, **0.3333333333333333**, using linear percentile interpolation over the 657 rows. The same comparison uses an absolute `1e-12` tolerance at the threshold offline and in the browser.

| Development comparison | Geometry only | Geometry and flow |
| --- | ---: | ---: |
| Eligible development rows flagged | 0 / 163 | 1 / 163 |
| Development geometries with flagged rows | 0 / 8 | 1 / 8 |
| Spearman rank association of group-mean distance with CL MAE | 0.54 | 0.33 |
| Spearman rank association of group-mean distance with CD MAE | 0.47 | 0.48 |

Both variants use the identical leave-one-geometry-out threshold rule. The sole flagged development row had absolute errors 0.00934 CL and 0.000229 CD, smaller than the development mean for either coefficient. Geometry and flow is the release choice because it distinguishes coverage holes at specific angles and Reynolds numbers, including interpolation between sampled Reynolds levels. The archived development data give very limited evidence for the warning's relationship to error. The Studio displays the score as a geometric/operating-condition distance and shows separate measured error evidence. Confidence intervals require fresh disjoint calibration and evaluation geometries. The available splits have already served training, selection, diagnosis or the frozen final evaluation.

For V3.3, freeze coverage-v1 and its threshold before the optimizer's independent verification. Candidate ranking should exclude limited-coverage inputs and record that rejection. Optimizer readiness also requires testing search constraints, drag safeguards and shortlisted candidates, with its own solver verification protocol. A nearby candidate can still have meaningful error.

## Reproduce

Use the pinned ML/data dependencies in the existing Python environment. The optional plots use Matplotlib 3.10.8. From the repository root, choose fresh output folders.

```sh
python scripts/audit_reliability.py --output reliability-replay --plots reliability-replay/plots
```

The replay verifies the frozen model and final dataset hashes, checks the development split membership, and compares the ONNX aggregate MAE to the published MAE at an absolute tolerance of `1e-6`. It writes only derived artifacts under the chosen output paths. `coverage-v1.json` is the compact index, `summary.json` binds the index and records display statistics, and `diagnostics.json` contains hashes, counts, signed errors, quantiles, excluded attempts and the coverage comparison. Revisions to indexed rows or the threshold require a new asset filename for immutable caching.
