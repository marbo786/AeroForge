# Surrogate design optimization

Open **Optimize** from Studio, Airfoil or Analysis. Choose maximum CL/CD, minimum CD at a required CL, or maximum CL. Select a fixed Reynolds number and either a fixed angle of attack or an angle range. Geometry limits, evaluation budget, algorithm and seed are under **Geometry limits and search settings**. The current model calculates coefficients for isolated NACA sections.

## Search and screening

The default is seeded differential evolution with a 16-member population, mutation factor 0.8 and crossover probability 0.9. The random-search baseline uses the same bounds, seed generator, coverage checks and model evaluation budget. Whenever the allowed camber range includes zero, the search proposes a symmetric section every eighth attempt. Symmetric sections use canonical position zero. Candidate positions are deduplicated before inference and the search stops after its unique point or proposal limit is exhausted. The default is 512 candidate evaluations, the maximum is 4,096 and the proposal cap is twenty times the evaluation budget with a minimum of 16.

Every candidate must be within the chosen ranges and near eligible training points according to coverage-v1. The optimization-only screening limits are CL −0.8 to 1.7 and CD 0.004 to 0.065. The frozen training and development labels had CL extrema −0.6399 and 1.5020, and CD extrema 0.00521 and 0.05543. The wider limits leave room around those observations and block near-zero drag from dominating CL/CD. The minimum-drag objective also rejects a predicted CL below the user's requested minimum. These checks use the surrogate and its training coverage. [Policy](../../shared/optimizer-v1.json) · [Training coverage evidence](../v3-2/README.md)

The panel reports proposals, duplicates, coverage rejections, submitted model rows, completed rows and feasible results. It shows the best candidate and up to two other candidates separated by at least 0.08 in model-range-normalized geometry and angle. The displayed baseline uses the original geometry at the fixed Reynolds number and, for fixed-angle search, at the selected angle. A bounded-angle search retains the original angle for the baseline. The single baseline row is accounted for separately. Objective improvement appears when the baseline meets the constraints and passes screening. The geometry overlay preserves the original input profile, and applying a candidate records the immediately preceding Studio design for revert.

## Browser execution

Next.js loads the optimizer panel on activation. A dedicated module worker handles search proposals, coverage checks, scores and shortlist ranking. It requests one batch of at most 16 candidates at a time from the same proxy-backed ONNX session used by Studio. The coefficient graph, training index and WASM assets use their existing same-origin paths. Closing or cancelling the search terminates the search worker. The UI retains acknowledged results and submitted counts, and discards the late reply from an in-flight ONNX batch. Regular Studio predictions retain their current retry path.

## Reproduce the benchmark

From `web/`, build the static export and serve it locally.

```sh
npm run build
npm run serve
```

From another terminal in `web/`, run the benchmark. It uses 512 model rows per search, seeds 42, 137 and 2026, and both algorithms. Each profile uses the same cases.

```sh
node scripts/benchmark-optimizer.mjs http://127.0.0.1:4173 ../optimizer-replay desktop
node scripts/benchmark-optimizer.mjs http://127.0.0.1:4173 ../optimizer-replay phone
```

| Objective | Reynolds number | Angle | Geometry or lift constraints |
| --- | ---: | --- | --- |
| Maximize CL/CD | 250,000 | Fixed at 4° | Manifest geometry bounds |
| Minimize CD | 350,000 | 0°–8° | Manifest geometry bounds and CL ≥ 0.8 |
| Maximize CL | 100,000 | 0°–8° | Thickness 12–16% chord |

The benchmark writes the three desktop differential-evolution shortlists for seed 42. Each shortlist preserves the exact original input, solver candidate inputs, predictions, settings, counts, history, model hash and coverage hash.

## Measured browser results

All 36 searches completed 512 candidate-model evaluations each. Differential evolution found a better surrogate objective than random search in all nine desktop case/seed pairs. The table shows the median of the three per-seed best values for each case. These observations describe this benchmark with the frozen model and search spaces.

| Objective | Differential evolution | Random search |
| --- | ---: | ---: |
| Maximize CL/CD | 108.16 | 106.67 |
| Minimize CD at CL ≥ 0.8 | 0.007092 | 0.007437 |
| Maximize CL | 1.45435 | 1.38581 |

Chrome 157 on the Ryzen 7 5800U reused one selected ONNX download and one WASM download per profile across 18 searches. The warm-session click-to-completion medians were 90.8 ms at 1440 × 900 and 91.1 ms at 390 × 844 with phone and touch emulation. The respective p95 values were 172.5 and 148.6 ms, including lazy worker startup on the first run. The long-task observer reported no tasks over 50 ms during these searches. Physical phone timing and WebKit compatibility remain unverified. [Desktop runs](../../artifacts/optimizer-v1/desktop-benchmark.json) · [Emulated phone runs](../../artifacts/optimizer-v1/phone-benchmark.json)

Replaying the 36 exported best designs with native ONNX produced maximum absolute differences of `1.19e-7` in CL and `7.45e-9` in CD against the browser results.

## Replay an exported shortlist

Export from the optimizer or use a saved benchmark shortlist. The CLI uses the existing pinned Windows XFOIL 6.99 executable and the recovery solver settings. It validates bounds, schema, score, coverage and version before executing. Choose a fresh output directory.

```sh
python scripts/verify_shortlist.py optimizer-replay/efficiency-shortlist.json --output optimizer-replay/xfoil-efficiency
```

The verifier runs one fresh solve per point with 160 panels, Mach 0, Ncrit 9, transition limits at x/c=1, 150 iterations and a 20-second timeout. The input retains the exact integer Reynolds number from the export. The polar header reports three decimal places in millions, so verification accepts the corresponding ≤500 Reynolds rounding difference while recording the exact command. The output contains geometry, commands, polar and solver logs, and a JSON report with hashes, convergence, predicted-minus-XFOIL residuals, feasibility and rank changes. XFOIL-rejected rows have missing eligible solver coefficients and ranking. Solver eligibility and satisfying the selected minimum lift are tracked separately.

## Bounded XFOIL replay

The seed-42 desktop shortlists supplied three candidates and one reference geometry per objective. All 12 solves produced eligible polars under the pinned solver checks. These are new runs for search verification. The three original-geometry rows are reference points, and this replay remains separate from the frozen benchmark.

| Objective | Candidate by surrogate rank | Predicted objective | XFOIL objective | XFOIL rank |
| --- | ---: | ---: | ---: | ---: |
| CL/CD | 1 | 108.16 | 105.48 | 2 |
| CL/CD | 2 | 107.33 | 106.69 | 1 |
| CL/CD | 3 | 106.79 | 104.54 | 3 |
| CD at CL ≥ 0.8 | 1 | 0.007070 | 0.00735 | 1 |
| CD at CL ≥ 0.8 | 2 | 0.007297 | 0.00738 | Infeasible |
| CD at CL ≥ 0.8 | 3 | 0.007420 | 0.00774 | 2 |
| CL | 1 | 1.45435 | 1.4505 | 2 |
| CL | 2 | 1.45018 | 1.4590 | 1 |
| CL | 3 | 1.44926 | 1.4425 | 3 |

The original section returned CL/CD 67.64 in the fixed-angle efficiency case. In the lift case its XFOIL CL was 0.7102 at the original 4° angle. The original section's XFOIL CL was 0.7068 in the drag case, below the selected minimum. Drag candidate 2 returned CL **0.7987** against a predicted **0.80429**, which changed its feasibility. Candidate order also reversed in the efficiency and lift shortlists. These results establish a repeatable offline check for shortlisted candidates. Whether threshold-adjacent misses are systematic needs broader independent verification before general availability. [Efficiency replay](../../artifacts/optimizer-v1/efficiency-xfoil-verification.json) · [Drag replay](../../artifacts/optimizer-v1/drag-xfoil-verification.json) · [Lift replay](../../artifacts/optimizer-v1/lift-xfoil-verification.json)
