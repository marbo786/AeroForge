# Main plane plus flap: research design note

Status: plan only. No solver runs, data generation, training, model replacement or multi-element editor are included. Current coefficients and Cp remain predictions for isolated NACA sections. The AF–02 assembly and the live representative-section overlay are illustrations.

## Data needed

A two-element section needs main-plane and flap geometry, flap chord ratio, gap, overlap, deflection, angle of attack and Reynolds number. Define the reference chord, area, angle origin and force signs before collecting labels. Preserve per-element coordinates, upper/lower pressure branches, transition assumptions, solver versions, convergence evidence and rejected attempts.

The current isolated-section XFOIL pipeline does not establish interacting-element accuracy. Select and validate a solver capable of viscous multi-element sections. Sample element-shape families and installation settings jointly, including narrow gaps, strong deflections and separation-sensitive cases. Reserve independent wind-tunnel or suitably verified higher-fidelity cases. A ground plane, endplates and the car body would require a separate three-dimensional data program.

## Model changes

Use a new versioned input/output contract and new artifacts; retain today's frozen models. Inputs must encode both shapes and their relative installation. Outputs should include total sectional CL/CD and separately identified Cp branches for each element, with a documented reference normalization and surface-station mapping.

Adding the current isolated predictions cannot represent slot flow, wake interaction or flap loading. The existing optimizer and pressure graph cannot be reused as a multi-element predictor. A future editor must distinguish the two model domains and withhold unsupported results. Repeating a two-dimensional Cp profile across a drawn span remains illustrative.

## Validation gates

- Check element clearance, nonintersection and geometry/coordinate reconstruction before simulation.
- Establish solver repeatability, mesh/panel refinement and pressure-to-force consistency, including drag sensitivity and transition/separation limits.
- Split by held-out main/flap shape families and installation combinations, rather than randomly mixing nearby configurations. Freeze an independent final reservation before model selection.
- Predeclare CL, CD and local-Cp error budgets, constraint margins and coverage rules for the intended use. Do not transfer the current MAEs or imply calibrated uncertainty without new evidence.
- Verify browser parity, hashes, failure states and out-of-domain withholding against the new frozen reference vectors. Validate physical accuracy separately from numerical parity.

## Why the current Re range is insufficient

Multi-element geometry does not inherently require Re above 500,000: a dedicated low-Re two-element study is possible. It would still need new interaction data and validation. The intended full-scale Formula-style application also needs a Reynolds envelope beyond the current 100k–500k evidence.

For scale only, assume speed 50 m/s, reference chord 0.30 m and kinematic viscosity `1.5 × 10⁻⁵ m²/s`. Then `Re = Uc/ν = 1,000,000`, already twice today's maximum. These are illustrative assumptions, not measured AF–02 or Formula 1 operating conditions. Choose a future range from the intended physical setup and validate it; do not extrapolate or rescale today's coefficients.

Even a validated two-element section model would not establish full-car downforce or lap time. Those need their own vehicle-level evidence.

[Current geometry/units contract](PHYSICS.md) · [Model evidence](ML.md) · [Browser architecture](ARCHITECTURE.md)
