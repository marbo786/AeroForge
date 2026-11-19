# AeroForge release evidence

The current portfolio publication, application source, public smoke result and recorded rollback target are in the [portfolio release record](PORTFOLIO_RELEASE.md). The v2 evidence below is historical.

## Historical v2 release checklist

The v2 Studio is live on Cloudflare Pages. GitHub `main` contains PR #1 at merge `075bf74`, whose tree matches the V2.5 implementation at `5a36255`. The public HTTPS checks on 2026-11-16 verified the v2 behavior and matching assets. V2.6 remains pending for deployment metadata, a separately identified preview and the rollback check. [Live Studio](https://aeroforge-9tf.pages.dev/) · [Merged PR](https://github.com/marbo786/AeroForge/pull/1) · [Deployment guide](DEPLOYMENT.md)

| Area | Status | Evidence |
| --- | --- | --- |
| Production regression | Passed | Lint, strict TypeScript, 23 Node tests and 59 Playwright tests passed. Ten profile-specific browser cases were skipped. The separate Python evidence audit passed 104 tests. |
| Public HTTPS smoke | Passed | Chrome 157.0.8103.51 checked the Studio homepage, an Airfoil share link, Model Evidence and the inference fixture. Same-origin WASM inference returned numerical results. The model and preprocessing hashes matched the accepted manifest, MIME and cache headers passed, a missing WASM URL returned 404, and the smoke recorded zero browser errors. |
| Public vehicle and Analysis | Passed | At 1440 × 900, the AF–02 scene loaded, **Inspect front wing** opened the representative section, and Analysis displayed real lift and drag curves. Default lift was 0.6972 before and after switching views. Both GLBs and the poster matched the files in merged `main` byte for byte by SHA-256. |
| Static production export | Passed locally | The V2.5 export guard accepted 107 files totaling 21,745,600 bytes. The largest file was the 14,848,852-byte WASM runtime. Both car assets met their size budgets. |
| Visual and accessibility audit | Passed locally | Before and after captures cover four viewport sizes and loading and fallback states. Axe 4.14.0 found zero violations in 12 tested states. The keyboard, touch-emulation and reduced-motion checks cover the camera, wing and geometry controls. [V2.5 audit](v2-5/README.md) |
| Performance | Desktop target met in the local Phase F build | Phase F measured 99–100 desktop and 91 mobile. Desktop total blocking time fell from 324.5–336.5 ms to 0–4.5 ms on repeat tests. Accessibility, best practices and SEO scored 100 in both profiles. The recorded V2.5 scores were 86 desktop and 92 mobile, with desktop orbit p95 at 17.5 ms and 2.24 s to the interactive 3D frame under the 10 Mbps / 100 ms profile. [Phase F audit](cleanup-f/README.md) · [V2.5 performance data](v2-5/performance.json) |
| V2.6 deployment verification | Pending | Confirm the exact Cloudflare deployment commit and project settings in the dashboard, run the complete route, cache, 3D and fallback checks on a named preview and the exact production deployment, and record the approved Pages rollback target. The preceding Git source baseline is `e8e0ea0`. |
| Wider coverage | Open | Phone touch was emulated in Chrome. Physical phone frame timing, other browser engines and screen reader combinations remain unverified. |

## Public vehicle asset evidence

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `/vehicle/af02-v1/car.glb` | 828,248 | `98730eb9b526bb7b0be824c75ff9e5e76255d32da8e7ef73ab92e9150f2b8f7f` |
| `/vehicle/af02-mobile-v1/car.glb` | 399,464 | `efed22e87f81934dc0f8ed0683b7e4c293143568a39d421290e3fd26fdb0839d` |
| `/vehicle/af02-v1/poster.webp` | 34,884 | `68b5c3b745b3cd6a5049a45203fc44bcf22c10de77d620e64a5c5382751ad8e3` |

## Accepted numerical results

| Coefficient | MAE | RMSE | R² |
| --- | ---: | ---: | ---: |
| CL | 0.01484 | 0.02553 | 0.99733 |
| CD | 0.000683 | 0.001165 | 0.98260 |

The frozen results cover 165 eligible XFOIL cases from eight unseen geometries. Predictions describe an isolated 2D section. Experimental accuracy, post-stall behavior and calibrated uncertainty remain unverified. [Frozen evaluation](../artifacts/recovery-v1-complete/final-evaluation.json) · [ML methodology](ML.md)

The earlier 41-test and all-100 Lighthouse results belong to the [v1 launch audit](ui-launch/README.md).
