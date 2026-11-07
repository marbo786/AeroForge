# XFOIL pilot data pipeline

Phase 3 establishes a real label source and a bounded pilot. It does not train a model, implement inference integration or establish experimental aerodynamic accuracy.

## Source and acquisition

The real solver is XFOIL 6.99 from the Windows archive linked by [MIT's XFOIL distribution page](https://web.mit.edu/drela/Public/web/xfoil/). Official source and command descriptions are available in the [XFOIL manual](https://web.mit.edu/drela/Public/web/xfoil/xfoil_doc.txt). The native Windows build was chosen because XFOIL/Fortran were absent from PATH, the legacy compiler previously failed and WSL was unverified. No system toolchain installation was needed.

Pinned observed hashes:

```text
URL: https://web.mit.edu/drela/Public/web/xfoil/XFOIL6.99.zip
Archive bytes: 3813300
Archive SHA-256: e13e8fe5cc38d8ac2626e9d3b17643bdcfaa63791619f042afdaa7cd103bcb08
xfoil.exe SHA-256: c17342f84ae260c2b11a74cd0e2fb8189a5f8954c6bb7a8467a0f27055c7faea
```

These pins identify the exact HTTPS-acquired distribution used; they are not an upstream digital signature. The local acquisition helper checks both hashes, bounds archive size and extraction paths, skips the archive's root-directory marker and refuses an existing tools folder. Never silently replace a changed binary under the same provenance record.

XFOIL is GPL-licensed. The executable, upstream archive and included source zip stay in ignored `tools/xfoil/`; this repository does not redistribute that third-party software. Any future redistribution needs its own license/source review. AeroForge's future application license must not mislabel XFOIL as MIT-licensed.

## Reproduce

Use Python 3.10.10, pandas 2.3.3, pyarrow 22.0.0 and pytest 9.0.2 as recorded in the pilot environment. Install pinned requirements in a project virtual environment if they are not already available. No new package installation was needed in the original run.

```sh
python -m pip install -r requirements-data.txt -r requirements-test.txt
python scripts/setup_xfoil.py
python scripts/run_pilot.py --output data/pilot-reproduction
python -m pytest -q
```

Run the acquisition command only when authorized to download/execute the small solver distribution and only if `tools/xfoil/` does not already exist. The runner defaults to `configs/pilot-v1.json` and `tools/xfoil/xfoil.exe`; `--xfoil` and `--config` can specify explicit paths. A different binary must be deliberately approved, pinned and described rather than bypassing the expected hash. The helper targets Windows; Linux/macOS builds have not been validated.

The runner refuses any existing output directory, uses no shell interpolation, hides native Windows console windows, and puts each point in a fresh directory. `subprocess.run` kills/waits for an individual solver after a 20-second timeout and retains partial output. The pilot is limited to at most 20 geometries and 500 attempts. It is not a large production batch launcher.

## Solver and geometry contract

`configs/pilot-v1.json` explicitly records viscous mode, fixed Reynolds and Mach, e^n transition, Ncrit, forced transition limits, panel settings, iteration budget, timeout, angle list and geometry list. Each point starts a fresh solver/boundary layer, so there is no path-dependent warm-start sweep. The saved points are a discrete polar sampling plan, not an assertion of valid continuous curves.

Input airfoils come from the tested Phase 2 geometry engine with its finite trailing edge and canonical symmetric p=0. The pipeline loads these files; it does not silently use XFOIL's built-in NACA generator. Each input coordinate file and geometry ID is hashed. Mean-line-based coordinates can have a slightly negative nose x; XFOIL identifies its geometric leading edge independently. No silent pre-rotation, input clipping or closed-edge substitution is performed.

The command stream disables graphics, loads the airfoil, explicitly sets panel controls, repanels, saves the actual 160-node geometry, sets viscous/transition/iteration parameters, enables polar accumulation and runs exactly one `ALFA`. Each saved polar header is checked against requested version, Re, Mach and Ncrit. Two empty lines are required after changes in the Windows build's PPAR menu; the initial probe detected this and the corrected sequence was verified before pilot generation. Unrecognized-command text rejects an attempt.

## Eligibility and failure policy

A point needs all of the following to be eligible:

- Successful bounded process execution, no final `VISCAL` nonconvergence and no command error.
- A parseable polar with exactly one row at the requested angle, matching solver metadata, and explicit log evidence of both polar acceptance and disk write.
- Finite coefficients, positive total drag, nonnegative pressure drag, plausible broad coefficient bounds and transition coordinates in `[0, 1]`.
- No symmetric-zero-lift anomaly, no unvalidated stall-risk flag, and the expected saved panel-node count.

The result states distinguish solver convergence from label eligibility. Some internal boundary-layer marching warnings recover before final convergence; their presence is recorded, while final viscous nonconvergence always rejects a point. A converged point with a quality warning is `suspect` and excluded. Angles at or above 10 degrees are conservatively flagged; the pilot samples 12 degrees to observe that risky region without labeling it validated post-stall behavior.

No failed/missing/nonfinite value is imputed. Rejected finite diagnostic coefficients remain in attempt records, while nonfinite fields become JSON null with an explicit reason and the original raw text is preserved. The supervised label table contains only accepted CL/CD. CM, pressure drag and transition locations are retained solely as raw/diagnostic solver outputs, not extra prediction targets.

Every attempt is appended immediately to JSONL with geometry/config/executable IDs, raw artifact hashes, process outcome, duration, warnings and coefficients. Final all-attempt Parquet and eligible-label Parquet/CSV preserve the recorded fields through the pinned serialization libraries. Report hashes cover the main artifacts; per-attempt hashes cover command streams, logs, polar and panel files. The acceptance/audit tests reparse the originals and compare them with recorded coefficients and exported labels. Git attributes preserve dataset bytes and exempt only this immutable evidence from whitespace cleanup; original Fortran padding/CRLF must not be reformatted to satisfy a source-code style check.

## Pilot results and acceptance

The criteria were set in configuration before the run: at least 70% eligible attempts, labels from all 20 geometries, three matching repeat runs and no process launch/timeout/nonzero-exit failures. They all passed.

| Result | Count |
| --- | ---: |
| Attempted | 280 |
| Solver converged | 270 (96.43%) |
| Eligible labels | 227 (81.07%) |
| Suspect and excluded | 43 |
| Nonconverged/rejected | 10 |
| Geometries with eligible labels | 20 of 20 |

The 43 suspect points comprise 37 converged 12-degree cases plus six lower-angle transition-location flags. Three other 12-degree attempts did not converge, so none of the 40 high-angle attempts enters the label table. The transition flags are small printed excursions above one (1.0001–1.0003); they are retained and conservatively excluded, not rounded into acceptance.

Eligible counts by Re: 111/140 at 100,000 and 116/140 at 500,000. By angle: -4 degrees 33/40, 0 degrees 37/40, 2 degrees 40/40, 4/6/8 degrees 39/40 each, and 12 degrees 0/40. Missing cases must remain missing in any future polar visualization. Runtime including repeat checks and output writing was 99.82 seconds; median solver process duration was 0.213 seconds on the recorded Windows environment.

Three fresh-process repeats for NACA 0008 at Re 100,000 and angles -4, 0 and 2 matched every saved polar coefficient exactly at printed precision (CL four decimals, CD five). This is a narrow reproducibility check, not cross-platform determinism, mesh convergence or independent physical validation. The broad geometry coverage and limited repeat coverage are documented separately.

See `data/pilot-v1/quality-report.json` for machine-readable results and `data/pilot-v1/README.md` for artifact layout. Original evidence is about 3.3 MB before Git compression; the complete failed attempts are included. CI audits these artifacts without downloading or running a Windows solver.

## Domain restrictions and next-phase decisions

This pilot establishes invocation, parsing, failure detection, provenance and throughput. It does not validate all geometries or the full specification's Re range. Re 1,000,000 was not sampled. Only two discrete Re values and a sparse geometry/angle set were tested. The negative-angle, low-Re and thin/cambered failures require attention before any broad dataset expansion. Numerical convergence alone is not physical accuracy.

Initial modeling should investigate the non-stall candidate subset (-4 through 8 degrees), retaining geometry-disjoint groups and missing/failure regions. No deployed model applicability domain is declared. Phase 4 must explicitly approve any expanded simulation plan and set error budgets using held-out geometry performance; the pilot is too small for a defensible final test split by itself.

For Phase 4 discussion, provisional engineering targets are CL MAE <= 0.05 and CD MAE <= 0.0015 on the eventually supported geometry-disjoint domain, measured against XFOIL only. These are proposed surrogate error budgets, not observed model accuracy or solver uncertainty bounds. Confirm or revise them with domain evidence before training/model selection; never tune them using the final test set. Report separate RMSE/R² and difficult-case errors regardless. No model has been trained or selected here.
