# AeroForge architecture: Phases 1–3

Implemented scope: static inference feasibility, analytic NACA geometry libraries and a real XFOIL pilot pipeline. The approved product architecture remains in `SPEC.md`; learned aerodynamic models and the Design Studio are not included yet.

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

The baseline deliberately avoids proxy workers. An independent same-origin module-worker experiment executes the real ONNX fixture in the production smoke suite, with one thread and without cross-origin isolation. It uses a generated worker script and the same runtime assets; the page itself stays on the simple main-thread path. The built-in proxy-worker option and multithreaded WASM are separate mechanisms and remain unverified. Do not enable them for the main UI without production evidence. This phase does not claim broad cross-browser support or final-model latency.

The runtime entry is copied from the pinned package and loaded using native dynamic ESM import with `webpackIgnore`; TypeScript still checks its API using the package types. This avoids webpack emitting an unused duplicate WASM file and keeps every core asset same-origin. Version changes must update both the package pin and the client runtime version.

Input parsing rejects empty tokens, nonfinite values and magnitudes above 1,000,000. Arithmetic remains in the model. The displayed timing covers `session.run`, excluding runtime download and initialization; it is not a final product benchmark.

## Caching and deployment safety

Runtime paths contain the package version and model paths contain the fixture schema version. Change the model path version whenever model bytes change; never publish different bytes under an immutable URL. The same rule applies to future scalers and model manifests. Repeat inference reuses the session and warm reload tests check browser cache use.

Only static assets are deployed. Next.js server actions, API routes, middleware/proxy, runtime cookies, dynamic server rendering, image optimization services and Pages Functions are absent. Browser code is behind a client component. No simulation/training packages are bundled into the application.

The spike uses ordinary anchors between exported documents. During investigation, Next.js 16.4.5 client-side navigation requested `/spike/__next.spike.__PAGE__.txt`, while export wrote a nested segment file; the resulting 404 failed the clean-console check. Ordinary document navigation requires no host-specific RSC rewrite. If later phases need Next.js soft navigation, revalidate those request paths on both the static server and Pages rather than hiding 404s or assuming compatibility.

## Verification boundaries

Node tests inspect the protobuf graph, hash, asset equality and per-file size. Playwright then independently executes it in a real browser against served production output and observes actual network responses and numerical results. Error-path tests deliberately intercept assets. GitHub CI is configured but a local pass does not establish that a hosted CI run or public deployment succeeded.
