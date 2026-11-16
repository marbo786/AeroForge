# AeroForge v1 launch checklist

Audit date: 2026-11-16. The existing Cloudflare Pages build has been exercised over public HTTPS. The dark studio is the launch candidate tested against its local production export. The candidate can ship as a portfolio demo after its deployment passes the public smoke check.

| Area | Status | Evidence |
| --- | --- | --- |
| Functional journeys | Passed | Playwright covered opening the studio, NACA presets, geometry handles and direct entry, alpha and Reynolds changes, coherent predictions and sweeps, comparison save and restore, downloads, shared-link clipboard and restoration, malformed URLs, and mobile controls. |
| Failure handling and domain | Passed | Browser tests covered missing and corrupt model files, missing WASM, retry, invalid drafts and settings outside the prediction envelope. Telemetry and curves withhold unavailable values. |
| ML verification | Passed | Python checked the geometry and preprocessing contract, trained source and exported ONNX agreement, artifact hashes, and the frozen evaluation. Real browser WASM agreed with the reference over 881 vectors within 1.49 × 10⁻⁷, returned positive drag for those vectors, and repeated identical results within a session. |
| Visual QA | Passed | Studio and chart captures at 1440 × 900, 1920 × 1080, 768 × 1024 and 390 × 844. The four candidate captures had no horizontal overflow, browser errors or third-party requests. [Before and after](ui-launch/README.md) |
| Accessibility | Passed | Axe 4.14.0 found zero violations in eight checks across the studio, Charts, Share and Model Evidence on desktop and emulated mobile after the contrast fix. Playwright exercised keyboard geometry changes. [Axe results](ui-launch/accessibility.json) |
| Static production export | Passed | Next.js exported all routes and required assets. The Pages guard accepted 88 files totaling 19,476,490 bytes. The largest file is the 14,848,852-byte WASM binary, below the 25 MiB per-file limit. Wrangler 4.162.0 parsed all three header rules, saw no Functions, and passed the four-route smoke on the final export. [Emulated Pages smoke](ui-launch/pages-emulator.json) |
| Performance | Passed | Lighthouse scored 100 for all four categories in desktop and simulated mobile lab runs. Drag p95 was 16.8 ms in a local Chrome sample. First inference still depends on the cold WASM transfer. [Lighthouse results](ui-launch/lighthouse.json) |
| Security and privacy checks | Passed | The export guard rejects .env files and Pages runtime entry points. A separate scan found no sensitive filenames or common private key and token markers in the export. The browser verifies the model checksum before initialization. The production dependency audit reported zero known advisories. |
| Existing public deployment | Passed | The [public release](https://aeroforge-9tf.pages.dev/) returned all four routes over HTTPS. The smoke ran real same-origin inference, matched the published manifest and both checksums, checked MIME and immutable cache headers, confirmed missing WASM returns 404, and saw no browser errors. [Smoke result](ui-launch/pages-live.json) |
| Documentation | Passed | README, architecture, runbook, visual evidence and the engineering case study include measured results, operating bounds, reproduction steps and future validation work. [Case study](CASE_STUDY.md) |
| Candidate rollout | Not verified | Private Cloudflare account settings and the candidate deployment are pending verification. Compare the live deployment's commit and project settings against the runbook when publishing. [Deployment guide](DEPLOYMENT.md) |
| Other browser engines, physical phones and screen readers | Not verified | Browser verification used Chrome with desktop, tablet and phone profiles. The automated checks and keyboard journey do not cover all assistive technology. |
| Experimental accuracy | Not verified | The frozen final panel measures agreement with XFOIL within a finite set. Post-stall behavior, wind tunnel accuracy and calibrated uncertainty have no validation in v1. |

`npm run verify` passed lint, strict TypeScript, 23 Node tests, a fresh production export and all 41 Playwright tests. The Python evidence audit passed 104 tests. The accepted model files and solver data matched the repository versions.

## Accepted numerical results

| Coefficient | MAE | RMSE | R² |
| --- | ---: | ---: | ---: |
| CL | 0.01484 | 0.02553 | 0.99733 |
| CD | 0.000683 | 0.001165 | 0.98260 |

These are the frozen results for 165 eligible XFOIL cases from eight unseen geometries. The browser takes raw fractional camber, canonical camber position and thickness, angle in degrees, and log₁₀ of Reynolds number in that order. The accepted 49,781-byte graph embeds trained scaling and target inversion. [Frozen evaluation](../artifacts/recovery-v1-complete/final-evaluation.json) · [ML methodology](ML.md)

## Browser performance

Lighthouse 13.6.0 audited the final local production export. These are lab scores. The mobile profile uses simulated throttling.

| Profile | Performance | Accessibility | Best practices | SEO | LCP | Blocking time | Layout shift |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop | 100 | 100 | 100 | 100 | 258 ms | 0 ms | 0.0194 |
| Mobile | 100 | 100 | 100 | 100 | 919 ms | 79 ms | 0.0083 |

The default studio loads 634,239 decoded bytes of framework and application JavaScript, versus 634,134 bytes before the refinement. No third-party requests were observed, and warm reload is covered by the Playwright runtime tests. Four fresh Chrome contexts over loopback reached prediction ready in 1.08–1.69 seconds. The graph request took 4–6 ms and the WASM request took 316–444 ms. The largest cold transfer was 3.84 MB of compressed WASM. The loader reuses one session and sends runtime work to a browser worker. [Cold-load captures](ui-launch/after/measurements.json)

Direct one-thread browser WASM initialized in 548–738 ms including asset fetch and session creation. Warm p95 ran at 0.3–0.4 ms for one row and 0.2–0.4 ms for 17 rows. The studio's first timed prediction, which includes worker communication, read 32.0–46.3 ms in the four captures. [Desktop parity and timing](ui-launch/model-parity-desktop.json) · [Mobile parity and timing](ui-launch/model-parity-mobile.json)

At 1440 × 900, 179 drag frame intervals measured 16.7 ms median and 16.8 ms p95, with one above 25 ms. React recorded 268 root commits during the drag sample. The chart path reached the DOM 179 ms after clicking Charts following a drag. Page JavaScript heap after forced collection was 5.48 MB before and 6.05 MB after 12 chart cycles. This short exercise excludes worker memory and cannot establish long-session memory stability. [Interaction profile](ui-launch/interaction-profile.json)

## Confirmed issues resolved

- Animated telemetry could show intermediate values between model results. The instruments now display rounded model values directly and label any previous result shown during an update.
- Lift and drag inspection positions could disagree or open at an unrelated angle. Both charts use one cursor initialized at the nearest model sample. Sweeps retain the shaded unavailable region and breaks for missing data.
- Rapid keyboard inputs could be coalesced by the pointer throttle. Keyboard steps now apply individually. The space shortcut also leaves focusable geometry handles and links alone.
- The shorter tablet and phone layouts keep important controls and the model values higher on screen. Flow-only edits reuse the sampled geometry. Exports use the displayed stage background and preserve the equal axes.
- The dark model evidence panels briefly failed contrast during entrance animation. The panels now render at full contrast immediately, and pending numbers use a readable muted foreground.

## Remaining issues

| Severity | Item |
| --- | --- |
| Release gate | Publish the candidate and run the four-route smoke test on its actual public URL. Confirm the commit in Cloudflare, then open one shared design link and check browser inference. |
| Medium | The first visit downloads the WASM runtime. Treat the local load timings as lab measurements and expect slower readiness on constrained connections. |
| Medium | Low-Re drag and high-camber sections carry higher model errors. Keep the current validation envelope and disclose the solver-based limits for engineering use. |
| Low | Physical mobile devices, Firefox, Safari and screen reader combinations still need manual coverage. |
| Low | The legacy studio stylesheet remains as an unreferenced source file. It is excluded from the production bundle. |
