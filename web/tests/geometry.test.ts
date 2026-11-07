import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cosineStations, generateGeometry, geometryId, getPreset, normalizeGeometry, parseNaca, presetCodes, sectionAt } from "../lib/geometry/naca4.ts";

const reference = JSON.parse(await readFile(new URL("../../tests/reference/naca4-stations.json", import.meta.url), "utf8"));
const near = (actual: number, expected: number, tolerance = 1e-13) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

for (const entry of reference.cases) {
  test(`NACA ${entry.code} agrees with independent high-precision station references`, () => {
    for (const expected of entry.stations) {
      const actual = sectionAt(parseNaca(entry.code), expected.x);
      near(actual.camber, expected.camber);
      near(actual.slope, expected.slope);
      near(actual.halfThickness, expected.halfThickness);
      for (const side of ["upper", "lower"] as const) {
        near(actual[side][0], expected[side][0]);
        near(actual[side][1], expected[side][1]);
      }
    }
  });
}

test("symmetric p is canonical across coordinates, IDs, signed zero and metadata", () => {
  const base = generateGeometry(parseNaca("0012"));
  for (const p of [-10, 0, .2, .4, .6, 100]) {
    const input = { m: -0, p, t: .12 };
    assert.deepEqual(normalizeGeometry(input), { m: 0, p: 0, t: .12 });
    assert.deepEqual(generateGeometry(input), base);
    assert.equal(geometryId(input), base.geometryId);
  }
  for (let i = 0; i < base.x.length; ++i) {
    assert.equal(base.upper[i][0], base.lower[i][0]);
    near(base.upper[i][1], -base.lower[i][1], 0);
  }
});

for (const code of presetCodes) {
  test(`preset ${code}: finite coordinates, normal thickness, edge gap and contour ordering`, () => {
    const p = getPreset(code);
    const g = generateGeometry(p, 101);
    assert.equal(g.x.length, 101);
    assert.equal(g.upper.length, 101);
    assert.equal(g.lower.length, 101);
    assert.equal(g.contour.length, 201);
    assert.deepEqual(g.contour[0], g.upper.at(-1));
    assert.deepEqual(g.contour[100], [0, 0]);
    assert.deepEqual(g.contour.at(-1), g.lower.at(-1));
    assert.equal(g.contour.filter(([x, y]) => x === 0 && y === 0).length, 1);
    for (let i = 0; i < g.x.length; ++i) {
      const [xu, yu] = g.upper[i];
      const [xl, yl] = g.lower[i];
      assert.ok([xu, yu, xl, yl].every(Number.isFinite));
      if (i) assert.ok(g.x[i] > g.x[i - 1]);
      const s = sectionAt(p, g.x[i]);
      near((xu + xl) / 2, g.x[i], 1e-15);
      near((yu + yl) / 2, s.camber, 1e-15);
      near(Math.hypot(xu - xl, yu - yl), 2 * s.halfThickness, 1e-15);
      near((xu - xl) + s.slope * (yu - yl), 0, 1e-15);
    }
    const [xu, yu] = g.upper.at(-1)!;
    const [xl, yl] = g.lower.at(-1)!;
    near(Math.hypot(xu - xl, yu - yl), .021 * p.t, 1e-15);
    const area = g.contour.reduce((sum, a, i) => {
      const b = g.contour[(i + 1) % g.contour.length];
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0) / 2;
    assert.ok(area > 0);
  });
}

test("camber peak, continuous slope, finite-difference derivative and true nose offset", () => {
  const p = parseNaca("2412");
  near(sectionAt(p, p.p).camber, p.m, 1e-16);
  assert.equal(sectionAt(p, p.p).slope, 0);
  assert.equal(sectionAt(p, 0).camber, 0);
  assert.equal(sectionAt(p, 1).camber, 0);
  for (const x of [.05, .3, .4, .8]) {
    const h = 1e-7;
    const derivative = (sectionAt(p, x + h).camber - sectionAt(p, x - h).camber) / (2 * h);
    near(sectionAt(p, x).slope, derivative, 1e-8);
  }
  near(sectionAt(p, p.p - 1e-9).camber, sectionAt(p, p.p + 1e-9).camber, 1e-15);
  assert.ok(sectionAt(parseNaca("6618"), .0001).upper[0] < 0);
});

test("cosine sampling has exact endpoints, clusters at both edges and preserves identity", () => {
  const x = cosineStations(101);
  assert.equal(x[0], 0); assert.equal(x[100], 1);
  near(x[50], .5);
  assert.ok(x[1] < .001 && x[100] - x[99] < .001);
  // Separate cosine evaluations can differ by a few float64 ULPs.
  for (let i = 0; i < x.length; ++i) near(x[i], 1 - x[100 - i], 1e-15);
  assert.equal(generateGeometry(parseNaca("2412"), 3).geometryId, generateGeometry(parseNaca("2412"), 1001).geometryId);
});

test("normalization has explicit units, is idempotent, preserves precision, and does not mutate input", () => {
  const input = { m: 2, p: 40, t: 12 };
  const p = normalizeGeometry(input, "percent");
  assert.deepEqual(p, parseNaca("2412"));
  assert.deepEqual(input, { m: 2, p: 40, t: 12 });
  assert.deepEqual(normalizeGeometry(p), p);
  assert.deepEqual(parseNaca(" naca 0412 "), parseNaca("0012"));
  const precise = { m: .013456789, p: .456789012, t: .123456789 };
  assert.deepEqual(normalizeGeometry(precise), precise);
  assert.equal(geometryId(p), "naca4-open-v1:3f947ae147ae147b:3fd999999999999a:3fbeb851eb851eb8");
  for (const key of ["m", "p", "t"] as const) {
    assert.notEqual(geometryId({ ...p, [key]: p[key] + 1e-15 }), geometryId(p));
  }
  assert.throws(() => getPreset("2312"));
  assert.throws(() => normalizeGeometry(input, "guess" as never));
});

test("invalid geometry values are rejected rather than clamped or coerced", () => {
  const invalid: unknown[] = [null, {}, { m: 0 }, { m: true, p: .4, t: .12 },
    { m: .02, p: "0.4", t: .12 }, { m: -1e-9, p: .4, t: .12 },
    { m: .0600001, p: .4, t: .12 }, { m: .02, p: 0, t: .12 },
    { m: .02, p: .600001, t: .12 }, { m: 0, p: NaN, t: .12 },
    { m: 0, p: 0, t: .0799999 }, { m: 0, p: 0, t: .1800001 }, { m: 0, p: 0, t: Infinity }];
  for (const values of invalid) assert.throws(() => normalizeGeometry(values));
  for (const code of [2412, "", "241", "24123", "24.12", "１２１２", "NACA 9912", "1012", "2400", "6407"]) {
    assert.throws(() => parseNaca(code as string));
  }
  for (const n of [true, 2, 3.5, 10002, NaN, "201"]) assert.throws(() => cosineStations(n as number));
  for (const x of [-1e-6, 1.00001, NaN, Infinity, true, "0.5"]) assert.throws(() => sectionAt(parseNaca("2412"), x as number));
});
