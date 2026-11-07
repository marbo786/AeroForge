from dataclasses import asdict
import json
import math
from pathlib import Path
import subprocess

import pytest

from aeroforge.geometry import (
    Parameters, PRESET_CODES, cosine_stations, generate_geometry, geometry_id,
    get_preset, normalize_geometry, parse_naca, section_at,
)

ROOT = Path(__file__).resolve().parents[2]
REFERENCE = json.loads((ROOT / "tests/reference/naca4-stations.json").read_text())


@pytest.mark.parametrize("case", REFERENCE["cases"], ids=lambda case: case["code"])
def test_decimal_reference_stations(case):
    p = parse_naca(case["code"])
    for expected in case["stations"]:
        actual = section_at(p, expected["x"])
        assert actual.camber == pytest.approx(expected["camber"], abs=1e-13, rel=0)
        assert actual.slope == pytest.approx(expected["slope"], abs=1e-13, rel=0)
        assert actual.half_thickness == pytest.approx(expected["halfThickness"], abs=1e-13, rel=0)
        assert actual.upper == pytest.approx(expected["upper"], abs=1e-13, rel=0)
        assert actual.lower == pytest.approx(expected["lower"], abs=1e-13, rel=0)


def test_reference_oracle_is_reproducible():
    # Fixture regeneration is independent of both production implementations.
    import importlib.util
    spec = importlib.util.spec_from_file_location("reference", ROOT / "tests/reference/generate_reference.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert module.build_reference() == REFERENCE


@pytest.mark.parametrize("p", [-10, 0, .2, .4, .6, 100])
def test_symmetric_geometry_and_identity_ignore_finite_p(p):
    inputs = {"m": -0.0, "p": p, "t": .12}
    normalized = normalize_geometry(inputs)
    assert normalized == Parameters(0, 0, .12)
    assert math.copysign(1, normalized.m) == 1
    assert math.copysign(1, normalized.p) == 1
    assert geometry_id(inputs) == geometry_id(parse_naca("0012"))
    shape = generate_geometry(inputs)
    assert shape == generate_geometry(parse_naca("0012"))
    for upper, lower in zip(shape.upper, shape.lower):
        assert upper[0] == lower[0]
        assert upper[1] == -lower[1]


@pytest.mark.parametrize("code", PRESET_CODES)
def test_geometry_normal_offsets_contour_and_edges(code):
    p = get_preset(code)
    shape = generate_geometry(p, 101)
    assert len(shape.x) == len(shape.upper) == len(shape.lower) == 101
    assert len(shape.contour) == 201
    assert shape.contour[0] == shape.upper[-1]
    assert shape.contour[100] == (0, 0)
    assert shape.contour[-1] == shape.lower[-1]
    assert shape.contour.count((0, 0)) == 1
    assert all(a < b for a, b in zip(shape.x, shape.x[1:]))
    for x, upper, lower in zip(shape.x, shape.upper, shape.lower):
        s = section_at(p, x)
        assert all(math.isfinite(value) for value in (*upper, *lower))
        assert (upper[0] + lower[0]) / 2 == pytest.approx(x, abs=1e-15)
        assert (upper[1] + lower[1]) / 2 == pytest.approx(s.camber, abs=1e-15)
        assert math.dist(upper, lower) == pytest.approx(2 * s.half_thickness, abs=1e-15)
        assert (upper[0] - lower[0]) + s.slope * (upper[1] - lower[1]) == pytest.approx(0, abs=1e-15)
    # TE gap is normal to the camber line, not necessarily a vertical gap.
    assert math.dist(shape.upper[-1], shape.lower[-1]) == pytest.approx(.021 * p.t, abs=1e-15)
    area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(shape.contour, shape.contour[1:] + shape.contour[:1])) / 2
    assert area > 0


def test_camber_peak_continuity_derivative_and_unclamped_nose():
    p = parse_naca("2412")
    assert section_at(p, p.p).camber == pytest.approx(p.m, abs=1e-16)
    assert section_at(p, p.p).slope == 0
    assert section_at(p, 0).camber == section_at(p, 1).camber == 0
    for x in (.05, .3, .4, .8):
        h = 1e-7
        numeric = (section_at(p, x + h).camber - section_at(p, x - h).camber) / (2 * h)
        assert section_at(p, x).slope == pytest.approx(numeric, abs=1e-8)
    assert section_at(p, p.p - 1e-9).camber == pytest.approx(section_at(p, p.p + 1e-9).camber, abs=1e-15)
    assert section_at(parse_naca("6618"), .0001).upper[0] < 0  # Correct normal offset, never clamp.


def test_cosine_spacing_and_resolution_do_not_change_identity():
    x = cosine_stations(101)
    assert x[0] == 0 and x[-1] == 1
    assert x[1] < .001 and x[-1] - x[-2] < .001
    assert x[50] == pytest.approx(.5)
    assert all(a == pytest.approx(1 - b, abs=1e-15, rel=0) for a, b in zip(x, reversed(x)))
    assert generate_geometry(parse_naca("2412"), 3).geometry_id == generate_geometry(parse_naca("2412"), 1001).geometry_id


def test_explicit_units_normalization_and_lossless_identity():
    raw = {"m": 2, "p": 40, "t": 12}
    result = normalize_geometry(raw, "percent")
    assert result == parse_naca("2412")
    assert raw == {"m": 2, "p": 40, "t": 12}
    assert normalize_geometry(result) == result
    assert parse_naca(" naca 0412 ") == parse_naca("0012")
    base = {"m": .02, "p": .4, "t": .12}
    for key in base:
        changed = dict(base, **{key: math.nextafter(base[key], math.inf)})
        assert geometry_id(changed) != geometry_id(base)
    assert geometry_id(base) == "naca4-open-v1:3f947ae147ae147b:3fd999999999999a:3fbeb851eb851eb8"


@pytest.mark.parametrize("values", [None, {}, {"m": 0}, {"m": True, "p": .4, "t": .12},
    {"m": .02, "p": "0.4", "t": .12}, {"m": -1e-9, "p": .4, "t": .12},
    {"m": .0600001, "p": .4, "t": .12}, {"m": .02, "p": 0, "t": .12},
    {"m": .02, "p": .600001, "t": .12}, {"m": 0, "p": float('nan'), "t": .12},
    {"m": 0, "p": 0, "t": .0799999}, {"m": 0, "p": 0, "t": .1800001},
    {"m": 0, "p": 0, "t": float('inf')}, {"m": 10**400, "p": .4, "t": .12}])
def test_invalid_geometry_is_rejected(values):
    with pytest.raises(ValueError):
        normalize_geometry(values)


@pytest.mark.parametrize("code", [2412, "", "241", "24123", "24.12", "１２１２", "NACA 9912", "1012", "2400", "6407"])
def test_invalid_or_out_of_candidate_domain_naca_codes(code):
    with pytest.raises(ValueError):
        parse_naca(code)


@pytest.mark.parametrize("count", [True, 2, 3.5, 10002, float('nan'), "201"])
def test_invalid_point_counts(count):
    with pytest.raises(ValueError):
        cosine_stations(count)


@pytest.mark.parametrize("x", [-1e-6, 1.00001, float('nan'), float('inf'), True, "0.5"])
def test_invalid_stations(x):
    with pytest.raises(ValueError):
        section_at(parse_naca("2412"), x)


def test_invalid_units_and_unknown_preset():
    with pytest.raises(ValueError):
        normalize_geometry({"m": 2, "p": 40, "t": 12}, "guess")
    with pytest.raises(ValueError):
        get_preset("2312")


def test_python_typescript_parity_over_candidate_domain():
    requests = [{"parameters": {"m": m, "p": p, "t": t}, "points": 101}
                for m in (0, .02, .06) for p in (.2, .4, .6) for t in (.08, .12, .18)]
    requests += [{"parameters": {"m": .013456789, "p": .456789012, "t": .123456789}, "points": 201}]
    completed = subprocess.run(["node", "--experimental-strip-types", "web/tests/geometry-parity.ts"],
                               cwd=ROOT, input=json.dumps(requests), text=True, capture_output=True, timeout=30)
    assert completed.returncode == 0, completed.stderr
    output = json.loads(completed.stdout)
    assert output["presets"] == [{"code": code, "parameters": asdict(get_preset(code))} for code in PRESET_CODES]
    for request, ts in zip(requests, output["cases"], strict=True):
        py = generate_geometry(request["parameters"], request["points"])
        assert ts["parameters"] == ts["normalized"] == asdict(py.parameters)
        assert ts["geometryId"] == py.geometry_id
        assert ts["x"] == pytest.approx(py.x, abs=1e-13, rel=0)
        for key in ("upper", "lower", "contour"):
            for actual, expected in zip(ts[key], getattr(py, key), strict=True):
                assert actual == pytest.approx(expected, abs=1e-13, rel=0)
        for x, actual in zip((0, .0001, .1, .25, .4, .6, .75, 1), ts["sections"], strict=True):
            expected = section_at(py.parameters, x)
            assert actual["camber"] == pytest.approx(expected.camber, abs=1e-13, rel=0)
            assert actual["slope"] == pytest.approx(expected.slope, abs=1e-13, rel=0)
            assert actual["halfThickness"] == pytest.approx(expected.half_thickness, abs=1e-13, rel=0)
