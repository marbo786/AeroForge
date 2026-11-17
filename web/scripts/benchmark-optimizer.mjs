import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [origin, output, profile = "desktop"] = process.argv.slice(2);
if (!origin || !output || !["desktop", "phone"].includes(profile)) {
  throw new Error("Usage: node scripts/benchmark-optimizer.mjs ORIGIN OUTPUT [desktop|phone]");
}

const cases = [
  { objective: "efficiency", re: 250000, alpha: [4, 4], thickness: [8, 18] },
  { objective: "drag", re: 350000, alpha: [0, 8], thickness: [8, 18], minimumLift: 0.8 },
  { objective: "lift", re: 100000, alpha: [0, 8], thickness: [12, 16] },
];
const seeds = [42, 137, 2026];
const algorithms = ["differential-evolution", "random"];
const evaluations = 512;
const browser = await chromium.launch(process.platform === "win32" ? { channel: "chrome" } : {});

async function fill(dialog, settings, seed, algorithm) {
  await dialog.locator('select[name="objective"]').selectOption(settings.objective);
  await dialog.getByLabel("Reynolds number", { exact: true }).fill(String(settings.re));
  const [min, max] = settings.alpha;
  await dialog.locator('select[name="angleMode"]').selectOption(min === max ? "fixed" : "range");
  if (min === max) await dialog.getByLabel("Fixed angle (°)").fill(String(min));
  else {
    await dialog.getByLabel("Angle of attack minimum").fill(String(min));
    await dialog.getByLabel("Angle of attack maximum").fill(String(max));
  }
  if (settings.minimumLift) {
    await dialog.getByLabel("Minimum lift coefficient").fill(String(settings.minimumLift));
  }
  await dialog.getByLabel("Thickness minimum").fill(String(settings.thickness[0]));
  await dialog.getByLabel("Thickness maximum").fill(String(settings.thickness[1]));
  await dialog.getByLabel("Candidate evaluation limit").fill(String(evaluations));
  await dialog.getByLabel("Random seed").fill(String(seed));
  await dialog.locator('select[name="algorithm"]').selectOption(algorithm);
}

try {
  const phone = profile === "phone";
  const page = await browser.newPage({
    viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: phone,
    hasTouch: phone,
    reducedMotion: "reduce",
  });
  const requests = [];
  const workers = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("worker", (worker) => workers.push(worker.url()));
  await page.goto(new URL("/studio/?view=airfoil", origin).href);
  await page.getByTestId("cl").filter({ hasText: "0.6972" }).waitFor();
  assert.equal(workers.filter((url) => url.includes("/_next/")).length, 0);
  const initialRequests = requests.length;
  await page.getByRole("button", { name: "Optimize", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Design optimization" });
  await dialog.getByText("Geometry limits and search settings", { exact: true }).click();
  const rows = [];
  await mkdir(output, { recursive: true });
  for (const settings of cases) {
    for (const seed of seeds) {
      for (const algorithm of algorithms) {
        await fill(dialog, settings, seed, algorithm);
        const start = dialog.getByRole("button", { name: "Start search" });
        await start.evaluate((button) => {
          const scope = button.closest("dialog");
          button.addEventListener(
            "click",
            () => {
              const start = performance.now();
              const tasks = [];
              const events = new PerformanceObserver((list) => {
                tasks.push(...list.getEntries().map((entry) => entry.duration));
              });
              events.observe({ entryTypes: ["longtask"] });
              window.optimizerTiming = new Promise((resolve) => {
                const observer = new MutationObserver(() => {
                  const status = scope.querySelector('[aria-label="Search status"]');
                  if (!["Search complete", "Search failed"].includes(status?.textContent.trim()))
                    return;
                  const elapsed = performance.now() - start;
                  tasks.push(...events.takeRecords().map((entry) => entry.duration));
                  events.disconnect();
                  observer.disconnect();
                  resolve({ elapsed, tasks });
                });
                observer.observe(scope, { subtree: true, characterData: true, childList: true });
              });
            },
            { once: true, capture: true },
          );
        });
        await start.click();
        const status = dialog.getByRole("status", { name: "Search status" });
        await status.filter({ hasText: /Search (?:complete|failed)/ }).waitFor({ timeout: 15000 });
        const timing = await page.evaluate(() => window.optimizerTiming);
        const row = {
          objective: settings.objective,
          seed,
          algorithm,
          timing,
          status: await status.textContent(),
        };
        const exportButton = dialog.getByRole("button", { name: "Export XFOIL shortlist" });
        if (await exportButton.isVisible()) {
          const download = page.waitForEvent("download");
          await exportButton.click();
          const bytes = await readFile(await (await download).path());
          const exported = JSON.parse(bytes);
          row.counts = exported.result.counts;
          row.baseline = exported.result.baseline;
          row.best = exported.result.shortlist[0];
          if (!phone && seed === 42 && algorithm === "differential-evolution")
            await writeFile(join(output, `${settings.objective}-shortlist.json`), bytes);
        } else {
          row.countsText = await dialog.getByTestId("search-counts").textContent();
        }
        rows.push(row);
        console.log(
          profile,
          settings.objective,
          seed,
          algorithm,
          row.counts?.completed,
          timing.elapsed.toFixed(1),
        );
      }
    }
  }
  const report = {
    browser: browser.version(),
    profile,
    initialRequests,
    modelRequests: requests.filter((url) => url.endsWith("/selected.onnx")).length,
    wasmRequests: requests.filter((url) => url.endsWith(".wasm")).length,
    optimizerWorkers: workers.filter((url) => url.includes("/_next/")).length,
    rows,
  };
  assert.equal(report.modelRequests, 1);
  await writeFile(
    join(output, `${profile}-benchmark.json`),
    JSON.stringify(report, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
