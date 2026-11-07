# NACA four-digit geometry contract

Phase 2 implements geometry only. Geometry validity does not imply that XFOIL converges, that a trained surrogate exists, or that an aerodynamic prediction is validated.

## Units, normalization and supported candidate geometry

The chord is one. Coordinates are dimensionless chord fractions in an unrotated body frame: leading-edge reference `(0, 0)`, trailing-edge chord reference `(1, 0)`, positive camber upward. Angle of attack is not applied to these coordinates; later visualization may rotate a copy without changing the geometry identity.

Parameters are `m` (maximum mean-line camber/chord), `p` (its chordwise position), and `t` (nominal thickness/chord). Both engines explicitly accept either ratio values `{m: 0.02, p: 0.4, t: 0.12}` or percent values `{m: 2, p: 40, t: 12}` with `units="percent"`. They do not infer units, coerce strings/booleans, clamp, or round. Extra metadata does not enter geometry identity.

For this project the geometry API validates the specification's candidate bounds: `0 <= m <= 0.06`, `0.08 <= t <= 0.18`, and `0.2 <= p <= 0.6` for cambered airfoils. These are candidate geometry bounds, not a model applicability domain. Four-digit codes outside them are intentionally rejected even when a general NACA equation could describe them.

### Symmetric canonicalization

When `m == 0` (including negative zero), normalization returns positive `m=0, p=0` before geometry calculation or ID construction. The supplied `p` must still be a finite number, but any finite value is discarded; it cannot create another symmetric shape. The mean-line implementation branches on `m == 0` before dividing by `p`. Thus `0012`, `0412`, and `{m: 0, p: 0.6, t: 0.12}` give the same geometry and identifier.

Do not replace this with an epsilon threshold: a small positive camber remains cambered. Future preprocessing, solver sampling, dataset grouping and model metadata must use this normalization convention.

## Equations

At a mean-line station `x` in `[0, 1]`, for `m > 0`:

```text
For x <= p:
  yc(x)   = m/p² * (2px - x²)
  yc'(x)  = 2m/p² * (p - x)

For x > p:
  yc(x)   = m/(1-p)² * (1 - 2p + 2px - x²)
  yc'(x)  = 2m/(1-p)² * (p - x)

For m = 0: yc(x) = yc'(x) = 0

yt(x) = 5t * (0.2969 sqrt(x) - 0.1260x - 0.3516x²
              + 0.2843x³ - 0.1015x⁴)

theta = atan(yc'(x))
xu = x - yt sin(theta)       yu = yc + yt cos(theta)
xl = x + yt sin(theta)       yl = yc - yt cos(theta)
```

Thickness is placed **normal to the camber line**. Simply adding/subtracting thickness vertically is incorrect for a cambered airfoil. The two surface points at each station have midpoint `(x, yc)` and Euclidean separation `2yt`; their offset vector is perpendicular to the mean-line tangent.

The coefficients specify the conventional finite trailing edge, not the closed-edge variant using `-0.1036`. At `x=1`, the half-gap is `0.0105t`, so the total gap normal to the camber line is `0.021t` (0.00252 chord for NACA 0012). For cambered airfoils the upper and lower trailing-edge x coordinates can straddle one. Near the nose the upper surface may extend slightly to negative x. Neither is clipped or forced into `[0, 1]`. Only mean-line station x is constrained to that interval.

The polynomial's maximum thickness is approximately `t`, near `x=0.3`; finite decimal coefficients do not make its numerical maximum exactly equal to `t`. Mean-line camber is exactly `m` at `x=p`; do not confuse it with maximum upper-surface ordinate. The implementation explicitly returns zero endpoint camber to remove endpoint cancellation roundoff.

### Sampling and surface order

`N` points per surface use `x_i = (1 - cos(pi*i/(N-1)))/2`, clustering near both edges. The default is 201; integer counts from 3 through 10,001 are supported. Endpoints are set exactly to zero and one. Small counts are permitted for tests, not claimed sufficient for solver discretization.

`upper` and `lower` are both ordered LE to TE and each contain `N` coordinate pairs. `contour` is upper TE -> upper surface -> LE -> lower surface -> lower TE, with exactly `2N-1` pairs and a single leading-edge point. The two finite-gap trailing-edge endpoints remain distinct; the first point is not appended at the end. A later plotting polygon may close the gap, while a solver adapter must explicitly choose paneling and file formatting. No solver adapter exists in Phase 2.

The mean-line x array is strictly increasing. Surface x arrays are not required to be monotone near the nose because the exact normal offset changes their x positions.

## Identity, shared constants and presets

`shared/naca4.json` is the common source for coefficients, candidate bounds, version, trailing-edge convention and preset codes. Python reads it from the source checkout; TypeScript imports it without Node-only APIs. Packaging the Python library as a standalone wheel is not part of this phase; the shared file must accompany it if packaging is added later.

Geometry ID schema:

```text
naca4-open-v1:<big-endian float64 m hex>:<p hex>:<t hex>
```

For example, NACA 2412 has ID:

```text
naca4-open-v1:3f947ae147ae147b:3fd999999999999a:3fbeb851eb851eb8
```

The binary encoding is identical across Python and JavaScript and independent of decimal formatting. It preserves input precision rather than rounding only the ID and accidentally assigning different geometries the same group. Sampling count and future operating conditions do not change identity. A one-ULP parameter change can change identity; future sampling must produce deterministic normalized parameter tuples, not depend on approximate floating-point equality. Changing the thickness convention or equations requires a schema-version change.

Presets: `0008`, `0012`, `0015`, `0018`, `2412`, `2415`, `4412`, `4418`, `6412`, `6618`. Preset lookup is explicit; unknown preset names are rejected. The separate parser accepts four ASCII digits with an optional case-insensitive `NACA` prefix and surrounding whitespace, then applies the same validation/canonicalization. There is no automatic rounding of continuously edited parameters to a nearest NACA designation.

Python values use frozen dataclasses and tuples. TypeScript exposes readonly types and freezes normalized parameters; returned coordinate arrays should be treated as immutable by callers. Normalization does not mutate the caller's object.

## APIs and test commands

Python: `python/aeroforge/geometry.py` exports `normalize_geometry`, `parse_naca`, `get_preset`, `geometry_id`, `section_at`, `cosine_stations`, and `generate_geometry`.

TypeScript: `web/lib/geometry/naca4.ts` exports equivalent camelCase functions. Python station field `half_thickness` corresponds to TypeScript `halfThickness`, and geometry field `geometry_id` to `geometryId`.

From the repository root, using the already installed pytest 9.0.2 and Node 24.11.0:

```sh
python -m pytest -q
cd web
npm run verify
```

For a new Python test environment, install `requirements-test.txt` inside a virtual environment; the geometry implementation itself uses only the Python standard library. NumPy is not required for a few hundred analytic coordinates, but later data pipelines can convert the returned tuples to arrays. No new Python runtime dependencies or ML packages were installed for Phase 2.

### Reference and verification method

Both implementations are checked against the committed `tests/reference/naca4-stations.json`: four reference airfoils, each at eight fixed stations, including the nose, trailing edge and camber breakpoints. `tests/reference/generate_reference.py` computes these values independently using 60-digit Decimal arithmetic, factored mean-line equations and slope-vector normalization instead of the production trigonometric path. It imports neither production engine and can reproduce the committed fixture:

```sh
python tests/reference/generate_reference.py
```

These are analytic equation references, not downloaded wind-tunnel or solver data. Tests use an absolute coordinate tolerance of `1e-13` chord and separately check symmetry, endpoints, derivative continuity, normal offsets, positive contour area, invalid values, no clipping, explicit units, preset lookup and lossless IDs.

The Python suite also launches the actual TypeScript engine through a test-only Node bridge, comparing complete arrays and exact identifiers across 28 parameter cases: a 27-case candidate-boundary/interior grid plus a non-digit continuous geometry. This catches language drift without claiming that mutual agreement alone proves the equations. Browser inference regression tests continue to run against the unchanged Phase 1 production UI.

## References

- [PDAS thickness definition](https://www.pdas.com/naca456thick4.html), authored by the PDAS implementation maintainer: scaled thickness coefficients and the nonzero trailing edge. The implementation uses the equivalent coefficients divided by five.
- [PyAnsys geometry implementation](https://geometry.docs.pyansys.com/version/dev/examples/04_applied/01_naca_airfoils.html): published camber, slope, cosine-station and normal-offset equations. AeroForge independently implements those standard equations; no PyAnsys runtime is required.

Scientific validation of lift/drag, solver convergence, mesh/panel sensitivity and model error remain Phases 3 and 4.
