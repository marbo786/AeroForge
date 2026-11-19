import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const phase = process.argv[2];
const folder = `../docs/polish/${phase}`;
await mkdir(folder, { recursive: true });
const server = spawn(process.execPath, ["scripts/serve-static.mjs"], {
  env: { ...process.env, PORT: "4175" },
  stdio: "pipe",
  windowsHide: true,
});
try {
  await new Promise((resolve) => server.stdout.once("data", resolve));
  const browser = await chromium.launch(process.platform === "win32" ? { channel: "chrome" } : {});
  const reports = [];
  try {
    for (const width of [320, 390, 768, 1440, 1920]) {
      for (const theme of ["dark", "light"]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
          reducedMotion: "reduce",
          isMobile: width < 741,
          hasTouch: width < 741,
        });
        await page.addInitScript((theme) => {
          localStorage.setItem("aeroforge-theme", theme);
          localStorage.setItem("aeroforge-tour", "done");
        }, theme);
        const views =
          phase === "scroll-a" || phase === "scroll-e"
            ? ["landing"]
            : phase === "scroll-b"
              ? ["landing", "studio"]
              : ["studio"];
        for (const view of views) {
          await page.goto(`http://127.0.0.1:4175/${view === "studio" ? "studio/" : ""}`);
          if (view === "landing") {
            for (const id of ["shape", "pressure", "compare"]) {
              await page.locator(`#${id}`).scrollIntoViewIfNeeded();
              await page.waitForTimeout(800);
            }
            await page
              .locator('#pressure [data-flow-visual="surface"]')
              .waitFor({ timeout: 60000 });
            await page.locator("#compare .share-card img").waitFor({ timeout: 60000 });
            for (const id of ["start", "pressure", "compare", "evidence"]) {
              await page.locator(`#${id}`).scrollIntoViewIfNeeded();
              if (id === "start") await page.evaluate(() => scrollTo(0, 0));
              await page.screenshot({
                path: `${folder}/${width}-${theme}-${id}.png`,
                animations: "disabled",
              });
            }
          } else {
            await page
              .locator('[aria-label="Prediction status"]')
              .filter({ hasText: "Prediction ready" })
              .waitFor();
            if (width > 740) await page.locator('[data-render-status="ready"]').waitFor();
            await page.screenshot({
              path: `${folder}/${width}-${theme}-studio.png`,
              fullPage: true,
              animations: "disabled",
            });
          }
          await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
          const violations = await page.evaluate(async () =>
            (
              await window.axe.run(document, {
                runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
              })
            ).violations.map(({ id, nodes }) => ({ id, targets: nodes.map((n) => n.target) })),
          );
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
          );
          reports.push({ width, theme, view, violations, overflow });
        }
        await page.close();
      }
    }
    if (phase === "scroll-a" || phase === "scroll-e") {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto("http://127.0.0.1:4175/");
      await page.locator('[data-render-status="ready"]').waitFor();
      for (const id of ["start", "shape", "pressure", "compare"]) {
        await page.locator(`#${id}`).scrollIntoViewIfNeeded();
        if (id === "start") await page.evaluate(() => scrollTo(0, 0));
        if (id === "pressure") await page.locator('[data-pressure-surface="ready"]').waitFor();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${folder}/1440-motion-${id}.png` });
      }
      await page.close();
    }
    await writeFile(`${folder}/audit.json`, JSON.stringify(reports, null, 2) + "\n");
    assert(
      reports.every((r) => !r.overflow && !r.violations.length),
      JSON.stringify(reports.filter((r) => r.overflow || r.violations.length)),
    );
    console.log(`${reports.length} states: zero WCAG A/AA violations and zero overflow`);
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}
