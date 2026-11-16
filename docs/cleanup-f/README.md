# Cleanup Phase F desktop startup

## What blocked the main thread

The cold desktop trace on the Phase E export at `a773202` showed a roughly 409 ms task attributed to the React scheduler. A separate Chrome CPU profile sampled 341 ms in the `PMREMGenerator.fromScene()` call stack within a 383 ms main-thread task. The stack ran through the room cubemap render, blur and roughness filtering, with shader uniform discovery waiting on the GPU. The two WebGL context creations in that profile took about 5 ms each. Style and layout accounted for 81 ms across the first Lighthouse trace, and its largest content had already painted when the graphics task began.

## Changes

The desktop and opt-in compact scenes load one precomputed reflection cubemap in parallel with the car mesh. The offline generator uses the same Three.js `RoomEnvironment`, blur and six roughness levels. It downsamples each face from 256 to 64 pixels at the highest level. The 82,928-byte gzip asset is served from a versioned, cacheable path. The 3D preview uses direct lighting if the map fails or takes longer than 2.5 seconds. The reflection map stays off the 2D startup path.

The before and after desktop captures showed similar shading. Across a 612 × 435 crop of the car and floor, the mean difference was 0.68 per RGB channel on the 0–255 scale. The visible differences were mainly in small highlights. The Analysis region also gained an accessible section heading above the two plot headings.

Run `node scripts/generate-inspection-lighting.mjs` from `web/` to regenerate the cube in headless Chrome using the pinned Three.js package. The output uses six faces in +X, −X, +Y, −Y, +Z, −Z order. Each face has six square mip levels from 64 to 2 pixels, stored as little-endian RGBA half floats in linear sRGB. Publish any changed asset bytes at a new versioned path. The production guard checks the compressed size and decoded layout.

## Measurements

The recorded V2.5 scores were 86 desktop and 92 mobile, with 313 ms desktop total blocking time. Phase F repeated the baseline and tested the new export on the same Windows machine, using headless Chrome, Lighthouse 13.6.0, simulated throttling and fresh browser profiles for both runs in each viewport profile. Desktop uses the Lighthouse desktop preset and mobile uses its default profile. All figures are from the local production export at `/studio/`. [V2.5 results](../v2-5/lighthouse.json) · [Phase F measurements](audit.json)

| Metric | Before | After |
| --- | ---: | ---: |
| Desktop performance | 85, 86 | 99, 100 |
| Desktop total blocking time | 324.5–336.5 ms | 0–4.5 ms |
| Desktop largest contentful paint | 687–874 ms | 676–891 ms |
| Mobile performance | 91, 92 | 91, 91 |
| Mobile total blocking time | 107–116 ms | 120–123 ms |
| Mobile largest contentful paint | 3.32–3.33 s | 3.32–3.33 s |

Both desktop runs cleared the target of 90. Accessibility, best practices and SEO scored 100 in both profiles. Mobile still loads the poster on first visit and only fetches the map when 3D is enabled.

In the separate instrumented Chrome load, the 3D-ready indicator moved from 1.15 s to 0.86 s. The longest observed main-thread task fell from 383 ms to 109 ms. The first car draw still compiles shaders in Chrome.

## Regression checks

Axe 4.14.0 was run on the same 12 desktop and phone states used in the V2.5 review, after finite transitions settled. The baseline flagged the desktop Analysis heading sequence. The updated export reported zero violations. Playwright includes the desktop mesh-failure recovery with the lighting asset unavailable, the phone 3D opt-in, and the check that direct 2D links request no vehicle assets.

Formatting, lint, strict TypeScript, the static export guard, 23 Node tests, 59 Playwright tests and 104 Python tests passed. Playwright skipped ten viewport-specific cases. The export guard checked the cubemap and both frozen model and preprocessing hashes.
