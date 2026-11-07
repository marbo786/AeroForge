import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test("recovered model passes frozen accuracy metadata and production browser numerical checks", async ({ page, request }, testInfo) => {
  const root = "/models/recovery-v1-complete/";
  const metadata = await (await request.get(root + "model.json")).json();
  const golden = await (await request.get(root + "golden.json")).json();
  expect(metadata.accuracy_targets_passed).toBe(true);
  expect(metadata.onnx_agreement_passed).toBe(true);
  expect(metadata.domain.continuous_domain_validated).toBe(false);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/spike/");
  const result = await page.evaluate(async ({ root, golden }) => {
    const url = location.origin + "/runtime/1.31.1/ort.wasm.min.mjs";
    const ort = await import(url);
    ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = location.origin + "/runtime/1.31.1/";
    const session = await ort.InferenceSession.create(root + "selected.onnx", { executionProviders: ["wasm"] });
    const x = golden.features as number[][];
    const results = await session.run({ features: new ort.Tensor("float32", Float32Array.from(x.flat()), [x.length, 5]) });
    const expected = (golden.expected.selected as number[][]).flat();
    const actual = Array.from(results.coefficients.data as Float32Array);
    const maxError = Math.max(...actual.map((value, i) => Math.abs(value - expected[i])));
    const timings: Record<string, { p50_ms: number; p95_ms: number }> = {};
    for (const [name, count] of [["single", 1], ["batch17", 17]] as const) {
      const features = new ort.Tensor("float32", Float32Array.from(x.slice(0, count).flat()), [count, 5]);
      for (let i = 0; i < 10; i++) await session.run({ features });
      const times = [];
      for (let i = 0; i < 100; i++) {
        const start = performance.now(); await session.run({ features }); times.push(performance.now() - start);
      }
      times.sort((a, b) => a - b);
      timings[name] = { p50_ms: times[49], p95_ms: times[94] };
    }
    await session.release();
    return { maxError, shape: results.coefficients.dims, cases: x.length, timings, isolated: crossOriginIsolated,
      positiveDrag: actual.filter((_, i) => i % 2 === 1).every((value) => value > 0) };
  }, { root, golden });
  expect(result.maxError).toBeLessThan(1e-5);
  expect(result.shape).toEqual([golden.features.length, 2]);
  expect(result.positiveDrag).toBe(true);
  expect(result.isolated).toBe(false);
  expect(errors).toEqual([]);
  const evidence = { ...result, errors, browser: page.context().browser()?.version() };
  await writeFile(testInfo.outputPath("recovery-evidence.json"), JSON.stringify(evidence, null, 2));
});
