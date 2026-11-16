# AeroForge progress

Last updated 2026-11-17 (Asia/Karachi).

## Current status

- The v2 Studio is live on Cloudflare Pages. GitHub `main` includes Cleanup Phases A–C through `6c7b293`. Cleanup Phases D and E are local on `codex/aeroforge-cleanup`. [Live Studio](https://aeroforge-9tf.pages.dev/) · [Release checklist](docs/RELEASE_CHECKLIST.md)
- The accepted ONNX model predicts isolated 2D sections. The AF–02 car and front-wing motion are illustrative. [Model evidence](docs/ML.md) · [Phase D demo](docs/media/aeroforge-demo.gif)

## Latest work · Cleanup Phase E

- Renamed the production verification workflow to `.github/workflows/ci.yml`. Added pinned Prettier with `npm run format` and included `npm run format:check` in production verification.
- Split the Studio controls, readouts, airfoil editor, playback, model details and design actions from the workspace. Split the inspection canvas from camera controls, lighting and floor, vehicle loading and wing interaction. The workspace retains shared design state and camera poses.
- Archived the completed milestones. Kept `docs/SPEC.md` as the canonical engineering brief and `web/AGENTS.md` at the Next.js app root, where Next.js generates it and coding agents discover it. [Progress archive](docs/history/progress-through-cleanup-d.md) · [Storage proposal](docs/REPO_SIZE.md)
- Verified formatting, lint, strict TypeScript, the production export and both frozen asset hashes. All 23 Node tests, 59 Playwright tests and 104 Python tests passed. Ten browser cases were skipped by profile.

## Next work

- Cleanup Phase F awaits approval. The recorded desktop Lighthouse baseline is 86 with 313 ms total blocking time and a performance target of 90. The mobile baseline is 92. [V2.5 performance evidence](docs/v2-5/README.md)
- V2.6 still requires the exact Cloudflare deployment metadata, a named preview and a verified rollback target. [Deployment guide](docs/DEPLOYMENT.md)

[Original specification](docs/SPEC.md) · [V2 specification](docs/V2_SPEC.md) · [Completed milestones](docs/history/progress-through-cleanup-d.md)
