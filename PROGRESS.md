# AeroForge progress

Last updated 2026-11-17 (Asia/Karachi).

## Current status

- The v2 Studio is live on Cloudflare Pages. GitHub `main` includes Cleanup Phases A–C through `6c7b293`. Cleanup Phases D–F are local on `codex/aeroforge-cleanup`. [Live Studio](https://aeroforge-9tf.pages.dev/) · [Release checklist](docs/RELEASE_CHECKLIST.md)
- The accepted ONNX model predicts isolated 2D sections. The AF–02 car and front-wing motion are illustrative. [Model evidence](docs/ML.md) · [Phase D demo](docs/media/aeroforge-demo.gif)

## Latest work · Cleanup Phase F

- Profiled desktop startup and replaced runtime reflection-map generation with a precomputed 81 KiB cubemap. The 3D scene uses direct lighting if the map is unavailable. Corrected the heading hierarchy in desktop Analysis.
- Repeat Lighthouse desktop scores rose from 85–86 to 99–100. Total blocking time fell from 324.5–336.5 ms to 0–4.5 ms. Mobile scored 91. Axe reported zero violations in 12 states. [Performance and accessibility audit](docs/cleanup-f/README.md)
- Verified formatting, lint, strict TypeScript, the static export and its asset hashes. All 23 Node tests, 59 Playwright tests and 104 Python tests passed. Playwright skipped ten cases by viewport profile.

## Cleanup Phase E

- Renamed the production verification workflow to `.github/workflows/ci.yml`. Added pinned Prettier with `npm run format` and included `npm run format:check` in production verification.
- Split the Studio controls, readouts, airfoil editor, playback, model details and design actions from the workspace. Split the inspection canvas from camera controls, lighting and floor, vehicle loading and wing interaction. The workspace retains shared design state and camera poses.
- Archived the completed milestones. Kept `docs/SPEC.md` as the canonical engineering brief and `web/AGENTS.md` at the Next.js app root, where Next.js generates it and coding agents discover it. [Progress archive](docs/history/progress-through-cleanup-d.md) · [Storage proposal](docs/REPO_SIZE.md)
- Verified formatting, lint, strict TypeScript, the production export and both frozen asset hashes. All 23 Node tests, 59 Playwright tests and 104 Python tests passed. Ten browser cases were skipped by profile.

## Next work

- V2.6 still requires the exact Cloudflare deployment metadata, a named preview and a verified rollback target. [Deployment guide](docs/DEPLOYMENT.md)

[Original specification](docs/SPEC.md) · [V2 specification](docs/V2_SPEC.md) · [Completed milestones](docs/history/progress-through-cleanup-d.md)
