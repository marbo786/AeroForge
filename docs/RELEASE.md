# V1 release verification (historical)

These measurements describe the original Phase 7 export. [Current v2 release evidence](RELEASE_CHECKLIST.md)

The release target is the static Next.js export in `web/out`. Cloudflare Pages will serve the frontend and versioned assets. The browser verifies the accepted ONNX model hash, then runs CPU inference through a single WASM thread in an ONNX Runtime proxy worker.

## Local results

Windows, Node.js 24.11.0, npm 11.6.1, Chrome 157.0.8103.51, Lighthouse 13.6.0 and Wrangler 4.162.0. Lighthouse used the same gzip-enabled loopback production server for both runs. Mobile used the default simulated network and 4× CPU slowdown. These are lab scores.

| Profile | Performance | Accessibility | Best practices | SEO | Largest contentful paint | Total blocking time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop baseline | 73 | 96 | 81 | 100 | 0.3 s | 850 ms |
| Desktop final | 100 | 100 | 100 | 100 | 273 ms | 19 ms |
| Mobile baseline | 70 | 96 | 81 | 100 | 0.9 s | 4,300 ms |
| Mobile final | 95 | 100 | 100 | 100 | 931 ms | 256 ms |

The worker reduced startup blocking and removed the SharedArrayBuffer deprecation warning from the homepage audit. The aerodynamics graph and fitted preprocessing stayed at their accepted versions. The interface now uses a darker heading accent and an ink logo on vermilion for sufficient contrast. The airfoil is an accessible group containing individually named slider handles, and the logo link names include their visible text.

The final export has **88 files** and **19,475,623 raw bytes**. Its largest asset is the **14,848,852-byte** WASM binary, below the 25 MiB Pages limit. The WASM binary is **3,836,894 bytes** when gzip-compressed by the local server. The selected ONNX model is **49,781 bytes**. Lighthouse measured **4,301,273 bytes** of total transferred resources per final profile. First-run model readiness still depends on network download and CPU speed. The LCP measurement tracks rendering of the page rather than the time until a prediction is ready.

Wrangler parsed all three header rules and served the studio, the shared design route, model evidence and the fixture. The browser completed real same-origin inference with no console or page errors. File MIME types, immutable cache headers, the downloaded model hash, and the missing-WASM 404 all passed. The Cloudflare CDN and real network performance remain to be measured after publishing.

## Reproduce the audit

Use the pinned Node.js and npm versions in [the deployment guide](DEPLOYMENT.md). Build the project and start `npm run serve` from `web`. Run Lighthouse against the production export with Chrome installed. The first command uses Lighthouse's default simulated mobile settings. The second uses the desktop preset.

```sh
npx --yes lighthouse@13.6.0 http://127.0.0.1:4173/ --output=json --output-path=mobile.json --disable-full-page-screenshot --chrome-flags="--headless=new --disable-gpu"
npx --yes lighthouse@13.6.0 http://127.0.0.1:4173/ --preset=desktop --output=json --output-path=desktop.json --disable-full-page-screenshot --chrome-flags="--headless=new --disable-gpu"
```

The release audit also used axe-core 4.14.0 for the studio, Charts and Share dialogs, and the model evidence page. The scans selected the WCAG 2.0 and 2.1 A and AA automated rules and reported zero violations across eight desktop and mobile states. Browser coverage includes keyboard adjustment of an airfoil handle, modal dismissal, and mobile controls. Desktop and mobile screenshots were captured and inspected after the visual fixes. The audit describes the tested states and viewport emulation.

## License and release scope

The repository's original project code and documentation use the [MIT License](../LICENSE). The build includes copies of the runtime and font notices under `/licenses/`. It copies framework and animation license files from the installed, locked packages. The ONNX Runtime MIT license and third-party notices are sourced from its pinned [v1.31.1 release](https://github.com/microsoft/onnxruntime/tree/v1.31.1). The fonts are distributed under their SIL Open Font Licenses. [Geist license](https://github.com/vercel/geist-font/blob/main/OFL.txt)

The XFOIL binary and archive are excluded from the repository and release. XFOIL serves as the offline reference solver under its upstream license. The model and data provenance are documented separately. [XFOIL acquisition and provenance](DATA.md) · [Model evaluation and artifacts](ML.md)

## Publishing status

The [public Cloudflare Pages deployment](https://aeroforge-9tf.pages.dev/) passed the HTTPS smoke test on 2026-11-16 in Chrome 157.0.8103.51. All four routes passed, including a restored shared design. The check confirmed same-origin ONNX inference, the expected model hash, MIME and cache headers, a 404 for missing WASM, and zero browser errors. The Lighthouse results above remain local measurements. [Publishing and public verification](DEPLOYMENT.md)
