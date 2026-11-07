import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test("production export runs real batched WASM inference with local assets and warm reload", async ({ page }, testInfo) => {
  const errors: string[] = [];
  const external: string[] = [];
  const failed: string[] = [];
  const assets: { url: string; status: number; mime: string }[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", (r) => { if (r.url().startsWith("http") && new URL(r.url()).origin !== "http://127.0.0.1:4173") external.push(r.url()); });
  page.on("requestfailed", (r) => failed.push(r.url()));
  page.on("response", (r) => {
    if (r.url().includes("/runtime/") || r.url().endsWith(".onnx")) {
      assets.push({ url: r.url(), status: r.status(), mime: r.headers()["content-type"] ?? "" });
    }
  });
  await page.goto("/spike/");
  await expect(page.getByRole("status")).toHaveText("Ready to load");
  expect(assets).toHaveLength(0); // Runtime/model are deferred until requested.
  await page.getByLabel("Input values").fill("0, 3, -2, 0.25");
  await page.getByRole("button", { name: "Run inference" }).click();
  await expect(page.getByTestId("output")).toHaveText("1, 7, -3, 1.5");
  await expect(page.getByRole("status")).toHaveText("Inference complete");
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(false);
  expect(assets.some((a) => a.url.endsWith(".wasm") && a.status === 200 && a.mime === "application/wasm")).toBe(true);
  expect(assets.some((a) => a.url.endsWith(".mjs") && a.status === 200 && a.mime.includes("javascript"))).toBe(true);
  expect(assets.some((a) => a.url.endsWith(".onnx") && a.status === 200)).toBe(true);
  expect(assets.every((a) => a.status === 200)).toBe(true);
  const initialAssets = assets.length;
  await page.getByLabel("Input values").fill("10");
  await page.getByRole("button", { name: "Run inference" }).click();
  await expect(page.getByTestId("output")).toHaveText("21");
  expect(assets).toHaveLength(initialAssets); // Reuses the initialized session.
  await page.screenshot({ path: testInfo.outputPath("inference.png"), fullPage: true });
  await page.reload(); // Direct nested-route load, with browser caching enabled.
  await page.getByRole("button", { name: "Run inference" }).click();
  await expect(page.getByTestId("output")).toHaveText("7");
  const cached = await page.evaluate(() => performance.getEntriesByType("resource")
    .filter((e) => /\.(wasm|onnx)$/.test(e.name))
    .map((e) => ({ name: e.name, transferSize: (e as PerformanceResourceTiming).transferSize,
      decodedBodySize: (e as PerformanceResourceTiming).decodedBodySize })));
  await testInfo.attach("asset-evidence", { body: JSON.stringify({ assets, cached, errors, external }, null, 2), contentType: "application/json" });
  await writeFile(testInfo.outputPath("asset-evidence.json"), JSON.stringify({ assets, cached, errors, external }, null, 2));
  expect(cached.length).toBe(2);
  // The runtime may request revalidation: 304 response headers are ~300 bytes,
  // while a true cache hit is zero. Neither should redownload the WASM body.
  expect(cached.every((e) => e.transferSize <= 300 && e.decodedBodySize > 0)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(external).toEqual([]);
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
});

test("invalid input is rejected without loading runtime assets", async ({ page }) => {
  const modelRequests: string[] = [];
  page.on("request", (r) => { if (/\/(runtime|models)\//.test(r.url())) modelRequests.push(r.url()); });
  await page.goto("/spike/");
  for (const value of ["", "abc", "NaN", "Infinity", "1000001", "1,,2"]) {
    await page.getByLabel("Input values").fill(value);
    await page.getByRole("button", { name: "Run inference" }).click();
    await expect(page.getByRole("region", { name: "Run the fixture" }).getByRole("alert")).toBeVisible();
    await expect(page.getByTestId("output")).toHaveCount(0);
  }
  expect(modelRequests).toEqual([]);
});

test("model loading failure is visible and a retry recovers", async ({ page }) => {
  await page.route("**/models/**/affine.onnx", (route) => route.fulfill({ status: 503, body: "Temporarily unavailable" }));
  await page.goto("/spike/");
  await page.getByRole("button", { name: "Run inference" }).click();
  await expect(page.getByRole("status")).toHaveText("Inference failed");
  await expect(page.getByRole("region", { name: "Run the fixture" }).getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("output")).toHaveCount(0);
  await page.unroute("**/models/**/affine.onnx");
  await page.getByRole("button", { name: "Run inference" }).click();
  await expect(page.getByTestId("output")).toHaveText("7");
});

test("missing WASM is reported without a fabricated result", async ({ page }) => {
  await page.route("**/*.wasm", (route) => route.fulfill({ status: 404, body: "Not found" }));
  await page.goto("/spike/");
  await page.getByRole("button", { name: "Run inference" }).click();
  await expect(page.getByRole("status")).toHaveText("Inference failed");
  await expect(page.getByRole("region", { name: "Run the fixture" }).getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("output")).toHaveCount(0);
});

test("same-origin dedicated module worker runs WASM without cross-origin isolation", async ({ page }) => {
  await page.goto("/spike/");
  const result = await page.evaluate(() => new Promise<{ output?: number[]; error?: string; isolated?: boolean }>((resolve, reject) => {
    const worker = new Worker("/models/fixture-v1/worker-check.mjs", { type: "module" });
    const timer = setTimeout(() => { worker.terminate(); reject(new Error("Worker inference timed out")); }, 20_000);
    worker.onmessage = ({ data }) => { clearTimeout(timer); worker.terminate(); resolve(data); };
    worker.onerror = (event) => { clearTimeout(timer); worker.terminate(); reject(new Error(event.message)); };
    worker.postMessage([0, 3, -2, 0.25]);
  }));
  expect(result.error).toBeUndefined();
  expect(result.output).toEqual([1, 7, -3, 1.5]);
  expect(result.isolated).toBe(false);
});
