import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test("selected trained research model executes in production WASM and matches source golden outputs", async ({ page, request }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const root = "/models/pilot-surrogate-v1/";
  const model = await (await request.get(root + "model.json")).json();
  const golden = await (await request.get(root + "golden.json")).json();
  expect(model.research_only).toBe(true);
  // Failed accuracy must remain explicit: a numeric export pass is not a release gate.
  expect(model.accuracy_targets_passed).toBe(false);
  await page.goto("/spike/");
  const result = await page.evaluate(async ({ root, model, golden }) => {
    const runtimeUrl = location.origin + "/runtime/1.31.1/ort.wasm.min.mjs";
    const ort = await import(runtimeUrl);
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = location.origin + "/runtime/1.31.1/";
    const session = await ort.InferenceSession.create(root + model.model_file, { executionProviders: ["wasm"] });
    const x = golden.features as number[][];
    const tensor = new ort.Tensor("float32", Float32Array.from(x.flat()), [x.length, 5]);
    const output = (await session.run({ features: tensor })).coefficients;
    const expected = (golden.expected[model.selected_family] as number[][]).flat();
    const maxError = Math.max(...Array.from(output.data as Float32Array, (value, i) => Math.abs(value - expected[i])));
    const one = new ort.Tensor("float32", Float32Array.from(x[0]), [1, 5]);
    const batch = new ort.Tensor("float32", Float32Array.from(x.slice(0, 17).flat()), [17, 5]);
    const timings: Record<string, { p50_ms: number; p95_ms: number }> = {};
    for (const [name, input] of [["single", one], ["batch17", batch]] as const) {
      for (let i = 0; i < 10; i++) await session.run({ features: input });
      const elapsed = [];
      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        await session.run({ features: input });
        elapsed.push(performance.now() - start);
      }
      elapsed.sort((a, b) => a - b);
      timings[name] = { p50_ms: elapsed[49], p95_ms: elapsed[94] };
    }
    await session.release();
    return { maxError, shape: output.dims, cases: x.length, timings, isolated: crossOriginIsolated };
  }, { root, model, golden });
  expect(result.maxError).toBeLessThan(golden.absolute_tolerance);
  expect(result.shape).toEqual([golden.features.length, 2]);
  expect(result.isolated).toBe(false);
  expect(errors).toEqual([]);
  const evidence = { ...result, browser: page.context().browser()?.version(), selected_family: model.selected_family,
    accuracy_targets_passed: model.accuracy_targets_passed, errors };
  await writeFile(testInfo.outputPath("surrogate-evidence.json"), JSON.stringify(evidence, null, 2));
  await testInfo.attach("surrogate-evidence", { body: JSON.stringify(evidence), contentType: "application/json" });
});
