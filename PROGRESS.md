# AeroForge progress

Last updated 2026-11-17 (Asia/Karachi).

## Current status

- The v2 Studio is live on Cloudflare Pages. The local `main` and cached `origin/main` both pointed to Cleanup Phase F at `28741d8` when `codex/aeroforge-v3` branched. The exact Pages deployment identity remains pending. [Live Studio](https://aeroforge-9tf.pages.dev/) · [Release checklist](docs/RELEASE_CHECKLIST.md)
- The accepted ONNX model predicts isolated 2D sections. The AF–02 car and front-wing motion are illustrative. [Model evidence](docs/ML.md) · [Phase D demo](docs/media/aeroforge-demo.gif)

## Latest work · Phase V3.2

- Replayed the accepted ONNX graph read-only against 165 eligible frozen XFOIL points. Reproduced both published MAEs within `1e-6` and published residual diagnostics and plots across eight input and coefficient axes, with geometry-grouped resampling and 168-attempt accounting. Drag MAE was 0.001293 at Re 100k and 0.000244 at 500k. [Reliability report and plots](docs/v3-2/README.md)
- Added a model-bound coverage index with 657 eligible training rows across 33 geometries. The limited-coverage threshold is the 90th percentile of the leave-one-geometry-out distances. The geometry-plus-flow score flagged one of 163 development rows, which did not have unusually large error. The UI shows nearby coverage and the final-panel error statistics separately. The benchmark has no fresh calibration and independent evaluation pair for prediction intervals.
- The Details drawer reports the current coverage state, distance and threshold, interpolation, model version and held-out evidence. An in-bounds sparse design keeps its coefficient prediction. The app reports unavailable coverage if the index is missing or fails verification.
- Formatting, lint, TypeScript, 25 Node tests, 68 Playwright tests and 106 Python tests passed. Playwright skipped 15 profile-specific cases. The static export passed with 110 files and 21,844,402 bytes, including a 9,530-byte authenticated coverage index. Both accepted coefficient artifact hashes matched.
- Audited nominal, limited, outside and unavailable coverage at 1920 × 1080, 1440 × 900, 768 × 1024 and 390 × 844 in Chrome. Axe 4.14.0 found zero WCAG A/AA rule violations across 16 states. No page or drawer had horizontal overflow. Captures and reports are local under `web/.wrangler/v32-audit/`. Phone testing used emulation.
- Compared matched static exports in Chrome 157. The initial 2D shell was 204.5 KiB gzip versus 203.1 KiB for V3.1, with zero vehicle requests. The deferred coverage fetch transferred 496 gzip bytes. Cold and warm edit-to-result medians were 630 and 96.7 ms across five cold runs and 30 warm edits, versus 638 and 97.7 ms for V3.1. Warm chart p95 was 99 ms and desktop orbit p95 was 16.8 ms, with zero draws at rest.
- Across five Lighthouse 13.6.0 runs per profile, performance scored 99–100 desktop and 91–92 mobile, with 100 for accessibility, best practices and SEO. Mobile LCP was 3.324–3.344 s and layout shift stayed below 0.005. Desktop total blocking time had a 7.5 ms median. One of five runs reached 107.5 ms, above the 50 ms target, with long tasks in shared chunks whose bytes matched V3.1.

## Phase V3.1

- The selected wing's representative NACA section appears beside the bay on desktop and below it on compact screens. It stays visible in the compact edit sheet. The same design, current prediction, saved comparison and wing inspection carry across Studio, Airfoil and Analysis. [Browser architecture](docs/ARCHITECTURE.md#browser-workspace)
- Angle and Reynolds controls mark their model bounds and allow exploration past them. The return action clamps only out-of-bounds fields. All coefficient and latency readouts clear while a new sample is pending, or when the draft is invalid or outside the model bounds. Lift and drag sweeps use their own supported angles.
- Formatting, lint, TypeScript, 24 Node tests, 63 Playwright tests and 104 Python tests passed. Playwright skipped 11 profile-specific cases. The export passed the Pages guard with 109 files and 21,830,728 bytes. The model and preprocessing hashes matched the accepted artifacts.
- Reviewed the Studio, wing, Airfoil, Analysis and compact parameter sheet at 1920 × 1080, 1440 × 900, 768 × 1024 and 390 × 844. Axe 4.14.0 found zero WCAG A/AA rule violations and no reviewed state had horizontal page overflow. The Chrome captures and audit outputs are local under `web/.wrangler/v31-audit/`. Mobile verification used touch emulation.
- Compared local static exports in Chrome 157 on a Ryzen 7 5800U. The direct 2D shell transferred 203.1 KiB gzip, up 0.9 KiB, with zero vehicle requests. Desktop deferred JavaScript was 264.9 KiB gzip. Across five fresh contexts and 30 warm edits per build, cold edit-to-result median moved from 532.1 to 529.9 ms and warm median from 96.9 to 97.4 ms. Warm chart p95 fell from 198.7 to 98.4 ms. Warm session-call median in Analysis moved from 0.7 to 2.4 ms while the chart batch and current prediction shared the session. The served coefficient graph weighed 39,908 gzip bytes and the existing WASM binary weighed 3,836,894 gzip bytes.
- Desktop orbit p95 was 17.1 ms on both builds over 294 draw intervals per build, with zero draws in the settled idle sample. Across five fresh Lighthouse 13.6.0 runs per build and profile, V3.1 scored 99–100 desktop and 91–92 mobile for performance and 100 for accessibility, best practices and SEO. Mobile LCP was 3.324–3.345 s, versus 3.477–3.484 s for the baseline. V3.1 desktop blocking time was 0–9.5 ms, and mobile layout shift stayed below 0.005.

## Phase V3.0

- Completed the v3 feasibility review and phase plan on `codex/aeroforge-v3`. The plan reuses the current Studio and ONNX pipeline, proposes applicability warnings and observed errors as the first reliability release, and gates the optimizer and pressure work on measured feasibility. [V3 technical specification](docs/V3_SPEC.md)
- Verified the local baseline from source. Formatting, lint, TypeScript, 23 Node tests, 59 Playwright tests and 104 Python tests passed. Playwright skipped 10 cases by viewport profile. The production export passed its Pages checks with 109 files and 21,825,346 bytes. The largest asset was the 14,848,852-byte WASM binary. Both frozen hashes matched.
- Ran the public HTTPS smoke test on 2026-11-17. The four tested routes passed, including shared design restoration and same-origin WASM inference. The model and preprocessing hashes, asset MIME/cache headers and missing-runtime 404 passed, with zero browser errors.
- Captured local Studio overview and selected-wing baselines at 1920 × 1080, 1440 × 900, 768 × 1024 and 390 × 844. Selected wing had zero horizontal overflow in all four profiles. The visual review confirmed the section currently sits beneath the bay and pushes telemetry farther down on compact screens. The captures are local under `web/test-results/v3-baseline/`.

## Cleanup Phase F

- Profiled desktop startup and replaced runtime reflection-map generation with a precomputed 81 KiB cubemap. The 3D scene uses direct lighting if the map is unavailable. Corrected the heading hierarchy in desktop Analysis.
- Repeat Lighthouse desktop scores rose from 85–86 to 99–100. Total blocking time fell from 324.5–336.5 ms to 0–4.5 ms. Mobile scored 91. Axe reported zero violations in 12 states. [Performance and accessibility audit](docs/cleanup-f/README.md)
- Verified formatting, lint, strict TypeScript, the static export and its asset hashes. All 23 Node tests, 59 Playwright tests and 104 Python tests passed. Playwright skipped ten cases by viewport profile.

## Cleanup Phase E

- Renamed the production verification workflow to `.github/workflows/ci.yml`. Added pinned Prettier with `npm run format` and included `npm run format:check` in production verification.
- Split the Studio controls, readouts, airfoil editor, playback, model details and design actions from the workspace. Split the inspection canvas from camera controls, lighting and floor, vehicle loading and wing interaction. The workspace retains shared design state and camera poses.
- Archived the completed milestones. Kept `docs/SPEC.md` as the canonical engineering brief and `web/AGENTS.md` at the Next.js app root, where Next.js generates it and coding agents discover it. [Progress archive](docs/history/progress-through-cleanup-d.md) · [Storage proposal](docs/REPO_SIZE.md)
- Verified formatting, lint, strict TypeScript, the production export and both frozen asset hashes. All 23 Node tests, 59 Playwright tests and 104 Python tests passed. Ten browser cases were skipped by profile.

## Next work

- Await explicit approval for V3.3. Its first gate is a browser worker feasibility benchmark using the frozen coefficient model and the versioned training-coverage safeguard. [V3 technical specification](docs/V3_SPEC.md)
- Confirm the exact Cloudflare deployment metadata, named preview and rollback target before a release. [Deployment guide](docs/DEPLOYMENT.md)

[Original specification](docs/SPEC.md) · [V2 specification](docs/V2_SPEC.md) · [Completed milestones](docs/history/progress-through-cleanup-d.md)
