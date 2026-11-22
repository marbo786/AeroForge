# Scroll-polish production release

Release record: 2026-11-22 (Asia/Karachi).

- Production: [AeroForge](https://aeroforge-9tf.pages.dev/).
- Application source: [`0966bda`](https://github.com/marbo786/AeroForge/commit/0966bda3abdd945d06251d8620ab79bce7e5d7f0).
- Application deployment: `2329de47-34de-4b34-81f7-81818b1a746d`, [immutable release](https://2329de47.aeroforge-9tf.pages.dev/), confirmed active from GitHub `main`.
- Publishing: the existing Git-connected Cloudflare Pages project `aeroforge`. Documentation-only publication commits may follow the application source above without changing application behavior.
- Previous production / rollback target: source `4f5ee78`, deployment `99297676-5311-431e-ba23-554be72226c8`, [immutable previous release](https://99297676.aeroforge-9tf.pages.dev/).

The [application CI run](https://github.com/marbo786/AeroForge/actions/runs/45044336034) passed 115 Python tests, 29 Node tests and 127 browser tests, with 22 viewport-specific skips. Local `npm run verify` passed after each polish phase. The final matrix checks initial and reached content at five widths, both themes and both motion preferences. It caught and fixed faint offscreen reveal text before publication. [Phase reports, screenshots and Lighthouse](polish/README.md#scroll-polish--phase-e).

Both the immutable release and public hostname passed five-route HTTPS smoke checks: real same-origin inference, model/preprocessing hashes, MIME/nosniff/immutable headers, missing-WASM 404 and zero browser errors. The live hostname serves the new story, the exact verified social image and the Lenis license notice. [Production check record](polish/scroll/production.json).

Additional isolated-browser feature probes from this host were transport-limited: 10 passed directly, six passed after retry, and four exhausted retries at navigation with `ERR_QUIC_PROTOCOL_ERROR`. Forced HTTP/2 and HTTP/1.1 attempts produced connection resets. Those results are separate from the clean route/inference smoke and local/Linux-CI application checks. No application code or production protocol setting was changed to mask them.

The current [20.4-second demonstration](media/aeroforge-demo.webp) and social preview use original fictional finishes and retain the honest limits. The car and wing pitch are illustrative; model predictions describe isolated NACA sections at α −4° to 8° and Re 100k–500k. No Python, shared geometry contract, configs, data or frozen coefficient/pressure artifacts changed.

To inspect the latest exact publishing deployment, run `npx --offline wrangler@4.162.0 pages deployment list --project-name aeroforge --json` from `web/`. Repeat public integrity checks with `npm run smoke:pages -- https://aeroforge-9tf.pages.dev/`. Physical-phone/WebKit timing remains unverified. Cold chapter activation still produces isolated longer frames; the lab report retains those measurements and the initial mobile-score regression.

The earlier portfolio release used application source `ac22c20`; its publishing commits culminated at `4f5ee78`. The older pre-portfolio rollback target, source `73b6918` / deployment `61795dff-75e9-4c20-baea-7c36f67897f1`, remains historical release evidence.
