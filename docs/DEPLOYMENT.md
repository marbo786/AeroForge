# Phase 1 deployment feasibility

The application is a **static Next.js export**. This document describes a prepared Cloudflare Pages deployment, not an already deployed public site.

## Reproduce locally

Prerequisites: Node.js 24.11.0, npm 11.6.1; Chrome installed on Windows or the matching Playwright Chromium on Linux.

```sh
cd web
npm ci
npm run verify
npm run serve
```

Build assets are in `web/out`. The local server binds to `127.0.0.1:4173`, serves only that directory with JavaScript/WASM MIME types, gzip negotiation, ETags and versioned asset caching, and performs no model execution. It is not `next start`, a development server, or a production hosting requirement. Playwright starts/stops this server automatically. The smoke test records warm-cache body/transfer sizes; actual CDN compression and caching must be checked after deployment.

## Cloudflare Pages Free settings

After the repository is pushed and GitHub/Cloudflare access is authorized:

| Setting | Value |
| --- | --- |
| Git repository | `marbo786/AeroForge` |
| Project root directory | `web` |
| Framework preset | Next.js (Static HTML Export) |
| Production branch | The approved release branch, normally `main` |
| Build command | `npm run build` |
| Output directory | `out` (relative to `web`) |
| Node version | `24.11.0` via `.node-version`; confirm build logs |
| Package installation | npm with committed `package-lock.json`; use `npm ci` where configurable |
| Environment secrets | None required |
| Functions / SSR adapter | None |

The initial local work branch is `codex/phase-1-onnx`; do not select it as the release branch by accident. No domain purchase is needed; the supplied `pages.dev` address is sufficient. Do not enable paid services, Workers inference, R2 or an SSR adapter.

The export includes `public/_headers`, with long-lived caching for versioned runtime/model paths and basic static security headers. Next.js configuration headers do not run on a plain static host. Keep model paths immutable across releases and publish all related assets together. The baseline requires neither COOP/COEP nor cross-origin isolation.

The two spike routes use ordinary document navigation, avoiding a discovered Next.js client-prefetch path mismatch in this release. Do not introduce a catch-all HTML fallback for model, module, WASM or RSC requests. No strict Content Security Policy is supplied or claimed tested; adding one requires a new production smoke pass for Next.js bootstrap scripts, WASM compilation and module workers.

## Production verification checklist

After a public deployment is authorized and completes:

1. Open `/` and load `/spike/` directly over HTTPS; confirm both return exported HTML.
2. Run `0, 3, -2, 0.25`; verify output `1, 7, -3, 1.5`.
3. Check the `.onnx`, `.mjs` and `.wasm` requests succeed from the same site. WASM must return `application/wasm`, the module JavaScript, and no HTML fallback.
4. Confirm runtime/module/WASM versions match, reload and confirm expected caching, inspect console errors, and test mobile width.
5. Verify no Functions or external inference requests and no billable service bindings.

The local smoke suite proves the production export under the included static server. A Cloudflare CDN deployment, its actual response headers and account configuration must be verified independently before claiming public deployment success.

## Constraints and official sources

Reviewed on 2026-11-07:

- [Next.js static export](https://nextjs.org/docs/app/guides/static-exports): `output: 'export'` emits `out`; server-only features are unavailable.
- [Cloudflare Pages static Next.js deployment](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/): static export preset and output settings.
- [Pages Free limits](https://developers.cloudflare.com/pages/platform/limits/): 500 builds/month, one build at once, 20-minute timeout, 20,000 files and 25 MiB maximum per file. Build-time checks verify the copied WASM companions fit the per-file limit.
- [Static asset pricing](https://developers.cloudflare.com/pages/functions/pricing/): static requests are free and unlimited when Functions are not invoked. Recheck terms before release.
- [ONNX Runtime Web deployment](https://onnxruntime.ai/docs/tutorials/web/deploy.html): ship the model, appropriate WASM binary and same-build module assets with explicit paths.
- [Runtime flags and workers](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html): one-thread execution avoids multithreading isolation requirements; worker options need independent validation.

This phase does not promise future host pricing, all-browser compatibility, final aerodynamic model size/accuracy, or Lighthouse scores. See `PROGRESS.md` for actual local results and unresolved constraints.
