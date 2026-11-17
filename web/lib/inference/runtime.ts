const runtimePath = "/runtime/1.31.1/";
export const runtime = (): Promise<typeof import("onnxruntime-web")> =>
  import(/* webpackIgnore: true */ `${location.origin}${runtimePath}ort.wasm.min.mjs`);

export async function loadVerifiedSession(
  version: string,
  filename: string,
  expectedHash: string,
  expectedBytes?: number,
) {
  const ort = await runtime();
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = true;
  ort.env.wasm.wasmPaths = `${location.origin}${runtimePath}`;
  const response = await fetch(`/models/${version}/${filename}`);
  if (!response.ok) throw new Error("Model download failed.");
  const bytes = await response.arrayBuffer();
  if (expectedBytes !== undefined && bytes.byteLength !== expectedBytes)
    throw new Error("Model size verification failed.");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  if (hash !== expectedHash) throw new Error("Model version verification failed.");
  return ort.InferenceSession.create(new Uint8Array(bytes), { executionProviders: ["wasm"] });
}
