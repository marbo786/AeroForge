# AeroForge progress

Last updated: 2026-11-07 (Asia/Karachi).

## Current phase and session rule

Phase 5 is complete on 2026-11-07 (Asia/Karachi), following explicit authorization. The responsive Design Studio uses accurate SVG geometry and real local ONNX inference with validation, telemetry, loading/error/retry and applicability states. Desktop/mobile screenshots were captured, inspected and refined. Phase 6 has not started and requires a new instruction. The accepted Phase 4 model and all original evidence remain unchanged.

Every coding session must begin by reading `docs/SPEC.md` and this file. The complete user specification is preserved byte-for-byte in `docs/SPEC.md`; this tracker supplements it and does not weaken its requirements. Work on one approved phase, validate it, update this tracker, commit it when possible, summarize, and stop. Never begin the next phase silently.

## Phase 5: completed tasks and acceptance

- Re-read the specification, tracker and handoff; inspected the accepted model metadata, shared geometry engine, runtime, production tests and static architecture. Read and applied the frontend-design skill. Implemented only the approved editor/single-condition telemetry scope.
- Built a graphite engineering workbench with cyan section outlines, amber evidence warnings, compact parameter controls and a central chord-normalized drawing. Self-hosted Geist and JetBrains Mono avoid external font requests. Downloaded only the small official JetBrains font (92,380 bytes) and OFL license; no JavaScript dependencies or system installations were added.
- `/` and `/studio/` render the real Design Studio. `/spike/` preserves the labeled infrastructure fixture and its independent regression tests. Ordinary anchors preserve the verified static navigation behavior.
- Reused the tested NACA equations and 201-point-per-surface contour, preserving finite trailing edge and symmetric canonicalization. The SVG maintains equal axis scales and shows the actual surface, mean camber, grid, chord dimension, leading/trailing-edge annotations and positive nose-up incidence about quarter chord. Brief shape/rotation transitions respect reduced motion.
- Added ten presets, synchronized range/numeric controls with units, reset and explicit draft validation. Symmetric camber position displays canonical zero and is disabled. Invalid edits retain an identified last valid geometry and withhold coefficients. Mobile leads with geometry, collapses controls behind an accessible expanded-state button, supports touch controls and stacks telemetry.
- Added `web/lib/inference/surrogate.ts`: raw five-feature contract, strict geometry/angle/Re checks, embedded-transform awareness, lazy same-origin runtime/model loading, SHA-256 verification of the accepted model, reused one-thread WASM session, output-shape/finite/positive-drag checks and safe L/D. Model bytes, weights, scalers, solver evidence and evaluation reservations were not changed.
- Debounced inference by 80 ms and cancelled display updates from superseded requests. Added honest loading states, withheld/stale-result handling, visible error/retry instructions and page-reload guidance for a failed WASM initialization. Latency is the measured session execution, including first-run overhead, excluding download/init; no synthetic readouts.
- Retained candidate operating controls through 12 degrees / Re 1,000,000, but withhold predictions beyond -4 to 8 degrees / Re 100,000–500,000. Visible finite-panel XFOIL, nonexperimental, non-post-stall and continuous-domain caveats remain. Intermediate Re values are labeled interpolation; low-Re drag risk is surfaced. Bounds do not imply full continuous-domain validation.
- Captured and actually inspected initial production screenshots at 1440x1000 and 390x844. Dedicated refinement moved incidence text off the surface, separated the trailing-edge/axis labels, enlarged mobile SVG annotations and applied the specified mono typeface. Captured and inspected final full-page images at the same viewport sizes: `docs/phase-5/desktop.png` and `mobile.png`; initial captures are preserved beside them. Both layouts and expanded mobile controls pass overflow checks.
- Updated README, architecture and `docs/phase-5/README.md`. Next.js generated `web/AGENTS.md` during the diagnostic development run; retained its local-version documentation guidance and consulted the bundled font/CSS guides. `docs/SPEC.md` is unchanged, with original SHA-256 `FCFC6299EB5405FE6C0C0DAAB7B10DC4B34AE0647B56DFD68760BBEF066AD464`.

### Phase 5 validation results

| Gate | Actual result |
| --- | --- |
| Python suite | 104 passed, 37.38 seconds |
| Node suite | 23 passed, including raw/canonical feature contract and pre-runtime domain rejection |
| Strict TypeScript | Passed |
| Static production build | Passed; `/`, `/studio/` and `/spike/` exported statically |
| Production Playwright suite | 22 passed, 43.4 seconds, Windows installed Chrome |
| Studio numeric/geometry checks | Displayed CL/CD match frozen source-model vectors at display precision; SVG contour matches tested generator; positive incidence orientation verified |
| Interaction/error checks | Presets, reset, symmetric p, numeric validation, keyboard sliders, rapid changes, reduced motion, model failure/retry, corrupt model/hash rejection, missing WASM and bounds withholding passed at both sizes |
| Browser network/console | Normal studio flow has zero external requests and zero browser console/page errors |
| Visual review | Initial and refined 1440px/390px captures opened and inspected; no horizontal overflow |

Initial failures were investigated and fixed. A float32 golden boundary encoded slightly below 8% thickness was restored to its intended physical UI precision in the test, preserving strict validation. A real React hydration failure came from multiple JSX fragments inside the SVG title; a single formatted string fixes SSR/client agreement and the clean-console gate. Diagnostic `next dev` exposed Turbopack's narrower root excluding the shared geometry/model JSON; dev now uses webpack consistently with the verified production build. A restricted-run localhost denial and generated-file EPERM were resolved through approved local test/build execution; neither was counted as a passing check.

Mobile evidence is viewport/touch emulation on desktop Chrome, not phone performance or broad browser validation. Model performance/accuracy remains finite XFOIL agreement as documented in Phase 4. No charts, comparison, URL sharing, deployment, remote push, training or new simulation were performed. No Phase 5 blocker remains.

Phase 5 commit: `build interactive design studio` on the existing `codex/phase-1-onnx` branch. Resolve the hash with `git log -1 --format=%H`; a commit cannot include its own hash. The pre-existing untracked `docs/HANDOFF.md` was read and left outside this phase commit. Stop and await instruction for Phase 6.

## Phase 4 recovery: completed tasks and acceptance

- Read `docs/SPEC.md`, this tracker, `docs/ML.md` and the solver/training/evaluation code before changes. Followed the attached recovery request: diagnosed CD error before new training or simulation, retained all historical metrics/artifacts and never began Phase 5.
- Created a read-only distribution/prediction audit in `scripts/diagnose_recovery.py`, saved under `artifacts/recovery-diagnosis/`, and documented it in `docs/ML.md` before expansion. The original 227-row/20-geometry pilot had two Re levels, no -2-degree rows and no duplicate operating points. CD ranged 0.00521–0.05543; the five worst rows contributed 20.4% of absolute drag error.
- Root cause evidence: original training CD MAE 0.001755 already missed the target; old validation was easier than the consumed test; low-Re mean CD error was 0.003020 versus 0.000854 at high Re. Large errors occurred at -4 through 4 degrees too, not just near positive-angle stall. Log-target MSE underweighted large original-unit drag errors. No valid high-drag rows were removed.
- Repeated the two worst old cases at 160 panels, reproducing all saved polar coefficients. Separate 320-panel diagnostics changed CD by 0.00097/0.00052, showing nonzero discretization uncertainty smaller than the original model errors. These refined-panel values remain diagnostic-only and are never mixed into training.
- Predeclared `configs/recovery-v1/plan.json`: seed 20261107; 33 train, 8 validation, 8 fresh final and 3 consumed-test diagnostic geometries. A pretraining integrity amendment explicitly retained original test geometries 0012/4210/6618 as diagnostic-only, including their new operating points. No final data existed at tuning time.
- Justified and estimated additional coverage before generation: 852 simulations, 5–10 single-CPU minutes, 10–15 MB, no downloads. Five bounded same-configuration XFOIL batches actually took about 249 seconds including repeat/output work and used about 10.2 MB. They produced 819 eligible labels, with 21 nonconverged and 12 suspect exclusions under unchanged rules. Added intermediate camber/thickness/position coverage, Re 250,000 and -2 degrees; no duplicate operating points or post-stall expansion.
- Combined evidence: 1,046 eligible cases over 52 geometries. Recovery rows: train 657, validation 163, consumed diagnostics 61, fresh final 165. All canonical geometry roles are disjoint. Source hashes, commands, actual paneled geometry, polars, failure logs and output tables remain traceable in `data/recovery-v1/`.
- Ran a controlled 19-candidate comparison: six fixed RBF/Matérn GP variants, three engineered-feature Ridge penalties, three tuned 300-tree forest leaf sizes and seven shared/independent neural configurations with log MSE, original-unit MSE, Huber and hybrid objectives. All use validation-only selection; configurations, seed, metrics, times, state/checkpoint sizes and latency are recorded with a comparison table.
- Tested physical feature transformations and a freely corrected thin-airfoil-inspired lift residual, with positive log-CD outputs. The public tensor contract remains five features; twelve internal features, train-only scaling and output inversion are embedded in the graph. Safe symmetric-p handling remains canonical. These are engineering priors, not exact aerodynamic laws.
- Selected **two independent 12→64→64→1 SiLU networks**, totaling 10,114 parameters, using 0.7 original-unit tolerance-scaled Smooth-L1 plus 0.3 standardized transformed-target MSE. AdamW lr 0.003, weight decay 0.0001, batch 64, max 800 epochs, patience 80; stopped at 468 epochs and restored the validation-best checkpoint. Validation MAEs: CL 0.010784, CD 0.000643. It beat the strongest GP validation score, so no inferior model was chosen for deployment convenience.
- A first sweep stopped on an artifact-writing variable-reuse defect after its baselines. Fixed that implementation error and reran the unchanged settings into a new directory, preserving the incomplete attempt. No fresh final simulations/results existed then; no test-driven search was performed.
- Froze selection/checkpoint/plan hashes and verified ONNX parity before unlocking the final simulation. `unlock.json` predates the final dataset manifest and records its prior absence. The one-use final evaluation command refuses a repeat. After selection, simulated exactly the eight reserved geometries and performed one final reporting pass on selected/baseline/original models.

### Recovery independent final results

All comparison rows below use the same 165 newly generated final cases from 8 reserved geometries, except the explicitly labeled historical row.

| Model / panel | CL MAE | CD MAE |
| --- | ---: | ---: |
| Original MLP, original consumed 35-row panel (historical) | 0.05897 | 0.003283 |
| Original frozen MLP, fresh 165-row final panel | 0.04259 | 0.001821 |
| Recovery Ridge, fresh final | 0.05303 | 0.002597 |
| Recovery Random Forest, fresh final | 0.02491 | 0.001268 |
| Recovery Matérn GP, fresh final | 0.01951 | 0.000896 |
| Selected recovery MLP, fresh final | **0.01484** | **0.000683** |

Selected final CL RMSE/R²: 0.02553/0.99733. CD RMSE/R²: 0.001165/0.98260. Both unchanged MAE targets pass. The recovered model's old consumed-panel MAEs are 0.01749/0.001024, retained as diagnostics only. The old and new final panels are not treated as equally difficult or interchangeable.

Final slices and error quantiles are recorded by geometry, Re, angle and camber family. CD p95/max absolute error remains 0.002781/0.005219; CL p95/max 0.05187/0.12565. Low Re remains hardest (CD MAE 0.001293 versus 0.000531/0.000244 at the higher Re levels), and high-camber 5518/6616 are difficult. No domain trimming or retraining occurred after final evaluation.

### Recovery export, tests and limits

| Gate | Actual result |
| --- | --- |
| Fresh independent final accuracy | Passed CL <=0.05 and CD <=0.0015 |
| Selected ONNX model size | 49,781 bytes, below 1 MB |
| Source/native ONNX max absolute error | 1.19e-7 on 881 development/diagnostic vectors; final inputs also audited |
| Source/browser WASM max error | 1.49e-7 on 881 vectors, below 1e-5 |
| Python suite | 104 passed (data hashes/raw coefficients, split/scaler provenance, lock chronology, frozen metrics, weights/ONNX) |
| Node suite | 21 passed |
| TypeScript / static production build | Passed |
| Production browser suite | 14 passed at 1440px and 390px, 31.2 seconds |
| Browser timing | Desktop single p50/p95 0.3/0.5 ms; batch-17 0.3/0.5 ms; hardware/timer dependent |

The mobile viewport runs on the same Windows Chrome machine, not phone hardware. Browser uses same-origin versioned assets, one-thread WASM, no inference backend and no cross-origin isolation. Training/simulation dependencies are not shipped as browser dependencies. The original model's failed metadata remains unchanged and separately tested. The visible feasibility UI has not become a Design Studio.

Artifacts and the 19-row comparison table are under `artifacts/recovery-v1-complete/`; all old failure evidence remains. Added recovery tests, docs, model metadata and byte-preserving Git attributes. No system installs, new downloads, public deployment or remote push were performed during recovery. A known third-party Windows pyreadline shutdown warning after pytest remains nonblocking with exit code zero.

Acceptance is finite-panel agreement with eligible XFOIL 6.99 labels only. It does not establish experimental physical accuracy, calibrated uncertainty, complete continuous-domain coverage, post-stall behavior or Re >500,000 support. Dataset size is below the initial 2,000–5,000 suggestion, but the explicit targets and independent panel passed; broader evidence remains a documented limitation rather than an invented guarantee. Phase 5 must expose applicability warnings and preserve input/preprocessing/versioning conventions.

## Original Phase 4 work and failed acceptance gate (historical)

- Read the specification/progress tracker, inspected the validated pilot and existing geometry/runtime/tests, and checked the Python environment. Used only the existing 227 eligible XFOIL labels; no new solver data or label-source substitution.
- Froze `configs/training-v1.json` before training: seed 42, explicit 14/3/3 canonical geometry groups, training-only feature/target standardization, log-CD targets and validation score mean(CL_MAE/0.05, CD_MAE/0.0015). No row-level leakage or metric-driven resplitting.
- Training/validation/test row counts are 156/36/35. Validation geometries are 0015, 2618 and 4412; untouched final test geometries were 0012, 4210 and 6618. Each partition includes symmetric/cambered coverage, but three held-out geometries are a severe uncertainty limitation.
- Trained four Ridge alphas, three 200-tree Random Forest leaf-size settings and four PyTorch MLP configurations. Used AdamW, SiLU, validation early stopping/LR scheduling, deterministic operations and one CPU thread. All tuning used validation only. Recorded family finalists and the winner before evaluating the test metrics.
- Validation selected the MLP with hidden widths [128,256,256,128] and learning rate 0.003, score 0.8423 versus forest 1.0642 and Ridge 1.4485. Its validation MAEs were CL 0.04202 and CD 0.001266. The selected checkpoint was not refitted after selection.
- The final test FAILED both predeclared targets: MLP CL MAE 0.05897 >0.05 and CD MAE 0.003283 >0.0015. CL RMSE/R² are 0.08607/0.97239; CD RMSE/R² are 0.006539/0.73338. Metadata records `accuracy_targets_passed=false`, `research_only=true` and no continuous validated domain.
- Forest final-test MAEs were CL 0.08821 and CD 0.003154; Ridge CL 0.08986 and CD 0.005367. The forest's better test drag MAE was not used to change the validation-based selection. No model was retuned, no split changed and no domain narrowed using final-test outcomes.
- Produced full metrics plus error slices by angle, Re, geometry ID and camber family. NACA 6618 is particularly weak (CL MAE 0.11008, CD MAE 0.005358); drag on NACA 4210 is also weak (MAE 0.003614). These are diagnostics, not permission to cherry-pick a favorable public domain.
- Exported all three family finalists to ONNX opset 17 with dynamic batch shapes and embedded train-only scalers plus log-CD inversion. Maximum source/native-ONNX differences across 299 representative inputs: Ridge 3.73e-9, forest 1.67e-6, MLP 3.58e-7, all below 1e-5 in original coefficient units. The MLP is 534,037 bytes; the forest is 1,725,127 bytes and exceeds the preferred 1 MB target but was not the winner.
- Verified the selected trained MLP in the production static export using ONNX Runtime Web 1.31.1 WASM, at both test viewport widths. Maximum source/browser difference 2.98e-7, shape [299,2], one thread, no cross-origin isolation and no page errors. Single-row p50/p95 approximately 0.2/0.3 ms; 17-row desktop batch 0.6/0.7 ms. Mobile viewport emulation used the same computer and is not phone hardware evidence.
- Added training/export code, audit tests, saved MLP weights, preprocessor/config/data/model hashes, golden vectors, candidate histories, evaluation and browser evidence under `artifacts/pilot-surrogate-v1/`. Added `docs/ML.md` with methodology, all held-out metrics, reproduction and limitations.
- Created project-local `.venv-ml` exposing the working installed CPU torch 2.12.0+cpu stack. Installed only pinned ONNX 1.19.1, native runtime 1.23.2 and sklearn-onnx 1.19.1 plus small dependencies there; no GPU/system interpreter install. Scientific requirements and actual environment are recorded. CI dependency changes are prepared but not remotely executed.
- No Design Studio/UI integration was added. The visible feasibility page still runs the labeled Phase 1 affine fixture. The real trained model runs only through production verification code and remains explicitly research-only.

### Phase 4 test and gate results

| Check | Actual outcome |
| --- | --- |
| Geometry-disjoint isolation / train-only scalers | Pass: 14/3/3 groups, no overlap |
| Python test suite in `.venv-ml` | 93 passed, including saved-weight/ONNX/metric audits |
| Node geometry/asset tests | 21 passed |
| TypeScript and static production build | Passed |
| Production browser smoke suite | 12 passed (10 existing + 2 trained-model checks), 28.5 seconds |
| Native/browser numerical agreement | Passed <1e-5 |
| Selected model preferred size | Passed <1 MB |
| Held-out predictive accuracy | FAILED both targets |
| Phase 4 acceptance / commit | NOT passed; no commit |

Software-test success does not override the predictive failure. Tests explicitly check that this research model's failed accuracy status is not hidden. The training CLI exited nonzero after writing results because accuracy failed. A third-party pyreadline console cleanup warning occurred after one passing Windows pytest run without changing its successful exit; model results were unaffected.

The 299 parity inputs comprise 227 dataset feature rows and 72 unlabeled boundary/interior inputs. The latter test numerical conversion only, not physical validity. Error slices were added as reporting from frozen predictions, without rerunning training or changing selection.

### Phase 4 blocker and required next decision

Per `docs/SPEC.md`, failed acceptance must be explained, and a blocked phase must be documented and stopped rather than committed. Therefore this phase is not marked complete and no Phase 4 commit is created, despite the user's requested commit at successful completion.

Recommended corrective work needs a new instruction: approve a broader reproducible XFOIL dataset, with more distinct geometries and Re levels and analysis of failed non-stall regions; reserve fresh unseen-geometry test data before tuning; use the now-consumed test set as diagnostic evidence only. Any revised error budget or supported domain must be explicit and independently validated. Do not repeatedly search this test set for a passing model or proceed to Phase 5.

## Phase 3 completed tasks and results (historical)

- Re-read `docs/SPEC.md` and this tracker; inspected the clean Phase 2 checkout and geometry implementation. XFOIL and gfortran remained absent from PATH.
- Established the approved real data source using MIT's small Windows XFOIL 6.99 distribution, acquired under the Phase 3 authorization into ignored `tools/xfoil/`. No system toolchain or package installation was needed; no NeuralFoil or other label-source fallback was used.
- Recorded observed archive SHA-256 `e13e8fe5cc38d8ac2626e9d3b17643bdcfaa63791619f042afdaa7cd103bcb08` and executable SHA-256 `c17342f84ae260c2b11a74cd0e2fb8189a5f8954c6bb7a8467a0f27055c7faea`. The runner rejects an unpinned executable. The GPL binary/archive/source zip are local tools and are not redistributed in Git.
- Verified a real viscous solver probe, actual panel/transition menus, and a Phase 2 coordinate-file import before launching the pilot. Corrected the extra blank line required when leaving the changed PPAR menu; command errors explicitly reject a point. The archive's root directory marker was skipped rather than extracted as an absolute path.
- Implemented `python/aeroforge/xfoil.py` for explicit one-point commands, bounded hidden-console processes, raw log preservation, polar parsing and quality classification. Implemented `python/aeroforge/pilot.py` and `scripts/run_pilot.py` for a reproducible bounded pilot, all-attempt records, eligible Parquet/CSV labels and a quality report. Added a pinned, non-destructive local acquisition helper.
- Froze `configs/pilot-v1.json`: 20 distinct canonical finite-edge geometries; Re 100,000 and 500,000; alpha -4, 0, 2, 4, 6, 8 and 12 degrees; viscous Mach 0; e^n/Ncrit 9; transition limits x/c=1 on both surfaces; 150 iterations; 160 panel nodes with explicit bunching/density/refinement settings; fresh process per point; 20-second timeout.
- Generated `data/pilot-v1/` with original input geometries, actual paneled solver coordinates, exact commands, compressed stdout/stderr, original polars, all 280 attempt records, 227 eligible labels and complete hash/provenance metadata. Missing/failed values were not filled or interpolated.
- Added `.gitattributes` to preserve solver evidence byte-for-byte, avoiding Git line-ending conversion that would invalidate raw artifact hashes. Added pandas 2.3.3 and pyarrow 22.0.0 data requirements matching the already installed environment.
- Added parser, malformed/nonfinite result, final nonconvergence, recovered internal warning, duplicate, metadata, command, timeout, launch failure, hash guard, no-overwrite and actual-pilot traceability tests. CI now installs the pinned data requirements and audits committed real evidence without requiring a solver download.
- Added `docs/DATA.md` and a pilot artifact README, and updated README/architecture documentation. The master specification remains unchanged. No model training, large dataset expansion, frontend changes, public deployment or remote push was performed.

### Phase 3 pilot results

| Check | Actual result |
| --- | --- |
| Real operating points attempted | 280 across 20 geometries |
| Solver-converged | 270 (96.43%) |
| Eligible labels | 227 (81.07%) |
| Suspect and excluded | 43 |
| Rejected/nonconverged | 10 |
| Geometry coverage | All 20 have eligible labels |
| Eligible by Re | 111/140 at 100,000; 116/140 at 500,000 |
| Repeated fresh-process solves | Three matched all saved polar coefficients at printed precision |
| Timeout/launch/nonzero-exit failures | Zero |
| Total pilot/repeat/output time | 99.82 seconds; median solver process 0.213 seconds |
| Final `python -m pytest -q` | 83 passed, zero skipped, 4.79 seconds |

The preset acceptance gates were defined before running: >=70% eligible attempts, all 20 geometries represented, three matching repeats and no process failures. All pass, as recorded in `quality-report.json`.

The real-data audit reparses every original polar, verifies every per-attempt artifact hash and the main-table/report hashes, compares recorded coefficients with the raw solver results, confirms canonical IDs/units/config metadata, and checks eligible CSV/Parquet labels match exactly. It also reparses repeat evidence. The first parser test run occurred during pilot execution and skipped the not-yet-existing report; after generation the audit became mandatory and the final suite has no skips.

### Phase 3 quality restrictions and technical decisions

- Each operating point runs independently rather than using a warm-start sweep; this makes failure attribution unambiguous and is part of the recorded solver configuration. It may converge less readily than a continuation sweep.
- All 40 attempts at 12 degrees are excluded: 37 converged but carry unvalidated stall-risk flags, and three failed. Six additional lower-angle points are conservatively excluded for transition locations slightly above one (1.0001–1.0003); their original values remain preserved and are not clamped.
- Internal MRCHDU marching warnings can recover; they are retained separately. Final VISCAL failure, missing/duplicate polar rows, malformed/nonfinite coefficients, setting mismatches, command errors and process failures never enter the eligible table.
- The eligible angle samples span -4 through 8 degrees, but this sparse pilot does not establish a continuous geometry/Re/alpha applicability domain. Re 1,000,000 and full candidate geometry coverage remain untested. Low-Re negative-angle and thin/cambered failure regions require further investigation before broad expansion.
- The repeat check covers NACA 0008 at Re 100,000 and angles -4, 0 and 2. It is a narrow printed-precision reproducibility check, not cross-platform, panel-sensitivity or independent physical validation. XFOIL agreement must not be described as experimental accuracy or high-fidelity CFD agreement.
- The dataset stores CL/CD as eligible targets. CM, pressure drag and transition values are retained only for provenance/diagnostics, not extra prediction targets.
- No geometry-disjoint training/validation/test split or trained surrogate exists yet. Phase 4 must determine adequate sample coverage and held-out geometry evaluation before any prediction claim.
- `docs/DATA.md` proposes initial Phase 4 engineering error budgets (CL MAE <=0.05, CD MAE <=0.0015) for discussion on the eventual supported domain. They are neither achieved metrics nor approved physical uncertainty bounds; confirm/refine with domain evidence before model selection and final-test evaluation.
- No Phase 3 acceptance blocker remains. The existing browser UI was unchanged, so its Phase 2 production regression results are retained historically; no fresh frontend visual verification is claimed here.

## Phase 2 completed tasks and results (historical)

- Re-read the full specification and progress tracker; inspected the clean Phase 1 checkout and existing tests/CI. Continued on the existing `codex/phase-1-onnx` branch without changing remote history.
- Implemented Python `python/aeroforge/geometry.py` and browser-compatible TypeScript `web/lib/geometry/naca4.ts`: standard piecewise mean line, analytic slope, finite-edge thickness polynomial, true normal surface offsets, cosine stations and ordered contour generation.
- Added `shared/naca4.json` as the common source of coefficients, schema version, candidate geometry bounds and ten preset codes. NACA parsing and preset lookup apply the same normalization.
- Froze the proposed symmetric convention: exactly zero camber becomes positive `m=0, p=0` before any divisions, coordinate calculation or identity construction. Finite irrelevant p values cannot create duplicate symmetric geometries; nonfinite p is still rejected.
- Added explicit ratio/percent normalization, strict numeric/finite/range checks, no silent coercion/clamping/rounding, and lossless versioned float64 geometry identifiers. IDs agree across languages and do not depend on sampling resolution or future operating conditions.
- Kept the standard finite trailing edge (`-0.1015` coefficient): normal TE gap is `0.021*t`. Surface offsets are not clipped at the leading/trailing edges. Default sampling is 201 points per surface; contours contain `2N-1` points and exactly one leading-edge point.
- Added independent 60-digit Decimal station references for NACA 0012, 2412, 4418 and 6618 at eight stations each, together with a reproducible reference script. These are equation references, not solver/experimental data.
- Added Python and TypeScript reference, symmetry, camber derivative, coordinate consistency, normal-offset, contour, bounds, units, preset and ID tests. The Python suite executes the actual TypeScript engine over 28 cases and compares all coordinate arrays and exact IDs.
- Added pinned pytest 9.0.2 test requirements and pytest source-path configuration. The Python geometry implementation has no runtime dependencies; no packages or binaries were installed for this phase.
- Extended existing CI to run Python geometry tests before production browser verification. Existing Node 24.11.0 TypeScript stripping runs the geometry tests without a new JavaScript dependency. `web/package.json` declares ESM and the TypeScript configuration permits explicit `.ts` test imports; existing package versions remain pinned.
- Added `docs/PHYSICS.md` and updated README/architecture documentation. The specification file is unchanged. No UI, solver, data-generation pipeline, ML training or aerodynamic predictions were added.

### Phase 2 tests and validation

| Check | Actual result |
| --- | --- |
| `python -m pytest -q` from repository root | 62 passed; final run 1.14 seconds |
| Node tests through `npm run verify` | 21 passed: 19 geometry and 2 existing asset tests |
| Strict TypeScript | Passed `next typegen && tsc --noEmit` |
| Production static build | Passed on Next.js 16.4.5; `/` and `/spike/` remain static |
| Existing production browser suite | All 10 passed at 1440px and 390px; 27.6 seconds |
| Cross-language parity | 27 boundary/interior grid cases plus 1 non-digit continuous geometry; full upper/lower/contour arrays within `1e-13` chord, exact normalized parameters and IDs |
| Reference fixture reproducibility | Independent Decimal regeneration equals the committed fixture |

Validation initially exposed a cosine mirror-symmetry test tolerance of `2e-16`, smaller than a few float64 rounding ULPs. Corrected that test to `1e-15` in both languages; no geometry equations or reference values were changed to conceal an error. Independent station-reference and cross-language coordinate tolerances remain `1e-13` chord. Normal-offset consistency checks use `1e-15`.

### Phase 2 technical decisions and limitations

- Geometry APIs intentionally support the project's candidate bounds, not every possible four-digit NACA designation. These bounds are not a validated aerodynamic model domain.
- A geometry ID records exact normalized float64 values using big-endian hex. No ID-only rounding merges distinct shapes. Future sampling must create deterministic parameter tuples; near-equal floating values are not automatically merged.
- The finite-edge equation and symmetric canonicalization are now `naca4-open-v1`. Any equation/trailing-edge convention change requires an explicit schema change and corresponding dataset/model metadata review.
- Source-checkout Python imports locate the shared JSON in the repository. Standalone wheel packaging and solver point-file formatting are deferred.
- The geometry API is tested as a library. It is not wired into the feasibility UI; the main Design Studio remains Phase 5 work. No new frontend visual changes were made or claimed.
- No Phase 2 blocker remains. XFOIL acquisition/compatibility remains a later Phase 3 decision. No solver or label-source fallback was selected, no remote push/deployment was performed, and no Phase 3 work began.

## Phase 1 completed tasks and results (historical)

- Re-read both source-of-truth documents. Inspected the supplied repository through the GitHub connector: public, empty, default branch `main`; local workspace contained only Phase 0 planning files.
- Resolved the local Git command blocker by using approved execution outside the restricted wrapper. Initialized local branch `codex/phase-1-onnx` and configured `origin` to the supplied repository. No global Git configuration or identity was changed.
- Built a minimal Next.js App Router application with `output: 'export'`, static `/` and `/spike/` routes, strict TypeScript, and ordinary document navigation.
- Generated a real, deterministic 199-byte ONNX graph (IR 8, opset 13, dynamic float32 batch, `Mul` + `Add`, `y = 2*x + 1`) and a SHA-256 manifest. This is explicitly an infrastructure fixture, not aerodynamic inference, learned weights, or a substitute label source.
- Added lazy native ESM loading of the pinned ONNX Runtime Web CPU package entry, with same-origin versioned module/WASM assets, explicit paths, one thread and no proxy worker. Reuses sessions; failed model loading can be retried.
- Added visible loading/error states, batch input validation, real model outputs and measured session-run timing. No accounts, backend inference, geometry engine, training, charts or studio functionality were added.
- Added a same-origin dedicated module-worker experiment that independently runs the fixture with one thread. It passes without cross-origin isolation. Built-in proxy workers, multithreaded WASM, strict CSP and other browsers are not claimed verified.
- Added exact package pins, npm lockfile, Node version file, production static server, asset tests, production Playwright smoke tests and GitHub Actions verification configuration.
- Added `README.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, and committed screenshot/network evidence under `docs/phase-1/`.
- Captured and inspected 1440x1000 and 390x844 production screenshots, then inspected the final captures again after delivery fixes. Controls, results and footer fit without horizontal overflow. The polished Design Studio and its dedicated design refinement remain Phase 5 work.

### Verified toolchain

| Component | Exact version |
| --- | --- |
| Node.js / npm | 24.11.0 / 11.6.1 |
| Next.js | 16.4.5, webpack production build |
| React / React DOM | 19.3.1 / 19.3.1 |
| ONNX Runtime Web | 1.31.1 |
| TypeScript | 5.9.3 |
| Playwright test | 1.65.0 |
| onnx-proto (build/test only) | 8.0.1 |
| Node / React / React DOM types | 24.10.1 / 19.2.2 / 19.2.2 |
| Browser actually tested | Installed Chrome 156.0.8078.81, headless, Windows |

Tailwind, Radix, Motion and plotting packages are deferred until needed. The feasibility page uses small custom CSS and system fonts with no external font requests. No Python packages, solver binaries or browser binaries were installed in this phase.

### Validation evidence

- `npm run verify`: passed production build, TypeScript, 2 Node asset tests and all 10 Playwright tests (5 flows at each viewport; final browser suite 28.4 seconds). Both routes were reported static by Next.js.
- `npm run typecheck`: separately passed after adding `next typegen` before `tsc --noEmit`, so first-run checks generate required route declarations rather than depending on a previous build.
- Browser inputs `[0, 3, -2, 0.25]` produced `[1, 7, -3, 1.5]`; a subsequent input `10` produced `21` using the same session. Direct reload of `/spike/` produced `7` for default input `3`.
- Actual `.onnx`, runtime `.mjs`, WASM companion `.mjs`, and `.wasm` requests returned HTTP 200 from the same origin. WASM MIME was `application/wasm`; module MIME was JavaScript. Normal flows recorded zero browser-console/page errors, zero failed requests and zero external HTTP requests.
- Warm reload evidence records zero transferred body bytes for both model and WASM, with decoded body sizes 199 and 14,848,852 bytes respectively. Both desktop and mobile checks passed. This result is for the supplied gzip-enabled local static server, not a verified public CDN.
- Invalid/empty/nonfinite/out-of-range inputs were rejected before any model/runtime request. Injected model HTTP 503 was visible and recovered on retry; injected WASM HTTP 404 showed an error without a fabricated output.
- Dedicated same-origin worker returned the same batch outputs with `crossOriginIsolated=false`. The main page's baseline also ran with `crossOriginIsolated=false`.
- The asset tests check graph structure, dynamic batch, constants, manifest hash, exact equality with installed runtime artifacts, and the Pages 25 MiB per-file bound.
- `npm audit --omit=dev --json`: zero known production advisories at the time checked. This is not a future security guarantee.
- `docs/SPEC.md` remains byte-identical to the Phase 0 attachment; no specification requirement was weakened.
- GitHub Actions is configured but has not been remotely run; no push or public deployment was performed.

### Delivery measurements and fixes

| Artifact | Uncompressed bytes | gzip bytes (offline estimate) |
| --- | ---: | ---: |
| CPU WASM | 14,848,852 | 3,792,479 |
| WASM module companion | 24,738 | 9,159 |
| CPU runtime ESM entry | 53,725 | 17,161 |
| ONNX fixture | 199 | 177 |

Final `out` contains 47 files totaling 15,918,493 uncompressed bytes, with exactly one WASM binary; every individual asset is below 25 MiB. The gzip column is an offline compression estimate, not a claim about Cloudflare network transfer. The local server compresses assets larger than 1 KiB; the small model is served raw. Final-product latency/Lighthouse targets remain later-phase measurements; fixture session-run timings are not aerodynamic benchmarks.

Initial validation failures were investigated and fixed, not waived:

1. Next.js has its own route-announcer alert. Scoped failure assertions to the fixture region rather than an ambiguous global alert locator.
2. Next.js 16.4.5 soft navigation requested `/spike/__next.spike.__PAGE__.txt` while export wrote a nested segment file, causing a real console 404. The spike now uses ordinary anchors between exported documents; no rewrite/backend is needed. Any future soft-navigation implementation must revalidate RSC paths on the selected host.
3. Bundled ONNX loading emitted an unused second 14.8 MB WASM file. Native ESM import from the same-origin pinned runtime directory removed that duplicate.
4. The first uncompressed-server warm reload redownloaded the large WASM body while caching the model. Added gzip negotiation, ETags and proper versioned asset caching; final network evidence confirms warm reuse. Tests allow a genuine cache hit or small header-only revalidation, but reject a full body download.
5. Added an explicit local icon and correct SVG MIME handling. The final normal browser flow has no resource-console errors.

### Phase 1 remaining limitations

- Public Cloudflare deployment, actual CDN response headers, GitHub CI execution, strict CSP, built-in proxy workers, multithreaded WASM and non-Chrome browsers have not been tested.
- Local commit only; `origin` is configured, but no remote branch was pushed and no PR was opened.
- XFOIL, solver provenance and scientific model validation remain hard gates for Phases 3 and 4. No aerodynamic accuracy claim is made.
- No Phase 1 implementation blocker remains. Stop here; do not begin Phase 2 without instruction.

## Phase 0 completed tasks (historical)

- Read the complete supplied specification and inspected the workspace, including hidden entries.
- Confirmed the workspace initially contained zero entries, no local `.git`, no application code, and no dependency manifests. No ancestor `AGENTS.md` was found at the checked levels from the drive root through this workspace.
- Inspected Windows, PowerShell, Python, Node.js, npm, Git, compiler commands, WSL access, and installed Python package metadata without installing dependencies.
- Checked XFOIL availability: no `xfoil` command on PATH and no executable in the initially empty workspace. This does not prove absence elsewhere on the machine.
- Reviewed official Next.js static-export, Cloudflare Pages, ONNX Runtime Web, XFOIL, NeuralFoil, and PyTorch documentation.
- Created `docs/SPEC.md` as an exact copy of the user's full specification, including all scope boundaries, design tokens, validation gates, phase requirements, and definition of done.
- Prepared the architecture, phase plan, dependency recommendations, risk register, and approval items below.

## Phase 0 environment evidence (historical)

| Item | Observed result | Consequence |
| --- | --- | --- |
| Host | Windows NT kernel 10.0.26200; PowerShell Core 7.6.9 | Native Windows workflow first; product edition lookup via CIM was denied, so no edition is asserted. |
| Workspace | `C:\Users\marbo\OneDrive\Desktop\CODING\sem 5\ML_Surrogate` | Spaces and OneDrive synchronization require careful subprocess paths and isolated outputs. Do not move the workspace without agreement. |
| Git | 2.47.0.windows.1; no local `.git` | Initial repository/commit still needs completion; see commit history. |
| Python | CPython 3.10.10, 64-bit; `C:\Program Files\Python310\python.exe` | Use an isolated environment and verify wheel/export support before pinning ML dependencies. |
| pip | 25.3, installed in the user's Python 3.10 site-packages | Do not alter the shared environment. |
| Node.js / npm | 24.11.0 / 11.6.1 | Node satisfies the documented Next.js minimum of 20.9. |
| pnpm | Command shim found; version not checked | Recommend npm and a committed lockfile, avoiding another package manager dependency. |
| XFOIL | Not on PATH; no project executable | Phase 3 cannot pass until a real label source works. |
| Fortran | `gfortran` not on PATH; no Fortran executable found in the checked MinGW bin directory | Compiling XFOIL is not currently ready. |
| C compiler | `C:\MinGW\bin\gcc.exe` found, but `gcc --version` fails with Illegal System DLL Relocation | Do not treat the existing compiler as usable or repair system DLLs. |
| Other build tools | `clang`, `cl`, `cmake`, `make` not on PATH | This does not rule out tools outside PATH or a separate developer shell. |
| WSL | `wsl.exe` exists; distribution listing returns `Wsl/E_ACCESSDENIED` | No usable Linux distribution was verified; do not assume WSL is ready or change Windows features. |
| Python packages (metadata) | NumPy 2.2.6; pandas 2.3.3; torch 2.12.0; scikit-learn 1.7.2; pytest 9.0.2 | Installed metadata alone is not proof of import/runtime compatibility. |
| Missing Python packages (metadata) | ONNX, ONNX Runtime, Polars, NeuralFoil | ONNX/export setup remains future work. Pandas is sufficient; Polars is optional. |

## Approved architecture and later-phase proposals

Offline: Python NACA geometry -> reproducibly configured XFOIL -> attempt/failure records and validated Parquet labels -> geometry-disjoint splits -> training-only preprocessing -> Ridge / Random Forest / PyTorch MLP comparison -> validation-based selection -> versioned ONNX, scaler, domain, metrics, and provenance artifacts.

Public runtime: static Next.js + strict TypeScript -> validated/canonicalized browser inputs -> identical preprocessing -> lazily loaded ONNX Runtime Web WASM -> coefficient postprocessing and domain checks -> SVG geometry, telemetry, and batched polar charts. Browser state and optional localStorage hold one comparison; URL parameters restore designs. No inference service, database, account, API key, or analytics storage is required.

Suggested repository boundaries, to create only in their approved phases:

```text
web/                  Next.js UI, browser physics/inference, Playwright tests
python/aeroforge/     geometry, solver runner, data quality, training/export
configs/              solver, sampling, split and training configurations
data/                 attempt records and curated datasets; storage policy set in phase 3
artifacts/            versioned model, preprocessing and provenance manifests
tests/                Python physics/data/ML tests and cross-language fixtures
docs/                 specification, architecture, physics, ML and deployment evidence
```

Phase 2 now implements both geometry engines with shared configuration, independent analytic reference fixtures and full coordinate parity tests. Canonical `p=0` when `m=0`, explicit symmetric branching and standard finite/open trailing-edge equations are frozen in `naca4-open-v1`; `docs/PHYSICS.md` documents their details. Future solver/model work must preserve these conventions or explicitly version a change.

Use ratios internally for `m,p,t`, degrees for angle, dimensionless Reynolds number, and feature order `[m, canonical_p, t, aoa_deg, log10(Re)]`. Freeze units, tensor shapes, dtype, transforms, output ordering `[CL, CD]`, and schema versions in the inference contract. Any drag transform must be selected using validation evidence and inverted identically in browser and Python.

## Hosting feasibility and deployment settings

Documentation review supports the intended architecture, but does not establish a working deployment. No production build, real ONNX browser run, or public deployment has been performed in Phase 0.

- Prefer Cloudflare Pages Free, its supplied `pages.dev` address, and static assets only. Custom-domain purchase is unnecessary.
- Proposed Pages root: `web`; preset: Next.js (Static HTML Export); build: `npm run build` wrapping `next build`; output relative to that root: `out`. Pin the verified Node version in the build environment. Production branch must match the eventual release branch.
- Use `output: 'export'`; propose `trailingSlash: true`. Avoid runtime server features, API routes, middleware/proxy, cookies, Server Actions, ISR, and default server image optimization. Access browser APIs only in browser code; handle URL restoration without introducing a dynamic server dependency.
- Official Free limits checked on 2026-11-07: 500 builds/month, one concurrent build, 20-minute build timeout, 20,000 files/site, and 25 MiB per asset. Static requests are free and unlimited when they do not invoke Functions. Build output must be audited against these limits, especially WASM file sizes.
- No Pages Functions, Workers inference, R2, paid endpoints, or paid upgrades are planned. Free-tier policy is an external dependency and must be checked again before release; no perpetual pricing guarantee is implied.
- Start ONNX WASM with one thread (`numThreads=1`) so cross-origin isolation is not a baseline requirement. Test worker offloading separately; do not assume proxy-worker bundling works. Keep a measured single-thread fallback.
- Self-host runtime JavaScript/module companions and WASM from the exact same pinned package build, with explicit asset paths. Test MIME types, CSP compatibility, worker requests, cold/warm cache behavior, nested routes, and absence of external core-runtime requests.
- Cache versioned model/scaler/runtime files together; a release manifest must prevent stale model/preprocessing combinations. No service worker is required for v1.
- GitHub Pages is a contingency requiring a fresh check of limits, base paths, MIME types and routing before switching; it has not been validated in this phase.

## Dependency recommendations and compatibility risks

These are candidates, not a claim that the combination is tested. Exact package availability, peer dependencies, security status, and patch selections must be checked again at the start of the relevant approved phase.

| Layer | Proposed starting point | Required verification |
| --- | --- | --- |
| JS environment | Existing Node 24.11.0 and npm 11.6.1 | Pin working versions; verify local and Pages builds. |
| Framework | Next.js 16.4.5 candidate, React/React DOM 19.3.1 candidates | Versions observed in official npm metadata; validate peer compatibility and static export in Phase 1, then lock exactly. |
| Styling | Tailwind 4.3.5 candidate, custom tokens | Official npm metadata observed; check matching build plugin and browser support in Phase 5. No generic component template. |
| Inference | ONNX Runtime Web stable 1.31.x candidate | Official runtime release 1.31.1 observed; npm package metadata lookup failed. Confirm the actual web package version before selecting it; match JS, module and WASM assets exactly. |
| UI helpers | Radix only where needed; Motion for React; custom SVG charts first | Select exact compatible versions when needed; measure bundles. No Plotly by default. |
| Python | Isolated Python 3.11 or 3.12 environment recommended for ML | Current PyTorch guidance says latest stable requires Python >=3.11; installed 3.10 metadata is insufficient. A new interpreter needs separate approval if installation is necessary. Phase 1 does not require ML training. |
| ML/data | CPU PyTorch, scikit-learn, NumPy, pandas + Parquet engine, ONNX, ONNX Runtime | Verify imports, Windows wheels, exporter dependencies, ONNX opset/IR support, baseline conversion, and float32 parity before freezing a compatible environment. Avoid unnecessary GPU downloads. |
| Tests | pytest; Playwright production smoke tests | Pin at setup; inspect browser availability before downloading a browser. |

The specified MLP has 132,738 parameters, about 530,952 bytes of float32 weights before ONNX overhead. A sub-1 MB model is plausible, but runtime WASM and JavaScript downloads are separate and may be much larger. Measure actual compressed transfer and uncompressed assets; baseline model size and conversion support may differ substantially.

## XFOIL acquisition routes (none executed)

1. Recommended first investigation: MIT's linked Windows XFOIL 6.99 distribution (approximately 3.8 MB). Obtain approval before downloading/executing a binary in Phase 3; verify source, license, process exit/timeout behavior, and an actual known-airfoil polar. The legacy binary is not yet proven compatible with this Windows environment.
2. Source build: MIT provides source, with Fortran/C and windowing/build requirements. This needs a working toolchain, a documented plotting/headless strategy, and separate approval for system dependencies. The broken local MinGW executable is not sufficient.
3. Linux/WSL route: investigate only if authorized and accessible; WSL is currently unverified due to access denial.
4. NeuralFoil: only with explicit approval to change the label source. It is an ML reference surrogate, not numerical CFD; agreement is surrogate distillation, not independent physical validation.

Do not launch large simulation batches before a pilot of roughly 20 distinct geometries, a few Reynolds values, and a limited alpha sweep establishes parsing, convergence rules, duration and failure rate. Do not proceed to model-dependent work without real usable labels. Narrow candidate bounds based on convergence and held-out errors rather than silently extrapolating.

## Risk register

| Risk | Severity | Resolution / gate |
| --- | --- | --- |
| Missing XFOIL, unusable compiler, unverified WSL | High | Establish and test one approved source in Phase 3; stop model work if none works. |
| Near-stall/low-Re solver failures and misleading convergence | High | Retain every attempt, reject failed/nonfinite labels, flag suspect physics, inspect domain coverage, restrict deployment bounds. |
| Geometry leakage or symmetric duplicates | High | Canonical geometry IDs and group splits (~70/15/15); fit scalers on train only; audit partition intersections. |
| Drag error hidden by lift accuracy or bad physical claims | High | Separate CL/CD metrics and difficult-case analysis; agree pilot-based thresholds and validation selection criterion before test evaluation. Solver agreement is not experimental accuracy. |
| Browser export/operator or preprocessing mismatch | High | Freeze schema/opset, compare Python and browser inference on representative inputs; original-unit maximum absolute export difference <1e-5. |
| Static Next.js, WASM companion paths, worker/CSP loading | High | Phase 1 production static smoke test must pass before main UI; single-thread baseline and matching local assets. |
| Python version/package metadata mismatch | Medium | Isolated verified environment, runtime probes, exact compatible versions; no reliance on installed metadata alone. |
| Model/runtime size and latency | Medium | Measure separately; lazy WASM import, batch sweeps, p50/p95 production timing; keep accuracy ahead of size target. |
| OneDrive/file paths or Git invocation failures | Medium | Quote paths, inspect actual subprocess behavior; no workspace relocation or system configuration changes without permission. |
| Appearance/accessibility lagging functionality | Medium | Playwright screenshots at 1440px and 390px, actual image inspection, refinement pass, touch/keyboard/reduced-motion checks. |
| Free hosting policy changes | Medium | Recheck official terms at release; stay entirely static on Free with no billable services. |

## Phase-by-phase plan and exit evidence

| Phase | Implementation scope | Acceptance / stop condition |
| --- | --- | --- |
| 0 | Inspect environment, preserve specification, assess architecture, plan and risks | Planning files verified; stop for user approval. |
| 1 | Minimal static Next.js app; tiny deterministic ONNX fixture; self-hosted WASM; production static server and Playwright smoke test; deployment settings and pinned versions | Known numeric inference result works in served `out`, assets load and no blocking console errors; record working versions. Fixture is explicitly an infrastructure test, never aerodynamic prediction. Commit and stop. |
| 2 | Python and browser NACA geometry, canonicalization, presets and reference fixtures | Reference, symmetric, camber, edge and coordinate/parity tests pass; conventions documented. Commit and stop. |
| 3 | Approved XFOIL acquisition/integration, bounded batch runner, deterministic config, full attempt logs, quality filtering and pilot report | Real parsed labels; measured failure rate and runtime; reproducible solver setup and supported pilot domain; agree predictive targets. If no source works, document blocker and stop. Commit and stop. |
| 4 | Scale dataset only after pilot; geometry splits, baselines + MLP, validation selection, untouched test report, chosen-model ONNX export and manifest | Genuine trained candidate meets agreed errors and export parity; export runs in verified browser harness. Document baseline deployment tradeoffs; seek approval before choosing an inferior model for convenience. Commit and stop. |
| 5 | Read frontend design guidance, implement precise dark workstation, responsive controls and real geometry/inference telemetry, loading/errors | Editing produces real valid results; parameter and inference tests pass; capture/inspect desktop + mobile images and refine. Commit and stop. |
| 6 | Real batched CL/CD charts, focused comparison, validated shared URLs, applicability/model panel, UI refinement | All specified production smoke flows pass, including errors and mobile layout; screenshot inspection and dedicated refinement complete. Commit and stop. |
| 7 | Static build/CI checks, hosting configuration, Lighthouse assessment, README and technical docs, license review, release cleanup | Verified deployment instructions and measured results; publicly deploy only with external authorization, otherwise list exact remaining actions. Never claim unverified deployment. Commit and stop. |

## Phase 0 test and validation results (historical)

- Planning preservation: SHA-256 of attachment and `docs/SPEC.md` match: `FCFC6299EB5405FE6C0C0DAAB7B10DC4B34AE0647B56DFD68760BBEF066AD464`.
- Environment probes: interpreter/package-manager versions and installed Python metadata recorded above. Missing/failed probes are recorded rather than counted as passed.
- Application tests, browser inference, screenshots, solver pilot, numerical model validation, Lighthouse, and public deployment: not run; no application exists in Phase 0.
- Final runtime-import and planning-file verification evidence is recorded in the session closeout below.

## Pending tasks and approvals

- Phases 1–5 are complete. Await explicit instruction before Phase 6.
- Retain Cloudflare Pages static export, npm lockfile, self-hosted WASM and the verified one-thread CPU/browser baseline; public deployment remains unperformed.
- The official Windows XFOIL 6.99 build is now established locally and pinned. A different solver binary or any label-source change requires explicit provenance/compatibility review; NeuralFoil substitution is not authorized.
- Confirm an isolated supported Python interpreter/toolchain route when ML setup is needed; no system installation has been performed.
- Public GitHub/Cloudflare configuration, paid changes, substantial downloads, destructive changes, and overwriting user content retain the explicit approval gates in the specification.
- README, architecture, physics and deployment documents now exist. Future ML documentation and MIT license review belong to their corresponding phases. No fabricated benchmarks, screenshots, URLs, or accuracy claims.

## Next phase

Phase 6: real batched lift/drag charts, focused two-design comparison, validated reproducible URLs and further model-information/interaction polish, only on explicit instruction. Preserve finite-domain caveats, accepted model/preprocessing contracts and static same-origin architecture. Do not begin Phase 7 deployment silently.

## Commit history

Phase 0 had no commit: the directory was not initialized and restricted Git probes failed with a path error. Phase 1 resolved invocation through approved execution and initialized the repository without resetting history.

Phase 1 commit: `9de96eb98a343d7b165769239a4600198e04cb5c` (`add static browser onnx feasibility spike`) on `codex/phase-1-onnx`. This initial commit includes the preserved Phase 0 planning files and the completed, tested Phase 1 implementation.

Phase 2 commit: `c66ad2a924233a6ce257a43b5206bc3fb8c1c0c8` (`implement naca geometry generator`), continuing on the same branch.

Phase 3 commit: `14c5507c26135170c9b8f50c7bc98141f02cd806` (`add xfoil simulation pipeline`), continuing on the same branch.

Original Phase 4 attempt was not committed because its predictive accuracy failed. The authorized recovery now passes all accepted gates. Phase 4 commit: `train and validate aerodynamic surrogate`, including the transparent original failure plus completed recovery on the existing branch. Resolve the final hash with `git log -1 --format=%H`; a commit cannot embed its own final hash. No remote push is included.

## Phase 0 session closeout (historical)

- Planning checks passed: exact byte comparison and SHA-256 equality with the supplied specification; all 24 numbered main sections retained. Only `docs/SPEC.md` and `PROGRESS.md` were created.
- Runtime checks passed: NumPy 2.2.6, pandas 2.3.3, scikit-learn 1.7.2, torch 2.12.0+cpu and pytest 9.0.2 import successfully on the current Python interpreter. A CPU tensor addition returned `[2.0, 2.0]`. This is a limited environment check, not ONNX export or training compatibility evidence.
- Git commit is blocked by the invocation/path error above. WSL distribution access and CIM product-edition lookup were denied; compiler execution failed. These failures were not concealed or bypassed.
- No packages, solver binaries, datasets, model files, or browser binaries were downloaded. No system configuration, application code, public infrastructure, or remote repository was changed.
- Awaiting user approval of the plan. Phase 1 has not started.

## Official sources reviewed on 2026-11-07

- [Next.js installation and platform requirements](https://nextjs.org/docs/app/getting-started/installation): Node >=20.9 and Windows support.
- [Next.js App Router static export](https://nextjs.org/docs/app/guides/static-exports): export configuration, `out` output and server-feature restrictions.
- [Cloudflare Pages static Next.js guide](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/): static export preset and build/output settings.
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/): Free build, file count and individual asset limits.
- [Cloudflare static request pricing](https://developers.cloudflare.com/pages/functions/pricing/): free static requests when Functions are not invoked.
- [ONNX Runtime Web deployment](https://onnxruntime.ai/docs/tutorials/web/deploy.html): required model/runtime assets, WASM paths and worker deployment considerations.
- [ONNX Runtime Web environment flags](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html): one-thread baseline, isolation requirements for threading and matching build assets.
- [Official ONNX Runtime release](https://github.com/microsoft/onnxruntime/releases/tag/v1.31.1): candidate runtime release; actual web npm distribution still needs confirmation.
- [Next.js npm metadata](https://registry.npmjs.org/next/latest), [React npm metadata](https://registry.npmjs.org/react/latest), [Tailwind npm metadata](https://registry.npmjs.org/tailwindcss/latest): observed candidate versions, not tested dependency pins.
- [MIT XFOIL distribution and licensing](https://web.mit.edu/drela/Public/web/xfoil/): Windows build and source routes; GPL distribution conditions. Keep AeroForge's proposed MIT application license separate from third-party redistribution obligations; review before bundling solver binaries.
- [NeuralFoil upstream](https://github.com/peterdsharpe/NeuralFoil): ML reference-generator identity and fallback provenance.
- [PyTorch local installation](https://pytorch.org/get-started/locally/): latest stable Python guidance; validate actual wheels rather than upgrading the working global installation.
