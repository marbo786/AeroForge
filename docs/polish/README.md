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
