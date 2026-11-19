# Portfolio release

Release record: 2026-11-20 (Asia/Karachi).

- Production: [AeroForge](https://aeroforge-9tf.pages.dev/).
- Application source: [`ac22c20`](https://github.com/marbo786/AeroForge/commit/ac22c2023dd688af21b9f71aea0d389978dfbfbe), including the phone export-menu correction.
- Publishing: the existing Cloudflare Pages project `aeroforge`, connected to GitHub `main`. Documentation-only publication commits may follow the application source above.
- Previous production / rollback target: deployment `61795dff-75e9-4c20-baea-7c36f67897f1`, source `73b6918`, [immutable deployment](https://61795dff.aeroforge-9tf.pages.dev/).

The first portfolio publication used source `f291d3b`, deployment `fa732dc1-2013-4c92-8003-91c6d428900b`. Its [immutable deployment](https://fa732dc1.aeroforge-9tf.pages.dev/) and production hostname served the new hero. The public HTTPS smoke checked five routes, real same-origin inference, model/preprocessing hashes, MIME/cache/nosniff headers and a missing-WASM 404 with zero browser errors.

Linux CI subsequently identified a phone export-menu overlap. The application source above anchors phone formats to the screen edge in two columns and raises their stacking order. The regression checks menu bounds before real downloads. Six repeated desktop/tablet/phone controls-and-export tests passed locally. [Six captured export states](polish/release/export-audit.json) have zero WCAG A/AA violations and zero overflow, with six real JSON downloads.

Full verification runs in [GitHub Actions](https://github.com/marbo786/AeroForge/actions/workflows/ci.yml). Local verification and the feature-by-feature evidence are recorded in the [polish report](polish/README.md). The Python implementation, shared geometry contract, data and frozen coefficient/pressure artifacts remain unchanged.

To inspect the latest exact deployment identity, run `npx --offline wrangler@4.162.0 pages deployment list --project-name aeroforge --json` from `web/`. To repeat the public integrity check, run `npm run smoke:pages -- https://aeroforge-9tf.pages.dev/`. The smoke now distinguishes the landing page from the editor and verifies phone poster-first entry.
