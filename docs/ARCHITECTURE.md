# AeroForge architecture and browser studio

Implemented scope: static inference feasibility, analytic geometry, real XFOIL data, a trained/evaluated ONNX surrogate and the responsive Design Studio. The approved product architecture remains in `SPEC.md`.

## Phase 5 browser studio

`web/app/studio/studio.tsx` supplies both `/` and `/studio/`. Validated numeric drafts feed the shared geometry engine and a proportionally scaled SVG. `web/lib/inference/surrogate.ts` owns domain checks, the accepted manifest, SHA-256 verification, cached session loading and coefficient validation. It sends the raw five-feature contract to the graph, which embeds every trained transformation. Async cancellation prevents superseded requests from displaying stale coefficients. Invalid/out-of-envelope inputs withhold telemetry while preserving a labeled last valid drawing. Domain status opens the model's finite XFOIL limitations and provenance drawer.

The subsequently authorized reference-based redesign is isolated in `instrument.tsx`, `stage.tsx`, `charts.tsx` and a shared component/token kit. Local Barlow/Geist/JetBrains fonts, CSS variables exposed through Tailwind, Motion springs and native dialogs implement the paper/ink/vermilion workstation. Geometry morphing interpolates NACA parameters and regenerates the tested contour, preserving equal axes. Pointer updates coalesce on animation frames, with a 110 ms minimum commit interval allowing the unchanged 80 ms inference debounce to resolve during drags. A current callback ref prevents queued updates from reverting newer inputs.

Phase 6 runs each 25-point lift and drag sweep as a single batch through the accepted browser ONNX session. The sweep spans −4° to 8° and invalid outputs leave gaps. A comparison stores one design and its operating-point coefficients for the current session. Each design's curve uses its own Reynolds number, and the stage overlays both sections at their respective angles of attack. CSV export contains the valid model rows.

Phase 7 uses the ONNX Runtime proxy worker for the studio to move WASM initialization and inference off the browser main thread. The studio still validates inputs and verifies the model hash before creating the session. It uses one WASM thread and same-origin assets. The latency readout times the session call and includes worker communication. The separate affine fixture keeps its original direct runtime path and worker experiment.

Share links serialize the current design as `m`, `p`, `t`, `aoa` and `re` query parameters. The studio reads them after hydration, validates geometry and operating inputs, and canonicalizes symmetric sections before starting inference. A malformed design link opens the default studio with an explanation. Editor bounds permit exploring configurations outside the model's prediction envelope. `/model/` presents the frozen final evaluation. Ordinary anchors preserve direct static navigation to the model and fixture pages.

## Accepted Phase 4 recovery

`python/aeroforge/recovery.py` trains and compares physics-feature Ridge/forest/GP models and shared/independent neural models. A controlled 33/8/8 train/validation/final geometry allocation, plus three separate consumed-test diagnostic geometries, replaces the inadequate original pilot split. `scripts/finalize_recovery.py` freezes model/selection hashes and numerical export parity before final simulations and permits one final reporting pass.

The selected lift-residual/log-drag networks have independent 64x64 SiLU hidden layers. Their ONNX graph embeds twelve physical/interaction features, train-only scaling and output inversion behind the unchanged five-feature external interface. Artifacts and inference metadata are under `artifacts/recovery-v1-complete/`; source/ONNX/browser consistency and fresh test accuracy gates pass. `model.json` states the finite-panel scientific limits and sampled Re values.

Phase 4 initially exposed trained-model execution only through the browser test harness. Phase 5 now uses the accepted model in the visible studio without an inference service. The original failed experiment remains below and in its original artifacts for transparency.

## Original Phase 4 research experiment (historical failure)

The working-tree experiment in `python/aeroforge/ml.py` trains Ridge, Random Forest and PyTorch MLP candidates from the validated pilot, using a predeclared geometry split and training-only preprocessing. The validation-selected MLP exports with embedded scaling/log-drag inversion and runs in the production WASM verification harness. Research artifacts and hashes are under `artifacts/pilot-surrogate-v1/`.

Held-out predictive error missed the configured targets. This work is not committed or promoted as an approved aerodynamic model; the visible feasibility UI remains unchanged. `docs/ML.md` records the frozen protocol, measured failures and the need for fresh test evidence before further tuning. The Design Studio is still out of scope.

## Offline solver pipeline

`python/aeroforge/xfoil.py` produces explicit single-point command streams, runs bounded processes and parses/qualifies actual solver polars. `python/aeroforge/pilot.py` applies a versioned, bounded plan to canonical Phase 2 geometries, saving per-attempt evidence, eligible label tables and a quality report. `scripts/run_pilot.py` is the source-checkout entry point.

The exact solver is a hash-pinned local Windows XFOIL 6.99 binary. It is excluded from Git and never ships to the frontend. `configs/pilot-v1.json` and `data/pilot-v1/` establish reproducible configuration and traceable real labels; raw failure metadata remains separate from eligible CL/CD labels. Parquet artifacts use pinned pandas/pyarrow. CI audits originals, hashes and label consistency without needing the executable. See `DATA.md` for acceptance checks and scientific limits.

## Geometry library boundary

`python/aeroforge/geometry.py` is the offline geometry engine, and `web/lib/geometry/naca4.ts` is its browser-compatible counterpart. Both consume `shared/naca4.json` for coefficients, version, candidate bounds and presets. Neither imports the ONNX fixture, solver code or a UI framework.

Normalization precedes geometry generation and ID construction. Symmetric `p=0` is shared by both paths. IDs encode normalized float64 parameters losslessly and exclude sampling resolution and operating conditions. Complete coordinate and ID parity are tested through a Node bridge from pytest; independent Decimal station references prevent parity from being the sole correctness oracle.

The Python library currently runs from the source checkout and has no runtime dependencies. Test setup uses pinned pytest. Native Node TypeScript stripping executes the TypeScript geometry tests without another test-runner dependency. No geometry UI was added; the Phase 1 production smoke suite remains a separate regression check. See `PHYSICS.md` for the full contract.

## Static inference feasibility

```text
build: pinned npm dependencies
  -> deterministic ONNX fixture + matching runtime asset copies
  -> next build (output: export)
  -> web/out (HTML, CSS, JavaScript, model, module and WASM)

browser: static /spike/ page
  -> validate user input
  -> lazy native import of the self-hosted ort.wasm.min.mjs package entry
  -> one-thread WASM InferenceSession
  -> float32 input batch -> ONNX Mul + Add -> output tensor
  -> display output and measured session.run duration
```

## Fixture contract

The graph computes `y = 2*x + 1`, with float32 tensor names `x` and `y`, shape `[batch]`, ONNX opset 13 and IR 8. It is an infrastructure fixture, not a learned model, a surrogate or a source of aerodynamic coefficients. Expected values live only in tests; the page displays `InferenceSession.run` outputs.

`web/scripts/prepare-assets.mjs` generates the model deterministically and its SHA-256 manifest; it copies only the CPU WASM binary and matching `.mjs` companion from the exact installed runtime package. The build never downloads a model from a model hub or invokes Python. A lockfile and exact direct dependency versions establish the JavaScript toolchain.

## Runtime choices

`web/lib/fixture.ts` sets `numThreads=1`, `proxy=false` and explicit same-origin versioned `wasmPaths` before session creation. WASM SIMD on modern Chrome is the verified CPU baseline. There is no WebGPU requirement, `SharedArrayBuffer` requirement or inference backend. The session is reused across runs; failed session creation clears the promise so a model-load retry can recover. A failed WASM initialization may require page reload.

The affine fixture runs on the main thread. Its separate same-origin module-worker experiment uses a generated script with the same runtime assets. Both fixture paths run one WASM thread without cross-origin isolation. The Design Studio uses the built-in proxy worker described above.

The runtime entry is copied from the pinned package and loaded using native dynamic ESM import with `webpackIgnore`; TypeScript still checks its API using the package types. This avoids webpack emitting an unused duplicate WASM file and keeps every core asset same-origin. Version changes must update both the package pin and the client runtime version.

Input parsing rejects empty tokens, nonfinite values and magnitudes above 1,000,000. Arithmetic remains in the model. The displayed timing covers `session.run`, excluding runtime download and initialization; it is not a final product benchmark.

## Caching and deployment safety

Runtime paths contain the package version and model paths contain the fixture schema version. Change the model path version whenever model bytes change; never publish different bytes under an immutable URL. The same rule applies to future scalers and model manifests. Repeat inference reuses the session and warm reload tests check browser cache use.

Only static assets are deployed. Next.js server actions, API routes, middleware/proxy, runtime cookies, dynamic server rendering, image optimization services and Pages Functions are absent. Browser code is behind a client component. No simulation/training packages are bundled into the application.

The spike uses ordinary anchors between exported documents. During investigation, Next.js 16.4.5 client-side navigation requested `/spike/__next.spike.__PAGE__.txt`, while export wrote a nested segment file; the resulting 404 failed the clean-console check. Ordinary document navigation requires no host-specific RSC rewrite. If later phases need Next.js soft navigation, revalidate those request paths on both the static server and Pages rather than hiding 404s or assuming compatibility.

## Verification boundaries

Node tests inspect the protobuf graph, hash, asset equality and per-file size. Playwright then independently executes it in a real browser against served production output and observes actual network responses and numerical results. Error-path tests deliberately intercept assets. GitHub CI is configured but a local pass does not establish that a hosted CI run or public deployment succeeded.
