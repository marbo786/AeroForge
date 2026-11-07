import type { InferenceSession } from "onnxruntime-web";
import metadata from "../../../artifacts/recovery-v1-complete/model.json" with { type: "json" };
import { normalizeGeometry, type Parameters } from "../geometry/naca4.ts";

export const model = metadata;
export type Design = Parameters & { alpha: number; re: number };
let sessionPromise: Promise<InferenceSession> | undefined;
const runtimePath = "/runtime/1.31.1/";
const runtime = (): Promise<typeof import("onnxruntime-web")> =>
  import(/* webpackIgnore: true */ `${location.origin}${runtimePath}ort.wasm.min.mjs`);

export function features(design: Design): number[] {
  const p = normalizeGeometry(design);
  const [low, high] = model.domain.alpha_deg;
  const reynolds = model.domain.sampled_reynolds;
  if (!Number.isFinite(design.alpha) || design.alpha < low || design.alpha > high ||
      !Number.isFinite(design.re) || design.re < reynolds[0] || design.re > reynolds[reynolds.length - 1]) {
    throw new Error("Predictions require an angle from -4 to 8° and Reynolds number from 100,000 to 500,000.");
  }
  // All scaling, engineered features and output inversion are inside the graph.
  return [p.m, p.p, p.t, design.alpha, Math.log10(design.re)];
}

async function loadSession() {
  const ort = await runtime();
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = `${location.origin}${runtimePath}`;
  const response = await fetch(`/models/${model.version}/${model.model_file}`);
  if (!response.ok) throw new Error("Model download failed.");
  const bytes = await response.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  if (hash !== model.model_sha256) throw new Error("Model version verification failed.");
  return ort.InferenceSession.create(new Uint8Array(bytes), { executionProviders: ["wasm"] });
}

export async function predict(design: Design) {
  const input = features(design); // Reject before any model/runtime request.
  sessionPromise ??= loadSession().catch((error: unknown) => { sessionPromise = undefined; throw error; });
  const session = await sessionPromise;
  const ort = await runtime();
  const start = performance.now();
  const result = await session.run({ features: new ort.Tensor("float32", Float32Array.from(input), [1, 5]) });
  const durationMs = performance.now() - start;
  const output = result.coefficients;
  const [cl, cd] = Array.from(output.data as Float32Array);
  if (output.dims.length !== 2 || output.dims[0] !== 1 || output.dims[1] !== 2 ||
      !Number.isFinite(cl) || !Number.isFinite(cd) || cd <= 1e-8) throw new Error("Model returned invalid coefficients.");
  return { cl, cd, ratio: cl / cd, durationMs };
}
