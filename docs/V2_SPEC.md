# AeroForge v2 Design Studio

**2026-11-16 · V2.5 implementation complete · Awaiting approval for V2.6**

The Design Studio opens in a dark inspection bay built around an original, unbranded Formula-style racing car. Selecting the front wing turns the bay into a close-up section study. The user can work with the same design in Studio, Airfoil and Analysis without losing edits or a saved comparison. The current public v1 release is the baseline, commit `e8e0ea0`.

## Scientific scope

The 3D car is an illustrative assembly. The editable profile is a representative isolated NACA four-digit section, separate from the vehicle's actual front wing design. The accepted XFOIL-trained ONNX surrogate returns dimensionless section CL and CD, and the interface computes section L/D from those coefficients. The feature order stays `[m, canonical_p, t, alpha_deg, log10(Re)]`. The graph, fitted transforms, applicability checks, and final evaluation artifacts remain the source of truth. There are no vehicle forces, pressure maps, near-ground predictions, or full-car CFD outputs.

Keep the comparison honest in the interface. The 3D canvas is labeled **Illustrative car**, the insert and diagram **Representative NACA section**, and the telemetry **Isolated 2D section**. The Details panel explains that the model excludes 3D, ground-effect and component-interaction physics. Editing uses camber 0–6%, position 20–60% chord for cambered profiles, thickness 8–18%, angle −4° to 12°, and Reynolds number 100,000–1,000,000. Predictions are restricted to −4° to 8° and Reynolds number 100,000–500,000 within those geometry bounds. Symmetric sections retain canonical position zero. Preserve the interpolation warning between sampled Reynolds levels and withhold invalid or out-of-domain coefficients. [Geometry contract](PHYSICS.md) · [Accepted model and evaluation](ML.md)

Leave optional car airflow off for the initial release. If visual testing in V2.5 shows value, add an opt-in schematic with the persistent label **Conceptual airflow visualization — not CFD results.** Preserve the existing toggle for conceptual lines in Airfoil. The independently evaluated v1 regression evidence remains 165 eligible XFOIL cases on eight unseen geometries, CL MAE 0.01484 and CD MAE 0.000683.

## What carries forward

| Current implementation | V2 use |
| --- | --- |
| `studio.tsx` validates paired sliders and number fields, applies presets/reset, restores shared parameters and guards async results with a design key. | Keep one controller above the mode views. Extract a hook only when the workspace needs it. |
| `instrument.tsx` owns the paced alpha sweep, sheet and dialog controls, status, comparison snapshot and downloads. | Lift design-related state above mode changes. Reuse the paced sweep, preset/reset, status, comparison save/restore/clear and SVG/PNG/CSV/JSON exports. Treat layout state as presentation. |
| `stage.tsx` and `lib/geometry/naca4.ts` render an equal-scale SVG with guides, chord, camber and thickness, camber position and angle handles, pan, zoom, view reset and comparison contours. | Reuse the accurate editor in Airfoil and a read-only, equal-scale section preview in the dock. Use the same normalized contour as the source for the optional 3D insert. |
| `lib/inference/surrogate.ts` authenticates the frozen model bytes, uses a single same-origin WASM worker session, validates outputs and reports duration. | Reuse the session and existing retry paths. Keep the 3D renderer independent of ONNX and model status. |
| `charts.tsx` runs a 25-row batch from −4° to 8° at each design's Reynolds number, shares the inspection cursor and leaves missing rows as gaps. | Reuse the two plots, sampled bounds and inspector in the analysis dock and full Analysis mode. Run batches only when a visible consumer or export needs them. Keep one current and one saved sweep keyed by geometry and Re. |
| `kit.tsx`, `use-reduced-preference.ts`, `shared-design.ts`, `/model/` and `/spike/`. | Reuse the native inputs, dialogs, accessible status and motion preferences. Preserve model evidence, inference fixture and existing share-link semantics. |

The deployed v1 studio opens with the light theme, a compact header, and a paced sweep. The proposed charcoal treatment belongs to the new workspace after approval. Legacy share URLs at `/studio/?m=…&p=…&t=…&aoa=…&re=…` still restore the same design and take the Studio default. Add a separate, optional `view=airfoil` or `view=analysis` for direct entry and a **Share current view** action. Unknown view values select the default. A malformed design still loads defaults with its existing notice. Retain `/`, `/studio/`, `/model/` and `/spike/` as real static routes.

## Workspace composition

Use graphite `#101419` for the bay, `#171D23` for controls, `#2A343D` for rules, `#E5EDF1` for text, `#A3B2BC` for secondary text, and `#59D5DF` for selected geometry and focused controls. Keep warnings amber. Use the existing local Geist and JetBrains Mono for labels and tabular measurements. Let the car, silhouettes and lighting carry the visual identity. Use thin rules, a faint floor grid for spatial reference, and a single cyan accent on the selected assembly.

```text
Desktop ≥1280
┌ AeroForge   Studio / Airfoil / Analysis                     Share · Model evidence ┐
├ Section controls ┬─────────────── Illustration viewport ──────────────┬─ 2D results ┤
│ NACA preset      │  Illustrative car                                  │ CL   CD     │
│ Camber / position│                                                    │ L/D         │
│ Thickness        │             large car, front three-quarter        │ latency     │
│ Alpha / Reynolds │                                                    │ model state │
│                  │  Front wing / selection           View · Zoom     │ bounds      │
├──────────────────┴ Section · Lift · Drag · Compare ▴ ─────────────────┴─────────────┤
└────────────────────────────────────────────────────────────────────────────────────┘
```

- **Desktop, 1440 × 900 and 1920 × 1080.** Start with a 52 px header, 208–232 px controls, 208–224 px telemetry, and a 44–52 px collapsed dock. Target a center viewport of at least 65% of available width at 1440 and 70% at 1920, and at least 70% of viewport height with the dock collapsed. Frame the car so it fills about 75–85% of the canvas width with tires and wings inside the safe area. Use a low front three-quarter camera as the default. Group camera presets and zoom in one corner. Put model status and warnings next to the measurements, outside the header.
- **Tablet, 768 × 1024 reference.** Use a full-width bay below the header, one compact results row, and a controls drawer. Keep the camera controls within thumb reach and expand charts below the bay when requested. Preserve the viewing area in portrait orientation.
- **Mobile, 390 × 844 reference.** Open Studio with a lightweight still and an **Enable 3D** action until device testing supports a different default. Keep Airfoil one tap away. Use a labeled bottom sheet for controls with 44 px touch targets, a compact telemetry strip, and stacked plots. Leave normal page scrolling available outside the canvas. During inspection the front-wing action and return-to-car action remain available as HTML controls.
- **Mode layout.** Studio prioritizes the car. Airfoil gives the accurate SVG the center with controls and telemetry still accessible. Analysis uses two large plots and comparison controls with a small section reference and the current parameters. The dock is collapsed by default in Studio, remembers the open panel during the session, and expands or collapses independently of the active design.

Use a matte graphite shell, a restrained clearcoat on bodywork, low-sheen rubber and dark metallic suspension. A soft key light and rim light should separate tires, wing edges, cockpit and sidepods against the background. Ground the car with a simple contact shadow. Use one restrained baked reflection source only if the measured cost fits the budget. Camera moves should ease to the selected view in about 350–500 ms, be cancelable on user input and snap with reduced motion. Use buttons for presets, orbit steps, zoom and reset, alongside pointer orbit and touch controls. Maintain visible focus, labeled mode controls, logical keyboard order and a live announcement for selection or fallback changes.

## State and rendering architecture

1. `Studio` keeps the validated design and invalid draft, preset, one saved design, prediction lifecycle, playback, and share/restore actions. Add a small workspace state for mode, selected component, dock and preferred camera pose. Mode changes are in-place so the controller and saved design survive. Pause automatic alpha playback when switching modes or inspecting a component so edits and results stay readable.
2. The geometry and inference functions are the only sources of scientific outputs. A change flows from inputs to normalized design to the SVG and ONNX. Renderers consume read-only results. Keep prediction status and domain feedback distinct from graphics loading or failure. Turn a stored comparison into a single explicit snapshot with its own inputs and coefficients.
3. Use a client-only dynamically imported 3D module from the workspace, with the static shell and a same-origin poster available first. Keep Three.js and its add-ons outside the 2D-only route path. A valid directly linked Airfoil or Analysis view must avoid requests for the car, decoders and 3D code. Detect WebGL2 before loading heavy code. On failed initialization, model fetch failure, or context loss, retain the controller, keep the panel usable, show the still and offer **Open Airfoil editor** and a user-initiated retry. An accessible **Inspect front wing** action enters the same section workflow with or without WebGL.
4. Name the GLB wing assembly, pick volume and camera anchor separately. Raycast only on permitted components, distinguish click from drag, and route canvas and keyboard selection into the same command. Highlight the wing using a material change or simple outline. Keep the 2D airfoil available immediately when the wing is selected. For the optional 3D response, extrude the real NACA contour across a short, separately labeled illustrative insert. Update that insert from normalized camber, position and thickness only. Show angle and Re in the 2D section study. Keep the rest of the car geometry decoupled from these parameters.
5. Store the camera pose on leaving Studio, release the scene's resources when disposing the canvas and resume the prior inspection state on return. Use a demand frame loop during interaction and transitions. Fit orthographic front, side and top views without clipping, and use perspective for the three-quarter view. Compact camera controls and context loss should never block the engineering controls.

## 3D feasibility and asset decision

**Renderer proposal.** The public app currently pins Next.js 16.4.5 and React/React DOM 19.3.1. Registry metadata checked on 2026-11-16 identifies MIT-licensed React Three Fiber 9.8.2 (`react` and `react-dom` peers `>=19 <19.4`, Three peer `>=0.156`) and MIT-licensed Three.js 0.187.0 as compatible candidates. The production build of this exact tuple is the first V2.1 gate. Pin the tested versions and matching Three types then. Use WebGL2, `frameloop="demand"`, Three's own OrbitControls and GLTFLoader, and no extra scene helper package initially. Test add-on transpilation with the current webpack static export. The lower-complexity alternative if Fiber introduces a verified incompatibility is a lazily loaded Three.js scene mounted by one React component, using the same state boundary and fallback. [Fiber installation and React compatibility](https://r3f.docs.pmnd.rs/getting-started/installation) · [Demand rendering](https://r3f.docs.pmnd.rs/advanced/scaling-performance) · [Three.js WebGL renderer](https://threejs.org/docs/pages/WebGLRenderer.html) · [Next.js client lazy loading](https://nextjs.org/docs/app/guides/lazy-loading)

**Measured during V2.0.** Local Playwright Chrome 157.0.8103.51 on Windows rendered and read back an RGBA WebGL2 pixel (`64, 128, 191, 255`, no GL errors) through ANGLE/D3D11 on integrated AMD Radeon graphics. On the same production export, a second browser launched with `--disable-webgl` returned no WebGL2 context and still produced v1 lift `0.6972` for the default NACA 2412 design. The normal browser produced the same lift. This verifies the browser capability and the current engineering path's independence from graphics. The Fiber build, new fallback UI, mobile hardware and scene performance are V2.1 or later verification.

| Asset option | Evidence and disposition |
| --- | --- |
| **Original Formula-style car, proposed** | Author a compact mesh from original profile curves and primitives. Shape the nose, front wing/endplates, undercut sidepods, floor, suspension, halo, cockpit, rear wing, tires and rims as recognizable assemblies. Use an original neutral livery with no team, sponsor or series marks. This gives us clean wing anchors and control over production complexity. |
| **Granty231, 2022–2025 Formula 1 car** | Creator's indexed listing shows 43.6k triangles and a CC Attribution label. Polygon count makes it worth considering if original modeling is impractical. Verify the exact license version, author scope, source files, branding, bundled textures, modification rights and attribution before selecting it. [Creator listing](https://sketchfab.com/3d-models/2022-2025-formula-1-car-3c052943c5744675bee3a2950a728b17) |
| **The 3D Dude, F1 2022 concept car** | Creator's indexed listing shows 869.7k triangles and a CC Attribution label. The mesh exceeds the proposed desktop budget by an order of magnitude and would need substantial retopology before use. [Creator listing](https://sketchfab.com/3d-models/f1-2022-concept-car-47bd9f66d55141958e09b7c75edfdab4) |

The two listings were reviewed as candidates through their indexed author pages. Direct listing retrieval returned 403 and no source files were downloaded, so neither is cleared for redistribution. For v2 prefer the original asset. Retain its source or reproducible generator, author and provenance, GLB export settings, asset hash and license notice. If a third-party mesh is ever selected, record its exact license and creator attribution in the repository and the app credits, document changes, verify texture and branding rights separately, and exclude any uncertain material. [Creative Commons attribution requirements](https://creativecommons.org/licenses/by/4.0/)

## Performance and delivery limits

These are proposed budgets for the production export, separate from measured v1 results. In V2.1 record actual sizes before choosing compression. In V2.5 record the browser, device, cache state, display resolution, renderer, throttling, and both transferred and decoded size where applicable.

| Metric | Target and measurement |
| --- | --- |
| Base shell | Add at most 45 KiB compressed JS over a comparable v1 run before the dynamic 3D payload; valid 2D-only entry loads zero 3D requests. |
| 3D code and content | At most 350 KiB compressed deferred JS plus decoder combined; desktop GLB at most 900 KiB, mobile variant at most 450 KiB, and poster at most 160 KiB. Count any external texture/environment files against the corresponding asset budget. Keep the combined desktop 3D enhancement under 1.4 MiB, separate from the existing WASM transfer. |
| Rendering work | At most 80k visible triangles and 85 draw calls on desktop; at most 35k and 45 on the mobile variant. Measure renderer counters in representative views including shadow cost. Cap DPR at 1.5 desktop and 1.25 mobile, with a reduced tier if needed. No frames at rest after camera damping or a transition settles. |
| Interaction | During a repeatable five-second orbit, target p95 frame interval ≤25 ms on integrated-GPU desktop and ≤34 ms on one physical mid-range phone that runs 3D. Target no more than 20% regression in median parameter-to-prediction time in five comparable cold and warm scripted runs against the v1 baseline, measuring cold and warm separately. |
| Startup | The controls and fallback render without GPU readiness. Target first interactive 3D frame within 3.5 s on a 10 Mbps / 100 ms desktop network profile. Show determinate progress when total bytes are known and a calm loading message otherwise. Avoid simultaneous duplicate scene loads and defer optional textures. |
| Accessibility and Lighthouse | Target 90+ performance, 95+ accessibility and best practices, and 90+ SEO per the original spec. Verify keyboard and touch, contrast, reduced motion, 2D fallback and chart reading with automated checks and manual review. |

Use glTF 2.0 binary GLB with merged static meshes where selection permits, instanced shared parts where demonstrated, and bounded material counts. Prefer material colors and a small texture atlas. Test Meshopt compression and quantify the asset savings against the extra decoder cost. Bundle decoders locally and use compressed textures only where measured and supported. Dispose geometries, materials, textures, event handlers, controls and any image bitmap resources on an actual teardown and test repeated mode switches and context loss. [GLTFLoader and supported compression](https://threejs.org/docs/pages/GLTFLoader.html)

Ship same-origin, versioned assets in the existing `web/out` static export with cache rules for immutable asset revisions. Keep ONNX unchanged on its existing paths. Validate MIME, loading, caching, missing GLB behavior and routing with Pages emulation and the actual preview. The current Free plan limits are 25 MiB per asset and 20,000 files. The stricter product budgets above govern the 3D experience. No API, account, CDN model dependency, hosted GPU or paid compute is required. Use an isolated v2 branch for implementation while `main` feeds public production. Only a separately authorized production release should move v2 onto `main`. [Cloudflare limits](https://developers.cloudflare.com/pages/platform/limits/) · [Current deployment runbook](DEPLOYMENT.md)

## Risks and responses

| Risk | Response and evidence |
| --- | --- |
| Original car looks like a block model or is hard to read in the dark. | Review silhouette in three-quarter, front, side and top views. Iterate on body curvature and light separation at V2.1 before adding interface chrome. |
| The 3D insert reads as a literal F1 design or calculated airflow. | Keep the canvas, insert and telemetry labels visible and test that real outputs always carry the section scope. Inspect boundaries with out-of-domain inputs and both fallback states. |
| Graphics startup competes with WASM or fails on mobile or in CI. | Lazy-load the scene, cap rendering cost, exercise the no-WebGL and asset-failure paths in CI, and review physical GPU results separately. The 2D editor remains the reliable path on unsupported hardware. |
| A layout extraction breaks existing behavior. | Use controller and fixture tests, compare shared URLs, readouts, keyboard and touch flows, exports and comparison to the v1 baseline. Test 2D and 3D independently before the public release. |
| Licensing or asset size blocks ship. | Prefer original source and provenance. Reject ambiguous licenses, branding, and assets that exceed budget after optimization. |

## Phases and acceptance gates

After each phase update `PROGRESS.md`, commit with a lowercase imperative message, and stop for approval. The current approval extends through V2.5. [V2.1 visual evidence](v2-1/README.md) · [V2.2 visual evidence](v2-2/README.md) · [V2.3 visual evidence](v2-3/README.md) · [V2.4 visual evidence](v2-4/README.md) · [V2.5 visual evidence](v2-5/README.md)

| Phase | Deliverable | Acceptance evidence |
| --- | --- | --- |
| **V2.0 · Architecture and visual planning** | This specification and progress entry, v1 inventory, rendering and asset feasibility, proposed layout and performance limits. | Registry peer ranges and local WebGL2/no-WebGL observations recorded. Each implementation phase has a defined exit gate. |
| **V2.1 · 3D car visualization** | Isolated static preview with original car and source/provenance, lazy scene, loading states, bounded orbit/zoom, four presets and 2D fallback. | Tested pinned Fiber/Three stack builds as static files. Show real screenshots of all camera presets with credible silhouette and lighting, measured payload and draw counts, and passing load, disable-WebGL, context loss and missing-asset tests. Existing routes continue to pass. |
| **V2.2 · Studio interface** | Studio-first shell, compact header, left controls, right telemetry, collapsible bottom dock, and working three-mode navigation with mobile sheets. | Studio is default. At 1440 and 1920 the bay meets its layout target with dock collapsed. At 768 and 390 there is no horizontal overflow. Keyboard navigation, parameter inputs, state retention, and primary mobile actions pass. |
| **V2.3 · Front-wing interaction** | Wing hit target and HTML equivalent, camera focus and return, highlight and section editor with optional representative insert. | Click and keyboard select the same wing; drag or pinch does not. Geometry matches the existing SVG references and changes with valid NACA geometry edits. Reduced motion and no-WebGL paths work, and section-scope labels remain visible. |
| **V2.4 · Analysis integration** | Real ONNX telemetry and both plots, synchronized views, comparison, exports, slow alpha sweep and share links. | Frozen golden vectors still agree within existing tolerance and model hash is unchanged. Validate gaps and errors, shared cursor, one saved design, late-response rejection, old and new deep links, and results surviving mode switches. |
| **V2.5 · Visual polish and performance** | Final responsive layouts, mobile rendering tier, asset optimization and accessibility pass. | Capture and inspect before/after Playwright images at 1920 × 1080, 1440 × 900, 768 × 1024 and 390 × 844 in at least two review rounds. Include Studio, wing selection, Airfoil, Analysis and representative loading/fallback states. Record measured budgets and actual mobile touch and reduced-motion behavior. |
| **V2.6 · Production verification** | Runbook, full regression results, approved static preview and, when authorized, public rollout. | `npm run verify`, Pages emulation, frozen artifact hashes and regression checks pass. Smoke test exact preview and public commits separately, including direct links, cached reload, real ONNX runtime, chart and comparison workflows, the 3D asset, and 2D fallback. Record the verified URL and rollback commit. |

## Regression coverage to preserve and extend

Run `npm run verify` from `web` against the production export. Keep the existing Node/browser tests and adapt UI selectors only where the layout changes. Establish the new behavior inside the relevant phase rather than duplicating the existing scientific tests.

The V2.0 baseline trace exposed timing sensitivity in the existing tablet model-retry test. The trace recorded the injected 503 followed by the real 49,781-byte model, with the UI already reporting **Prediction ready** when the test waited for a second retry button. Before extending that test in V2.1, wait for the corrupt response to be served and then assert the new failure before removing the route interception.

| Existing baseline | Additional v2 checks |
| --- | --- |
| Asset byte integrity, feature order, independent NACA coordinates, source-to-ONNX golden predictions, positive drag and real browser WASM. | Check the same coefficient and L/D outputs in all three modes and while WebGL is disabled or a scene asset fails. Verify the frozen model and preprocessing hashes. |
| Parameter limits, symmetric normalization, exact geometry, keyboard and pointer handles, presets, paced alpha playback and invalid input handling. | Confirm Studio edits survive an Airfoil and Analysis round trip. Verify selected-insert geometry against normalized section coordinates, and ensure playback pauses during selection and switching. |
| Real sweep curves, matched chart and point samples, synchronized inspection, missing-region behavior and comparison save/restore/clear. | Verify dock and full Analysis share the same samples and one saved design. Assert stale edits and out-of-domain inputs cannot be presented as current results or connected by a line. |
| Old URL round trips, malformed-link notice, model/runtime loading errors, corrupt-model retry and downloads. | Cover view-specific links, old links without a view, reloads, direct Airfoil entry with zero 3D requests, missing GLB and GPU context loss, exports while the 3D scene is unavailable, and retained edits after fallback. |
| Static export guard, always-same-origin assets, and Pages production smoke. | Include budgets for the new GLB and deferred chunks, fallback operation without GLB and shader assets, route/static cache checks, and no new backend or third-party requests. |
