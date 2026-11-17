import type { InferenceSession } from "onnxruntime-web";
import manifest from "../../../artifacts/pressure-v1/model.json" with { type: "json" };
import {
  cosineStations,
  generateGeometry,
  normalizeGeometry,
  type Point,
} from "../geometry/naca4.ts";
import type { Design } from "./domain.ts";
import { loadVerifiedSession, runtime } from "./runtime.ts";

export const pressureAngles = manifest.alpha;
export const pressureReynolds = manifest.reynolds;
export const pressureStationCount = manifest.stations;
const stations = cosineStations(pressureStationCount);
const rejected = new Set(manifest.rejected);
let sessionPromise: Promise<InferenceSession> | undefined;

export function pressureFeatures(design: Design): number[] {
  const { m, p, t } = normalizeGeometry(design);
  return [m * 100, p * 10, t * 100, design.alpha, design.re];
}

export function pressureUnavailable(design: Design): string | undefined {
  if (!pressureReynolds.includes(design.re) || !pressureAngles.includes(design.alpha))
    return "Choose a sampled angle and Reynolds number to view pressure.";
  const digits = pressureFeatures(design).slice(0, 3);
  if (digits.every((value) => Math.abs(value - Math.round(value)) < 1e-8)) {
    const [m, p, t] = digits.map(Math.round);
    const code = `${m}${p}${String(t).padStart(2, "0")}`;
    const alpha = design.alpha >= 0 ? `+${design.alpha}` : design.alpha;
    if (rejected.has(`${code}-${design.re}-${alpha}`))
      return "Pressure unavailable for this case. The XFOIL run did not pass the data checks.";
  }
}

export function pressureCoordinates(design: Design) {
  const geometry = generateGeometry(design);
  const interpolate = (branch: readonly Point[]) => {
    const cumulative = [0];
    for (let i = 1; i < branch.length; i++) {
      const [x, y] = branch[i];
      const [previousX, previousY] = branch[i - 1];
      cumulative.push(cumulative[i - 1] + Math.hypot(x - previousX, y - previousY));
    }
    let edge = 1;
    return stations.map((station): Point => {
      const distance = station * cumulative[cumulative.length - 1];
      while (cumulative[edge] < distance) edge++;
      const fraction =
        (distance - cumulative[edge - 1]) / (cumulative[edge] - cumulative[edge - 1]);
      const [x0, y0] = branch[edge - 1];
      const [x1, y1] = branch[edge];
      return [x0 + (x1 - x0) * fraction, y0 + (y1 - y0) * fraction];
    });
  };
  return [interpolate(geometry.upper), interpolate(geometry.lower)] as const;
}

export function decodePressure(output: { dims: readonly number[]; data: unknown } | undefined) {
  if (
    !output ||
    output.dims.length !== 3 ||
    output.dims[0] !== 1 ||
    output.dims[1] !== 2 ||
    output.dims[2] !== pressureStationCount ||
    !(output.data instanceof Float32Array) ||
    output.data.length !== 2 * pressureStationCount ||
    !output.data.every(Number.isFinite)
  )
    throw new Error("Model returned an invalid pressure profile.");
  return [
    output.data.slice(0, pressureStationCount),
    output.data.slice(pressureStationCount),
  ] as const;
}

export async function predictPressure(design: Design) {
  const unavailable = pressureUnavailable(design);
  if (unavailable) throw new Error(unavailable);
  sessionPromise ??= loadVerifiedSession(
    manifest.version,
    manifest.file,
    manifest.sha256,
    manifest.bytes,
  ).catch((error: unknown) => {
    sessionPromise = undefined;
    throw error;
  });
  const session = await sessionPromise;
  const ort = await runtime();
  const input = new ort.Tensor("float32", Float32Array.from(pressureFeatures(design)), [1, 5]);
  return decodePressure((await session.run({ features: input })).cp);
}
