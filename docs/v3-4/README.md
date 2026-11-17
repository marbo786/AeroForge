# Surface pressure feasibility

The V3.4 pilot passed its predeclared floor. The pinned Windows XFOIL 6.99 executable yielded 22 eligible paired pressure profiles from 24 primary attempts, with at least one eligible case in all 12 geometry/Reynolds combinations. Three fresh repeats agreed at printed precision. All three 320-panel diagnostic runs were eligible. This supports proceeding to an approved pressure-data and model evaluation phase. The evidence describes viscous XFOIL surface pressure on isolated two-dimensional sections. [Plan](../../configs/pressure-pilot-v1.json) · [Full pilot report](../../data/pressure-pilot-v1/report.json)

## Bounded run

Each geometry used both angles at every sampled Reynolds number. The three repeats used the same 160-panel settings as their primary matches. The 320-panel diagnostics used separate processes and outputs.

| NACA | Re 100k, −4° and 6° | Re 250k, −2° and 4° | Re 500k, 0° and 8° |
| --- | ---: | ---: | ---: |
| 0012 | 2/2 | 2/2 | 2/2 |
| 2412 | 1/2 | 2/2 | 2/2 |
| 4415 | 2/2 | 2/2 | 2/2 |
| 6618 | 1/2 | 2/2 | 2/2 |

NACA 2412 at Re 100k and −4° converged, but the polar reported upper transition at x/c = 1.0001. The existing eligibility rule classified it as suspect. NACA 6618 at Re 100k and 6° failed viscous convergence and had no eligible polar row. Both produced pressure files with uniquely matching coordinates. The pressure labels were excluded in both cases, and all raw files and reasons were retained.

## Pairing and viscous state

Each fresh process loads the existing analytic finite-gap NACA input, saves its solver panel nodes with `PSAV`, then applies the existing viscous settings and runs one `ALFA`. `CPWR` and `CPMN` run immediately after that solve. The MIT manual lists the pressure export command. The distributed 6.99 source's `CPDUMP` routine and the Windows executable's actual output contain x, y and Cp plus the geometry name, angle, Reynolds number and flap reference. The two coordinate columns have five decimal places and PSAV has six. [XFOIL user primer](https://web.mit.edu/drela/Public/web/xfoil/xfoil_doc.txt)

The paired files have 160 or 320 rows in the identical traversal upper trailing edge → nose → lower trailing edge. Each CPWR coordinate must match exactly one PSAV row, at the same ordinal, in both dimensions within `5.51e-6` chord per axis. That allows the combined rounding from the two formats. All 30 attempts met the pairing check, with a maximum observed difference of `5e-6` chord. Cases also have to match the header conditions and pass the original viscous polar convergence and eligibility rules.

The surface Cp minimum agreed with XFOIL's reported viscous minimum to within `5e-5` Cp across the run. Across the 22 eligible primary cases the reported viscous and inviscid minima differed in every case, with a maximum difference of 1.0542 Cp. Integrating the closed surface with trapezoidal endpoint Cp gives pressure lift in the wind axis and the pitching moment about (0.25, 0) in chord units. The largest eligible primary discrepancies versus the polar were `4.80e-5` CL and `4.67e-5` CM, within the polar's printed resolution and below the predeclared `3e-4` gate. The raw contour integral of pressure drag is retained as a diagnostic. XFOIL's viscous CD comes from the wake calculation and its reported CDp is derived from that drag and skin friction. [XFOIL force conventions](https://web.mit.edu/drela/Public/web/xfoil/xfoil_doc.txt)

## Surface representation

Each solver panel is projected onto its nearest segment of the input geometry's known, ordered analytic contour. Monotone traversal and distinct trailing-edge endpoints are checked. The largest observed solver-to-analytic projection distance was `1.58e-5` chord. The split is where this projected arc crosses the analytic leading-edge reference. The adjacent solver nodes bracketed that reference in all 22 eligible primary cases. A shared nose value is linearly interpolated within that bracket and recorded explicitly. No pressure is extrapolated across the trailing-edge gap or into missing solves. This matters for cambered noses where the minimum observed x/c was −0.000669 and x/c alone does not identify the surface.

Upper and lower branches are stored nose first. Each branch uses its own normalized surface arc length `s`, with 0 at the shared nose and 1 at its own trailing edge. The fixed grid samples at cosine-clustered stations. Each station retains physical x/c and y/c and dimensionless Cp. The compressed primary array has shape `[22, 2, 257, 3]` ordered by case, upper/lower, station and x/c–y/c–Cp. The three repeats, three refined cases and two excluded primaries remain outside this label array. [Paired primary profiles](../../data/pressure-pilot-v1/primary-profiles.npz)

The table shows the worst values across the 44 eligible primary case/surface pairs. Reconstruction error measures the round trip from paired branch nodes to the fixed grid and back to those nodes.

| Stations per branch | Whole-branch MAE | Whole-branch p95 | Nose p95, s ≤ 0.08 | Tail p95, s ≥ 0.90 | Suction-peak error in Cp |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 65 | 0.00674 | 0.04287 | 0.07127 | 0.01094 | 0.03748 |
| 129 | 0.00327 | 0.02381 | 0.02839 | 0.00422 | 0.01370 |
| 257 | 0.00151 | 0.00830 | 0.01431 | 0.00297 | 0.00530 |

The largest 257-station pointwise reconstruction error was 0.01886 Cp near the upper nose of NACA 0012 at Re 500k and 8°. The largest suction-peak location shift from gridding was 0.00372 chord. Use 257 stations for the first model comparison. Retain the raw source to support representation changes without rerunning the solver.

## Panel sensitivity

Fresh repeats of NACA 0012 at Re 100k and −4°, NACA 2412 at Re 250k and 4°, and NACA 6618 at Re 500k and 8° matched the printed x, y and Cp arrays and polar coefficients exactly. The 320-versus-160 comparisons use the same 257 arc stations separately on each surface. Across these six branch comparisons the largest whole-branch MAE was 0.00150 Cp, largest whole-branch p95 was 0.00371 and largest suction-peak difference was 0.00290 Cp. The largest peak location shift was 0.00619 chord, including branches with shallow minima. The worst local difference was 0.02604 Cp on the NACA 6618 lower trailing edge, where its tail p95 was 0.01851. These three examples support tracking nose and tail errors separately. They give limited information about refinement at other conditions, particularly where low-Re solves fail. [Pressure and signed refinement differences](panel-sensitivity.png)

## Proposed V3.5 gate for approval

Start with 96 preregistered geometry groups, allocated 64 train, 16 validation and 16 untouched test. Stratify the geometry allocation across symmetric and cambered sections, thin and thick families, and camber positions. Exclude the four V3.4 geometries from the new splits and retain them as diagnostic fixtures. Propose three sampled Reynolds levels and seven angles from −4° to 8° in 2° steps, for **2,016 primary attempts** at 160 panels. Freeze geometry IDs, split assignments, solver settings and metrics before generation. Use a separately approved cap for any additional refinement checks. Report per-cell attempted and eligible counts and require at least 80% eligible in each held-out Reynolds stratum with results from at least 12 of the 16 test geometries per Reynolds level. Leave failed cells absent. The first pressure release should expose the sampled Reynolds levels. Intermediate Reynolds support needs its own validation evidence.

The 24 pilot primaries used 4.61 solver seconds and 315,689 raw bytes locally. All 30 attempts used 7.45 solver seconds and 424,224 raw bytes. The complete run took 8.85 seconds before plotting. A linear scale-up suggests about 6.5 serial solver minutes and 26.5 MB of raw files for 2,016 attempts, plus about 12 MB of compressed grids at the pilot yield. Allow roughly 7–10 local minutes and 50–60 MB including manifests and geometry. Convergence, solver duration and output sizes can shift in a wider panel. These are planning estimates and the batch awaits approval.

Use a small multi-output MLP as the first baseline, with two arrays of 257 Cp stations. Use the shared NACA geometry to map predicted arc stations to plotted x/c and y/c. Audit the analytic/solver correspondence at inference coordinates rather than substituting a pressure field inferred from CL/CD. Propose the following held-out limits for a comparative visualization, with eligible labels scored against the frozen 160-panel representation.

| Metric | Proposed limit |
| --- | ---: |
| Geometry-balanced mean of per-profile MAE, each branch | ≤ 0.03 Cp |
| Geometry-balanced pointwise p95, each branch | ≤ 0.10 Cp |
| Pointwise p95 by region and branch | ≤ 0.15 Cp at the nose and ≤ 0.10 Cp at the tail |
| p90 of absolute per-profile minimum Cp error, each branch | ≤ 0.18 Cp |
| p90 of distance from the predicted suction location to the reference near-minimum region, each branch | ≤ 0.02 chord in x/c |
| Source/ONNX/browser max absolute error | ≤ `1e-5` Cp on frozen parity vectors |

For geometry-balanced metrics, weight each geometry equally and then its eligible profiles and stations equally. Treat reference points within 0.02 Cp of the minimum as the near-minimum region to avoid penalizing flat peaks solely for where the argmin falls. Report peak and error metrics by Reynolds number, alpha and geometry family, including tail behavior and the local maximum errors. The proposed whole-branch and peak limits sit above the measured gridding and three-case panel effects because they target a learned comparative curve. They require approval before generation. Preserve browser delivery budgets of a lazily fetched model ≤512 KiB and warm edit-to-plot p95 ≤150 ms. If representation or test quality misses the frozen gates, release the geometry tools and keep pressure results in the feasibility report.

## Geometry and visualization path

- The Level 1 view uses the existing equal-scale Airfoil stage and shared analytic geometry. Keep a fixed chord and camber line reference, add a scale readout and grid toggle, and distinguish the freestream direction from the rotated chord.
- Give upper and lower surface inspection separate keyboard-accessible focus, with arrow-key station movement, hover or touch selection and numerical x/c and y/c. Show the finite trailing-edge gap and permit coordinates outside the nominal x/c endpoints where the analytic geometry requires it.
- Keep the conceptual flow overlay opt-in and labeled. If V3.5 passes, add a separate pressure plot using upper/lower x/c, a conventional inverted Cp axis, and a point link to the matching geometric surface. Retain unsupported and missing states. A velocity field would require a separate CFD dataset and verification.

## Reproduce the pilot

Use the pinned ML/data dependencies and the existing installed XFOIL 6.99 binary and source archive. Optional plotting uses Matplotlib 3.10.8. Choose a fresh output directory.

```sh
python scripts/run_pressure_pilot.py --output pressure-replay --plot pressure-panel-sensitivity.png
```

The dataset includes the solver and pilot configs, the archive and binary hashes, each attempt's commands, geometry, pressure, panel coordinates, polars and compressed console logs. Pytest audits the saved run without launching the solver. [Raw attempts and hash manifest](../../data/pressure-pilot-v1/attempts.jsonl) · [Provenance](../../data/pressure-pilot-v1/provenance.json)
