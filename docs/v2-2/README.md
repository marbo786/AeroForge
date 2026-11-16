# Design Studio workspace review

Captured in Playwright Chrome on Windows against the local static production export. The 390 px captures use touch and viewport emulation with 3D initially disabled. All captures use reduced motion.

| Viewport | Studio bay | Studio | Airfoil | Analysis |
| --- | --- | --- | --- | --- |
| 1920 × 1080 | 1452 × 837 px (75.6% width, 77.5% height) | [Studio](studio-1920.png) | | |
| 1440 × 900 | 972 × 657 px (67.5% width, 73.0% height) | [Studio](studio-1440.png) | [Airfoil](airfoil-1440.png) | [Analysis](analysis-1440.png) |
| 768 × 1024 | 748 × 604 px | [Studio](studio-768.png) | | |
| 390 × 844 | 370 × 329 px | [Studio](studio-390.png) | [Airfoil](airfoil-390.png) · [Controls sheet](controls-390.png) | [Analysis](analysis-390.png) |

The first desktop review found the collapsed dock partly below the fold. The refined layout fits the full dock in both desktop viewports and meets the bay size targets. The phone still-image view now shows a single action to enable 3D, and the controls sheet title and close button fit on one row. The final captures had no horizontal overflow at any of the four sizes.

The production checks covered keyboard mode switching, input validation, state retention across views, comparison, legacy and view-specific share links, device-appropriate controls, and real ONNX point and batched predictions. Direct Airfoil and Analysis links requested no vehicle assets. A separate visual probe switched from a zoomed Side view to Airfoil, checked that the canvas was removed, and captured identical canvas pixels after returning to Studio.
