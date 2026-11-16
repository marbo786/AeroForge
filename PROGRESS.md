# AeroForge progress

Last updated 2026-11-17 (Asia/Karachi).

## Current status

- The v2 Studio is live on Cloudflare Pages. The local `main` and cached `origin/main` both pointed to Cleanup Phase F at `28741d8` when `codex/aeroforge-v3` branched. The exact Pages deployment identity remains pending. [Live Studio](https://aeroforge-9tf.pages.dev/) · [Release checklist](docs/RELEASE_CHECKLIST.md)
- The accepted ONNX model predicts isolated 2D sections. The AF–02 car and front-wing motion are illustrative. [Model evidence](docs/ML.md) · [Phase D demo](docs/media/aeroforge-demo.gif)

## Latest work · Phase V3.0

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

- Await explicit approval for V3.1. Its scope is the Studio section inset, shared inputs and inspection, synchronized telemetry, metadata-driven domain controls and responsive verification. [V3 technical specification](docs/V3_SPEC.md)
- Confirm the exact Cloudflare deployment metadata, named preview and rollback target before a release. [Deployment guide](docs/DEPLOYMENT.md)

[Original specification](docs/SPEC.md) · [V2 specification](docs/V2_SPEC.md) · [Completed milestones](docs/history/progress-through-cleanup-d.md)
