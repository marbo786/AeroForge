# AeroForge — Master Project Specification & Codex Instructions

You are a senior full-stack engineer specializing in machine learning, scientific computing, interactive visualization, and production web applications.

Your task is to develop **AeroForge — an AI-powered aerodynamic design studio**.

The application must be technically credible, visually exceptional, genuinely functional, and deployable for public use at **zero recurring infrastructure cost**.

This is a serious machine-learning portfolio project, not a mockup or concept demonstration.

Read these instructions carefully. Do not attempt to implement the entire project in one run.

---

# 1. DEVELOPMENT PROCESS — MANDATORY

## 1.1 Create the master specification

Your first responsibility is to create:

`docs/SPEC.md`

This document must preserve the complete project specification, architecture, engineering requirements, scope boundaries, design principles, validation criteria, and deployment strategy described below.

Also create:

`PROGRESS.md`

This file must track:

- Current phase.
- Completed tasks.
- Pending tasks.
- Blockers.
- Technical decisions.
- Test results.
- Next phase.
- Commit history.

These documents are the source of truth throughout development.

Every future coding session must begin by reading both files.

## 1.2 Do not implement everything at once

Development must be divided into independent phases.

For each phase:

1. Read `docs/SPEC.md` and `PROGRESS.md`.
2. Inspect the relevant existing code.
3. Develop a short implementation plan.
4. Implement only the approved phase.
5. Run tests and validation.
6. Fix errors.
7. Update `PROGRESS.md`.
8. Commit the completed phase.
9. Summarize what was accomplished.
10. Stop and await the next instruction.

Do not silently continue into subsequent phases.

Do not sacrifice correctness or testing to finish additional features.

## 1.3 Initial approval gate

On your first execution:

- Inspect the repository.
- Inspect the operating system and available development tools.
- Check the availability of XFOIL.
- Check relevant Python and Node.js versions.
- Verify the proposed hosting and ONNX architecture.
- Identify technical risks.
- Create the master specification.
- Create the initial progress tracker.
- Present a phase-by-phase implementation plan.

**Stop and wait for my approval before implementing application code.**

You may create the planning documents during this step.

## 1.4 Destructive actions and downloads

Ask permission before:

- Deleting existing project files or directories.
- Overwriting user-created content.
- Resetting Git history.
- Force-pushing.
- Installing system-level dependencies.
- Downloading unusually large datasets or model files.
- Performing substantial network downloads.
- Making paid or potentially billable infrastructure changes.

Routine package installation after approval of a phase is acceptable if it is non-destructive and within the agreed scope.

Never expose credentials or commit secrets.

## 1.5 Git conventions

Create one meaningful commit per completed phase.

Use lowercase imperative commit messages.

Examples:

- `initialize project architecture`
- `implement naca geometry generator`
- `add xfoil simulation pipeline`
- `train aerodynamic surrogate`
- `integrate browser inference`
- `build interactive design studio`
- `prepare static deployment`

Never commit a phase while its required tests are failing.

If a phase is blocked, document the blocker and stop instead.

---

# 2. PROJECT OVERVIEW

## Product name

**AeroForge**

## Tagline

**Design. Simulate. Optimize.**

## Product concept

AeroForge is an interactive aerodynamic design studio where users can modify 2D airfoil geometries and obtain near-instant aerodynamic performance predictions using machine-learning surrogate models.

The interface should feel like professional engineering software, with the polish and responsiveness of a premium modern web application.

## Core user experience

A visitor should be able to:

1. Open AeroForge through a public website.
2. Select a NACA 4-digit airfoil.
3. Adjust camber, camber position, and thickness.
4. Modify angle of attack and Reynolds number.
5. View mathematically accurate airfoil geometry.
6. Receive real ML predictions for lift and drag.
7. View aerodynamic performance curves.
8. Compare the current design against a preset or previous design.
9. Understand prediction limitations.
10. Share a design through a reproducible URL.

No account, subscription, payment, API key, or local installation should be required for visitors.

---

# 3. PROJECT SCOPE

Strictly separate v1 requirements from future extensions.

## 3.1 Version 1.0 — Mandatory

The initial public release must include:

### Physics and data

- NACA 4-digit geometry generator.
- Reliable aerodynamic reference-data pipeline.
- Reproducible simulation configuration.
- Convergence tracking and filtering.
- Clean training dataset.
- Geometry-disjoint train/validation/test split.

### Machine learning

- Baseline regression models.
- PyTorch MLP.
- Proper model evaluation.
- Model selection based on held-out performance.
- ONNX export for the selected deployable model.
- Browser inference.
- Model and preprocessing versioning.

### Frontend

- High-quality responsive dark UI.
- Interactive airfoil editor.
- Accurate 2D airfoil rendering.
- Adjustable design parameters.
- Lift/drag performance readouts.
- Two performance charts.
- A simple two-design comparison.
- Shareable designs through URL parameters.
- Model applicability warnings.
- Model information and limitations.

### Deployment

- Free static hosting.
- Public HTTPS website.
- No persistent inference backend.
- Documented deployment procedure.
- Automated build and smoke tests.

## 3.2 Version 2.0 — Explicitly out of scope for v1

Do not implement the following during the initial release:

- OpenFOAM-based velocity-field modeling.
- Full CFD flow-field prediction.
- 3D aerodynamic simulation.
- Pitching-moment prediction.
- Design optimization algorithms.
- Full multi-design comparison laboratory.
- Command palette.
- Guided onboarding tour.
- Pressure coefficient field surrogate.
- User authentication.
- Database-backed accounts.
- Advanced pan-and-zoom tools.
- Resizable workstation panels.
- Four-chart analytics workspace.
- Large export subsystem.
- Multi-user collaboration.

These may appear in the roadmap but must not delay v1.

For v1, only JSON design export is required if it is straightforward; URL-based sharing is mandatory.

---

# 4. FREE DEPLOYMENT ARCHITECTURE

Free public deployment is a hard requirement.

## 4.1 Preferred technology stack

### Frontend

- Next.js.
- TypeScript.
- Tailwind CSS.
- Radix UI primitives where needed.
- Custom components and design tokens.
- Motion for React.
- SVG/Canvas visualizations.
- uPlot, visx, or lightweight custom SVG charts.

Avoid Plotly.js unless its additional size is justified by a measured requirement.

Avoid unnecessary component libraries.

Do not use default shadcn/ui styling.

### Machine learning

- PyTorch for model training.
- scikit-learn for baseline comparisons.
- ONNX for model export.
- ONNX Runtime Web for browser inference.

### Simulation

- XFOIL, preferably.
- Python and NumPy for NACA geometry generation.
- Pandas or Polars for dataset processing.

### Hosting

Preferred:

**Cloudflare Pages with static frontend export.**

Alternative:

**GitHub Pages or another verified free static host.**

Check current official hosting documentation before choosing the final provider.

## 4.2 Architecture

The intended production flow is:

User Input
→ Browser Input Validation
→ Feature Normalization
→ ONNX Runtime Web
→ Prediction Postprocessing
→ Results and Visualization

No Python backend should be necessary during public inference.

Training occurs offline.

Simulation occurs offline.

The deployed application serves static assets and performs local browser inference.

## 4.3 No hidden infrastructure dependencies

Do not introduce:

- Paid model endpoints.
- Paid databases.
- GPU hosting.
- Free trials that expire into mandatory paid subscriptions.
- Persistent Python servers.
- Third-party API dependencies for core functionality.
- Serverless inference that may generate unexpected charges.

Verify usage limits and hosting requirements using official documentation.

## 4.4 Deployment feasibility spike — Mandatory early milestone

Before building the main frontend, create a minimal deployment experiment.

The experiment must:

1. Initialize the selected Next.js version.
2. Configure static export.
3. Load a tiny ONNX model in the browser.
4. Execute a real ONNX inference.
5. Validate ONNX Runtime Web WASM asset loading.
6. Build the application for production.
7. Serve the static output locally.
8. Verify that inference works in the production build.
9. Document the Cloudflare Pages deployment settings.

Investigate:

- Next.js static export compatibility.
- WASM asset paths.
- ONNX Runtime Web version compatibility.
- Cross-origin and security restrictions.
- Web Worker compatibility.
- Production asset loading.
- Cache behavior.
- Static-hosting limitations.

**Do not proceed to the main frontend until this spike passes.**

Pin and document working dependency versions.

Use official documentation rather than assuming older tutorials remain valid.

---

# 5. VISUAL DESIGN SYSTEM

Frontend quality is a major project priority.

AeroForge must look like a carefully designed engineering workstation, not a generic AI-generated dashboard.

## 5.1 Visual direction

Aim for:

- Premium technical software.
- Precision instrumentation.
- Professional CAD applications.
- Modern aerospace engineering interfaces.
- Strong information hierarchy.
- Minimal decorative elements.
- Purposeful scientific visualization.

Reference the interaction quality of professional simulation tools and the restrained design principles of products such as Linear and Vercel, without copying their interfaces.

## 5.2 Color system

Use the following as initial design tokens.

| Token | Hex |
|---|---|
| Main background | `#0B0F14` |
| Panel background | `#141A22` |
| Elevated surface | `#1C2530` |
| Subtle border | `#283341` |
| Primary text | `#E8EEF5` |
| Secondary text | `#93A4B7` |
| Primary accent | `#45C4D8` |
| Warning | `#E6A34A` |
| Error | `#E56B6F` |

These are starting values, not an instruction to use every color everywhere.

Keep the interface predominantly neutral.

Use the cyan accent selectively.

Reserve scientific heatmap colors for actual scientific visualizations.

## 5.3 Typography

Use:

- Geist or Inter for general interface typography.
- JetBrains Mono for numerical and engineering readouts.

Ensure fonts load efficiently and work in static deployment.

Use tabular numbers for telemetry.

## 5.4 Spacing and geometry

Use a consistent 4px-based spacing scale.

Prefer:

- Compact but comfortable controls.
- Well-aligned panels.
- Moderate corner radii.
- Subtle borders.
- Clear section separation.
- Precise labels.
- Consistent numerical formatting.

Avoid oversized padding and unnecessary empty space.

## 5.5 Avoid

Do not use:

- Purple gradients.
- Neon gradients throughout the interface.
- Generic SaaS cards.
- Excessive glassmorphism.
- Random decorative blobs.
- Emoji navigation.
- Oversized hero sections.
- Placeholder charts.
- Fake metrics.
- Unnecessary visual noise.
- Decorative animations presented as real CFD.

## 5.6 Animation

Implement restrained motion for:

- Slider changes.
- Airfoil geometry transitions.
- Numeric transitions where appropriate.
- Chart updates.
- Panel interactions.

Support reduced-motion preferences.

Keep physics calculations independent from animation state.

---

# 6. FRONTEND LAYOUT

## Desktop

Target a primary design viewport at approximately 1440px width.

### Header

A compact application header containing:

- AeroForge branding.
- Design Studio navigation.
- Model information.
- Share action.
- GitHub repository link when configured.

### Left panel

Design parameter controls:

- Airfoil preset.
- Maximum camber.
- Camber position.
- Thickness.
- Angle of attack.
- Reynolds number.

Each input requires:

- Appropriate units.
- A clear numeric value.
- Validation.
- Consistent limits.
- Accessible labels.

### Center viewport

The primary visual centerpiece.

Features:

- Accurate airfoil shape.
- Engineering grid.
- Reference chord.
- Leading/trailing edge labels.
- Angle-of-attack representation.
- Interactive geometry transitions.
- Responsive aspect ratio.
- Clear visual contrast.

Do not prioritize advanced viewport controls in v1.

### Right panel

Aerodynamic telemetry:

- Predicted lift coefficient.
- Predicted drag coefficient.
- Lift-to-drag ratio.
- Prediction latency.
- Model status.
- Domain warning when appropriate.

### Bottom section

Two charts for v1:

1. Lift coefficient versus angle of attack.
2. Drag coefficient versus angle of attack.

Include tooltips, axis labels, units, and appropriate scales.

If the model does not provide valid predictions for a point, indicate missing values rather than interpolating fictitious results.

## Mobile

At approximately 390px width:

- Use a single-column layout.
- Keep the airfoil visualization prominent.
- Move controls into an accessible collapsible section.
- Stack telemetry cleanly.
- Make charts horizontally readable.
- Avoid horizontal overflow.
- Ensure all sliders support touch input.

Do not merely scale down the desktop workspace.

---

# 7. VISUAL VERIFICATION REQUIREMENT

Screenshots and visual inspection are mandatory.

After implementing major frontend changes:

1. Run the application.
2. Capture a screenshot at 1440px width.
3. Capture a screenshot at 390px width.
4. Inspect both screenshots.
5. Identify spacing, alignment, typography, and overflow problems.
6. Fix the problems.
7. Capture updated screenshots.

Use Playwright for browser automation and screenshots.

Do not claim the interface has been visually verified if screenshots were not actually captured and inspected.

Perform at least one dedicated visual refinement pass before marking the frontend phase complete.

---

# 8. AERODYNAMIC PHYSICS SPECIFICATION

## 8.1 Geometry

Implement standard NACA 4-digit geometry generation.

Input parameters:

- Maximum camber ratio, m.
- Position of maximum camber, p.
- Thickness ratio, t.

Use accurate equations for:

- Camber line.
- Camber-line derivative.
- Thickness distribution.
- Upper surface coordinates.
- Lower surface coordinates.

Use cosine-spaced chordwise points where appropriate.

Document the trailing-edge convention.

## 8.2 Symmetric airfoils

When maximum camber is zero, the camber position does not affect the physical shape.

Handle this explicitly.

For symmetric airfoils:

- Use a canonical internal value for camber position.
- Avoid generating duplicate geometries that differ only in irrelevant camber-position metadata.
- Ensure preprocessing uses the same convention during training and inference.

Document the chosen convention.

## 8.3 Simulation domain

Initial target ranges:

- Camber: 0–6%.
- Camber position: 20–60% chord for cambered foils.
- Thickness: 8–18%.
- Angle of attack: -4° to 12°.
- Reynolds number: 100,000–1,000,000.

These are maximum candidate sampling bounds, not guaranteed validated prediction bounds.

The final supported domain must be determined from solver reliability and model evaluation.

You may narrow the range if evidence indicates poor convergence or accuracy.

Do not silently extrapolate outside the validated domain.

## 8.4 Solver reproducibility

For XFOIL, explicitly configure and record:

- Solver version.
- Viscous or inviscid mode.
- Reynolds number.
- Mach number.
- Transition model.
- Ncrit, initially 9.
- Iteration limits.
- Panel settings.
- Angle-of-attack sweep.
- Convergence status.

Use a consistent near-incompressible Mach-number setting for the initial dataset.

Do not mix inconsistent solver configurations into the training data.

## 8.5 Convergence and stall handling

XFOIL may become unreliable near stall, particularly at challenging Reynolds numbers or geometries.

Implement clear data-quality rules.

For v1:

- Record all attempted simulation points.
- Exclude explicitly non-converged cases from supervised training.
- Retain failure metadata for analysis.
- Detect invalid or nonfinite coefficients.
- Flag suspicious aerodynamic results.
- Evaluate solver behavior across the parameter domain.
- Restrict the deployed prediction domain where necessary.

Do not assume that every numerically converged solution is physically accurate.

Do not pretend the model has validated post-stall behavior.

Document the final domain restrictions.

---

# 9. DATA GENERATION — HARD GATE

The data pipeline is the highest-risk component.

## 9.1 Environment check

During initial planning, detect whether XFOIL is installed and executable.

Report:

- XFOIL availability.
- Compiler availability.
- Python environment.
- Relevant OS constraints.
- Feasible installation methods.

## 9.2 Preferred approach

Use XFOIL to generate reference aerodynamic coefficients.

First generate a pilot dataset.

Suggested pilot:

- 20 distinct airfoil geometries.
- A small set of Reynolds numbers.
- A limited angle-of-attack sweep.

Validate:

- Solver invocation.
- Output parsing.
- Convergence detection.
- Data schema.
- Simulation duration.
- Failure rate.

Do not generate thousands of cases until the pilot is successful.

## 9.3 Fallback strategy

If XFOIL is unavailable:

**Option A:** Investigate compiling XFOIL from source.

**Option B:** Investigate installing a compatible XFOIL build.

**Option C:** Evaluate NeuralFoil as an alternative reference generator.

NeuralFoil must not be represented as a numerical CFD solver.

NeuralFoil is itself a machine-learning surrogate.

If NeuralFoil is used, explicitly describe AeroForge as learning to approximate NeuralFoil-generated predictions, not as replacing high-fidelity CFD.

Do not report agreement with NeuralFoil as independent physical validation.

Do not automatically change the label source without informing me.

## 9.4 Stop condition

If no suitable data source can be established:

- Stop model-dependent development.
- Explain the blocker.
- Present the alternatives.
- Ask me which route to take.

Do not continue into ML integration using fake or untrained weights.

Frontend geometry work may be performed separately only after explicit approval.

---

# 10. DATASET DESIGN

Target approximately 2,000–5,000 valid cases initially.

The exact size should depend on pilot results, solver throughput, and convergence reliability.

Use reproducible sampling.

Record all experimental configurations.

Store data in an appropriately structured format such as Parquet.

## 10.1 Group-aware splitting

Define an airfoil geometry using the tuple:

`(m, p, t)`

Use a canonical geometry identifier.

For symmetric airfoils, canonicalize the irrelevant camber-position parameter.

Split by geometry identifier so no geometry appears in more than one dataset partition.

Use approximately:

- 70% training geometries.
- 15% validation geometries.
- 15% test geometries.

Use stratification or space-filling allocation where practical, ensuring that each partition represents the relevant geometry range.

Explicitly evaluate boundary and difficult cases.

A separate boundary stress-test set may be useful, but do not falsely claim that all extrapolation corners are represented by ordinary random splitting.

Fit preprocessing only on the training partition.

---

# 11. MACHINE LEARNING ARCHITECTURE

## Inputs

Five input features:

- Camber.
- Canonical camber position.
- Thickness.
- Angle of attack.
- log10(Reynolds number).

## Outputs

For v1:

- Lift coefficient, CL.
- Drag coefficient, CD.

## Baseline models

Train and evaluate:

1. Ridge regression.
2. Random Forest or XGBoost.
3. PyTorch MLP.

## Suggested MLP

Input(5)
→ Linear(128)
→ SiLU
→ Linear(256)
→ SiLU
→ Linear(256)
→ SiLU
→ Linear(128)
→ SiLU
→ Linear(2)

Suggested training:

- AdamW.
- Learning rate 0.001.
- Batch size 128.
- Weight decay 0.0001.
- Maximum 300 epochs.
- Early stopping patience 25.
- Learning-rate scheduler.
- Reproducible random seeds.

Tune hyperparameters using the validation partition.

Do not tune on the final test set.

---

# 12. MODEL EVALUATION AND ACCEPTANCE CRITERIA

For every candidate model, calculate:

- Lift MAE.
- Lift RMSE.
- Lift R².
- Drag MAE.
- Drag RMSE.
- Drag R².
- Error versus angle of attack.
- Error versus Reynolds number.
- Error across airfoil geometry families.
- Inference latency.

## 12.1 Model selection

The MLP is not automatically the winner.

Define a clear validation-based selection criterion before evaluating the test set.

If the MLP does not outperform the strongest baseline on the primary criterion, deploy the strongest suitable baseline, provided it can be exported and executed reliably in-browser.

If a baseline is difficult to deploy efficiently, report the tradeoff and obtain approval before choosing an inferior model solely for convenience.

Evaluate all final candidates on the untouched test set.

Do not repeatedly select models based on test-set performance.

## 12.2 Numeric targets

The following are engineering acceptance targets:

**ONNX agreement**

- Maximum absolute difference between PyTorch and exported ONNX outputs: less than 1e-5 in original coefficient units across a representative input test suite.

**Model artifact size**

- Prefer less than 1 MB for the inference model.
- Investigate quantization or compression if necessary.
- Do not damage model fidelity solely to meet this target.

**Prediction performance**

- Report p50 and p95 prediction latency.
- Target interactive response times on a typical laptop.
- Batch polar sweeps where appropriate.

**Predictive error**

- Establish initial error targets after the pilot dataset.
- Report separate lift and drag errors.
- Do not invent universal accuracy thresholds without considering solver quality and the selected domain.

**Scientific validation**

- Test on unseen geometries.
- Identify failure regions.
- Compare against the actual label source.
- Distinguish solver agreement from physical accuracy.

If any acceptance target fails, explain why and propose corrective work rather than silently passing the phase.

---

# 13. ONNX BROWSER INFERENCE

Use ONNX Runtime Web.

Implement:

- Versioned model loading.
- Browser-compatible model execution.
- Input validation.
- Preprocessing.
- Batched inference.
- Postprocessing.
- Domain checks.
- Error handling.
- Loading indicators.
- Model metadata.
- Inference timing.

Keep training and inference preprocessing identical.

Persist scaler parameters as versioned artifacts.

Test ONNX output against PyTorch.

Do not depend on server-side inference.

Use WASM as the default runtime execution provider unless a better option is verified.

Make CPU compatibility the baseline requirement.

---

# 14. BUNDLE SIZE AND PERFORMANCE

Performance matters.

Avoid shipping large libraries unnecessarily.

## Initial performance budgets

- ONNX model artifact: target less than 1 MB.
- Minimize initial JavaScript transferred.
- Defer loading ML runtime until required.
- Avoid heavy plotting frameworks without justification.
- Avoid shipping simulation or training dependencies to the browser.
- Minimize unnecessary client-side rendering.
- Keep parameter interactions responsive.

Do not confuse compressed network transfer size with uncompressed JavaScript bundle size. Report both where practical.

Measure performance using production builds.

## Lighthouse targets

For the primary page on a controlled test environment:

- Performance: target 90+.
- Accessibility: target 95+.
- Best Practices: target 95+.
- SEO: target 90+.

Treat these as goals rather than guaranteed scores.

Record the environment and actual results.

Prioritize real user responsiveness and correctness over chasing a score.

---

# 15. DESIGN STUDIO FUNCTIONALITY

## Parameter editor

Implement:

- NACA presets.
- Camber control.
- Camber-position control.
- Thickness control.
- Angle-of-attack control.
- Reynolds-number control.
- Reset action.

Synchronize sliders and numerical inputs.

Provide meaningful bounds and validation.

## Geometry viewport

Generate airfoil geometry from the actual equations.

Features:

- Upper and lower surfaces.
- Grid.
- Chord reference.
- Axes.
- Angle-of-attack indicator.
- Smooth geometry transitions.
- Consistent scaling.

The geometry must remain accurate at different viewport sizes.

## Telemetry

Display real model outputs.

Include:

- CL.
- CD.
- CL/CD.
- Prediction latency.
- Model version.
- Applicability status.

Prevent division by invalid or near-zero drag values.

## Charts

Implement two charts:

- Lift coefficient versus angle of attack.
- Drag coefficient versus angle of attack.

Generate the values using batch inference from the actual model.

Never hardcode fake curves.

---

# 16. SIMPLE DESIGN COMPARISON

For v1, implement only a focused comparison workflow.

Allow the user to:

1. Save the current design as a comparison candidate.
2. Modify or select another airfoil.
3. Overlay the two geometries.
4. Compare CL, CD, and CL/CD.
5. Compare their performance curves.
6. Reset the comparison.

No complex comparison database is needed.

Use browser state and localStorage if appropriate.

---

# 17. SHAREABLE DESIGNS

Allow users to share reproducible airfoil configurations through URL parameters.

Example concept:

`/studio?m=0.02&p=0.4&t=0.12&aoa=4&re=500000`

Validate and normalize incoming parameters.

Ensure invalid URLs do not crash the application.

For privacy and simplicity, do not transmit saved designs to an external analytics or storage service.

---

# 18. TESTING REQUIREMENTS

Implement automated tests covering:

### Physics

- NACA geometry reference cases.
- Symmetric geometry behavior.
- Leading/trailing edge behavior.
- Camber-line calculations.
- Coordinate consistency.

### Data pipeline

- Output parsing.
- Solver failure handling.
- Nonfinite result filtering.
- Duplicate handling.
- Geometry-disjoint splitting.
- Reproducibility.

### ML

- Feature preprocessing.
- Model input/output shapes.
- Reproducible inference.
- PyTorch/ONNX numerical agreement.
- Domain validation.

### Frontend

- Parameter interactions.
- Preset selection.
- Chart updates.
- Model loading states.
- Model errors.
- Comparison workflow.
- URL sharing.
- Mobile layout.

Use Playwright for end-to-end smoke tests.

## Required browser smoke tests

At minimum, verify:

1. The homepage loads.
2. The Design Studio opens.
3. NACA presets work.
4. Slider changes update the geometry.
5. ML inference returns valid outputs.
6. Charts respond to input changes.
7. Invalid inputs are handled.
8. Comparison mode works.
9. A shared URL restores the design.
10. The production build contains no blocking browser-console errors.

Run smoke tests against the production build, not only the development server.

---

# 19. DOCUMENTATION

Maintain:

- `docs/SPEC.md`
- `PROGRESS.md`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/PHYSICS.md`
- `docs/ML.md`
- `docs/DEPLOYMENT.md`

The README should contain:

- Overview.
- Features.
- Screenshots.
- Architecture.
- ML methodology.
- Dataset source.
- Evaluation results.
- Local installation.
- Model-training instructions.
- Production deployment instructions.
- Known limitations.
- Roadmap.

Do not fabricate screenshots, benchmarks, or deployment URLs.

Use an appropriate open-source license.

Prefer MIT unless repository constraints or dependency/license considerations suggest otherwise.

Do not include emojis in source code, documentation, or commit messages.

---

# 20. DEVELOPMENT PHASES

## Phase 0 — Feasibility and planning

Deliverables:

- Repository inspection.
- XFOIL availability check.
- Platform constraints.
- Dependency-version recommendations.
- Risk assessment.
- Master specification.
- Initial progress tracker.
- Approved project plan.

Stop for approval.

## Phase 1 — Deployment and ONNX feasibility

Deliverables:

- Minimal Next.js static application.
- Browser ONNX inference example.
- Production static build.
- WASM compatibility verification.
- Deployment configuration.
- Pinned dependency versions.
- Automated smoke test.

Acceptance:

The production static build successfully runs a real ONNX inference.

Stop after tests pass.

## Phase 2 — Physics geometry engine

Deliverables:

- NACA geometry generator.
- Parameter normalization.
- Geometry tests.
- Airfoil preset system.

Acceptance:

Reference geometry tests pass, including symmetric-airfoil edge cases.

Stop after tests pass.

## Phase 3 — Simulation data pipeline

Deliverables:

- XFOIL integration or explicitly approved alternative.
- Batch runner.
- Convergence handling.
- Pilot dataset.
- Reproducible solver configuration.
- Data-quality report.

Acceptance:

The data pipeline produces real, correctly parsed, validated aerodynamic labels.

**Hard gate: do not proceed without a real data source.**

Stop after tests pass.

## Phase 4 — ML training and evaluation

Deliverables:

- Dataset preprocessing.
- Geometry-disjoint splits.
- Baseline models.
- PyTorch MLP.
- Evaluation report.
- Selected model.
- ONNX export.
- Numerical agreement tests.

Acceptance:

A genuinely trained model runs in the browser-compatible inference format and passes the agreed validation criteria.

Stop after tests pass.

## Phase 5 — Main Design Studio

Deliverables:

- Complete visual design system.
- Responsive workstation layout.
- Interactive geometry editor.
- Real inference integration.
- Telemetry.
- Loading and error states.
- Desktop/mobile screenshot review.

Acceptance:

A user can edit an airfoil and immediately obtain valid model predictions through the production frontend.

Stop after tests pass.

## Phase 6 — Charts, comparison and polish

Deliverables:

- Two aerodynamic charts.
- Two-design comparison.
- Shareable URLs.
- Model limitations panel.
- Interaction refinement.
- Responsive visual refinement.
- End-to-end smoke tests.

Acceptance:

All v1 user flows work, are tested, and are visually reviewed.

Stop after tests pass.

## Phase 7 — Production deployment

Deliverables:

- Cloudflare Pages configuration.
- Production build verification.
- Deployment instructions.
- Lighthouse assessment.
- Final documentation.
- GitHub repository cleanup.
- Portfolio-ready release.

Acceptance:

The application is ready for public deployment at zero recurring infrastructure cost.

If external authorization is available, deploy and verify the public website.

Otherwise, provide the exact remaining user actions.

Do not claim deployment success without verification.

Stop after completion.

---

# 21. VERSION 2 ROADMAP

After v1 is completed and approved, consider:

- Airfoil optimization using evolutionary algorithms.
- Surface pressure coefficient prediction.
- Physics-informed regularization.
- Neural operators for CFD fields.
- More advanced geometry families.
- Pressure and velocity heatmaps.
- Interactive flow-field visualization.
- Advanced design comparison.
- Design export tools.
- 3D wing visualization.
- OpenFOAM validation.

These features are not part of the v1 definition of done.

---

# 22. QUALITY REQUIREMENTS

Throughout development:

- Use strict TypeScript.
- Keep modules small and understandable.
- Avoid duplicate logic.
- Maintain clear boundaries between frontend, physics, ML, and data generation.
- Handle all expected error states.
- Document assumptions.
- Pin dependency versions.
- Use reproducible random seeds.
- Maintain automated tests.
- Follow accessibility best practices.
- Avoid unnecessary abstractions.
- Do not fabricate ML outputs.
- Do not fabricate CFD results.
- Do not silently bypass failed validation.
- Do not substitute decorative animations for numerical simulation.
- Do not claim a model is accurate without evaluating it.
- Do not claim that a deployment works unless tested.

If a technical requirement proves infeasible, explain the limitation and propose alternatives.

Do not conceal failures.

---

# 23. FINAL DEFINITION OF DONE

AeroForge v1 is complete only when:

- A real airfoil dataset has been generated using a clearly documented source.
- A surrogate has been trained and evaluated.
- The best deployable model has been selected using a defensible methodology.
- Browser inference works.
- The airfoil geometry is mathematically correct.
- The frontend is visually polished.
- Users can interact with design parameters.
- Real predictions update in the UI.
- Charts reflect actual predictions.
- Two designs can be compared.
- Shared URLs reproduce designs.
- Relevant tests pass.
- The application builds for free static hosting.
- Deployment instructions are verified.
- Documentation describes limitations accurately.
- The GitHub repository is professionally presented.

# 24. IMMEDIATE TASK

For this first Codex session, perform **Phase 0 only**.

1. Inspect the repository.
2. Check the development environment.
3. Check whether XFOIL is available.
4. Assess free static deployment feasibility.
5. Identify dependency compatibility risks.
6. Create `docs/SPEC.md`.
7. Create `PROGRESS.md`.
8. Present the proposed architecture and phase plan.
9. Identify any decisions requiring my approval.

Do not implement application functionality yet.

**Stop and wait for my approval of the plan before beginning Phase 1.**