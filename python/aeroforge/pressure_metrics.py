"""Held-out scoring for nose-to-tail, upper and lower Cp arrays."""
import numpy as np


def weighted_quantile(values, weights, quantile):
    order = np.argsort(values)
    mass = np.cumsum(weights[order], dtype=np.float64)
    return float(values[order[np.searchsorted(mass, quantile * mass[-1])]])


def score_pressure(predicted, reference, geometry_ids, station, plan):
    if (
        reference.shape != (len(geometry_ids), 2, len(station), 3)
        or predicted.shape != reference.shape[:-1]
        or len(geometry_ids) == 0
        or not np.isfinite(predicted).all()
        or not np.isfinite(reference).all()
    ):
        raise ValueError("invalid pressure evaluation arrays")
    _, group, counts = np.unique(geometry_ids, return_inverse=True, return_counts=True)
    weights = 1.0 / counts[group]
    nose = station <= plan["nose_end"]
    tail = station >= plan["tail_start"]
    report = {"profiles": len(geometry_ids), "geometries": len(counts)}
    for branch, side in enumerate(("upper", "lower")):
        cp = reference[:, branch, :, 2]
        x = reference[:, branch, :, 0]
        prediction = predicted[:, branch]
        delta = np.abs(prediction - cp)
        minimum = cp.min(axis=1)
        predicted_x = x[np.arange(len(x)), prediction.argmin(axis=1)]
        near_minimum = cp <= minimum[:, None] + plan["near_minimum_cp"]
        distances = np.where(near_minimum, np.abs(x - predicted_x[:, None]), np.inf)

        def pointwise(mask):
            values = delta[:, mask]
            return weighted_quantile(values.ravel(), np.repeat(weights, values.shape[1]), 0.95)

        report[side] = {
            "mae": float(np.average(delta.mean(axis=1), weights=weights)),
            "p95": pointwise(slice(None)),
            "nose_p95": pointwise(nose),
            "tail_p95": pointwise(tail),
            "minimum_cp_p90": weighted_quantile(np.abs(prediction.min(axis=1) - minimum), weights, 0.90),
            "minimum_location_p90": weighted_quantile(distances.min(axis=1), weights, 0.90),
            "max": float(delta.max()),
            "nose_max": float(delta[:, nose].max()),
            "tail_max": float(delta[:, tail].max()),
        }
    return report


def pressure_accuracy_gates(metrics, plan):
    return {
        side: {
            name: metrics[side][name] <= limit
            for name, limit in plan["limits"].items() if name != "parity_max"
        }
        for side in ("upper", "lower")
    }
