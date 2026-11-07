import spec from "../../../shared/naca4.json" with { type: "json" };

export type Parameters = Readonly<{ m: number; p: number; t: number }>;
export type Units = "ratio" | "percent";
export type Point = readonly [number, number];
export type Station = Readonly<{
  camber: number; slope: number; halfThickness: number; upper: Point; lower: Point;
}>;
export type AirfoilGeometry = Readonly<{
  parameters: Parameters; geometryId: string; x: readonly number[];
  upper: readonly Point[]; lower: readonly Point[]; contour: readonly Point[];
}>;
export const schemaVersion = spec.schemaVersion;
export const presetCodes: readonly string[] = Object.freeze([...spec.presets]);

function finite(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

/** Explicit units, candidate bounds, no clamping/rounding; symmetric p is discarded. */
export function normalizeGeometry(values: unknown, units: Units = "ratio"): Parameters {
  if (units !== "ratio" && units !== "percent") throw new Error("units must be ratio or percent");
  if (!values || typeof values !== "object") throw new Error("m, p and t are required");
  const source = values as Record<string, unknown>;
  const scale = units === "percent" ? 100 : 1;
  let m = finite(source.m, "m") / scale;
  let p = finite(source.p, "p") / scale;
  const t = finite(source.t, "t") / scale;
  for (const [key, value] of [["m", m], ["t", t]] as const) {
    const [low, high] = spec.candidateBounds[key];
    if (value < low || value > high) throw new Error(`${key} must be between ${low} and ${high} as a chord ratio`);
  }
  if (m === 0) { m = 0; p = 0; }
  else if (p < spec.candidateBounds.p[0] || p > spec.candidateBounds.p[1]) {
    throw new Error("p must be between 0.2 and 0.6 for cambered airfoils");
  }
  return Object.freeze({ m, p, t });
}

/** Lossless big-endian float64 values; same identity contract as Python. */
export function geometryId(values: unknown): string {
  const p = normalizeGeometry(values);
  const hex = (value: number) => {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setFloat64(0, value, false);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  };
  return `${schemaVersion}:${[p.m, p.p, p.t].map(hex).join(":")}`;
}

export function parseNaca(code: string): Parameters {
  if (typeof code !== "string") throw new Error("NACA code must be a four-digit string");
  const match = /^(?:NACA\s*)?([0-9]{4})$/i.exec(code.trim());
  if (!match) throw new Error("NACA code must contain exactly four digits");
  const digits = match[1];
  return normalizeGeometry({ m: Number(digits[0]) / 100, p: Number(digits[1]) / 10, t: Number(digits.slice(2)) / 100 });
}

export function getPreset(code: string): Parameters {
  if (!presetCodes.includes(code)) throw new Error("unknown preset");
  return parseNaca(code);
}

function station(p: Parameters, x: number): Station {
  let camber = 0;
  let slope = 0;
  if (p.m !== 0) {
    if (x <= p.p) {
      camber = p.m / p.p ** 2 * (2 * p.p * x - x ** 2);
      slope = 2 * p.m / p.p ** 2 * (p.p - x);
    } else {
      camber = p.m / (1 - p.p) ** 2 * (1 - 2 * p.p + 2 * p.p * x - x ** 2);
      slope = 2 * p.m / (1 - p.p) ** 2 * (p.p - x);
    }
  }
  if (x === 0 || x === 1) camber = 0;
  const [a, b, c, d, e] = spec.thicknessCoefficients;
  const halfThickness = 5 * p.t * (a * Math.sqrt(x) + b * x + c * x ** 2 + d * x ** 3 + e * x ** 4);
  const theta = Math.atan(slope);
  const dx = halfThickness * Math.sin(theta);
  const dy = halfThickness * Math.cos(theta);
  return { camber, slope, halfThickness, upper: [x - dx, camber + dy], lower: [x + dx, camber - dy] };
}

export function sectionAt(values: unknown, x: number): Station {
  finite(x, "x");
  if (x < 0 || x > 1) throw new Error("x must be between 0 and 1");
  return station(normalizeGeometry(values), x);
}

export function cosineStations(pointsPerSurface = 201): number[] {
  if (!Number.isInteger(pointsPerSurface) || pointsPerSurface < 3 || pointsPerSurface > 10001) {
    throw new Error("pointsPerSurface must be an integer between 3 and 10001");
  }
  return Array.from({ length: pointsPerSurface }, (_, i) => i === 0 ? 0 : i === pointsPerSurface - 1 ? 1 :
    (1 - Math.cos(Math.PI * i / (pointsPerSurface - 1))) / 2);
}

export function generateGeometry(values: unknown, pointsPerSurface = 201): AirfoilGeometry {
  const parameters = normalizeGeometry(values);
  const x = cosineStations(pointsPerSurface);
  const sections = x.map((xi) => station(parameters, xi));
  const upper = sections.map((s) => s.upper);
  const lower = sections.map((s) => s.lower);
  return { parameters, geometryId: geometryId(parameters), x, upper, lower, contour: [...upper].reverse().concat(lower.slice(1)) };
}
