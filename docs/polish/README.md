# AeroForge portfolio polish

## Phase 1 · unified visual system

One shared token set defines graphite surfaces, orange accents, readable mono labels and a persistent light theme. Theme controls are available in the workspace and standalone inspection page. Coefficient readouts receive more space than the section name; no inference behavior changes. Static Open Graph/Twitter metadata references a designed 1200 × 630 PNG with the honest-limits footnote.

Verification and visual evidence are recorded per phase. Captures cover Studio, Airfoil and Analysis at 1440, 768 and 390 pixels in both themes, with WCAG A/AA checks and page-overflow assertions. Chrome phone emulation does not establish physical-phone performance.

The palette uses graphite `#101419`, panel `#171d23`, text `#eef1f4`, muted text `#b0bcc6` and orange `#ff9559`. Light mode uses cool gray surfaces and darker orange to retain text contrast. The existing condensed display face marks the product; mono numerals carry the coefficient hierarchy. Phone actions occupy a dedicated header row so labels retain their legibility without obscuring the brand.

The theme preference is local to the browser. Storage failures leave the current session usable. No car performance, uncertainty or full-scale downforce claim is introduced.

Phase 1 verification: `npm run verify` passed formatting, lint, strict TypeScript, 29 Node tests, static build/Pages guards and 84 browser tests (17 profile-specific skips). Final captures and axe reports in [phase-1](phase-1/audit.json) cover 18 states with zero WCAG A/AA violations and zero overflow. The coefficient graph and preprocessing hashes match the accepted artifacts. Nothing deferred.

## Phase 2 · hero and guided entry

The root presents the AF–02 alongside a condensed headline and one editor CTA. The scene reuses the inspection component, including its graphics fallback and phone poster. The GIF was not added to the first viewport: the existing renderer/poster already conveys the car and avoids competing motion. The README demo remains available.

A five-step native-dialog tour covers the car, section edits, telemetry, comparison/search and honest limits. It is requested on entry through the hero, remembers skip/completion in local storage and can be replayed with Tour. Direct engineering links do not interrupt the user with a tour. Storage failure permits normal use without persisting the preference.

Phase 2 verification: `npm run verify` passed formatting, lint, TypeScript, 29 Node tests, export/Pages guards and 86 browser tests (17 profile skips). [Thirty captured states](phase-2/audit.json) have zero WCAG A/AA violations and zero overflow, including landing and tour in both themes. Axe 4.14.0 is pinned for reproducible local audits. No requested behavior deferred; the existing GIF remains in the README.

## Phase 3 · fictional racing identity

Ember Works, Ion Velocity and Violet Apex are original fictional finishes. Car paint, section outlines and coefficient charts follow the colorway; the share URL takes precedence over local storage. The compact poster retains its original showroom finish until 3D is enabled.

Telemetry compares against the saved design, or the first eligible section at the current alpha/Re. Green marks higher CL/L/D or lower CD, purple marks an improved session best at that operating point, and amber marks the opposite direction. Text names accompany the colors. These are coefficient conventions, not a claim that higher lift is best for every application. Missing/pending results also clear deltas. Five start lights accompany first model initialization; reduced motion displays static lights with the same status text.

The illustrative Long straight brief selects minimum drag at alpha 2° and CL ≥ 0.35. The Technical circuit brief selects maximum section lift at alpha 8° and stores a minimum-lift setting of 1.0 for a switch to the drag objective. The lift objective itself has no minimum-lift constraint. Neither brief predicts lap time or full-car downforce. Existing custom searches retain their behavior.

Phase 3 verification: `npm run verify` passed formatting, lint, TypeScript, 29 Node tests, export/Pages guards and 94 browser tests (17 profile skips). [Sixty audited states](phase-3/audit.json) have zero WCAG A/AA violations and zero overflow. Twelve focused feature tests and four applicable wing tests also passed. Wing picking now probes an actual selectable point, preserving click/keyboard/camera/touch assertions across viewport proportions. No requested behavior deferred.

Reproduce captures from `web/` after a build with `node scripts/capture-polish.mjs phase-3` (substitute the phase number). The script runs its own static server and pinned axe checker. Captures use reduced motion and Chrome phone emulation.

## Phase 4 · pressure and a linked section

Surface Cp colors the actual solver-aligned NACA coordinates with the existing pressure graph. The fixed −3 to +1 color scale visibly labels its saturated ends, while the Pressure plot retains exact station inspection. The graph, transforms, pressure coordinates and frozen artifacts are unchanged. First activation loads pressure; flow-off does not request that graph.

Selected-wing inspection adds an in-place representative section overlay and a white section cut that regenerate with the shared geometry. The existing pitch pivot carries both. Pressure repeats uniformly across the illustrative span and is not a finite-wing pressure result. The car’s surrounding multi-plane assembly remains illustrative.

Wind-tunnel smoke uses pressure colors and responds to geometry and pressure magnitudes, but its paths and dash speed are explicitly schematic. A surface-pressure model cannot establish the surrounding velocity field or streamlines. Reduced motion freezes the dashes.

Nominal geometry/flow bounds and the pressure model’s sampled alpha/Re values gate the study. Known rejected solver cases remain unavailable. Keyed results prevent stale colors after edits or unsupported inputs; failed pressure can be retried. No CFD, velocity inference, downforce conversion or new model is introduced.

Phase 4 verification: `npm run verify` passed formatting, lint, TypeScript, 29 Node tests, export/Pages guards and 101 browser tests (18 profile skips). [Forty-eight audited states](phase-4/audit.json) have zero WCAG A/AA violations and zero overflow. Eleven applicable focused pressure/wing checks and three controls/export checks passed. Frozen Cp vectors agree with displayed samples within `1e-5`. The pitch test now checks distinct 8°/12° illustrative poses while retaining absent coefficients at 12°. No model, Python or frozen-artifact changes. Predicted streamlines and a velocity field remain outside the available model; the smoke trajectories are deliberately labeled schematic.
