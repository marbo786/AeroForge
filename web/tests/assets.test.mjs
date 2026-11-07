import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { onnx } = require('onnx-proto');
const root = new URL('../', import.meta.url);

test('fixture graph has the documented dynamic batch, arithmetic, and manifest hash', async () => {
  const bytes = await readFile(new URL('public/models/fixture-v1/affine.onnx', root));
  const manifest = JSON.parse(await readFile(new URL('public/models/fixture-v1/manifest.json', root)));
  const model = onnx.ModelProto.decode(bytes);
  assert.equal(Number(model.irVersion), 8);
  assert.equal(Number(model.opsetImport[0].version), 13);
  assert.equal(model.graph.input[0].type.tensorType.shape.dim[0].dimParam, 'batch');
  assert.deepEqual(model.graph.node.map((x) => x.opType), ['Mul', 'Add']);
  assert.deepEqual(model.graph.initializer.map((x) => x.floatData[0]), [2, 1]);
  assert.equal(manifest.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(manifest.bytes, bytes.length);
  assert.ok(bytes.length < 1024);
});

test('deployed runtime companions exactly match the pinned package and fit Pages limits', async () => {
  const pkg = JSON.parse(await readFile(new URL('package.json', root)));
  const version = pkg.dependencies['onnxruntime-web'];
  for (const name of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs', 'ort.wasm.min.mjs']) {
    const deployed = await readFile(new URL(`public/runtime/${version}/${name}`, root));
    const upstream = await readFile(new URL(`node_modules/onnxruntime-web/dist/${name}`, root));
    assert.ok(deployed.equals(upstream), `${name} must match the installed package`);
    assert.ok(deployed.length < 25 * 1024 * 1024, `${name} must fit the Pages per-asset limit`);
  }
});
