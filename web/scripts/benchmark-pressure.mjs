import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const [, , origin, output] = process.argv;
if (!origin || !output) throw new Error("Usage: node scripts/benchmark-pressure.mjs ORIGIN REPORT");
const manifest = JSON.parse(
  await readFile(new URL("../../artifacts/pressure-v1/model.json", import.meta.url), "utf8"),
);
const model = `/models/${manifest.version}/${manifest.file}`;
const browser = await chromium.launch(process.platform === "win32" ? { channel: "chrome" } : {});
const plot = "[data-pressure-plot]";
const settings = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  {
    name: "phone emulation",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  },
];

function quantile(values, q) {
  return [...values].sort((a, b) => a - b)[Math.ceil(values.length * q) - 1];
}

async function resources(page) {
  return page.evaluate(() =>
    performance.getEntriesByType("resource").map((entry) => ({
      path: new URL(entry.name).pathname,
      gzipBytes: entry.encodedBodySize,
      durationMs: entry.duration,
    })),
  );
}

async function armEdit(page, target, event) {
  await target.evaluate(
    (element, { event, plot }) => {
      window.pressureTiming = new Promise((resolve, reject) => {
        const previous = document.querySelector(plot);
        const timeout = setTimeout(() => reject(new Error("Timed out waiting for the plot")), 5000);
        element.addEventListener(
          event,
          () => {
            const started = performance.now();
            const observer = new MutationObserver(() => {
              const current = document.querySelector(plot);
              if (!current || current === previous) return;
              observer.disconnect();
              clearTimeout(timeout);
              // The second frame includes the browser's first opportunity to paint the update.
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve(performance.now() - started)),
              );
            });
            observer.observe(document.body, { childList: true, subtree: true });
          },
          { once: true, capture: true },
        );
      });
    },
    { event, plot },
  );
  return () => page.evaluate(() => window.pressureTiming);
}

try {
  const profiles = [];
  for (const { name, ...device } of settings) {
    const cold = [];
    const warm = [];
    let initialJs;
    let transfer;
    for (let run = 0; run < 5; run++) {
      const page = await browser.newPage({ ...device, reducedMotion: "reduce" });
      const requests = [];
      page.on("request", (request) => requests.push(new URL(request.url()).pathname));
      await page.goto(new URL("/studio/?view=airfoil", origin).href);
      await page
        .locator('[aria-label="Prediction status"]')
        .filter({ hasText: "Prediction ready" })
        .waitFor();
      const before = await resources(page);
      assert(
        !before.some(
          ({ path }) => path.includes("/models/pressure-") || path.includes("/vehicle/"),
        ),
      );
      const initialScripts = before.filter(
        ({ path }) => path.startsWith("/_next/") && path.endsWith(".js"),
      );
      initialJs = initialScripts.reduce((total, row) => total + row.gzipBytes, 0);

      const toggle = page.getByRole("button", { name: "Pressure", exact: true });
      const coldTiming = await armEdit(page, toggle, "click");
      await toggle.click();
      cold.push(await coldTiming());
      const after = await resources(page);
      assert.equal(after.filter(({ path }) => path === model).length, 1);
      assert.equal(requests.filter((path) => path.endsWith(".wasm")).length, 1);
      transfer = after.filter(({ path }) => !before.some((row) => path === row.path));
      if (run === 0) {
        const scripts = after.filter(
          ({ path }) => path.startsWith("/_next/") && path.endsWith(".js"),
        );
        const found = [];
        for (const { path } of scripts) {
          const content = await (await page.request.get(new URL(path, origin).href)).text();
          if (content.includes("ML-predicted surface pressure coefficient")) found.push(path);
        }
        assert.equal(found.length, 1, "Expected one pressure view chunk");
        assert(
          !before.some(({ path }) => path === found[0]),
          "Pressure view loaded before activation",
        );
      }

      const angle = page.getByLabel("Pressure angle");
      for (let edit = 0; edit < 6; edit++) {
        const hotTiming = await armEdit(page, angle, "change");
        await angle.selectOption(edit % 2 ? "4" : "6");
        warm.push(await hotTiming());
      }
      await page.close();
    }
    profiles.push({
      name,
      initialJs,
      transfer,
      cold,
      warm,
      coldMedianMs: quantile(cold, 0.5),
      warmMedianMs: quantile(warm, 0.5),
      warmP95Ms: quantile(warm, 0.95),
    });
  }
  const report = { browser: browser.version(), profiles };
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  assert(
    profiles.every(({ warmP95Ms }) => warmP95Ms <= 150),
    "Pressure edit-to-plot p95 exceeds 150 ms",
  );
} finally {
  await browser.close();
}
