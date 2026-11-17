"""Audit frozen coefficient evidence and export a training-only coverage index."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
import pandas as pd
from scipy.stats import spearmanr

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "artifacts/recovery-v1-complete"
FINAL = ROOT / "data/recovery-v1/final-locked"
OUTPUT = ROOT / "artifacts/reliability-v1"
COLS = ["m", "p", "t", "alpha_deg", "reynolds"]
TARGETS = ["cl", "cd"]
THRESHOLD_QUANTILE = 0.90


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value, compact=False):
    options = {"separators": (",", ":")} if compact else {"indent": 2}
    path.write_bytes((json.dumps(value, allow_nan=False, **options) + "\n").encode("utf-8"))


def features(frame):
    values = frame[COLS].to_numpy(dtype=np.float64, copy=True)
    values[:, 4] = np.log10(values[:, 4])
    return values


def predict(session, frame):
    values = session.run(["coefficients"], {"features": features(frame).astype(np.float32)})[0]
    if values.shape != (len(frame), 2) or not np.isfinite(values).all():
        raise ValueError("Unexpected predictions from frozen ONNX graph")
    return values


def nearest(query, train, scale, dimensions, excluded=None):
    diff = (query[:, None] - train[None, :]) / scale
    diff[:, :, 1] = np.where((query[:, None, 0] == 0) | (train[None, :, 0] == 0), 0, diff[:, :, 1])
    distance = np.linalg.norm(diff[:, :, :dimensions], axis=2)
    if excluded is not None:
        distance[excluded] = np.inf
    return distance.min(axis=1)


def study_coverage(train, validation, errors, domain):
    spans = [np.ptp(domain[key]) for key in ["m", "cambered_p", "t", "alpha_deg"]]
    scale = np.array([*spans, np.ptp(np.log10(domain["sampled_reynolds"]))])
    x_train = features(train)
    x_val = features(validation)
    ids = train.geometry_id.to_numpy()
    excluded = ids[:, None] == ids[None, :]
    comparisons = {}
    for name, dimensions in [("geometry_only", 3), ("geometry_and_flow", 5)]:
        held_out = nearest(x_train, x_train, scale, dimensions, excluded)
        threshold = float(np.quantile(held_out, THRESHOLD_QUANTILE))
        distances = nearest(x_val, x_train, scale, dimensions)
        limited = distances > threshold + 1e-12
        per_geometry = pd.DataFrame({
            "geometry": validation.geometry_id, "distance": distances,
            "cl": np.abs(errors[:, 0]), "cd": np.abs(errors[:, 1]),
        }).groupby("geometry").mean()
        comparisons[name] = {
            "threshold": threshold,
            "training_leave_geometry_out_distance": {
                str(q): float(np.quantile(held_out, q)) for q in [0.5, 0.9, 0.95, 1]
            },
            "development_distance_max": float(distances.max()),
            "development_geometry_rank_correlation": {
                key: float(spearmanr(per_geometry.distance, per_geometry[key]).statistic)
                for key in TARGETS
            },
            "development_groups": {
                label: {
                    "rows": int(mask.sum()),
                    "geometries": int(validation.loc[mask, "geometry_id"].nunique()),
                    "mae": dict(zip(TARGETS, np.abs(errors[mask]).mean(axis=0).tolist())) if mask.any() else None,
                }
                for label, mask in [("nearby", ~limited), ("limited", limited)]
            },
        }
    return comparisons


def summarize(errors):
    if len(errors) == 0:
        return None
    return {
        name: {
            "mae": float(np.abs(values).mean()),
            "bias": float(values.mean()),
            "absolute_error_quantiles": {
                str(q): float(np.quantile(np.abs(values), q)) for q in [0.5, 0.9, 0.95, 1]
            },
        }
        for name, values in zip(TARGETS, errors.T)
    }


def bootstrap(labels, errors):
    groups = [errors[labels.geometry_id == key] for key in sorted(labels.geometry_id.unique())]
    sums = np.array([np.abs(group).sum(axis=0) for group in groups])
    sizes = np.array([len(group) for group in groups])
    sampled = np.random.default_rng(3202).integers(0, len(groups), size=(4000, len(groups)))
    means = sums[sampled].sum(axis=1) / sizes[sampled].sum(axis=1, keepdims=True)
    return dict(zip(TARGETS, np.quantile(means, [0.025, 0.975], axis=0).T.tolist()))


def slices(labels, attempts, errors):
    result = {}
    for field, source in [
        ("geometry", "geometry_code"), ("camber_percent", "m"), ("camber_position_percent", "p"),
        ("thickness_percent", "t"), ("alpha_deg", "alpha_deg"), ("reynolds", "reynolds"),
        ("xfoil_cl", "cl"), ("xfoil_cd", "cd"),
    ]:
        if source in TARGETS:
            edges = [0, 0.5, 1] if source == "cl" else [0.01, 0.02, 0.03]
            cuts = [-np.inf, *edges, np.inf]
            masks = []
            for low, high in zip(cuts, cuts[1:]):
                mask = (labels[source] >= low) & (labels[source] < high)
                label = f"<{high:g}" if np.isneginf(low) else f">={low:g}" if np.isposinf(high) else f"[{low:g}, {high:g})"
                masks.append((label, mask, None))
        else:
            masks = [
                (
                    "Symmetric" if source == "p" and key == 0 else f"{key * 100:g}" if source in {"m", "p", "t"} else str(key),
                    labels[source] == key,
                    int((attempts[source] == key).sum()),
                )
                for key in sorted(attempts[source].unique())
            ]
        result[field] = [
            {
                "label": label, "attempted": total, "eligible": int(mask.sum()),
                "geometries": int(labels.loc[mask, "geometry_id"].nunique()), "error": summarize(errors[mask]),
            }
            for label, mask, total in masks
        ]
    return result


def plot(slices_by_field, target, destination, rows, geometries):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    titles = ["NACA geometry", "Camber (% chord)", "Camber position (% chord)",
              "Thickness (% chord)", "Angle of attack (°)", "Reynolds number", "XFOIL CL", "XFOIL CD"]
    figure, axes = plt.subplots(4, 2, figsize=(11, 13), layout="constrained")
    figure.suptitle(f"{target.upper()} error against XFOIL · {rows} eligible cases, {geometries} airfoils", fontsize=15)
    for axis, title, bins in zip(axes.flat, titles, slices_by_field.values()):
        for i, row in enumerate(bins):
            if row["error"] is None:
                continue
            error = row["error"][target]
            axis.bar(i, error["mae"], color="#257b8b", zorder=2)
            axis.scatter(i, error["absolute_error_quantiles"]["0.95"], color="#9b431e", s=18, zorder=3)
        axis.set_title(title, loc="left")
        axis.set_ylabel("Absolute error")
        axis.set_xticks(range(len(bins)), [r["label"] + f'\n(n={r["eligible"]})' for r in bins], fontsize=8)
        axis.set_ylim(bottom=0)
        axis.grid(axis="y", alpha=0.25)
        axis.spines[["top", "right"]].set_visible(False)
    figure.supxlabel("Bars show mean absolute error. Dots show the 95th percentile of absolute error.")
    figure.savefig(destination, dpi=120)
    plt.close(figure)


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--output", type=Path, default=OUTPUT)
    cli.add_argument("--plots", type=Path, help="Optional directory for PNG figures (matplotlib 3.10.8)")
    args = cli.parse_args()
    manifest = read_json(MODEL / "model.json")
    original = read_json(MODEL / "final-evaluation.json")
    quality = read_json(FINAL / "quality-report.json")
    graph = MODEL / manifest["model_file"]
    hashes = {
        name: digest(path)
        for name, path in {
            "onnx": graph, "evaluation": MODEL / "final-evaluation.json",
            "train": MODEL / "train.parquet", "development": MODEL / "validation.parquet",
            "development_splits": MODEL / "splits.json",
            "final_labels": FINAL / "labels.parquet", "final_attempts": FINAL / "attempts.parquet",
        }.items()
    }
    if (hashes["onnx"] != manifest["model_sha256"] or not quality["acceptance_passed"]
        or hashes["final_labels"] != quality["artifact_hashes"]["labels.parquet"]
        or hashes["final_attempts"] != quality["artifact_hashes"]["attempts.parquet"]):
        raise ValueError("Frozen evidence failed its provenance checks")
    train = pd.read_parquet(MODEL / "train.parquet")
    development = pd.read_parquet(MODEL / "validation.parquet")
    splits = read_json(MODEL / "splits.json")
    for role, frame in [("train", train), ("validation", development)]:
        frozen = splits[role]
        if (len(frame) != frozen["rows"] or set(frame.sample_id) != set(frozen["sample_ids"])
            or set(frame.geometry_id) != set(frozen["geometry_ids"])):
            raise ValueError(f"Frozen {role} split does not match the data")
    attempts = pd.read_parquet(FINAL / "attempts.parquet")
    labels = pd.read_parquet(FINAL / "labels.parquet").merge(
        attempts[["attempt_id", "geometry_code"]], on="attempt_id", validate="one_to_one",
    )
    if set(labels.attempt_id) != set(attempts.loc[attempts.eligible, "attempt_id"]):
        raise ValueError("Frozen labels differ from eligible attempt IDs")
    for left, right in [(train, development), (train, labels), (development, labels)]:
        if set(left.geometry_id) & set(right.geometry_id):
            raise ValueError("Geometry roles overlap")

    session = ort.InferenceSession(str(graph), providers=["CPUExecutionProvider"])
    dev_errors = predict(session, development) - development[TARGETS].to_numpy()
    comparison = study_coverage(train, development, dev_errors, manifest["domain"])
    groups = []
    for geometry, rows in train.groupby(["m", "p", "t"], sort=True):
        conditions = sorted((float(a), int(re)) for a, re in rows[["alpha_deg", "reynolds"]].itertuples(index=False, name=None))
        if len(set(conditions)) != len(conditions):
            raise ValueError("Duplicate accepted training condition")
        groups.append([*geometry, conditions])
    coverage = {
        "version": "coverage-v1", "model_sha256": hashes["onnx"], "training_sha256": hashes["train"],
        "threshold": comparison["geometry_and_flow"]["threshold"], "groups": groups,
    }

    errors = predict(session, labels) - labels[TARGETS].to_numpy()
    aggregate = summarize(errors)
    for target in TARGETS:
        if abs(aggregate[target]["mae"] - original["selected_metrics"][target]["mae"]) > 1e-6:
            raise ValueError(f"ONNX audit differs from frozen {target.upper()} MAE")
    if len(labels) != original["rows"] or labels.geometry_id.nunique() != original["geometry_count"]:
        raise ValueError("Final panel dimensions changed")
    sliced = slices(labels, attempts, errors)
    args.output.mkdir(parents=True, exist_ok=True)
    index_path = args.output / "coverage-v1.json"
    write_json(index_path, coverage, compact=True)
    write_json(args.output / "summary.json", {
        "model_sha256": hashes["onnx"], "coverage_file": index_path.name,
        "coverage_sha256": digest(index_path), "training_sha256": hashes["train"],
        "training_geometries": len(groups), "training_rows": len(train),
        "final": {
            "attempted": len(attempts), "eligible": len(labels), "geometries": original["geometry_count"],
            "mae": {key: original["selected_metrics"][key]["mae"] for key in TARGETS},
            "cd_mae_by_re": {r["label"]: round(r["error"]["cd"]["mae"], 9) for r in sliced["reynolds"]},
        },
    })
    write_json(args.output / "diagnostics.json", {
        "hashes": hashes, "threshold_quantile": THRESHOLD_QUANTILE, "coverage_comparison": comparison,
        "final": {
            "overall": aggregate, "geometry_bootstrap_mae_percentiles_2_5_and_97_5": bootstrap(labels, errors),
            "attempted": len(attempts), "eligible": len(labels),
            "excluded": [
                {
                    "attempt_id": row.attempt_id, "geometry_code": row.geometry_code,
                    "reynolds": row.reynolds, "alpha_deg": row.alpha_deg,
                    "status": row.status, "reasons": list(row.reasons), "warnings": list(row.warnings),
                }
                for row in attempts.loc[~attempts.eligible].itertuples()
            ],
            "slices": sliced,
        },
    })
    if args.plots:
        args.plots.mkdir(parents=True, exist_ok=True)
        for name in TARGETS:
            plot(sliced, name, args.plots / f"{name}-errors.png", len(labels), original["geometry_count"])


if __name__ == "__main__":
    main()
