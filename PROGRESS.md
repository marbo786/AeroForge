# AeroForge progress

Last updated: 2026-11-07 (Asia/Karachi).

## Current phase and session rule

Phase 2: physics geometry engine is complete. The user explicitly approved Phase 2 on 2026-11-07. Only analytic geometry, normalization, presets and their tests/documentation were added. Phase 3 has not started and requires a new instruction.

Every coding session must begin by reading `docs/SPEC.md` and this file. The complete user specification is preserved byte-for-byte in `docs/SPEC.md`; this tracker supplements it and does not weaken its requirements. Work on one approved phase, validate it, update this tracker, commit it when possible, summarize, and stop. Never begin the next phase silently.

## Phase 2 completed tasks and results

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

- Phases 1 and 2 were explicitly authorized and completed. Await a new instruction before Phase 3.
- Retain Cloudflare Pages static export, npm lockfile, self-hosted WASM and the verified one-thread CPU/browser baseline; public deployment remains unperformed.
- XFOIL acquisition is a later separate decision, not authorization to change the label source. Recommend investigating the official Windows binary first in Phase 3.
- Confirm an isolated supported Python interpreter/toolchain route when ML setup is needed; no system installation has been performed.
- Public GitHub/Cloudflare configuration, paid changes, substantial downloads, destructive changes, and overwriting user content retain the explicit approval gates in the specification.
- README, architecture, physics and deployment documents now exist. Future ML documentation and MIT license review belong to their corresponding phases. No fabricated benchmarks, screenshots, URLs, or accuracy claims.

## Next phase

Phase 3: simulation data pipeline, only after explicit instruction. Begin by reading both planning files and rechecking XFOIL availability. Establish an explicitly approved real label source, bounded solver invocation, reproducible configuration, convergence/failure records and a pilot quality report. Do not generate large batches or begin ML training before the pilot/data-source gate passes. Any binary acquisition, system toolchain change or NeuralFoil fallback retains the approval gates in `docs/SPEC.md`.

## Commit history

Phase 0 had no commit: the directory was not initialized and restricted Git probes failed with a path error. Phase 1 resolved invocation through approved execution and initialized the repository without resetting history.

Phase 1 commit: `9de96eb98a343d7b165769239a4600198e04cb5c` (`add static browser onnx feasibility spike`) on `codex/phase-1-onnx`. This initial commit includes the preserved Phase 0 planning files and the completed, tested Phase 1 implementation.

Phase 2 commit: `implement naca geometry generator`, continuing on the same branch. Resolve the final commit hash with `git log -1 --format=%H`; a commit cannot include its own final hash. No remote push is included.

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
