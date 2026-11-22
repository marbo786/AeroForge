# AeroForge progress

Last updated 2026-11-22 (Asia/Karachi).

## Scroll polish

- Phase E verification passed: 29 Node / 127 browser tests, with 22 viewport skips; the landing matrix and recaptured ten-state audit are clean. The new 20.4-second WebP, social preview and current-status docs are refreshed. Initial application JS is down 64,296 / 70,107 gzip bytes from baseline (desktop / phone); scroll p95 is 17.0 / 17.4 ms, with cold activation outliers retained in the report. Corrected Lighthouse performance medians are 92.5 desktop / 85.5 mobile, with 100 for accessibility, best practices and SEO. The initial contrast failure and mobile-score drop remain documented. [Final evidence](docs/polish/README.md#scroll-polish--phase-e).

- Phase D complete: 13px bold telemetry deltas, arrow/word state labels, observed-range sectors and reduced-motion-safe result ticks. Full verification passed 29 Node / 121 browser tests with 20 skips. Forty audited states are clean. Initial landing JS phase delta is −1 / −1 gzip bytes; full-story chunks grew by 9 bytes. [Evidence](docs/polish/README.md#scroll-polish--phase-d).

- Phase C complete: accessible View disclosure, native tour focus return, sticky operating-point rail. Fresh full verification passed 29 Node / 119 browser tests with 20 skips after a host-suspension timeout was confirmed environmental. Thirty audited states are clean; desktop page height is unchanged. Initial landing application JS phase delta: +1 / +1 gzip bytes. [Evidence](docs/polish/README.md#scroll-polish--phase-c).

- Phase B complete: shared keyboard-native swatches preserve URL/local colorways. Full verification: 29 Node and 116 browser tests passed; 19 skips. Twenty audited landing/studio states are clean. Application JS phase delta: +418 / +287 gzip bytes, desktop / phone. [Captures and evidence](docs/polish/README.md#scroll-polish--phase-b).

- Phase A complete: continuous landing, one scroll-driven desktop renderer, lazy live model panels, native phone/reduced-motion layouts. Full verification: 29 Node and 114 browser tests passed; 19 viewport skips. Ten audited width/theme states have zero WCAG A/AA violations or overflow. Initial application JS fell 65,325 / 71,005 gzip bytes (desktop / phone); cold panel activation still has isolated longer frames. [Evidence and captures](docs/polish/README.md#scroll-polish--phase-a).

## Current status

- The portfolio studio is published from GitHub `main` through the Git-connected Cloudflare Pages project. Exact application source, deployment provenance and rollback target are recorded in the [release record](docs/PORTFOLIO_RELEASE.md). [Live Studio](https://aeroforge-9tf.pages.dev/)
- The accepted ONNX model predicts isolated 2D sections. The AF–02 car and front-wing motion are illustrative. [Model evidence](docs/ML.md) · [Scroll and interaction demo](docs/media/aeroforge-demo.webp)

## Portfolio publication

- Pushed the complete portfolio work to GitHub `main` and published through the existing Cloudflare Pages project. [Live AeroForge](https://aeroforge-9tf.pages.dev/) · [Release record](docs/PORTFOLIO_RELEASE.md).
- Public HTTPS smoke verified five routes, same-origin inference, frozen model hashes, headers and the missing-runtime 404 with zero browser errors.
- Corrected a Linux-CI phone export-menu overlap. Six repeated controls/export tests passed; six recaptured states have zero WCAG A/AA violations and overflow. Application source: `ac22c20`. The prior production deployment is recorded as the rollback target.

## Portfolio polish · Phase 6 (plan only)

- Documented the data, versioned model contract, validation gates and Reynolds-range rationale for a main plane plus flap. No multi-element implementation or new scientific artifacts. [Research design note](docs/MULTI_ELEMENT_WING.md)
- Passed the final `npm run verify`: 29 Node and 109 browser tests, with 18 viewport-specific skips. No UI changes; Phase 5 captures remain current. [Polish report](docs/polish/README.md).

## Portfolio polish · Phase 5

- Added side-by-side live/saved wing inspection on the AF–02, preserving phone poster-first previews and the existing saved-design state.
- Added locally exported 1200 × 675 PNG share cards with section geometry, coefficients, fictional livery and honest limits. Completed optimizer challenges share the same card format and candidate URL.
- Passed `npm run verify`: 29 Node and 109 browser tests, 18 profile skips. Forty-eight audited states, including 320px phones, have zero WCAG A/AA violations and overflow. [Polish record](docs/polish/README.md).

## Portfolio polish · Phase 4

- Replaced the conceptual-flow toggle with model-driven surface Cp and a labeled schematic wind-tunnel smoke mode.
- Added a shared live NACA surface and section cut to selected-wing inspection, with Cp repeated spanwise only for illustration. Preserved sampled pressure limits, rejected cases and unavailable states.
- Passed `npm run verify`: 29 Node and 101 browser tests, 18 profile skips. Forty-eight audited states have zero WCAG A/AA violations and overflow. [Polish record](docs/polish/README.md).

## Portfolio polish · Phase 3

- Added original Ember Works, Ion Velocity and Violet Apex finishes across the car, charts and shared URL, with local persistence.
- Added telemetry baseline deltas, per-operating-point session bests, five model-start lights with a reduced-motion fallback, and illustrative optimizer track briefs.
- Passed `npm run verify`: 29 Node and 94 browser tests, 17 profile skips. Sixty audited states have zero WCAG A/AA violations and overflow. [Polish record](docs/polish/README.md).

## Portfolio polish · Phase 2

- Added an AF–02 hero with a single editor CTA, visible honest limits and the existing mobile poster/3D opt-in behavior.
- Added a five-step, skippable, locally remembered tour with a replay control. Legacy root design links still open the engineering workspace.
- Passed `npm run verify`: 29 Node and 86 browser tests, 17 profile skips. Thirty captured states have zero WCAG A/AA violations and overflow. [Polish record](docs/polish/README.md).

## Portfolio polish · Phase 1

- Consolidated dark/orange and light palettes, added a persistent theme control, raised small labels and enlarged live coefficient readouts relative to the section name.
- Added static social metadata and a designed preview with explicit section/car limits. Models, Python and frozen evidence remain unchanged.
- Passed `npm run verify`: 29 Node and 84 browser tests, 17 profile skips; 18 captured states have zero WCAG A/AA violations and overflow. Verification and captures: [polish record](docs/polish/README.md).

## Latest work · Phase V3.5

- Generated 1,914 eligible pressure profiles from the approved 2,016 XFOIL attempts. Froze the selected model using validation data, then passed all accuracy gates on 322 profiles from 16 held-out geometries. Upper and lower MAE were 0.0201 and 0.0138 Cp. [Data and model report](docs/v3-5/README.md)
- Added the on-demand Airfoil Pressure view with inverted Cp, linked upper and lower station inspection and explicit missing states. The 270 KiB graph shares the deployed WASM runtime. Chrome matched the 24 frozen source vectors within `9.54e-7` Cp. [Browser evidence](docs/v3-5/README.md#browser-verification)
- Warm edit-to-pressure-plot p95 was 35.7 ms on desktop and 36.6 ms in Chrome phone emulation. The four reviewed layouts had zero axe WCAG A/AA violations and zero horizontal overflow. All 115 Python, 29 Node and 82 executed browser tests passed. The final static export passed the Pages guard.

## Phase V3.4

- Ran exactly 24 primary, three repeat and three refined XFOIL solves for surface pressure. All 30 CPWR files uniquely matched their PSAV panels. Twenty-two primary cases met the pressure and polar gates, including at least one result for every geometry/Reynolds pair. All three repeats matched at printed precision. Both primary exclusions occurred at Re 100k. [Pressure pilot](docs/v3-4/README.md)
- Selected 257 arc-length stations per branch for proposed model evaluation. The worst whole-branch reconstruction MAE was 0.00151 Cp. The largest local 320-versus-160 difference reached 0.02604 Cp on the NACA 6618 lower trailing edge. [Panel sensitivity plot](docs/v3-4/panel-sensitivity.png)
- Preserved commands, pressure files, panel coordinates, polars, compressed logs, hashes and the paired eligible array. The report proposes a geometry-disjoint 2,016-attempt data cap and pressure error budgets for approval, plus the Level 1 geometry UI path.
- Replayed the saved evidence in regression tests without launching XFOIL. All 115 Python tests, 28 Node tests and 72 Playwright tests passed, with 17 profile-specific browser skips. Formatting, lint, TypeScript and the static Pages export guard passed.

## Phase V3.3

- Added a cancellable worker-based optimizer for CL/CD, minimum drag at required lift, and maximum lift. It screens the model domain and training coverage, displays a ranked shortlist and objective history, and preserves the original section for comparison and revert. The verifier replays exported shortlists offline with the pinned XFOIL 6.99 setup. [Optimizer documentation](docs/v3-3/README.md)
- The 36 benchmark searches each completed 512 candidate evaluations, with one ONNX and one WASM download per profile. Differential evolution improved the surrogate objective in all nine matched desktop case/seed pairs. Chrome click-to-completion p95 was 172.5 ms desktop and 148.6 ms with phone emulation. Native ONNX replay of all 36 best designs agreed with browser CL and CD within `1.2e-7` and `7.5e-9`, respectively. Physical phone timing and WebKit remain unverified.
- All 12 bounded XFOIL replays gave eligible polars. XFOIL changed the top-ranked candidate for efficiency and lift. One minimum-drag candidate fell below the requested CL of 0.8, returning 0.7987 against a prediction of 0.80429. Review constraint margins and broaden independent shortlist verification before general availability. The raw replay files are local under `web/.wrangler/v33-audit/xfoil/`. [Solver comparison and data](docs/v3-3/README.md#bounded-xfoil-replay)
- Formatting, lint, TypeScript, 28 Node tests, 72 Playwright tests and 109 Python tests passed. Playwright skipped 17 profile-specific cases. The static export passed with 113 files and 21,867,739 bytes, including one 5,839-byte optimizer worker. The two frozen coefficient artifact hashes matched.
- Reviewed the optimizer settings and result at 1920 × 1080, 1440 × 900, 768 × 1024 and 390 × 844. The final axe 4.14.0 audit found zero WCAG A/AA rule violations across eight states, and none had horizontal page or drawer overflow. Captures and reports are local under `web/.wrangler/v33-audit/`.
- Compared matched static exports in Chrome 157. Initial 2D JavaScript was 205.3 KiB gzip versus 204.5 KiB in V3.2, with zero vehicle requests. Desktop deferred JavaScript stayed at 264.9 KiB gzip. V3.3 cold and warm edit-to-result medians were 529.7 and 97.4 ms over five fresh contexts and 30 warm edits, versus 541.5 and 97.2 ms for V3.2. Warm chart p95 was 98.5 ms. Desktop orbit p95 was 17.0 ms over 294 draw intervals, with zero draws at rest.
- All five Lighthouse 13.6.0 runs per profile scored 100 desktop and 92 mobile for performance, and 100 for accessibility, best practices and SEO. Desktop blocking time ranged from 0 to 27.5 ms. Mobile LCP was 3.321–3.340 s and layout shift stayed below 0.007.

## Phase V3.2

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

- Review the locally verified portfolio polish and the plan-only [multi-element research scope](docs/MULTI_ELEMENT_WING.md) before new data/model work.
- Confirm the exact Cloudflare deployment metadata, named preview and rollback target before a release. [Deployment guide](docs/DEPLOYMENT.md)

[Original specification](docs/SPEC.md) · [V2 specification](docs/V2_SPEC.md) · [Completed milestones](docs/history/progress-through-cleanup-d.md)
