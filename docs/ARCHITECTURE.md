# AeroForge architecture and browser studio

The portfolio Studio and its illustrative AF–02 inspection bay are published through the Cloudflare Pages project connected to GitHub `main`. [Release provenance and rollback target](PORTFOLIO_RELEASE.md) · [Product specifications](SPEC.md) · [Architecture and budgets](V2_SPEC.md)

## Browser workspace

`web/app/landing.tsx` supplies the root hero; `web/app/studio/studio.tsx` supplies `/studio/` and legacy root design links. Validated numeric drafts feed the shared geometry engine and a proportionally scaled SVG. `web/lib/inference/domain.ts` derives the nominal prediction envelope from the accepted manifest. The editor defines its exploration limits separately in `design-fields.ts`, marks the model limits in the flow controls and offers an explicit return to model range. `surrogate.ts` reuses the same domain checks and handles SHA-256 verification, cached session loading and coefficient validation. It sends the raw five-feature contract to the graph, which embeds every trained transformation. Results and failures are keyed by canonical design, model version and retry. Pending, invalid and out-of-bounds inputs clear all current coefficients and latency, including between playback samples. Invalid drafts keep a labeled last-valid drawing.

Studio, Airfoil and Analysis share the same design, predictions and session comparison. Studio loads the illustrative car through a client-only React Three Fiber module. Selecting the front wing focuses the camera and opens a representative NACA section beside the bay on desktop and below it on compact screens. The compact parameter sheet carries a live copy of the section while users edit. The outline is calculated from the shared NACA engine and memoized by geometry, with angle applied around the quarter chord as a separate transform. The geometry editor and ONNX telemetry describe the isolated 2D section. Phones start with a poster and opt into the compact GLB. Airfoil and Analysis deep links skip vehicle loads, and the controls remain usable when WebGL fails. The renderer uses demand frames and releases its canvas when leaving Studio, preserving the camera pose for return.

The workstation is isolated in `instrument.tsx`, `stage.tsx`, `charts.tsx` and a shared component/token kit. Local Barlow/Geist/JetBrains fonts, CSS variables exposed through Tailwind, Motion springs and native dialogs support the shared graphite/orange presentation with a persisted light theme. Geometry morphing interpolates NACA parameters and regenerates the contour with equal axes. Contour and camber paths are memoized by geometry so flow-only edits do not resample them. Pointer updates coalesce on animation frames, with a 110 ms minimum commit interval allowing the unchanged 80 ms inference debounce to resolve during drags. Keyboard steps apply individually. Telemetry displays the rounded model result without animating through intermediate numbers.

Each 25-point lift and drag sweep runs as a single batch through the accepted browser ONNX session. Its key includes geometry, Reynolds number and model version. The sweep substitutes its own angles from the manifest, so it can display valid curves for an otherwise eligible design at an unsupported operating-point angle. Invalid outputs leave gaps. A shared cursor follows the current angle until the user inspects another sample and retains that selection across the studio dock, Airfoil and Analysis. A comparison stores one design and its operating-point coefficients for the current session. Each design's curve uses its own Reynolds number, and the stage overlays both sections at their respective angles of attack. CSV export contains the valid model rows.

Phase 7 uses the ONNX Runtime proxy worker for the studio to move WASM initialization and inference off the browser main thread. The studio still validates inputs and verifies the model hash before creating the session. It uses one WASM thread and same-origin assets. The latency readout times the session call and includes worker communication. The separate affine fixture keeps its original direct runtime path and worker experiment.

V3.5 loads the Airfoil Pressure view and its verified graph after activation. It uses a second session in the same proxy runtime. Pressure inference validates output shape and finite values before the plot maps each curve onto the shared NACA geometry. A design change resets the result before the next inference can render. [Pressure browser verification](v3-5/README.md#browser-verification)

The Studio loads one same-origin training coverage index after the first eligible prediction completes or reaches an error. The model hash, training-table hash and asset hash tie the index to the accepted release. Coverage compares the current design and operating point with eligible training rows. A limited-coverage warning does not change an eligible coefficient result. The Details drawer explains the distance, threshold, scoped final-panel MAE and Reynolds interpolation. The model's nominal bounds apply even if the index is unavailable. [Reliability evidence and method](v3-2/README.md)

The optimizer loads on activation and starts a dedicated module worker. The worker proposes, screens and ranks designs and requests one bounded inference batch at a time through the existing browser session. The browser keeps submitted counts and terminates the worker on cancellation. Only the active worker's replies can update the search. Apply and revert go through the shared Studio design state. [Search policy and offline verification](v3-3/README.md)

Share links serialize the current design as `m`, `p`, `t`, `aoa` and `re` query parameters. `view=airfoil` or `view=analysis` preserves the active engineering view. Links without `view` open Studio. The app reads the parameters after hydration, validates geometry and operating inputs, and canonicalizes symmetric sections before starting inference. A malformed design link opens with default parameters and an explanation. Editor bounds permit exploring configurations outside the model's prediction envelope. `/model/` presents the frozen final evaluation. Ordinary anchors preserve direct static navigation to the model and fixture pages.

## Accepted Phase 4 recovery

`python/aeroforge/recovery.py` trains and compares physics-feature Ridge/forest/GP models and shared/independent neural models. A controlled 33/8/8 train/validation/final geometry allocation, plus three separate consumed-test diagnostic geometries, replaces the inadequate original pilot split. `scripts/finalize_recovery.py` freezes model/selection hashes and numerical export parity before final simulations and permits one final reporting pass.

The selected lift-residual/log-drag networks have independent 64x64 SiLU hidden layers. Their ONNX graph embeds twelve physical/interaction features, train-only scaling and output inversion behind the unchanged five-feature external interface. Artifacts and inference metadata are under `artifacts/recovery-v1-complete/`; source/ONNX/browser consistency and fresh test accuracy gates pass. `model.json` states the finite-panel scientific limits and sampled Re values.

Phase 4 initially exposed trained-model execution only through the browser test harness. Phase 5 now uses the accepted model in the visible studio without an inference service. The original failed experiment remains below and in its original artifacts for transparency.

## Original Phase 4 research experiment (historical failure)

The working-tree experiment in `python/aeroforge/ml.py` trains Ridge, Random Forest and PyTorch MLP candidates from the validated pilot, using a predeclared geometry split and training-only preprocessing. The validation-selected MLP exports with embedded scaling/log-drag inversion and runs in the production WASM verification harness. Research artifacts and hashes are under `artifacts/pilot-surrogate-v1/`.

Held-out predictive error missed the original targets. The candidate remained a research result. The later Phase 4 recovery supplied the model used by the public browser studio. [Original protocol and recovery evidence](ML.md)

## Offline solver pipeline

`python/aeroforge/xfoil.py` produces explicit single-point command streams, runs bounded processes and parses/qualifies actual solver polars. `python/aeroforge/pilot.py` applies a versioned, bounded plan to canonical Phase 2 geometries, saving per-attempt evidence, eligible label tables and a quality report. `scripts/run_pilot.py` is the source-checkout entry point.

The exact solver is a hash-pinned local Windows XFOIL 6.99 binary. It is excluded from Git and never ships to the frontend. `configs/pilot-v1.json` and `data/pilot-v1/` establish reproducible configuration and traceable real labels; raw failure metadata remains separate from eligible CL/CD labels. Parquet artifacts use pinned pandas/pyarrow. CI audits originals, hashes and label consistency without needing the executable. See `DATA.md` for acceptance checks and scientific limits.

## Geometry library boundary

`python/aeroforge/geometry.py` is the offline geometry engine, and `web/lib/geometry/naca4.ts` is its browser-compatible counterpart. Both consume `shared/naca4.json` for coefficients, version, candidate bounds and presets. Neither imports the ONNX fixture, solver code or a UI framework.

Normalization precedes geometry generation and ID construction. Symmetric `p=0` is shared by both paths. IDs encode normalized float64 parameters losslessly and exclude sampling resolution and operating conditions. Complete coordinate and ID parity are tested through a Node bridge from pytest; independent Decimal station references prevent parity from being the sole correctness oracle.

The Python geometry library runs from the source checkout. Test setup uses pinned pytest. Native Node TypeScript stripping executes the TypeScript geometry tests without another test-runner dependency. The browser geometry engine powers the Airfoil editor and the section diagrams. [Geometry contract](PHYSICS.md)

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

The production verification suite covers formatting, lint, strict TypeScript, Node geometry/inference/search checks and real-browser tests. The [polish report](polish/README.md) records current counts, viewport audits, bundle changes and landing Lighthouse measurements. The Python evidence audit and frozen scientific artifacts remain unchanged. Browser tests exercise same-origin ONNX, direct links, withheld outputs, chart gaps, camera return, smooth-scroll focus, native dialogs and the graphics fallback. Physical-phone timing and WebKit remain unverified.

## Portfolio presentation

The shared palette lives in `web/app/studio/tokens.css`; workspace and inspection styles consume it. The theme toggle persists a local preference and gracefully handles unavailable storage. Open Graph metadata uses a static PNG so the static export needs no image service. [Phased polish record](polish/README.md)

The landing scene reuses the inspection renderer and mobile poster/3D opt-in policy. The primary CTA requests the five-step tour in the workspace. Tour completion and skipping are remembered locally; the Tour action reopens it. Legacy root links with design/view parameters bypass the hero.

The root livery provider restores a validated fictional colorway from the URL or local storage. The shared token file maps colorways to contrast-adjusted light/dark accents. The Three.js material treatment changes only original AF–02 paint materials. Share URLs include `livery`. Telemetry keeps first-section baselines and best values by alpha/Re in session memory, or compares against the saved design. CL/L/D increases and CD decreases are labeled explicitly; none is a full-car performance measurement. Initial coefficient loading uses five sequential lights, with static lights under reduced motion. Optimizer track briefs reset only the search settings, not the live design.

The pressure-driven study reuses the frozen pressure session and solver-aligned arc-length coordinates. Its hook validates coefficient bounds, the pressure model’s sampled operating points and known rejected cases before inference. Results are keyed to exact pressure features; edits, failures and unsupported conditions withhold old colors. SVG segments and the selected wing’s representative section share the same Cp arrays. A live section cut and spanwise-extruded NACA surface attach to the existing pitch pivot. The extrusion repeats isolated 2D Cp across the span, not a finite-wing pressure solution. Smoke path deflection and animation are schematic, while color samples come from the pressure model. Reduced motion freezes the smoke dashes.

Car comparison reuses the session’s existing saved design and result. Two independent inspection viewports show the live and saved representative sections, with phone 3D opt-in retained for each. The original viewport stays mounted but inactive so its camera pose can return after comparison. Compare does not infer a full-car performance difference. Share cards render a self-contained SVG with true section geometry, model coefficients, fictional livery and honest-limits footer, then encode it locally as a 1200 × 675 PNG. Completed optimizer challenges use the same card renderer with objective, surrogate objective delta, seed and evaluation count; their share link restores the selected candidate and livery. The comparison baseline remains session-only.

Portfolio-polish releases publish from GitHub `main` through the existing Cloudflare Pages project. [Release provenance and rollback target](PORTFOLIO_RELEASE.md). [Current verification and captures](polish/README.md)

## Multi-element research boundary

The [main-plane-plus-flap design note](MULTI_ELEMENT_WING.md) is a plan only. Interacting elements need a new geometry/installation contract, solver evidence, separately validated models and a new applicability domain. The current car assembly and representative-section extrusion do not implement that physics. No multi-element data generation or model change is included.


## Scroll-driven introduction

The landing route owns an optional Lenis instance and a mutable scroll-camera store. The inspection camera subscribes to that store, interpolates its existing view framing, and invalidates demand frames only when progress changes. The store is absent from ordinary studio camera control. Coarse-pointer/compact layouts use normal document flow and native scrolling; reduced motion keeps the same readable story without choreography. Intersection observers mount the below-fold story lab, which reuses existing geometry, coefficient inference, pressure eligibility and share-card components. Legacy root design parameters still select the studio rather than the story.

The landing morph regenerates the same NACA geometry with a small presentation-only RAF interpolation; it does not import the studio animation library. Landing counters stop at the real model value when motion preference changes. Lenis is also destroyed on pagehide and recreated on a back/forward-cache return. Explicit colorway parameters carry a landing selection into the editor even when storage is unavailable.
