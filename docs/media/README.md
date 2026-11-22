# AeroForge interaction media

The current [animated WebP](aeroforge-demo.webp) is a 20.4-second, 1280×800 edited browser capture of the scroll story, fictional colorway switch, a real handle drag, Surface Cp and two different sections compared on the illustrative car. It retains the isolated-section / illustrative-car limits caption. Initial graphics loading and navigation gaps are trimmed; this is a product demonstration, not a performance benchmark.

The optimized WebP is 1,428,052 bytes, compared with a 3,824,071-byte GIF candidate from the same 64 input captures. The encoder merged unchanged frames into 43 frames. The earlier `aeroforge-demo.gif` remains historical evidence for the previous release.

To recapture, build the web export and run `node scripts/capture-demo.mjs` from `web/`. It writes source PNGs and a timing manifest under `web/.wrangler/scroll-demo/` and updates `web/public/social-preview.png`. The WebP uses Pillow, quality 78, method 6, lossless source PNGs, optimized frame merging and the manifest durations. [Capture record](../polish/scroll/demo.json).
