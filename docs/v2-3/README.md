# Front-wing inspection review

Captured in Playwright Chrome on Windows against the local production export. The 390 px captures use viewport and touch emulation. Screenshots use reduced motion to capture stable camera positions.

| Viewport | Overview | Front-wing inspection |
| --- | --- | --- |
| 1440 × 900 | [Live 3D overview](overview-1440.png) | [Selected wing and section](wing-1440.png) |
| 390 × 844 | [Default still](overview-390.png) | [Before 3D opt-in](wing-390.png) · [After enabling 3D](wing-3d-390.png) |

The first review found that the mobile still image pushed the section's telemetry below the initial viewport. Inspection now replaces the still with a compact graphics status and keeps the 3D opt-in available. The selected wing retains more of its material shading and the section SVG uses more of its panel width. Both reviewed viewport widths had no horizontal overflow.

Picking uses the named front-wing assembly and its bounds, then tests the foremost mesh at the pointer so nearer parts of the car can occlude the wing. The named GLB anchor controls the close-up. The same action is available from the keyboard or without WebGL. The vehicle geometry is illustrative and the telemetry describes the isolated NACA section. The SVG carries the editable cross-section.

Browser verification covers mouse and keyboard selection, drag and pinch rejection, camera pose on return, preserving selection when switching to Airfoil and back, and editing through the phone sheet. With WebGL disabled, the test verifies that every sampled point in the preview matches the full editor after a thickness edit, that ONNX telemetry responds, and that the car asset is never requested.

A separate Chrome probe at 1152 × 768 observed 28 rendered frames over about 450 ms for the normal camera move. Under reduced motion it observed three redraws within 84 ms of selection, including the layout change.
