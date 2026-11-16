# Launch visual audit

Chrome 157.0.8103.51 and Playwright captured both versions against their local production exports, using the same default NACA 2412 design and reduced motion for repeatable shots.

| Viewport | Studio before | Studio after | Charts before | Charts after |
| --- | --- | --- | --- | --- |
| 1440 × 900 | [Before](before/1440x900.png) | [After](after/1440x900.png) | [Before](before/1440x900-charts.png) | [After](after/1440x900-charts.png) |
| 1920 × 1080 | [Before](before/1920x1080.png) | [After](after/1920x1080.png) | [Before](before/1920x1080-charts.png) | [After](after/1920x1080-charts.png) |
| 768 × 1024 | [Before](before/768x1024.png) | [After](after/768x1024.png) | [Before](before/768x1024-charts.png) | [After](after/768x1024-charts.png) |
| 390 × 844 | [Before](before/390x844.png) | [After](after/390x844.png) | [Before](before/390x844-charts.png) | [After](after/390x844-charts.png) |

The candidate uses a slate surface, cyan airfoil contour and muted drafting guides. The geometry dominates the desktop composition. The tablet view brings the lift readout and geometry controls into the first screen. The phone view keeps the three coefficients, alpha sweep and action bar above the parameter dock. Both chart cursors inspect the same measured angle, with the unsupported region still shaded.

[Before measurements](before/measurements.json) · [After measurements](after/measurements.json). Reproduce a capture with `node scripts/capture-launch.mjs after` from `web` after a production build.
