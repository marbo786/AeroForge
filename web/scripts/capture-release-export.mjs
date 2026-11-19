import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const folder = "../docs/polish/release";
await mkdir(folder, { recursive: true });
const server = spawn(process.execPath, ["scripts/serve-static.mjs"], {
  env: { ...process.env, PORT: "4178" },
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
    const reports = [];
    for (const width of [1440, 390, 320]) {
      for (const theme of ["dark", "light"]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
          reducedMotion: "reduce",
          isMobile: width <= 390,
          hasTouch: width <= 390,
        });
        await page.addInitScript((theme) => localStorage.setItem("aeroforge-theme", theme), theme);
        await page.goto("http://127.0.0.1:4178/studio/?view=airfoil");
        await page.getByTestId("cl").getByText("0.6972", { exact: true }).waitFor();
        await page.getByRole("button", { name: "Surface Cp", exact: true }).click();
        await page.locator('[data-flow-visual="surface"]').waitFor();
        await page.getByRole("button", { name: "Export +", exact: true }).click();
        const menu = page.getByRole("group", { name: "Export formats" });
        await menu.scrollIntoViewIfNeeded();
        const bounds = await menu.boundingBox();
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        assert(bounds.x >= 0 && bounds.x + bounds.width <= clientWidth);
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
        await page.screenshot({
          path: `${folder}/${width}-${theme}-export-menu.png`,
          fullPage: true,
          animations: "disabled",
        });
        const download = page.waitForEvent("download");
        await menu.getByRole("button", { name: "json", exact: true }).click();
        assert.equal((await download).suggestedFilename(), "naca-2412.json");
        reports.push({ width, theme, bounds, clientWidth, violations, overflow });
        await page.close();
      }
    }
    await writeFile(`${folder}/export-audit.json`, JSON.stringify(reports, null, 2));
    assert(reports.every((r) => !r.overflow && !r.violations.length));
    console.log(
      "Six export states: zero WCAG A/AA violations, zero overflow, six real JSON downloads.",
    );
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}
