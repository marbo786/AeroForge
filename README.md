# AeroForge

Design. Simulate. Optimize.

AeroForge is a phased aerodynamic design studio project. **The current implementation is Phase 1 only:** a static Next.js feasibility application executing a small, deterministic ONNX graph in the browser. It does not predict airfoil performance and contains no trained aerodynamic weights.

Read [the full specification](docs/SPEC.md) and [the progress tracker](PROGRESS.md) before development. Each subsequent phase requires approval.

## Run the feasibility test

Use Node.js 24.11.0 and npm 11.6.1:

```sh
cd web
npm ci
npm run verify
```

On Windows, Playwright uses installed Chrome without a browser download. On Linux, install its matching Chromium before smoke tests (`npx playwright install --with-deps chromium`). The latter may install system dependencies and requires appropriate authorization locally; CI runs in an isolated runner.

`npm run verify` prepares assets, checks TypeScript, tests the model and runtime artifacts, builds a static production export, and runs browser smoke tests against that export. No Next.js development or production server is used by the smoke tests. For manual inspection:

```sh
npm run serve
```

Open `http://127.0.0.1:4173/spike/`, enter `0, 3, -2, 0.25`, and select **Run inference**. Expected ONNX output: `1, 7, -3, 1.5`. `npm run dev` is available for development but is not acceptance evidence.

## What is being tested

- Next.js static export, including direct access to the nested `/spike/` route.
- Actual float32 ONNX `Mul` and `Add` execution (`y = 2x + 1`), with dynamic batches.
- Lazy ONNX Runtime Web CPU/WASM loading from the same origin as the page.
- Correct same-build WASM/module companion assets, one-thread execution without cross-origin isolation, and versioned caching.
- Invalid input, missing model, missing WASM, model-load retry, repeated inference and warm reload behavior.
- Desktop (1440px) and mobile (390px) production smoke tests and screenshots.

Phase 1 validation passed: strict TypeScript, 2 asset tests, and 10 production browser smoke tests on Windows Chrome 156.0.8078.81. The same-origin dedicated module-worker experiment also passes. Recorded network evidence is in [docs/phase-1](docs/phase-1/); CI and public hosting have not been run remotely.

![Phase 1 desktop inference test](docs/phase-1/desktop.png)

[Mobile screenshot](docs/phase-1/mobile.png)

The fixture is reproducibly generated with `onnx-proto`, ONNX IR 8 and opset 13. Its manifest includes its hash and purpose. Generated model/runtime assets are ignored by Git and regenerated on each build. See [deployment instructions](docs/DEPLOYMENT.md) and [Phase 1 architecture](docs/ARCHITECTURE.md).

## Boundaries and roadmap

There is no inference backend, database, account system, paid service, or third-party core-runtime request. The static verification server is a local development tool, not a production dependency. Deployment to a public host has not been performed.

Next phases cover NACA geometry; a real solver pilot and quality-controlled dataset; trained/evaluated models; the responsive Design Studio; real charts, comparison and URL sharing; and public-release verification. XFOIL availability remains unresolved. Dataset provenance, evaluation results, scientific accuracy, and aerodynamic performance screenshots will be documented when those phases are completed.
