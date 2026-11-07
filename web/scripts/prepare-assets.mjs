import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const { onnx } = require('onnx-proto');
const root = new URL('../', import.meta.url);
const version = JSON.parse(await readFile(new URL('node_modules/onnxruntime-web/package.json', root))).version;
const runtimeDir = new URL(`public/runtime/${version}/`, root);
const modelDir = new URL('public/models/fixture-v1/', root);
await mkdir(runtimeDir, { recursive: true });
await mkdir(modelDir, { recursive: true });
// Copy only the CPU WASM runtime and its same-build module companion.
for (const name of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs', 'ort.wasm.min.mjs']) {
  await copyFile(new URL(`node_modules/onnxruntime-web/dist/${name}`, root), new URL(name, runtimeDir));
}
// Independent same-origin module-worker experiment; not part of the page's runtime path.
await writeFile(new URL('worker-check.mjs', modelDir), `
import * as ort from '/runtime/${version}/ort.wasm.min.mjs';
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = new URL('/runtime/${version}/', self.location.origin).href;
self.onmessage = async ({ data }) => {
  try {
    const session = await ort.InferenceSession.create('/models/fixture-v1/affine.onnx', { executionProviders: ['wasm'] });
    const results = await session.run({ x: new ort.Tensor('float32', Float32Array.from(data), [data.length]) });
    self.postMessage({ output: Array.from(results.y.data), isolated: self.crossOriginIsolated });
    await session.release();
  } catch (error) { self.postMessage({ error: String(error) }); }
};
`);
const value = (name) => ({ name, type: { tensorType: { elemType: 1, shape: { dim: [{ dimParam: 'batch' }] } } } });
const model = onnx.ModelProto.create({
  irVersion: 8,
  producerName: 'aeroforge-phase-1-fixture',
  opsetImport: [{ domain: '', version: 13 }],
  graph: {
    name: 'affine-infrastructure-check',
    input: [value('x')], output: [value('y')],
    initializer: [
      { name: 'scale', dataType: 1, dims: [1], floatData: [2] },
      { name: 'bias', dataType: 1, dims: [1], floatData: [1] },
    ],
    node: [
      { opType: 'Mul', input: ['x', 'scale'], output: ['scaled'] },
      { opType: 'Add', input: ['scaled', 'bias'], output: ['y'] },
    ],
  },
});
const error = onnx.ModelProto.verify(model);
if (error) throw new Error(error);
const bytes = onnx.ModelProto.encode(model).finish();
await writeFile(new URL('affine.onnx', modelDir), bytes);
await writeFile(new URL('manifest.json', modelDir), JSON.stringify({
  version: 'fixture-v1', purpose: 'Infrastructure test only; not an aerodynamic model',
  formula: 'y = 2*x + 1', dtype: 'float32', irVersion: 8, opset: 13,
  runtimeVersion: version, bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
}, null, 2) + '\n');
console.log(`Prepared ${bytes.length}-byte ONNX fixture and ONNX Runtime Web ${version} CPU assets.`);

// Phase 4 research artifacts are served for production verification only.
// The visible feasibility UI continues to use its explicitly labeled affine fixture.
const research = new URL('../../artifacts/pilot-surrogate-v1/', import.meta.url);
const researchTarget = new URL('public/models/pilot-surrogate-v1/', root);
await mkdir(researchTarget, { recursive: true });
for (const name of ['model.json', 'preprocessing.json', 'golden.json', 'mlp.onnx', 'ridge.onnx', 'forest.onnx']) {
  await copyFile(new URL(name, research), new URL(name, researchTarget));
}
const recovery = new URL('../../artifacts/recovery-v1-complete/', import.meta.url);
// The accepted recovery model powers the Phase 5 studio; transforms are embedded.
const recoveryTarget = new URL('public/models/recovery-v1-complete/', root);
await mkdir(recoveryTarget, { recursive: true });
for (const name of ['model.json', 'preprocessing.json', 'golden.json', 'selected.onnx']) {
  await copyFile(new URL(name, recovery), new URL(name, recoveryTarget));
}
