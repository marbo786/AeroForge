import type { InferenceSession } from "onnxruntime-web";

export const runtimeVersion = "1.31.1";
export const modelUrl = "/models/fixture-v1/affine.onnx";
let sessionPromise: Promise<InferenceSession> | undefined;

function loadRuntime(): Promise<typeof import("onnxruntime-web")> {
  // A native ESM import prevents webpack from also emitting an unused WASM copy.
  return import(/* webpackIgnore: true */ `${location.origin}/runtime/${runtimeVersion}/ort.wasm.min.mjs`);
}

async function loadSession() {
  const ort = await loadRuntime();
  ort.env.wasm.numThreads = 1;
  // Baseline avoids SharedArrayBuffer, COOP/COEP and proxy-worker requirements.
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = `${location.origin}/runtime/${runtimeVersion}/`;
  return ort.InferenceSession.create(modelUrl, { executionProviders: ["wasm"] });
}

export async function runFixture(values: number[]) {
  if (!values.length || values.some((x) => !Number.isFinite(x) || Math.abs(x) > 1e6)) {
    throw new Error("Enter finite values between -1,000,000 and 1,000,000.");
  }
  if (!sessionPromise) sessionPromise = loadSession().catch((error: unknown) => {
    sessionPromise = undefined;
    throw error;
  });
  const session = await sessionPromise;
  const { Tensor } = await loadRuntime();
  const start = performance.now();
  const result = await session.run({ x: new Tensor("float32", Float32Array.from(values), [values.length]) });
  const durationMs = performance.now() - start;
  const output = Array.from(result.y.data as Float32Array);
  if (output.length !== values.length || output.some((x) => !Number.isFinite(x))) {
    throw new Error("The runtime returned an invalid output tensor.");
  }
  return { output, durationMs };
}
