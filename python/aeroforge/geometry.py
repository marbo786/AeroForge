"""Unit-chord NACA four-digit geometry; conventions in docs/PHYSICS.md."""

from dataclasses import dataclass
import json
import math
from numbers import Real
from pathlib import Path
import re
import struct
from typing import Literal, Mapping

_SPEC = json.loads((Path(__file__).resolve().parents[2] / "shared/naca4.json").read_text())
SCHEMA_VERSION = _SPEC["schemaVersion"]
PRESET_CODES = tuple(_SPEC["presets"])
Units = Literal["ratio", "percent"]
Point = tuple[float, float]


@dataclass(frozen=True)
class Parameters:
    m: float
    p: float
    t: float


@dataclass(frozen=True)
class Station:
    camber: float
    slope: float
    half_thickness: float
    upper: Point
    lower: Point


@dataclass(frozen=True)
class AirfoilGeometry:
    parameters: Parameters
    geometry_id: str
    x: tuple[float, ...]
    upper: tuple[Point, ...]
    lower: tuple[Point, ...]
    contour: tuple[Point, ...]


def _finite(value: object, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, Real):
        raise ValueError(f"{name} must be a finite number")
    try:
        number = float(value)
    except (OverflowError, ValueError) as error:
        raise ValueError(f"{name} must be a finite number") from error
    if not math.isfinite(number):
        raise ValueError(f"{name} must be a finite number")
    return number


def normalize_geometry(values: Mapping[str, object] | Parameters, units: Units = "ratio") -> Parameters:
    """Validate candidate geometry bounds and canonicalize p=0 for m=0.

    No clamping, rounding, inferred units, or model applicability claim.
    Symmetric input p is still required to be numeric and finite, but has no
    physical range requirement because it is discarded before range checks.
    """
    if units not in ("ratio", "percent"):
        raise ValueError("units must be ratio or percent")
    source = vars(values) if isinstance(values, Parameters) else values
    if not isinstance(source, Mapping) or any(key not in source for key in ("m", "p", "t")):
        raise ValueError("m, p and t are required")
    scale = 100 if units == "percent" else 1
    m, p, t = (_finite(source[key], key) / scale for key in ("m", "p", "t"))
    for key, value in (("m", m), ("t", t)):
        low, high = _SPEC["candidateBounds"][key]
        if not low <= value <= high:
            raise ValueError(f"{key} must be between {low} and {high} as a chord ratio")
    if m == 0:
        m, p = 0.0, 0.0  # Also remove signed zero before IDs/preprocessing.
    elif not _SPEC["candidateBounds"]["p"][0] <= p <= _SPEC["candidateBounds"]["p"][1]:
        raise ValueError("p must be between 0.2 and 0.6 for cambered airfoils")
    return Parameters(m, p, t)


def geometry_id(values: Mapping[str, object] | Parameters) -> str:
    """Lossless cross-language identifier: version + big-endian float64 tuple."""
    p = normalize_geometry(values)
    return SCHEMA_VERSION + ":" + ":".join(struct.pack(">d", x).hex() for x in (p.m, p.p, p.t))


def parse_naca(code: str) -> Parameters:
    if not isinstance(code, str):
        raise ValueError("NACA code must be a four-digit string")
    match = re.fullmatch(r"(?:NACA\s*)?([0-9]{4})", code.strip(), re.IGNORECASE)
    if not match:
        raise ValueError("NACA code must contain exactly four digits")
    digits = match.group(1)
    return normalize_geometry({"m": int(digits[0]) / 100, "p": int(digits[1]) / 10, "t": int(digits[2:]) / 100})


def get_preset(code: str) -> Parameters:
    if code not in PRESET_CODES:
        raise ValueError("unknown preset")
    return parse_naca(code)


def _station(p: Parameters, x: float) -> Station:
    # The symmetric branch must run before dividing by p.
    if p.m == 0:
        camber = slope = 0.0
    elif x <= p.p:
        camber = p.m / p.p**2 * (2 * p.p * x - x**2)
        slope = 2 * p.m / p.p**2 * (p.p - x)
    else:
        camber = p.m / (1 - p.p)**2 * (1 - 2 * p.p + 2 * p.p * x - x**2)
        slope = 2 * p.m / (1 - p.p)**2 * (p.p - x)
    if x in (0, 1):
        camber = 0.0
    a, b, c, d, e = _SPEC["thicknessCoefficients"]
    half_thickness = 5 * p.t * (a * math.sqrt(x) + b * x + c * x**2 + d * x**3 + e * x**4)
    theta = math.atan(slope)
    dx = half_thickness * math.sin(theta)
    dy = half_thickness * math.cos(theta)
    return Station(camber, slope, half_thickness, (x - dx, camber + dy), (x + dx, camber - dy))


def section_at(values: Mapping[str, object] | Parameters, x: float) -> Station:
    x = _finite(x, "x")
    if not 0 <= x <= 1:
        raise ValueError("x must be between 0 and 1")
    return _station(normalize_geometry(values), x)


def cosine_stations(points_per_surface: int = 201) -> tuple[float, ...]:
    if isinstance(points_per_surface, bool) or not isinstance(points_per_surface, int) or not 3 <= points_per_surface <= 10001:
        raise ValueError("points_per_surface must be an integer between 3 and 10001")
    n = points_per_surface
    # Explicit endpoints remove trig roundoff; interior stations remain unrounded.
    return (0.0,) + tuple((1 - math.cos(math.pi * i / (n - 1))) / 2 for i in range(1, n - 1)) + (1.0,)


def generate_geometry(values: Mapping[str, object] | Parameters, points_per_surface: int = 201) -> AirfoilGeometry:
    p = normalize_geometry(values)
    x = cosine_stations(points_per_surface)
    sections = tuple(_station(p, xi) for xi in x)
    upper = tuple(s.upper for s in sections)
    lower = tuple(s.lower for s in sections)
    # Upper TE -> LE -> lower TE; leading edge occurs exactly once.
    contour = tuple(reversed(upper)) + lower[1:]
    return AirfoilGeometry(p, geometry_id(p), x, upper, lower, contour)
