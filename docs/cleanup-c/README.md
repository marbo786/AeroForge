# Illustrative front-wing pitch

The Studio angle-of-attack control turns the front-wing assembly around its inspection anchor. The visual pitch is capped at ±7° and moves smoothly with normal motion. Reduced motion applies the new pose immediately. The NACA section and ONNX inputs retain the angle set by the user. Camber and thickness remain section controls.

| Viewport | Before, 8° input | After, 8° input | After, −4° input |
| --- | --- | --- | --- |
| 1440 × 900 | [Previous pose](before-1440.png) | [Positive pitch](after-1440.png) | [Negative pitch](negative-1440.png) |
| 390 × 844 | [Previous pose](before-390.png) | [Positive pitch](after-390.png) | [Negative pitch](negative-390.png) |

Playwright captured the local production export using Chrome, with touch emulation at 390 px. The selected wing shows the change relative to the stationary nose and tires. The phone caption has its own compact row above the graphics, and both viewports fit without horizontal overflow.

The browser tests check pose changes with normal motion on desktop and reduced motion on phone. The rendered phone scene stays identical between the 8° and 12° inputs because both hit the visual cap. With WebGL disabled, the caption, section editing and browser predictions remain available.
