import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
const output = process.argv[2] ?? "../docs/ui-redesign/frame-profile.json";
const server = spawn(process.execPath, ["scripts/serve-static.mjs"], {
  env: { ...process.env, PORT: "4176" },
  stdio: "pipe",
  windowsHide: true,
});
try {
  await new Promise((resolve, reject) => {
    server.stdout.once("data", resolve);
    server.once("error", reject);
  });
  const browser = await chromium.launch(process.platform === "win32" ? { channel: "chrome" } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => {
      window.auditReactCommits = 0;
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        supportsFiber: true,
        inject: () => 1,
        onCommitFiberRoot: () => {
          window.auditReactCommits++;
        },
      };
    });
    await page.goto("http://127.0.0.1:4176/");
    await page
      .getByRole("status")
      .filter({ hasText: "Prediction ready" })
      .waitFor({ state: "attached" });
    await page.locator(".spark-line").first().waitFor();
    const box = await page.locator(".geometry-handle.camber .handle-dot").boundingBox();
    if (!box) throw new Error("Camber handle unavailable.");
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    const commitsBefore = await page.evaluate(() => window.auditReactCommits);
    await page.mouse.move(x, y);
    await page.mouse.down();
    const sampling = page.evaluate(
      () =>
        new Promise((resolve) => {
          const intervals = [];
          let last = performance.now();
          function sample(now) {
            intervals.push(now - last);
            last = now;
            if (intervals.length < 180) requestAnimationFrame(sample);
            else resolve(intervals.slice(1));
          }
          requestAnimationFrame(sample);
        }),
    );
    for (let i = 0; i < 120; i++) {
      await page.mouse.move(x, y - 14 * Math.sin(i / 16));
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    const intervals = await sampling;
    const sorted = [...intervals].sort((a, b) => a - b);
    const dragCommits = (await page.evaluate(() => window.auditReactCommits)) - commitsBefore;
    const chart = await page.getByRole("button", { name: "Charts +", exact: true }).evaluate(
      (button) =>
        new Promise((resolve) => {
          const start = performance.now();
          const observer = new MutationObserver(() => {
            if (!document.querySelector("dialog[open] .chart-line")) return;
            observer.disconnect();
            resolve(performance.now() - start);
          });
          observer.observe(document.body, { subtree: true, childList: true, attributes: true });
          button.click();
        }),
    );
    await page.keyboard.press("Escape");
    const cdp = await page.context().newCDPSession(page);
    async function heap() {
      await cdp.send("HeapProfiler.collectGarbage");
      return (await cdp.send("Runtime.getHeapUsage")).usedSize;
    }
    const heapBefore = await heap();
    for (let count = 0; count < 12; count++) {
      await page.getByRole("button", { name: "Charts +", exact: true }).click();
      await page.locator("dialog[open] .chart-line").first().waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
    }
    const heapAfter = await heap();
    const report = {
      viewport: { width: 1440, height: 900 },
      browser: browser.version(),
      samples: intervals.length,
      medianMs: sorted[Math.floor(sorted.length * 0.5)],
      p95Ms: sorted[Math.floor(sorted.length * 0.95)],
      meanMs: intervals.reduce((a, b) => a + b, 0) / intervals.length,
      framesOver25Ms: intervals.filter((v) => v > 25).length,
      dragCommits,
      chartPathReadyMs: chart,
      heapBefore,
      heapAfter,
      chartCycles: 12,
      scope:
        "Local Chrome drag frame intervals and root commit count. Chart timing ends at DOM insertion. Heap is the page isolate after forced GC.",
    };
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report));
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}
