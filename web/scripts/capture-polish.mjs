import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const phase = process.argv[2] ?? "phase-1";
assert(/^phase-[1-5]$/.test(phase));
const folder = `../docs/polish/${phase}`;
await mkdir(folder, { recursive: true });
const server = spawn(process.execPath, ["scripts/serve-static.mjs"], {
  env: { ...process.env, PORT: "4175" },
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
    for (const width of [1440, 768, 390, ...(phase === "phase-5" ? [320] : [])]) {
      const page = await browser.newPage({
        viewport: { width, height: width <= 390 ? 844 : 900 },
        reducedMotion: "reduce",
        isMobile: width <= 390,
        hasTouch: width <= 390,
      });
      await page.addInitScript(() => localStorage.setItem("aeroforge-tour", "done"));
      async function audit(view) {
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
        const theme = await page.evaluate(() => document.documentElement.dataset.theme ?? "dark");
        await page.screenshot({
          path: `${folder}/${width}-${theme}-${view}.png`,
          fullPage: true,
          animations: "disabled",
        });
        reports.push({ width, theme, view, violations, overflow });
      }
      for (const theme of ["dark", "light"]) {
        for (const view of ["studio", "airfoil", "analysis"]) {
          await page.goto(`http://127.0.0.1:4175/studio/?view=${view}&livery=ember`);
          await page
            .locator('[aria-label="Prediction status"]')
            .filter({ hasText: "Prediction ready" })
            .waitFor();
          await page.evaluate((theme) => {
            document.documentElement.dataset.theme = theme;
            localStorage.setItem("aeroforge-theme", theme);
          }, theme);
          if (view === "studio" && width > 740)
            await page.locator('[data-render-status="ready"]').waitFor();
          await audit(view);
        }
        if (["phase-2", "phase-3"].includes(phase)) {
          await page.goto("http://127.0.0.1:4175/");
          if (width > 740) await page.locator('[data-render-status="ready"]').waitFor();
          await audit("landing");
          await page.goto("http://127.0.0.1:4175/studio/");
          await page.getByRole("button", { name: "Tour", exact: true }).click();
          await page.getByRole("dialog", { name: "AeroForge tour" }).waitFor();
          await audit("tour");
        }
      }
      if (phase === "phase-3") {
        for (const livery of ["ion", "violet"]) {
          for (const theme of ["dark", "light"]) {
            for (const view of ["studio", "analysis"]) {
              await page.goto(`http://127.0.0.1:4175/studio/?view=${view}&livery=${livery}`);
              await page
                .locator('[aria-label="Prediction status"]')
                .filter({ hasText: "Prediction ready" })
                .waitFor();
              await page.evaluate((theme) => {
                document.documentElement.dataset.theme = theme;
                localStorage.setItem("aeroforge-theme", theme);
              }, theme);
              if (view === "studio" && width > 740)
                await page.locator('[data-render-status="ready"]').waitFor();
              await audit(`${livery}-${view}`);
            }
          }
        }
        await page.goto("http://127.0.0.1:4175/studio/?view=airfoil&livery=ember");
        await page.getByRole("button", { name: "Optimize", exact: true }).click();
        await page.getByLabel("Illustrative track brief").selectOption("low-drag");
        await audit("track-preset");
        await page.route("**/selected.onnx", () => {});
        await page.goto("http://127.0.0.1:4175/studio/?view=airfoil&livery=ember");
        await page.locator(".start-lights i").first().waitFor();
        await audit("start-lights");
      }
      if (phase === "phase-4") {
        for (const theme of ["dark", "light"]) {
          await page.goto("http://127.0.0.1:4175/studio/?view=airfoil&livery=ember");
          await page.evaluate((theme) => {
            document.documentElement.dataset.theme = theme;
            localStorage.setItem("aeroforge-theme", theme);
          }, theme);
          await page.getByRole("button", { name: "Surface Cp", exact: true }).click();
          await page.locator('[data-flow-visual="surface"]').waitFor();
          await audit("surface-cp");
          await page.getByRole("button", { name: "Smoke lines", exact: true }).click();
          await audit("smoke");
          await page.goto("http://127.0.0.1:4175/studio/?livery=ember");
          if (width > 740) await page.locator('[data-render-status="ready"]').waitFor();
          await page.getByRole("button", { name: "Inspect front wing", exact: true }).click();
          await page.getByRole("button", { name: "Surface Cp", exact: true }).click();
          await page.locator('[data-pressure-surface="ready"]').waitFor();
          await audit("wing-cp");
          for (const [name, query] of [
            ["pressure-unavailable", "m=.02&p=.4&t=.12&aoa=3&re=240000"],
            ["pressure-rejected", "m=0&p=0&t=.08&aoa=8&re=100000"],
          ]) {
            await page.goto(`http://127.0.0.1:4175/studio/?view=airfoil&${query}`);
            await page.getByRole("button", { name: "Surface Cp", exact: true }).click();
            await page
              .getByRole("region", { name: "Pressure-driven section study" })
              .getByRole("status")
              .waitFor();
            await audit(name);
          }
        }
      }
      if (phase === "phase-5") {
        for (const theme of ["dark", "light"]) {
          await page.goto("http://127.0.0.1:4175/studio/?livery=ember");
          await page.evaluate((theme) => {
            document.documentElement.dataset.theme = theme;
            localStorage.setItem("aeroforge-theme", theme);
          }, theme);
          await page
            .locator('[aria-label="Prediction status"]')
            .filter({ hasText: "Prediction ready" })
            .waitFor();
          await page.getByRole("button", { name: "Save baseline", exact: true }).click();
          const edit = page.getByRole("button", { name: "Edit parameters", exact: true });
          if (await edit.isVisible()) await edit.click();
          await page.getByLabel("Thickness", { exact: true }).fill("14");
          const close = page.getByRole("button", { name: "Close Design parameters", exact: true });
          if (await close.isVisible()) await close.click();
          await page.getByRole("button", { name: "Compare on car", exact: true }).click();
          if (width > 740)
            await page.waitForFunction(
              () =>
                document.querySelectorAll('.car-comparison [data-render-status="ready"]').length ===
                2,
            );
          await page
            .locator('[aria-label="Prediction status"]')
            .filter({ hasText: "Prediction ready" })
            .waitFor();
          await audit("car-compare");
          await page.goto("http://127.0.0.1:4175/studio/?view=airfoil&livery=ion");
          await page
            .locator('[aria-label="Prediction status"]')
            .filter({ hasText: "Prediction ready" })
            .waitFor();
          await page.getByRole("button", { name: "Share", exact: true }).click();
          await page.locator(".share-card img").waitFor();
          await audit("share-card");
          if (width === 1440 && theme === "dark") {
            const event = page.waitForEvent("download");
            await page.getByRole("button", { name: "Download share card PNG" }).click();
            await (await event).saveAs(`${folder}/share-card.png`);
          }
          await page.goto("http://127.0.0.1:4175/studio/?view=airfoil&livery=violet");
          await page.getByRole("button", { name: "Optimize", exact: true }).click();
          await page.getByText("Geometry limits and search settings", { exact: true }).click();
          await page.getByLabel("Candidate evaluation limit").fill("64");
          await page.getByRole("button", { name: "Start search", exact: true }).click();
          const challenge = page.getByRole("region", { name: "Optimizer challenge card" });
          await challenge.waitFor();
          await challenge.scrollIntoViewIfNeeded();
          await audit("challenge-card");
          if (width === 1440 && theme === "dark") {
            const event = page.waitForEvent("download");
            await challenge.getByRole("button", { name: "Download share card PNG" }).click();
            await (await event).saveAs(`${folder}/optimizer-challenge.png`);
          }
        }
      }
      await page.close();
    }
    await writeFile(`${folder}/audit.json`, JSON.stringify(reports, null, 2));
    assert(
      reports.every((r) => !r.overflow && !r.violations.length),
      JSON.stringify(reports.filter((r) => r.overflow || r.violations.length)),
    );
    const card = await browser.newPage({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1,
    });
    const poster = (await readFile("public/vehicle/af02-v1/poster.webp")).toString("base64");
    await card.setContent(
      `<html><body style="margin:0;background:#101419;color:#eef1f4;font-family:Arial"><img src="data:image/webp;base64,${poster}" style="position:absolute;right:0;top:35px;width:800px"><div style="position:relative;padding:54px"><p style="color:#ff9559;font-size:24px">AeroForge / AF–02</p><h1 style="font-size:74px;line-height:1;max-width:540px;margin:60px 0 24px">Shape your<br>aerodynamic instinct.</h1><p style="font-size:24px">Live NACA section design.</p><p style="margin-top:80px;font-size:18px;color:#b0bcc6">Honest limits · Illustrative car · Isolated 2D predictions<br>α −4° to 8° · Re 100k–500k</p></div></body></html>`,
    );
    await card.screenshot({ path: "public/social-preview.png" });
    console.log(`${reports.length} audited states: zero WCAG A/AA violations and zero overflow.`);
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}
