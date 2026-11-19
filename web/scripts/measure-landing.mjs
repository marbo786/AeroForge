import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const label = process.argv[2] ?? "after";
const server = spawn(process.execPath, ["scripts/serve-static.mjs"], {
  env: { ...process.env, PORT: "4182" },
  stdio: "pipe",
  windowsHide: true,
});
try {
  await new Promise((resolve) => server.stdout.once("data", resolve));
  const browser = await chromium.launch(process.platform === "win32" ? { channel: "chrome" } : {});
  const reports = [];
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        isMobile: width === 390,
        hasTouch: width === 390,
      });
      const files = new Map();
      const responses = [];
      page.on("response", (response) => {
        if (response.url().endsWith(".js"))
          responses.push(
            response
              .body()
              .then((body) => files.set(response.url(), gzipSync(body).length))
              .catch(() => {}),
          );
      });
      await page.goto("http://127.0.0.1:4182/");
      if (width === 1440)
        await page.locator('[data-render-status="ready"]').waitFor({ timeout: 60000 });
      await page.waitForTimeout(1500);
      await Promise.all(responses);
      const initialJsGzip = [...files.values()].reduce((a, b) => a + b, 0);
      await page.evaluate(() => {
        window.frameSamples = [];
        let previous = performance.now();
        function frame(now) {
          window.frameSamples.push(now - previous);
          previous = now;
          window.frameId = requestAnimationFrame(frame);
        }
        window.frameId = requestAnimationFrame(frame);
      });
      for (let i = 0; i < 32; i++) {
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(45);
      }
      const frames = await page.evaluate(() => {
        cancelAnimationFrame(window.frameId);
        return window.frameSamples.sort((a, b) => a - b);
      });
      await Promise.all(responses);
      reports.push({
        width,
        initialJsGzip,
        storyJsGzip: [...files.values()].reduce((a, b) => a + b, 0),
        frameMs: {
          p50: frames[Math.floor(frames.length * 0.5)],
          p95: frames[Math.floor(frames.length * 0.95)],
          max: frames.at(-1),
        },
        environment: "Chrome on Windows; phone emulation, not a physical device",
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  await mkdir("../docs/polish/scroll", { recursive: true });
  await writeFile(`../docs/polish/scroll/${label}.json`, JSON.stringify(reports, null, 2) + "\n");
  console.log(reports);
} finally {
  server.kill();
}
