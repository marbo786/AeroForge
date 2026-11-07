# Real XFOIL pilot v1

Generated on 2026-11-07 using the project-local MIT Windows XFOIL 6.99 build. These are viscous XFOIL labels, not experimental measurements, high-fidelity CFD or NeuralFoil outputs. No learned model is included.

Results: 280 attempts, 270 solver-converged results, 227 eligible labels, 43 suspect results and 10 rejected/nonconverged results. All 20 geometries have eligible labels. The run and three repeat checks took about 99.82 seconds. See `quality-report.json` for actual acceptance checks, grouped coverage and failure counts.

- `config.json`: exact solver/sampling configuration copied for this run.
- `manifest.json`: source, solver/archive hashes, geometry schema, configuration hash and environment versions.
- `geometries/`: Phase 2 finite-edge coordinates loaded into XFOIL, with 401 points each.
- `raw/aNNNN/commands.in`: exact stdin for each independent solver process.
- `raw/aNNNN/stdout.txt.gz`, `stderr.txt.gz`: compressed original output bytes, including internal warnings and final failures.
- `raw/aNNNN/panels.dat`: actual solver-repaneled 160-node coordinates.
- `raw/aNNNN/polar.txt`: original polar including solver settings and, when converged, one coefficient row. An empty polar body is retained for failed solves.
- `attempts.jsonl` and `attempts.parquet`: every attempt, eligibility, reasons, diagnostic coefficients, process outcome, elapsed time and per-file hashes.
- `labels.parquet` and `labels.csv`: eligible CL/CD labels only, joined by attempt/geometry IDs and source/config hashes. Nonconverged/suspect values are not interpolated or substituted.
- `repeat/`: raw evidence for three repeated operating points. All coefficients matched the original polar's printed precision; this is a limited reproducibility check, not an independent physical validation.

The configuration covers two Reynolds numbers (100,000 and 500,000), Mach zero, Ncrit 9, nominal natural transition with forced limits at x/c=1 on both surfaces, 150 iterations and 160 panel nodes. Angles are -4, 0, 2, 4, 6, 8 and 12 degrees. Points at 12 degrees are excluded as unvalidated stall risk. Six other rows are conservatively excluded for printed transition locations above one; the raw values are not clamped.

This is a sparse pilot, not a complete training dataset or a validated rectangular prediction domain. No geometry-disjoint training/test split has been made yet. Do not train from all attempts or tune/evaluate a final model on this pilot without a separately approved Phase 4 plan.

`.gitattributes` disables text conversion and whitespace cleanup checks for this immutable evidence directory because provenance hashes cover original file bytes, Fortran padding and line endings. Preserve those bytes when copying the dataset. The executable and upstream archive remain ignored under `tools/xfoil/`; they are not redistributed here. See [pipeline documentation](../../docs/DATA.md) for reproduction, licensing and limitations.
