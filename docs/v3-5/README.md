# Surface pressure surrogate

V3.5 adds **Pressure** to the Airfoil view. It displays separate upper and lower curves for the current 2D section, with more negative Cp plotted higher. Select a surface and move the station slider with the keyboard, or select a point by pointer or touch. The highlighted point has matching x/c, y/c and dimensionless Cp readouts. Both branches start at the shared analytic nose and end at their own finite-gap trailing edges. [Pressure browser evidence](../../artifacts/pressure-v1/browser-performance.json)

Pressure is available at Re 100,000, 250,000 and 500,000 and at angles −4°, −2°, 0°, 2°, 4°, 6° and 8°. The operating-point selectors change the current section design. The plot clears immediately on any design edit, invalid input, or unsupported condition. The app also withholds exact matches to known rejected solver cases and offers retry if the pressure graph fails to load or yields invalid values. Geometry can vary continuously within the Studio's NACA bounds, but the measured benchmark uses four-digit sections at the sampled conditions. [Model and missing-case manifest](../../artifacts/pressure-v1/model.json)

## Data and model selection

The plan was frozen before generation. It assigns 96 canonical geometry groups to 64 training, 16 validation and 16 test groups. The split covers symmetric sections and camber, camber-position and thickness bands. It excludes the four V3.4 pressure fixtures and the eight locked recovery examples. Each geometry received all 21 planned operating points. The pinned XFOIL 6.99 setup used one fresh 160-panel process per attempt, Mach 0, Ncrit 9 and the locked transition and iteration settings. No additional refinement solves were run. [Frozen plan](../../configs/pressure-v1.json) · [Solver settings](../../configs/recovery-v1/final-locked.json)

| Partition | Attempted | Eligible |
| --- | ---: | ---: |
| Train | 1,344 | 1,278 |
| Validation | 336 | 314 |
| Test | 336 | 322 |
| Total | 2,016 | 1,914 |

Every attempt's raw hashes and classification were verified offline. Each eligible array replayed exactly from its original CPWR and PSAV files. The 102 excluded cases failed the polar checks and supplied no labels. The report includes case and geometry/Reynolds counts, rejection evidence and file hashes. The solver emitted 26,695,509 raw bytes and took 420.8 summed process seconds. The raw folders, logs, floating-point partitions and training checkpoints remain local under the ignored `data/pressure-v1/` directory. The committed artifacts contain the graph, source parity vectors, split digests and evaluation results. [Full evaluation](../../artifacts/pressure-v1/report.json)

Two small PyTorch MLPs predicted the same pair of 257-station Cp arrays. The first learned both branches in one output layer. The selected model shares a network across the surfaces and uses reflected camber and angle features for the lower branch. Both were fit only on training labels. The selected checkpoint minimized the largest ratio of a validation error to its approved limit. Those ratios were 0.839 for the direct model and 0.755 for the shared model. Its checkpoint, graph and source parity vectors were hashed before the test partition was opened. [Validation results](../../artifacts/pressure-v1/validation.json) · [Frozen selection](../../artifacts/pressure-v1/selection.json)

## Test results

Each test Reynolds stratum passed the 80% floor and included all 16 held-out geometries. Eligible cases numbered 102/112 at Re 100,000, 111/112 at 250,000 and 109/112 at 500,000. The table weights each geometry equally, then each eligible profile and each relevant station equally. Suction location is measured to the nearest reference point within 0.02 Cp of the reference minimum. [Full test results and slices](../../artifacts/pressure-v1/report.json)

| Metric | Upper | Lower | Limit |
| --- | ---: | ---: | ---: |
| Whole-branch MAE, Cp | 0.0201 | 0.0138 | 0.030 |
| Whole-branch pointwise p95, Cp | 0.0666 | 0.0449 | 0.100 |
| Nose pointwise p95, Cp at s ≤ 0.08 | 0.0723 | 0.0752 | 0.150 |
| Tail pointwise p95, Cp at s ≥ 0.90 | 0.0435 | 0.0347 | 0.100 |
| Minimum Cp error p90 | 0.0487 | 0.0533 | 0.180 |
| Suction location error p90, x/c | 0.000 | 0.000 | 0.020 |

Local absolute errors still reached 0.606 Cp on the upper nose and 0.478 Cp on the lower nose. The upper-surface MAE at Re 100,000 was 0.0263 Cp, compared with 0.0148 Cp at Re 500,000. Results benchmark the 160-panel XFOIL reference for eligible cases. The grid round trip alone reached 0.0721 Cp maximum pointwise difference on the held-out upper surface. This model supports comparative surface-pressure inspection. Accuracy for experimental measurements, three-dimensional wings, flow velocity and unsampled operating points remains unmeasured. [V3.4 panel sensitivity](../v3-4/README.md#panel-sensitivity) · [Physics conventions](../PHYSICS.md)

## Browser verification

The pressure graph is 276,173 bytes and loads only on demand. The coefficient and pressure sessions share one same-origin ONNX Runtime Web 1.31.1 WASM binary and proxy worker. The pressure loader verifies the byte length and SHA-256 before inference, and validates finite values and the expected two-by-257 output shape. On 24 frozen vectors, the source-to-native-ONNX and source-to-Chrome maximum absolute errors were both `9.54e-7` Cp, giving a native-ONNX-to-Chrome upper bound of `1.91e-6` Cp against the `1e-5` gate. The largest distance between analytic and paired solver coordinates across the eligible dataset was `6.26e-5` chord. A separate browser test checks the plot and matching section against a paired cambered fixture from the raw solver grid. [Source vectors](../../artifacts/pressure-v1/parity.json) · [Coordinate fixture](../../artifacts/pressure-v1/plot-coordinate-fixture.json)

The performance benchmark measures first activation after the coefficient model is ready and warm edits from the angle control through the first paint opportunity. Each profile used five fresh contexts and 30 warm edits. Warm edit-to-plot p95 was 35.7 ms on desktop and 36.6 ms in phone emulation, both within the 150 ms budget. First activation medians were 365.6 ms and 362.3 ms respectively. The graph transferred 251,124 gzip bytes on activation. Initial Airfoil loads fetched neither the graph nor the pressure view chunk. Physical phone timing and WebKit remain unverified. [Measured browser timings](../../artifacts/pressure-v1/browser-performance.json)

The matched V3.4 control and V3.5 export transferred 205.3 and 205.5 KiB gzip of initial 2D JavaScript, respectively, with zero vehicle requests. Deferred 3D JavaScript was 264.9 KiB gzip on both builds. Coefficient edit-to-result medians were 545.0 ms cold and 97.0 ms warm for V3.4 and 508.2 ms cold and 96.6 ms warm for V3.5. The coefficient chart p95 was 98.9 ms in V3.5. Both builds had a 17.1 ms orbit p95 and zero draws at rest. Across three Lighthouse 13.6.0 runs per profile, V3.5 scored 99–100 for desktop performance and 92 for mobile, with 100 in accessibility, best practices and SEO. Mobile LCP was 3.322–3.330 s, mobile CLS stayed below 0.007, and desktop blocking time ranged from 19 to 24 ms. [Matched startup, Lighthouse and runtime evidence](../../artifacts/pressure-v1/browser-regression.json)

Reviewed Pressure at 1920 × 1080, 1440 × 900, 768 × 1024 and 390 × 844. Axe reported zero WCAG A/AA rule violations and no horizontal overflow in those captures. The regression suite passed 115 Python tests, 29 Node tests and 82 browser tests, with 17 profile-specific browser skips. The final static export passed the Pages guard with 116 files and 22,156,156 bytes. The existing coefficient graph and preprocessing hashes matched. [Accessibility evidence](../../artifacts/pressure-v1/browser-accessibility.json)

## Reproduction

Use the pinned XFOIL executable and source archive from the V3.4 pilot, plus the project ML dependencies. The output directories must be new. The training command opens only train and validation partitions. Evaluation verifies the frozen selection before opening the test partition. The generated report contains raw and derived digests from that run. Exact byte hashes depend on the solver and checkout bytes. [XFOIL setup](../v3-4/README.md#reproduce-the-pilot)

```powershell
.\.venv-ml\Scripts\python.exe scripts/run_pressure_dataset.py
.\.venv-ml\Scripts\python.exe scripts/train_pressure.py
.\.venv-ml\Scripts\python.exe scripts/evaluate_pressure.py
```

The web build uses the committed graph and application manifest. From `web/`, run `npm run verify` to build the static export and verify browser parity, failure and retry, lazy loading, coordinate alignment and keyboard inspection. To remeasure pressure latency, run `npm run serve` in one terminal and the benchmark in another.

```powershell
node scripts/benchmark-pressure.mjs http://127.0.0.1:4173 .wrangler/pressure-performance.json
```
