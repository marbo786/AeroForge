# Visual, accessibility and performance review

Playwright captured Studio, the selected front wing, Airfoil and Analysis at 1920 × 1080, 1440 × 900, 768 × 1024 and 390 × 844. Loading and failed-asset fallback were captured at 1440 and 390 px. All reviewed states fit without horizontal overflow. The phone uses Chrome touch and viewport emulation on Windows.

| Viewport | Refined Studio | Refined front wing | Refined Airfoil | Refined Analysis |
| --- | --- | --- | --- | --- |
| 1920 × 1080 | [Studio](after/1920-studio.png) | [Wing](after/1920-wing.png) | [Airfoil](after/1920-airfoil.png) | [Analysis](after/1920-analysis.png) |
| 1440 × 900 | [Studio](after/1440-studio.png) | [Wing](after/1440-wing.png) | [Airfoil](after/1440-airfoil.png) | [Analysis](after/1440-analysis.png) |
| 768 × 1024 | [Studio](after/768-studio.png) | [Wing](after/768-wing.png) | [Airfoil](after/768-airfoil.png) | [Analysis](after/768-analysis.png) |
| 390 × 844 | [Still preview](after/390-studio.png) · [Live 3D](after/390-live.png) | [Wing](after/390-wing.png) | [Airfoil](after/390-airfoil.png) | [Analysis](after/390-analysis.png) |

Compare the [V2.4 screenshots](before/) with the [refined captures](after/). The tablet dock returns to the initial screen and compact Analysis puts live telemetry before the charts. The second framing pass enlarges the desktop car while the wing close-up leaves more room for the endplates. Phone dock and preset actions use larger touch targets. [Desktop loading](after/1440-loading.png) · [Desktop fallback](after/1440-fallback.png) · [Phone loading](after/390-loading.png) · [Phone fallback](after/390-fallback.png)

The reduced-detail phone GLB comes from the same authoring script and retains the wing assembly and inspection anchor. Regenerate from `web` with `node scripts/generate-inspection-car.mjs --mobile`. Desktop and compact reflection maps use 128 px and 64 px faces. The phone stays opt-in and caps pixel density at 1.25. The static asset check requires the compact file and its 450 KiB ceiling. The desktop GLB and poster retain their original paths and bytes.

An offline Meshopt 1.1.1 trial encoded the individual GLB streams, retaining the JSON header for a comparable gzip estimate. The desktop estimate was 210,220 bytes versus 346,836 bytes with native buffers. The compact estimate was 110,239 versus 146,359. The Three.js decoder file added 7,812 gzip bytes before bundling and the trial excludes extension metadata and decoder time. Production uses native glTF buffers and the compact mesh. This phase ships no new runtime dependencies.

The keyboard can focus the 3D canvas and orbit with arrow keys. Camera transitions snap and orbit damping is disabled under reduced motion. The phone test sends pinch and tap input through Chrome, verifies the dedicated compact asset, and checks that editing the section works after selection. The axe audit covered the live workspace, wing, Airfoil, Analysis, share dialog and phone parameter sheet. [Accessibility report](accessibility.json)

The production benchmarks compare the static export of `e8e0ea0` with V2.5. Both use Windows Chrome and the same local server and model. Five interleaved cold edits start with a fresh browser context and hold the first model request until the edit. Five warm edits reuse the initialized session. The browser samples the time from the input event to the current CL appearing. JavaScript and geometry sizes record gzip-encoded payload bytes and decoded bytes from browser resource timing. The desktop startup uses a fresh context at 10 Mbps and 100 ms latency. The five-second orbit samples actual canvas draws on the integrated GPU, followed by a check for draws at rest. Phone figures record transfer, draw count and pixel density under emulation. Physical phone frame timing remains unverified. [Performance data](performance.json) · [Lighthouse results](lighthouse.json)

The isolated Lighthouse run scored 92 mobile and 86 desktop for performance, with 100 for accessibility, best practices and SEO in both profiles. The desktop performance goal is 90. Desktop total blocking time was 313 ms. Mobile layout shift fell from 0.801 on the first pass to 0.009 in the final audit after reserving the bay and applying the responsive controls layout before hydration.

| Measure | Final result |
| --- | --- |
| Direct 2D shell | 201.4 KiB gzip, an increase of 9.4 KiB over v1. Zero vehicle requests. |
| Deferred JavaScript | 265.0 KiB gzip. With the desktop car and poster, the 3D enhancement transfers 637.4 KiB gzip. |
| Desktop render | 35,606 triangles and 34 draw calls. First interactive frame at 2.24 s. Orbit p95 17.5 ms and zero draws at rest. |
| Compact render | 390.1 KiB decoded, 142.9 KiB gzip. 14,874 triangles and 34 draw calls. |
| Median cold and warm edits | 562.8 ms cold and 91.6 ms warm, versus 548.5 ms and 92.0 ms in v1. |
