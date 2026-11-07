# Phase 5 Design Studio evidence

The studio is available at `/` and `/studio/` in the static export. `/spike/` remains the separate, explicitly labeled infrastructure fixture. This phase implements geometry editing and single-condition telemetry; charts, comparison and URL sharing remain Phase 6.

## Design direction

The airfoil section is the visual centerpiece. A continuous three-column workbench places controls on the left, a chord-normalized technical drawing in the center and coefficients on the right. Mobile leads with the drawing, provides a native-button collapsible parameter section and stacks coefficient readouts.

Tokens: background `#0B0F14`, panel `#141A22`, border `#283341`, text `#E8EEF5`, geometry/accent `#45C4D8`, caution `#E6A34A`. Geist supplies interface typography; JetBrains Mono supplies numerical and engineering readouts. Fonts are self-hosted with no external runtime requests. The small JetBrains font and OFL license were obtained from the official JetBrains/JetBrainsMono repository; the source is pinned by the committed font bytes. Geist is supplied by the already pinned Next.js package.

The design deliberately uses a technical section drawing instead of decorative flow lines or placeholder plots. Grid, quarter-chord pivot, camber, reference chord, incidence and leading/trailing-edge annotations describe the actual geometry. SVG coordinates use identical x/y scale and preserve aspect ratio. Positive incidence puts the leading edge above the trailing edge. Shape/rotation transitions are brief and disabled with reduced motion.

## Inference and validity

`web/lib/inference/surrogate.ts` validates canonical geometry and operating bounds before runtime loading. It uses the accepted `recovery-v1-complete` metadata and verifies the downloaded ONNX SHA-256 before session creation. Float32 input is `[m, canonical_p, t, alpha_deg, log10(Re)]`; embedded transformations are never applied twice. Coefficients, output shape, finite values and positive drag are checked before display. L/D is computed only from valid outputs.

Runtime/model loading is deferred to the client. Same-origin ONNX Runtime Web 1.31.1 uses one-thread WASM with a reused session, no proxy worker and no inference backend. A failed session load can be retried; failed WASM initialization can require a page reload, which the error instructions state. Displayed latency measures `session.run`, including first-run overhead where applicable, and excludes model/runtime download. It is not a p50/p95 benchmark.

Inputs retain editable drafts and explicit validation errors. During invalid edits the last valid geometry is identified and coefficients are withheld. Async requests are debounced by 80 ms and superseded responses cannot overwrite the latest design. Candidate geometry controls retain the specification bounds. Operating controls permit the original candidate limits (12 degrees, Re 1,000,000), but predictions are withheld beyond -4 to 8 degrees / Re 100,000 to 500,000. Re interpolation is explicitly labeled; low-Re drag risk and finite-panel, nonexperimental, non-post-stall limitations remain visible. These bounds are an evidence envelope, not a claim that every point inside is validated.

## Visual review

Initial production screenshots: `desktop-initial.png` at 1440 px and `mobile-initial.png` at 390 px. Both were actually opened and inspected. The refinement pass moved the incidence annotation off the surface, separated the trailing-edge and axis labels, enlarged mobile SVG text and applied the specified self-hosted JetBrains Mono readouts. Final captures are `desktop.png` and `mobile.png`; inspection and final test results are recorded in `PROGRESS.md`.

All mobile checks emulate a touch viewport in Windows Chrome on the same desktop computer. They do not establish phone hardware performance or broad browser compatibility. No public deployment is claimed.

## Final validation

`npm run verify` passed strict TypeScript, 23 Node tests, the static production build and 22 Playwright tests (43.4 seconds). The separate Python audit suite passed all 104 tests (37.38 seconds). Studio tests verify the rendered contour, positive incidence orientation, visible coefficients against frozen source-model vectors, presets/reset/symmetry, invalid/beyond-envelope inputs, keyboard sliders, rapid changes, reduced motion, loading, model retry/hash rejection and missing WASM at both viewport widths. Normal flows report no external requests or console/page errors. `desktop-runtime.json` and `mobile-runtime.json` preserve the final suite's accepted-model browser parity/timing checks; they audit the frozen model without tuning or consuming another evaluation panel.

The initial runs exposed and corrected a float32-boundary test input and a real SVG-title hydration error. Numeric UI test inputs restore intended physical decimal precision; validation remains strict. A single-string SVG title preserves server/client markup agreement. Development uses webpack to resolve the repository-level shared/model JSON consistently with the production build.
