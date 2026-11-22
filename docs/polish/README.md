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

Reproduce captures from `web/` after a build with `node scripts/capture-polish.mjs phase-3` (substitute an implementation phase from 1 to 5). The script runs its own static server and pinned axe checker. Captures use reduced motion and Chrome phone emulation.

## Phase 4 · pressure and a linked section

Surface Cp colors the actual solver-aligned NACA coordinates with the existing pressure graph. The fixed −3 to +1 color scale visibly labels its saturated ends, while the Pressure plot retains exact station inspection. The graph, transforms, pressure coordinates and frozen artifacts are unchanged. First activation loads pressure; flow-off does not request that graph.

Selected-wing inspection adds an in-place representative section overlay and a white section cut that regenerate with the shared geometry. The existing pitch pivot carries both. Pressure repeats uniformly across the illustrative span and is not a finite-wing pressure result. The car’s surrounding multi-plane assembly remains illustrative.

Wind-tunnel smoke uses pressure colors and responds to geometry and pressure magnitudes, but its paths and dash speed are explicitly schematic. A surface-pressure model cannot establish the surrounding velocity field or streamlines. Reduced motion freezes the dashes.

Nominal geometry/flow bounds and the pressure model’s sampled alpha/Re values gate the study. Known rejected solver cases remain unavailable. Keyed results prevent stale colors after edits or unsupported inputs; failed pressure can be retried. No CFD, velocity inference, downforce conversion or new model is introduced.

Phase 4 verification: `npm run verify` passed formatting, lint, TypeScript, 29 Node tests, export/Pages guards and 101 browser tests (18 profile skips). [Forty-eight audited states](phase-4/audit.json) have zero WCAG A/AA violations and zero overflow. Eleven applicable focused pressure/wing checks and three controls/export checks passed. Frozen Cp vectors agree with displayed samples within `1e-5`. The pitch test now checks distinct 8°/12° illustrative poses while retaining absent coefficients at 12°. No model, Python or frozen-artifact changes. Predicted streamlines and a velocity field remain outside the available model; the smoke trajectories are deliberately labeled schematic.

## Phase 5 · compare and share

Save baseline in Studio, edit the section, then choose Compare on car. The pair uses the same saved-design state as section and curve comparison. Each card has a live NACA overlay on the reference car, its section outline and isolated coefficients. Current pending/invalid results stay empty. Phones retain two independent poster-first previews and stack the pair. The saved baseline is session-only; ordinary share links restore the current design and colorway.

Share opens a designed card preview and Download share card PNG. A local SVG-to-canvas conversion produces an opaque 1200 × 675 PNG containing true section geometry, CL, CD, L/D, operating point, fictional colorway and honest-limits footer. No card is available without a current in-domain prediction. Export does not call a server.

Completed optimizer results include an Optimizer challenge card. It carries the selected candidate, objective, relative surrogate objective delta when a nonzero baseline is available, seed and evaluation count. The card is downloadable and its URL restores the candidate/livery. It makes no physical performance, lap-time or full-car downforce claim; independent shortlist verification remains necessary.

Phase 5 verification: `npm run verify` passed formatting, lint, TypeScript, 29 Node tests, export/Pages guards and 109 browser tests (18 profile skips). [Forty-eight audited states](phase-5/audit.json) at 1440, 768, 390 and 320 pixels have zero WCAG A/AA violations and zero overflow against document client width. Eight focused sharing tests passed; exported PNG dimensions, signature, livery pixels and footer content were checked. Three repeated camera-return checks passed with exact rendered-interior comparison; a browser-clipped boundary row is excluded. [Design card PNG](phase-5/share-card.png) · [Optimizer challenge PNG](phase-5/optimizer-challenge.png). No requested sharing behavior deferred. Baselines remain session-only; deployment and physical-device testing are not part of this local polish pass.

## Phase 6 · plan only

The [multi-element design note](../MULTI_ELEMENT_WING.md) specifies main/flap geometry and installation data, a new versioned model contract, independent validation gates and the need for a representative higher-Re evidence envelope. It distinguishes a possible low-Re multi-element study from the intended full-scale application. No implementation, solver runs or training were performed. There are no affected UI screenshots; Phase 5 captures remain current.

Phase 6 verification: the required final `npm run verify` passed formatting, lint, TypeScript, 29 Node tests, the static export/Pages guards and 109 browser tests (18 profile-specific skips). Documentation links resolve and changed text files are valid UTF-8. No Python, shared geometry, configs, data or frozen artifacts changed across the polish commits. Phase 5’s 48-state WCAG A/AA and client-width overflow audit remains current because this phase has no UI changes. Multi-element implementation is intentionally deferred; the note is the only deliverable for that research scope.

## Publication follow-up

The work is now published from `main`. [Release provenance and rollback target](../PORTFOLIO_RELEASE.md). Deployment smoke now checks the hero and editor separately. Linux CI exposed a phone export-menu overlap; the corrected two-column menu passed six repeated controls/export cases and [six captured export states](release/export-audit.json) with zero WCAG A/AA violations or client-width overflow. Reproduce those captures with `node scripts/capture-release-export.mjs` after a build.


## Scroll polish · phase A

The landing is a continuous five-chapter story with a final honest-limits strip and studio entry. Desktop scroll moves the existing demand-rendered camera through three-quarter, front, side and wing views; there is one car renderer. The same pressure profiles color the live representative wing and the section plot. Phones keep an unpinned still preview and optional 3D. Reduced motion disables Lenis, camera choreography and reveals while preserving every chapter and control.

`lenis@1.3.27` is pinned exactly and imported only for a fine-pointer desktop landing without reduced motion. Its manual RAF is cleaned up with its instance. Native hash history and focus targets are preserved by the landing anchor handler. The studio and legacy root design URLs use no Lenis instance. No GSAP is needed. Below-fold section, pressure and share panels load on intersection; the studio is a separate lazy chunk for legacy links.

Phase A initially morphed true NACA geometry using the existing presentation spring; Phase E replaces that landing-only dependency with a small RAF interpolation. The small landing counters animate to real browser ONNX results; studio coefficients still show the actual rounded result directly. Pressure uses the existing eligibility/error states and labels smoke as schematic. Evidence tiles link the final-panel MAE, graph size and historical pressure timing to their sources. The optional five-light hero moment is deferred to keep attention on the scroll story.

Verification: `npm run verify` passed formatting, lint, TypeScript, 29 Node tests, the static export/Pages guard and 114 browser tests (19 viewport skips). [Ten audited width/theme states](scroll-a/audit.json) have zero WCAG A/AA violations and zero client-width overflow; 44 screenshots include the static layouts and live desktop camera poses. Initial application `.js` transfer was 428,931 gzip bytes on desktop (−65,325) and 147,671 on phones (−71,005). After scrolling, application chunks totaled 491,722 / 210,462 bytes. These counts exclude separately loaded runtime `.mjs` and WASM assets. Scroll frame p95 was 17.1 / 17.4 ms versus 16.9 / 17.0 before; cold activation produced isolated maxima of 133.7 / 83.4 ms. This is a lab measurement, not a claim of jank-free physical-device performance. [Phase A measurement](scroll/scroll-a.json). Reproduce captures with `node scripts/capture-polish.mjs scroll-a`; initial JavaScript and scroll timing with `node scripts/measure-landing.mjs scroll-a`. [Before measurement](scroll/before.json).


## Scroll polish · phase B

The shared colorway picker now uses original two-tone swatch chips and native radio inputs. Arrow keys select and focus adjacent finishes; the selected/focused chip exposes its name and a visible focus outline. Landing, studio, share URLs and local persistence all use the same component.

`npm run verify` passed formatting, lint, TypeScript, 29 Node tests, export/Pages guards and 116 browser tests (19 viewport skips). [Twenty landing/studio width/theme states](scroll-b/audit.json) have zero WCAG A/AA violations and zero client-width overflow. Initial application JS is 429,349 / 147,958 gzip bytes (desktop / phone), a phase delta of +418 / +287 bytes; no dependency was added. [Measurement](scroll/scroll-b.json) · [Repeat](scroll/scroll-b-repeat.json). The first timing pass had a 33 ms host animation cadence; the repeat measured p95 17.4 / 33.6 ms with cold-activation maxima of 150.2 / 66.6 ms. Both runs are retained rather than treating the faster one as a guarantee. No picker behavior was deferred.


## Scroll polish · phase C

Optimize, Model evidence and Share remain primary header actions. The View disclosure contains the persisted Light toggle and Tour. Escape closes the disclosure and restores focus; outside clicks and leaving its tab sequence close it. Tour is rendered outside the hidden disclosure and continues to use the native modal dialog, returning focus to View. The phone action row fits 320px without wrapping Share onto another line.

The desktop section rail is sticky and adds a compact live operating-point summary. The 1440×900 capture retains the previous 1,063px document height, so this uses the rail's empty space without adding page scroll. The summary remains within the initial viewport. [Thirty studio/menu/tour states](scroll-c/audit.json) have zero WCAG A/AA violations and zero client-width overflow; the capture script also checks disclosure bounds.

Final Phase C `npm run verify` passed formatting, lint, TypeScript, 29 Node tests, export/Pages guards and 119 browser tests (20 viewport skips). Initial landing application JS is 429,350 / 147,959 gzip bytes, a +1 / +1 byte phase delta; View code stays in the studio chunk, so this is a landing transfer comparison rather than a separate studio budget measurement. [Measurement](scroll/scroll-c.json): scroll p95 17.1 / 17.3 ms, cold maxima 116.7 / 50.1 ms. No requested Phase C behavior was deferred. An initial run was interrupted by host suspension: 118 browser tests passed, one existing phone share-link test exceeded its wall-clock timeout after 15.8 hours, and 20 were skipped. That case passed in a fresh browser in 9.2 seconds without a source change; the complete fresh run above passed.


## Scroll polish · phase D

Telemetry deltas use bold 13px mono text, an arrow and a written Baseline / Better / Session best / Worse label. Green, purple and amber keep their established AA text colors. Eight outlined sectors show each current metric's position between the worst and best actually observed at that operating point. A single observation is labeled explicitly; pending, invalid and unsupported inputs remove the bars as well as coefficients. The range is a local session summary, not an optimizer or full-car performance claim.

Number ticks use a short opacity/translation on the actual rounded result. They never interpolate studio coefficients and stop under reduced motion. `npm run verify` passed formatting, lint, TypeScript, 29 Node tests, export/Pages guards and 121 browser tests (20 viewport skips). [Forty baseline/best/better/worse width/theme states](scroll-d/audit.json) have zero WCAG A/AA violations and zero client-width overflow. Initial landing application JS is 429,349 / 147,958 gzip bytes (phase delta −1 / −1); full-story chunks grew by 9 bytes. [Measurement](scroll/scroll-d.json): scroll p95 17.1 / 16.8 ms, cold maxima 149.9 / 100.0 ms. No requested telemetry behavior was deferred.


## Scroll polish · phase E

The current [20.4-second WebP demonstration](../media/aeroforge-demo.webp) shows the scroll story, an original colorway switch, a real handle drag, Surface Cp and two different sections compared on the car. It is 1,428,052 bytes versus the 3,824,071-byte GIF candidate; initial graphics loading and navigation gaps are trimmed, so it is not a performance benchmark. The old GIF remains historical evidence. The social preview uses the current Ember finish and an explicit honest-limits footer. README, the current-status progress bullet and the architecture introduction now point to the `main` release record instead of stale V2.6/old-branch status.

The landing morph now uses a small presentation-only RAF interpolation, regenerating true NACA geometry without importing the studio animation library. Mid-animation reduced-motion changes settle counters at the real result. Pagehide tears down Lenis; a back/forward-cache return recreates it. Native Tab focus, anchors, the tour and explicit colorway handoff are covered, including unavailable local storage. The static export includes the Lenis MIT notice.

Final `npm run verify` passed formatting, lint, TypeScript, 29 Node tests, export/Pages guards and 127 browser tests (22 viewport-specific skips). The new browser suite audits initial and reached content at all five landing widths in both themes, with both normal and reduced motion (40 audit states across 20 contexts). [Ten recaptured landing states](scroll-e/audit.json) have zero WCAG A/AA violations and zero client-width overflow; four additional desktop poses show the live camera story. [Media capture record](scroll/demo.json).

| Application JS, gzip bytes | Before | Final | Change |
| --- | ---: | ---: | ---: |
| Desktop initial landing | 494,256 | 429,960 | −64,296 |
| Phone initial landing | 218,676 | 148,569 | −70,107 |
| Desktop after scrolling | 494,256 | 440,532 | −53,724 |
| Phone after scrolling | 218,676 | 159,141 | −59,535 |

Phase E adds 611 bytes to the initial landing and removes 51,618 bytes from full-story application chunks, relative to Phase D. These application `.js` counts exclude separately lazy-loaded runtime `.mjs`, WASM and model assets. Models and their bytes are unchanged; visiting the new live-model chapters activates their existing runtime. [Final measurement](scroll/scroll-e.json). The final repeat measured scroll p95 at 17.0 / 17.4 ms, with isolated cold-activation maxima of 100.0 / 50.0 ms, desktop / phone emulation. The smaller lazy bundle does not eliminate those long frames, and this report does not claim jank-free physical-device performance.

Lighthouse uses two cold-cache samples per profile and version through the same local gzip server, with the previous immutable public release captured read-only for the baseline. [Baseline provenance](scroll/lighthouse-baseline-provenance.json). [Final Lighthouse reports](scroll/lighthouse/summary.json) use Lighthouse 13.6.0 / Chrome 157. Desktop performance samples are 96 and 89 (median 92.5), versus baseline 84 and 96 (90.0). Mobile samples are 82 and 89 (85.5), versus baseline 77 and 84 (80.5). Accessibility, best practices and SEO are 100 in every final run. These small sample ranges do not establish a causal or physical-device speed improvement.

The [initial reveal audit](scroll/lighthouse/initial-reveal/summary.json) found desktop accessibility 96 because offscreen text stayed at 15% opacity. The correction keeps text fully readable while retaining staggered transforms, and the expanded regression now audits initial offscreen content as well as reached chapters in both motion modes. Initial mobile performance was 82 / 73 (median 77.5, a 3-point drop from baseline); those runs are retained, rather than hidden by the final repeat. The final repeat has no median score drop. Baseline samples were captured on November 20 and the corrected repeat on November 22 on the same host; results are lab observations with substantial run-to-run variation. Physical-phone and WebKit timing remain unverified; the optional five-light landing moment remains deferred. No model, Python, shared geometry contract or frozen-artifact change was made.


## Scroll polish · publication

Application source [`0966bda`](https://github.com/marbo786/AeroForge/commit/0966bda3abdd945d06251d8620ab79bce7e5d7f0) is active on the production hostname and [immutable Pages release](https://2329de47.aeroforge-9tf.pages.dev/). [Linux CI](https://github.com/marbo786/AeroForge/actions/runs/45044336034) passed 115 Python, 29 Node and 127 browser tests (22 skips). Both URLs passed the five-route HTTPS integrity smoke with zero browser errors. The public story, social-image hash and Lenis notice were checked directly.

The separate extra public feature run finished with 10 direct passes, six retry passes and four final navigation QUIC failures on this host. Forced protocol probes saw connection resets. These are recorded without claiming a completely clean public feature suite. [Production record](scroll/production.json) · [Release provenance and rollback](../PORTFOLIO_RELEASE.md). The application models and frozen scientific evidence are unchanged.
