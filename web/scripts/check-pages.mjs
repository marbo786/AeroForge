import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../out/", import.meta.url));
const entries = await readdir(root, { recursive: true, withFileTypes: true });
const files = [];
for (const entry of entries) {
  const path = join(entry.parentPath, entry.name);
  const name = relative(root, path).replaceAll("\\", "/");
  assert(!entry.isSymbolicLink(), `Unexpected symbolic link: ${name}`);
  assert(
    !/^(?:_worker\.js|_routes\.json|functions|node_modules)(?:\/|$)/i.test(name),
    `Unexpected runtime asset: ${name}`,
  );
  assert(!/(^|\/)\.env(?:[./]|$)/i.test(name), `Unexpected environment file: ${name}`);
  if (entry.isFile()) files.push({ name, bytes: (await stat(path)).size });
}
assert(files.length <= 20_000, "Export exceeds the Pages Free file limit");
const largest = files.sort((a, b) => b.bytes - a.bytes)[0];
assert(largest && largest.bytes <= 25 * 1024 ** 2, "Export exceeds the Pages per-file limit");

const manifest = JSON.parse(
  await readFile(new URL("../../artifacts/recovery-v1-complete/model.json", import.meta.url)),
);
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url)));
const runtime = `runtime/${lock.packages["node_modules/onnxruntime-web"].version}`;
const model = `models/${manifest.version}/${manifest.model_file}`;
const preprocessing = `models/${manifest.version}/preprocessing.json`;
for (const name of [
  "index.html",
  "studio/index.html",
  "model/index.html",
  "spike/index.html",
  "inspection/index.html",
  "404.html",
  "_headers",
  model,
  preprocessing,
  `${runtime}/ort.wasm.min.mjs`,
  `${runtime}/ort-wasm-simd-threaded.mjs`,
  `${runtime}/ort-wasm-simd-threaded.wasm`,
  "licenses/AeroForge-MIT.txt",
  "licenses/ONNX-Runtime-LICENSE.txt",
  "licenses/Three-LICENSE.txt",
  "licenses/React-Three-Fiber-LICENSE.txt",
])
  assert(
    files.some((file) => file.name === name && file.bytes > 0),
    `Missing Pages asset: ${name}`,
  );
for (const [path, kib] of [
  ["vehicle/af02-v1/car.glb", 900],
  ["vehicle/af02-v1/poster.webp", 160],
  ["vehicle/af02-mobile-v1/car.glb", 450],
]) {
  const file = files.find((entry) => entry.name === path);
  assert(
    file && file.bytes > 0 && file.bytes <= kib * 1024,
    `Missing or over-budget inspection asset: ${path}`,
  );
}
const exportedHash = createHash("sha256")
  .update(await readFile(join(root, model)))
  .digest("hex");
assert.equal(
  exportedHash,
  manifest.model_sha256,
  "Exported model hash differs from the accepted model",
);
const preprocessingHash = createHash("sha256")
  .update(await readFile(join(root, preprocessing)))
  .digest("hex");
assert.equal(
  preprocessingHash,
  manifest.preprocessing_sha256,
  "Exported preprocessing hash differs from the accepted model",
);
const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
console.log(
  JSON.stringify(
    {
      files: files.length,
      totalBytes,
      largest,
      modelSha256: exportedHash,
      preprocessingSha256: preprocessingHash,
    },
    null,
    2,
  ),
);
