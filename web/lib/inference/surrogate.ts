import type { InferenceSession } from "onnxruntime-web";
import { normalizeGeometry } from "../geometry/naca4.ts";
import { assessDomain, domainMessage, model, type Design } from "./domain.ts";
import { loadVerifiedSession, runtime } from "./runtime.ts";

export { model, type Design } from "./domain.ts";
let sessionPromise: Promise<InferenceSession> | undefined;

export function features(design: Design): number[] {
  const p = normalizeGeometry(design);
  const { outside } = assessDomain({ ...design, ...p });
  if (outside.length) throw new Error(domainMessage(outside));
  // All scaling, engineered features and output inversion are inside the graph.
  return [p.m, p.p, p.t, design.alpha, Math.log10(design.re)];
}

export async function predict(design: Design) {
  const { rows, durationMs } = await predictBatch([design]);
  const row = rows[0];
  if (!row) throw new Error("Model returned invalid coefficients.");
  return { ...row, durationMs };
}

export async function predictBatch(designs: readonly Design[]) {
  if (!designs.length) throw new Error("At least one design is required.");
  const input = Float32Array.from(designs.flatMap(features));
  sessionPromise ??= loadVerifiedSession(model.version, model.model_file, model.model_sha256).catch(
    (error: unknown) => {
      sessionPromise = undefined;
      throw error;
    },
  );
  const session = await sessionPromise;
  const ort = await runtime();
  const start = performance.now();
  const result = await session.run({
    features: new ort.Tensor("float32", input, [designs.length, 5]),
  });
  const durationMs = performance.now() - start;
  const output = result.coefficients;
  const data = output?.data;
  if (
    !(data instanceof Float32Array) ||
    output.dims.length !== 2 ||
    output.dims[0] !== designs.length ||
    output.dims[1] !== 2 ||
    data.length !== designs.length * 2
  ) {
    throw new Error("Model returned invalid coefficients.");
  }
  const rows = designs.map((_, index) => {
    const cl = data[index * 2];
    const cd = data[index * 2 + 1];
    if (!Number.isFinite(cl) || !Number.isFinite(cd) || cd <= 1e-8) return null;
    return { cl, cd, ratio: cl / cd };
  });
  return { rows, durationMs };
}
