# Analysis integration review

Playwright Chrome on Windows served the local static production export. The 390 px capture uses a phone viewport and touch emulation. In the comparison, NACA 4412 runs at Reynolds number 500,000 and the saved NACA 2412 at 250,000. Both operating points are at 4°. The shared cursor inspects the independently sampled 6.5° values.

| View | Capture |
| --- | --- |
| Desktop Analysis, 1440 × 900 | [Charts and section comparison](analysis-1440.png) |
| Phone Analysis, 390 × 844 | [Stacked charts and operating-point table](analysis-390.png) |
| Desktop Studio | [Analysis dock after changing views](dock-1440.png) |

The first desktop review found the numeric cursor field clipped its digits. The revised field fits the number and spinner, and the dock legend aligns with the charts. The phone preview was shortened so the charts begin higher. Both widths had no horizontal overflow.

The browser tests checked the CSV values against the live point result, both Reynolds numbers in a saved comparison, the inspection cursor across modes, and Analysis share parameters. They also held real worker replies across edits and injected a single missing sample and a batch error to verify gaps and retry behavior. The frozen ONNX golden vectors run independently in the production browser and the Pages guard verifies the accepted model and preprocessing hashes.

With WebGL disabled, a separate browser check confirmed that Studio, Airfoil, Analysis, CSV and JSON all report the same rounded default values: CL 0.6972, CD 0.01052 and L/D 66.29. The browser did not request the car file.
