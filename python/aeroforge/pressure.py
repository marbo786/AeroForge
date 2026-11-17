"""Align XFOIL 6.99 surface pressure and assess a branch-wise representation."""
from dataclasses import dataclass
import math
import re

import numpy as np


@dataclass(frozen=True)
class PressureDump:
    name: str
    alpha: float
    reynolds: float
    flap_hinge: tuple[float, float]
    samples: np.ndarray


def numeric_rows(lines, width):
    rows = []
    for line in lines:
        if not line.strip():
            continue
        fields = line.replace("D", "E").replace("d", "e").split()
        if len(fields) != width:
            raise ValueError("malformed numeric row")
        rows.append([float(field) for field in fields])
    array = np.asarray(rows, dtype=float)
    if len(rows) < 3 or not np.isfinite(array).all():
        raise ValueError("insufficient or nonfinite numeric rows")
    return array


def parse_pressure(text):
    lines = text.strip().splitlines()
    if len(lines) < 6:
        raise ValueError("incomplete CPWR file")
    metadata = re.fullmatch(r"\s*Alfa =\s*(\S+)\s+Re =\s*(\S+)\s+Xflap,Yflap =\s*(\S+)\s+(\S+)\s*", lines[1])
    if metadata is None or lines[2].lstrip("# ").split() != ["x", "y", "Cp"]:
        raise ValueError("unexpected CPWR header")
    alpha, reynolds, hinge_x, hinge_y = map(float, metadata.groups())
    if not all(map(math.isfinite, (alpha, reynolds, hinge_x, hinge_y))):
        raise ValueError("nonfinite CPWR metadata")
    return PressureDump(lines[0].strip(), alpha, reynolds, (hinge_x, hinge_y), numeric_rows(lines[3:], 3))


def pair_panels(panels, pressure, expected_count, tolerance):
    if len(panels) != expected_count or len(pressure) != expected_count:
        raise ValueError("PSAV and CPWR must each contain the prescribed panel count")
    differences = np.abs(panels[:, None] - pressure[None, :, :2]).max(axis=2)
    compatible = differences <= tolerance
    if not np.all(compatible.diagonal()):
        raise ValueError("CPWR coordinates do not match PSAV in traversal order")
    if not np.all(compatible.sum(axis=0) == 1) or not np.all(compatible.sum(axis=1) == 1):
        raise ValueError("ambiguous CPWR and PSAV coordinates")
    return float(differences.diagonal().max())


def pressure_forces(nodes, cp, alpha):
    """Closed-contour pressure lift and moment in XFOIL's chord and sign conventions."""
    angle = math.radians(alpha)
    cos, sin = math.cos(angle), math.sin(angle)
    end = np.roll(nodes, -1, axis=0)
    dx, dy = (end - nodes).T
    x, y = ((nodes + end) / 2).T
    dx_rot, dy_rot = dx * cos + dy * sin, dy * cos - dx * sin
    x_rot, y_rot = (x - 0.25) * cos + y * sin, y * cos - (x - 0.25) * sin
    next_cp = np.roll(cp, -1)
    mean_cp = (cp + next_cp) / 2
    delta_cp = next_cp - cp
    return {
        "cl": float(np.sum(dx_rot * mean_cp)),
        "cm": float(-np.sum(
            dx_rot * (mean_cp * x_rot + delta_cp * dx_rot / 12)
            + dy_rot * (mean_cp * y_rot + delta_cp * dy_rot / 12)
        )),
        "integrated_pressure_drag": float(-np.sum(dy_rot * mean_cp)),
    }


def pressure_branches(nodes, cp, geometry, projection_tolerance):
    """Locate the analytic LE in solver traversal via ordered contour projections."""
    contour = np.asarray(geometry.contour)
    edges = np.diff(contour, axis=0)
    lengths = np.linalg.norm(edges, axis=1)
    cumulative = np.r_[0.0, np.cumsum(lengths)]
    projection = np.clip(
        np.sum((nodes[:, None] - contour[None, :-1]) * edges[None], axis=2) / lengths[None] ** 2,
        0, 1,
    )
    projected = contour[None, :-1] + projection[:, :, None] * edges[None]
    errors = np.linalg.norm(nodes[:, None] - projected, axis=2)
    nearest = errors.argmin(axis=1)
    worst = float(errors[np.arange(len(nodes)), nearest].max())
    arc = cumulative[nearest] + projection[np.arange(len(nodes)), nearest] * lengths[nearest]
    if worst > projection_tolerance or np.any(np.diff(arc) <= 0):
        raise ValueError("solver panels do not follow the analytic contour")
    if arc[0] > projection_tolerance or cumulative[-1] - arc[-1] > projection_tolerance:
        raise ValueError("solver traversal is missing a trailing edge endpoint")
    le = cumulative[len(geometry.upper) - 1]
    split = np.searchsorted(arc, le)
    if split < 2 or split > len(nodes) - 2:
        raise ValueError("analytic leading edge does not separate two branches")
    points = np.column_stack([nodes, cp])
    if abs(arc[split] - le) <= 1e-12:
        upper, lower = points[split::-1], points[split:]
        interpolated = False
        nose_span = 0.0
    else:
        fraction = (le - arc[split - 1]) / (arc[split] - arc[split - 1])
        nose = points[split - 1] + fraction * (points[split] - points[split - 1])
        upper = np.vstack([nose, points[split - 1::-1]])
        lower = np.vstack([nose, points[split:]])
        interpolated = True
        nose_span = float(arc[split] - arc[split - 1])
    return {"upper": upper, "lower": lower}, {
        "max_geometry_projection_error": worst,
        "upper_raw_count": int(split + (not interpolated)),
        "lower_raw_count": int(len(nodes) - split),
        "interpolated_shared_le": interpolated,
        "le_bracket_arc_length": nose_span,
        "minimum_panel_x": float(nodes[:, 0].min()),
        "trailing_edge_gap": float(np.linalg.norm(nodes[0] - nodes[-1])),
    }


def normalized_arc(branch):
    arc = np.r_[0.0, np.cumsum(np.linalg.norm(np.diff(branch[:, :2], axis=0), axis=1))]
    if np.any(np.diff(arc) <= 0):
        raise ValueError("duplicate branch coordinate")
    return arc / arc[-1]


def summarize_error(error, station):
    def statistics(values):
        return {
            "mae": float(np.mean(values)), "p95": float(np.quantile(values, 0.95)),
            "max": float(np.max(values)),
        } if len(values) else None
    return {
        "all": statistics(error),
        "nose_s_le_0_08": statistics(error[station <= 0.08]),
        "tail_s_ge_0_90": statistics(error[station >= 0.90]),
    }


def resample_branch(branch, count):
    arc = normalized_arc(branch)
    station = (1 - np.cos(np.linspace(0, math.pi, count))) / 2
    sampled = np.column_stack([np.interp(station, arc, column) for column in branch.T])
    restored = np.interp(arc, station, sampled[:, 2])
    metrics = summarize_error(np.abs(restored - branch[:, 2]), arc)
    raw_peak = branch[branch[:, 2].argmin()]
    grid_peak = sampled[sampled[:, 2].argmin()]
    metrics.update(
        suction_peak_cp_delta=float(grid_peak[2] - raw_peak[2]),
        suction_peak_x_delta=float(grid_peak[0] - raw_peak[0]),
    )
    return sampled, metrics
