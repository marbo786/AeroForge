# Phase 4 recovery: accepted independent evaluation

The recovery meets the original engineering objectives on a fresh geometry-disjoint final panel: **CL MAE 0.01484 <= 0.05; CD MAE 0.000683 <= 0.0015**. The final model also passes source/ONNX/browser parity and static production verification. Phase 4 can close; Phase 5 has not started. The original failed experiment and its numerical results are preserved later in this document and in their original artifact directory.

## Root cause and quality investigation

The read-only diagnosis below preceded all new simulations and training. High drag at low Re was underfit even on the original training data (CD MAE 0.001755); the three-geometry validation panel was easier than the consumed test panel. The original log-target loss emphasized relative error, while acceptance required original-unit MAE. Low-Re mean CD error was 0.003020 versus 0.000854 at high Re. More capacity alone was not justified.

The two largest-error cases were rerun with 160 panels and reproduced the saved polar coefficients exactly. Diagnostic 320-panel solves changed CD from 0.05137 to 0.05040 and from 0.04747 to 0.04695. These changes are smaller than the original model errors (0.02349/0.01843), but show nonzero discretization uncertainty. Refined-panel results remain diagnostic only and are not mixed into the 160-panel labels. No valid high-drag points were removed, no quality threshold was relaxed, and no domain was narrowed to obtain a pass.

## Independent protocol and controlled data expansion

`configs/recovery-v1/plan.json` reserved all groups before recovery tuning. The consumed original test geometries (0012, 4210, 6618) remain diagnostic-only, including newly generated operating points. They are excluded from recovery fitting. The final eight geometries did not appear in training, validation or diagnostics.

| Recovery role | Geometries | Eligible rows |
| --- | ---: | ---: |
| Train | 33 | 657 |
| Validation | 8 | 163 |
| Consumed-test diagnostics | 3 | 61 |
| Fresh final test | 8 | 165 |

Development comprises 17 original geometries and 16 new training geometries, plus eight new validation geometries. The new final codes are 0010, 1510, 2316, 3512, 4314, 5518, 6416 and 6616. Canonical `(m,p,t)` IDs define groups; every role is disjoint. Excluding diagnostics, allocation is approximately 67/16/16 percent by geometry. Group IDs, sample IDs, source hashes and seed 20261107 are recorded.

Coverage was expanded deliberately to intermediate thickness/camber positions, Re 250,000, and -2 degrees, keeping Re 100,000 and difficult valid cases. The original solver configuration, failure rules and finite-edge geometry convention were retained. Five bounded batches attempted 852 new points, producing 819 eligible labels, with 21 final nonconvergences and 12 suspect exclusions. Together with the original 227 labels this gives 1,046 eligible cases across 52 geometries. No operating point is duplicated. The five batches produced:

| Batch | Attempts | Eligible |
| --- | ---: | ---: |
| New training geometries | 336 | 325 |
| New validation geometries | 168 | 163 |
| Original geometries at Re 250,000 | 140 | 131 |
| Original geometries at -2 degrees | 40 | 35 |
| Reserved final geometries | 168 | 165 |

The expansion was estimated beforehand at 852 simulations, 5–10 CPU minutes and 10–15 MB, without downloads. Actual solver batch times including repeats/output total about 249 seconds; raw expansion evidence is about 10.2 MB. Every batch passed its predeclared source-quality gates. The 819/852 eligible fraction is **96.13%**; all rejected/suspect attempts remain preserved. No new post-stall claim or Re 1,000,000 coverage is implied.

The final data did not exist during tuning. After the winner and ONNX parity were frozen, `unlock.json` bound model/selection/plan hashes and recorded final-data absence. Only then were the reserved geometries simulated. The final evaluation writes a one-use marker and refuses a second evaluation command. Its baseline comparisons are a single reporting pass, not new selection. Tests may reproduce the frozen numeric metrics as audits; they do not retune or make another model decision.

## Experiments and selected architecture

Nineteen reproducible candidates were compared on validation data only: six fixed RBF/Matérn Gaussian-process variants, three Ridge penalties, three 300-tree forest leaf sizes, and seven shared/independent neural configurations. Original data/metrics were not overwritten. A first sweep hit an artifact-path variable reuse bug after its baselines; the defect was corrected and the unchanged settings rerun in `recovery-v1-complete`, retaining the incomplete attempt directory. No final data had been simulated at that point.

All recovery models use explicit physics-related features from the same five input values: camber, canonical camber position, thickness, angle in radians, log10(Re), camber-thickness interaction, camber/position ratios with safe symmetric handling, squared angle, Reynolds-angle/thickness interactions and an effective-angle approximation. A thin-airfoil-inspired lift trend `2*pi*(alpha_rad+2*m)` is corrected by a freely learned residual; it is not imposed as exact physics. CD remains log-transformed and positive after exponentiation. Train-only standardization and every transformation/inversion are embedded in ONNX. The external contract remains float32 `[m, canonical_p, t, alpha_deg, log10(Re)] -> [CL,CD]`.

The controlled neural ablations on the same development data include:

| Neural variant | Validation CL MAE | Validation CD MAE |
| --- | ---: | ---: |
| Shared 64x64, log-target MSE | 0.01316 | 0.000845 |
| Independent 64x64, log-target MSE | 0.01292 | 0.000797 |
| Independent 64x64, original-unit scaled MSE | 0.01416 | 0.000853 |
| Independent 64x64, original-unit scaled Huber | 0.01110 | 0.000742 |
| Independent 64x64, hybrid (selected) | 0.01078 | 0.000643 |
| Independent 128x128, hybrid | 0.01188 | 0.000673 |
| Shared 128x128, hybrid | 0.01267 | 0.000647 |

The selected model has **two independent 12→64→64→1 SiLU networks**, one for lift residual and one for log drag, totaling 10,114 learned parameters. The hybrid objective combines 0.7 original-unit target-scaled Smooth-L1 with 0.3 standardized transformed-target MSE. Scaling uses the unchanged 0.05/0.0015 engineering tolerances; it is not division by small observed CL/CD. AdamW lr 0.003, weight decay 0.0001, batch 64, an 800-epoch maximum and patience 80 were fixed; it stopped after 468 epochs and restored its validation-best checkpoint. It was not refit after final selection.

Validation score is still mean(CL_MAE/0.05,CD_MAE/0.0015), with both individual validation targets required before final unlock. The selected score is about 0.322 versus about 0.346 for the best Matérn baseline. All configurations, metrics, times, state/checkpoint sizes, latency measurements and seed are in `experiments.json` and its [comparison table](../artifacts/recovery-v1-complete/experiments.md). Total recorded complete-sweep training/measurement time was about 194 seconds on one CPU thread. Forest state sizes are explicitly estimates; the frozen forest finalist is serialized separately.

These experiments show measurable benefits of independent heads and the hybrid loss on the expanded dataset. The separate contribution of each engineered feature and data expansion was not isolated; no claim is made that any one feature or more data alone caused the improvement.

## Single independent final evaluation

All rows below use the **same 165 fresh final cases**. The original model remains frozen at its previous weights and preprocessing, enabling a fair same-set comparison despite its smaller training dataset.

| Model | CL MAE | CL RMSE | CL R² | CD MAE | CD RMSE | CD R² |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Original pilot MLP | 0.04259 | 0.05869 | 0.98590 | 0.001821 | 0.003422 | 0.84972 |
| Recovery Ridge | 0.05303 | 0.07863 | 0.97469 | 0.002597 | 0.004370 | 0.75493 |
| Recovery Random Forest | 0.02491 | 0.04144 | 0.99297 | 0.001268 | 0.002278 | 0.93340 |
| Recovery Matérn GP | 0.01951 | 0.03528 | 0.99491 | 0.000896 | 0.002009 | 0.94821 |
| Selected independent MLP | **0.01484** | **0.02553** | **0.99733** | **0.000683** | **0.001165** | **0.98260** |

For historical continuity, the original consumed 35-row panel had MAEs 0.05897/0.003283. The recovered model has 0.01749/0.001024 on those same old rows, but this is explicitly **diagnostic**, not fresh test evidence. Do not compare the original 35-row error directly against the new 165-row error as if their difficulty were identical.

Final error distributions remain imperfect: CL median/p95/max absolute errors are 0.00791/0.05187/0.12565; CD 0.000374/0.002781/0.005219. Aggregate MAE targets do not imply every individual prediction meets those tolerances. At Re 100,000, CD MAE remains highest at 0.001293, versus 0.000531 at 250,000 and 0.000244 at 500,000. NACA 5518 and 6616 are the most difficult final geometries; detailed geometry/Re/angle/camber-family slices are retained in `final-evaluation.json`. No post-test domain trimming or retraining occurred.

## Export, production verification and limits

The selected ONNX model is **49,781 bytes**, with all feature construction, scaling, lift-trend restoration and log-drag inversion embedded. Native source/ONNX max difference is 1.19e-7 on 881 development/diagnostic vectors; the Python suite additionally verifies the 165 final inputs. Production browser WASM max difference is 1.49e-7 on those 881 vectors, well below 1e-5 in original coefficient units.

On the recorded Windows Chrome 156.0.8078.81 machine, desktop single-row browser p50/p95 was 0.3/0.5 ms and batch-17 0.3/0.5 ms. Mobile viewport emulation measured 0.2/0.4 ms and 0.3/0.4 ms, respectively; it is not phone hardware evidence. Native ONNX single-row p50/p95 was approximately 0.22/0.36 ms. Measurements used ten warmups and 100 session runs, exclude initialization/download, and are timer/hardware dependent.

Validation passed: **104 Python tests**, **21 Node tests**, strict TypeScript, a fresh static Next.js production build and **14 browser smoke tests**. Original failing-model metadata/exports remain checked separately, so historical failure cannot be silently turned into a pass. Real expansion polars, raw hashes, filter decisions, final lock chronology, scaler provenance, checkpoint/ONNX agreement and group isolation are audited. The visible feasibility UI remains unchanged; no Phase 5 studio was built.

Artifacts are under `artifacts/recovery-v1-complete/`; original failure artifacts remain under `artifacts/pilot-surrogate-v1/`. New raw data is under `data/recovery-v1/`. Reproduction sequence, into new/refusing-existing output locations, is: `plan_recovery.py`, the four development `run_pilot.py` configurations, `tune_recovery.py`, then `finalize_recovery.py prepare`, `simulate`, and `evaluate`. The existing outputs/one-use final marker intentionally prevent accidental reruns of this consumed final experiment. Any subsequent tuning needs a new independent final reservation.

This closes the stated Phase 4 engineering criteria **against eligible XFOIL labels on this finite test panel**. It does not establish experimental accuracy, all-domain coverage, calibrated uncertainty, post-stall behavior, Reynolds >500,000, or a mathematical guarantee between sampled conditions. Missing/failing XFOIL cases still represent selection bias. Keep these restrictions visible in Phase 5; do not extrapolate silently. No public deployment was performed.

References for the recovery implementations: [scikit-learn Matérn kernel](https://scikit-learn.org/stable/modules/generated/sklearn.gaussian_process.kernels.Matern.html) and [PyTorch Smooth-L1 loss](https://docs.pytorch.org/docs/2.12/generated/torch.nn.SmoothL1Loss.html). The GP was a genuine competing baseline, not a decorative comparison; selection favored the measured validation winner.

---

# Preserved original pilot experiment and pre-recovery diagnosis

## Recovery diagnosis (before new simulation or training)

The original experiment is preserved below and in `artifacts/pilot-surrogate-v1/`. The consumed 0012/4210/6618 test set is now diagnostic only. The read-only audit in `scripts/diagnose_recovery.py` found:

- Only 227 eligible rows and 20 distinct canonical geometries, two Reynolds levels (111/116 rows), and no samples at -2 degrees. Six other angle levels have 33–40 rows. There are no exact duplicate operating points or duplicated geometry identities disguised by symmetric p. Similar foils at different thicknesses are physically different samples, not duplicate labels.
- CL spans -0.6399 to 1.4995. CD spans 0.00521 to 0.05543, median 0.01472 and 95th percentile 0.03619. The largest CD values belong to low-Re, strongly cambered/thick geometries and can persist across adjacent angles. They are not automatically invalid outliers.
- The saved MLP already uses log10(Re), log(CD), training-only scalers and geometry-disjoint groups. Those transformations alone therefore cannot constitute a recovery. Its training CD MAE is 0.001755, above the target, versus validation 0.001266 and consumed-test 0.003283. This is not a simple case of very low training loss followed by classic overfitting: high-drag cases are underfit and the three-geometry validation set was easier than the diagnostic test set.
- The worst errors are concentrated at Re 100,000, including -4, 0, 2 and 4 degrees, not solely near positive-angle stall. The worst point (4210, Re 100,000, -4 degrees) has CD 0.05137 versus predicted 0.02788. The five worst rows contribute 20.4% of total absolute drag error. 6618 low-Re drag is persistently underestimated; log-target MSE prioritizes relative errors rather than the requested original-unit MAE.
- Solver review retains the existing 10 nonconverged and 43 suspect exclusions. All configurations/hashes and canonical split IDs audit correctly. No valid high-drag row is removed, and no supported-domain narrowing is applied to make the target easier.

Diagnosis supports testing original-unit-aware drag losses, independent target models and smooth/interaction-aware baselines. Additional coverage is justified to replace an easy three-geometry validation panel and provide a genuinely fresh final test, not as an assumption that larger networks or more rows automatically fix errors. The machine-readable distribution/error audit is under `artifacts/recovery-diagnosis/`.

**Status: blocked on predictive accuracy.** Training, native ONNX parity and production-browser execution work, but the validation-selected MLP misses both predeclared final-test MAE targets. These are research artifacts, not an approved public aerodynamic model. No Phase 4 commit or Phase 5 implementation is authorized by this result.

## Dataset, split and experiment protocol

The experiment uses only the 227 eligible XFOIL 6.99 labels in `data/pilot-v1/labels.parquet`, pinned by SHA-256 in `configs/training-v1.json`. Suspect and failed solver attempts remain excluded. No additional simulation data was generated for this phase.

The geometry allocation was fixed before training or model-error evaluation:

| Partition | Geometries | Rows | Geometry allocation |
| --- | ---: | ---: | --- |
| Train | 14 | 156 | All remaining pilot geometries |
| Validation | 3 | 36 | NACA 0015, 2618, 4412 |
| Test | 3 | 35 | NACA 0012, 4210, 6618 |

Allocation deliberately includes symmetric and cambered examples and different thickness/camber positions. Canonical geometry IDs, not individual rows, define group membership. Symmetric p is zero. Tests confirm disjointness, canonical IDs, absence of duplicate operating points and complete row assignment. This is a small, explicit 70/15/15 geometry allocation, not stratified proof that every domain corner is represented.

The primary selection score is the validation-only mean of `CL_MAE/0.05` and `CD_MAE/0.0015`, lower is better. Those engineering budgets came from the Phase 3 proposal and were frozen in configuration before training. The split was not changed after observing model errors. Test metrics were computed only after the overall winner and each family finalist were recorded to `selection.json`. Test results did not choose a model or tune hyperparameters, and no corrective retraining was performed after the targets failed.

## Features and preprocessing

The model consumes a float32 tensor `features` with shape `[batch, 5]` in this order:

```text
[m, canonical_p, t, alpha_deg, log10(Re)]
```

The output tensor `coefficients` has shape `[batch, 2]` in original dimensionless `[CL, CD]` units. Callers must validate/canonicalize geometry and construct log10(Re); they must not pass raw Re as the fifth feature.

All input means/standard deviations and target preprocessing are fitted on the 156 training rows only. Targets use identity CL and natural-log CD, followed by per-target standardization; CD is exponentiated after inverse standardization. This ensures positive drag without clipping predicted coefficients. The exact scalers are versioned in `preprocessing.json` and embedded in every ONNX graph, so consumers must not standardize again. Geometry validation bounds are not evidence of aerodynamic applicability.

The source implementations use float32 inputs/scalers. Python tests reproduce saved scaling statistics from training rows and compare saved PyTorch predictions with ONNX in original coefficient units.

## Models trained

- Ridge: alpha 0.01, 0.1, 1 and 10. Finalist: alpha 0.01.
- Random Forest: 200 trees, minimum leaf sizes 1, 2 and 4; deterministic seed and one CPU worker. Finalist: minimum leaf size 1.
- PyTorch MLP: SiLU networks with hidden widths `[64,64]` and `[128,256,256,128]`, learning rates 0.001 and 0.003, AdamW, weight decay 0.0001, batches of 128, at most 300 epochs, validation early stopping patience 25 and validation LR scheduling. Finalist: `[128,256,256,128]`, learning rate 0.003.

Eleven configurations were considered. Seed 42, deterministic PyTorch operations and one CPU thread were used. Histories and validation metrics for all configurations are saved. Only the validation-best model in each family was evaluated in the final test reporting pass. The winner was not refitted on validation data, preserving the exact selected checkpoint for all reported results.

## Held-out results

| Family | Validation selection score | Test CL MAE | Test CL RMSE | Test CL R² |
| --- | ---: | ---: | ---: | ---: |
| Ridge | 1.4485 | 0.08986 | 0.13252 | 0.93455 |
| Random Forest | 1.0642 | 0.08821 | 0.10429 | 0.95947 |
| MLP (selected) | 0.8423 | 0.05897 | 0.08607 | 0.97239 |

| Family | Test CD MAE | Test CD RMSE | Test CD R² |
| --- | ---: | ---: | ---: |
| Ridge | 0.005367 | 0.008854 | 0.51121 |
| Random Forest | 0.003154 | 0.005054 | 0.84071 |
| MLP (selected) | 0.003283 | 0.006539 | 0.73338 |

The MLP is the correct validation-selected research candidate. The forest has a better test drag MAE, but switching to it based on this result would select on the test set. No such switch was made. The MLP's CL MAE 0.05897 exceeds 0.05, and CD MAE 0.003283 exceeds 0.0015. High aggregate R² does not pass those error targets.

`evaluation.json` reports errors by angle, Reynolds number, geometry ID and camber family. Particularly weak unseen-geometry results are NACA 6618 (CL MAE 0.11008, CD MAE 0.005358) and drag on NACA 4210 (CD MAE 0.003614). NACA 0012 is better (CL MAE 0.03797, CD MAE 0.001049), but this does not justify retroactively restricting the domain using test outcomes. The test sample comprises only three geometries and has substantial missing/failure-selection uncertainty.

## ONNX and browser verification

All three family finalists export successfully with opset 17, dynamic batch dimensions and embedded preprocessing/postprocessing. Ridge uses an equivalent linear PyTorch wrapper; the forest uses sklearn-onnx plus standard pre/postprocessing nodes; the MLP uses the explicit supported legacy PyTorch exporter (`dynamo=False`) for this small feed-forward graph. No quantization was used.

| Export | Bytes | Maximum native source/ONNX absolute difference |
| --- | ---: | ---: |
| Ridge | 1,434 | 3.73e-9 |
| Random Forest | 1,725,127 | 1.67e-6 |
| MLP | 534,037 | 3.58e-7 |

All native differences are below `1e-5` in original coefficient units. The suite contains all 227 dataset inputs plus 72 unlabeled boundary/interior inputs: 299 total. These extra inputs test numerical export fidelity, not physical accuracy or solver convergence. The MLP meets the preferred sub-1 MB model size; the forest exceeds it and was not the validation winner. No fidelity was traded for convenience or size.

The selected MLP also ran through ONNX Runtime Web 1.31.1 WASM in the served Next.js production static export, at 1440px and 390px. Maximum source/browser difference was 2.98e-7 over all 299 inputs. It ran on one CPU thread with `crossOriginIsolated=false`, no page errors and no backend inference. The visible `/spike/` UI still displays its separately labeled Phase 1 affine fixture; trained-model verification occurs only in the test harness, not in a Design Studio.

Windows Chrome 156.0.8078.81 measured session-run p50/p95 of approximately 0.2/0.3 ms for a single row. A 17-row batch measured 0.6/0.7 ms at desktop width and 0.5/0.6 ms at mobile width. Both tests ran on the same desktop computer; mobile viewport emulation is not a phone performance measurement. Each benchmark used 10 warmups and 100 runs, excluding initialization, asset download and feature construction. Browser timer resolution limits the precision of these short measurements. Native per-family CPU p50/p95 measurements are in `evaluation.json`; timing scopes differ because ONNX embeds normalization while source benchmarks receive normalized arrays.

## Reproduction and artifacts

Training used the existing Python 3.10.10 CPU PyTorch 2.12.0+cpu installation through a project-local `.venv-ml` with system packages exposed. Small export packages were installed only inside that environment: ONNX 1.19.1, native ONNX Runtime 1.23.2 and sklearn-onnx 1.19.1. `requirements-ml.txt`, `requirements-data.txt` and `requirements-test.txt` pin the scientific dependencies. `environment.json` records the actual local versions. No GPU or system interpreter was installed.

From the repository root in a configured environment:

```sh
python scripts/train_surrogate.py --output artifacts/new-predeclared-run
python -m pytest -q
cd web
npm run verify
```

The training command refuses an existing artifact directory and exits nonzero when the selected model misses accuracy or numerical-parity gates. Do not rerun this fixed test experiment to search for a passing seed. A fresh environment should install CPU PyTorch from its official CPU wheel index and the pinned requirement files. CI has been prepared for CPU ML audit dependencies but has not run remotely.

The current local research artifacts under `artifacts/pilot-surrogate-v1/` contain model metadata, frozen configuration/selection, split membership, preprocessing, candidate histories, full/sliced evaluation, all three ONNX models, the trained MLP checkpoint, golden vectors and desktop/mobile browser evidence. Hashes bind the selected model, preprocessing, config and dataset. Original-byte Git attributes protect those hashes if the experiment is later retained in a commit.

Tests verify group isolation, feature conventions, train-only scaling, selection policy, failed accuracy status, saved weights, graph checking, output shape/reproducibility/positive drag, numerical parity, metadata hashes and reported metrics. The final software checks pass, but the product accuracy acceptance gate does not. A nonblocking third-party pyreadline console-cleanup warning appeared after one passing Windows pytest run; it did not change the exit status or model results.

## Blocker and corrective proposal

The pilot provides too little evidence for release readiness, and the observed errors make Phase 4 incomplete under `SPEC.md`. No commit was made, no model was promoted to public use and Phase 5 did not start. This follows the explicit rule to document failed acceptance rather than commit a failing phase.

Recommended next work requires a new instruction: design a broader, reproducible XFOIL dataset with more geometries, Reynolds levels and reliable non-stall points; reserve a **fresh** geometry-disjoint final test set before tuning; use the current consumed test results only as diagnostic evidence; then reconsider capacity/regularization and error budgets using training/validation evidence. Any domain narrowing needs independent validation rather than selecting favorable points from this test set. Changing a target after seeing the failures must be explicit and justified, not described as passing the original experiment.

These metrics measure agreement with XFOIL's eligible labels only. They do not establish wind-tunnel accuracy, post-stall validity, solver discretization convergence, uncertainty calibration, a continuous validated domain or safety for engineering decisions.

References: [PyTorch ONNX export](https://docs.pytorch.org/docs/2.12/onnx.html), [sklearn-onnx converters](https://onnx.ai/sklearn-onnx/), [ONNX Runtime Web deployment](https://onnxruntime.ai/docs/tutorials/web/deploy.html). Exact working package versions are recorded locally rather than inferred from latest documentation.
