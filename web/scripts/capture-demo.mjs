import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const folder = ".wrangler/scroll-demo";
await mkdir(folder, { recursive: true });
const server = spawn(process.execPath, ["scripts/serve-static.mjs"], {
  env: { ...process.env, PORT: "4184" },
  stdio: "pipe",
  windowsHide: true,
});
try {
  await new Promise((resolve) => server.stdout.once("data", resolve));
  const browser = await chromium.launch(process.platform === "win32" ? { channel: "chrome" } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript(() => {
      localStorage.setItem("aeroforge-tour", "done");
      document.addEventListener("DOMContentLoaded", () => {
        const caption = document.createElement("div");
        caption.id = "demo-caption";
        caption.setAttribute("aria-hidden", "true");
        caption.style.cssText =
          "position:fixed;bottom:12px;left:12px;z-index:10000;padding:12px 16px;background:#101419;color:#eef1f4;border-left:3px solid #ff9559;font:14px Arial;pointer-events:none;box-shadow:0 4px 18px #0005";
        document.body.append(caption);
        const cursor = document.createElement("i");
        cursor.setAttribute("aria-hidden", "true");
        cursor.style.cssText =
          "position:fixed;top:-50px;left:-50px;width:18px;height:18px;border:2px solid #ff9559;border-radius:50%;z-index:10001;pointer-events:none";
        document.body.append(cursor);
        document.addEventListener("mousemove", (event) => {
          cursor.style.left = `${event.clientX - 9}px`;
          cursor.style.top = `${event.clientY - 9}px`;
        });
      });
    });
    const origin = "http://127.0.0.1:4184";
    await page.goto(origin + "/");
    await page.locator('[data-render-status="ready"]').waitFor();
    const car = await page.locator("canvas").screenshot();
    const card = await browser.newPage({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1,
    });
    const font = (await readFile("app/fonts/BarlowSemiCondensed-Bold.ttf")).toString("base64");
    await card.setContent(
      `<html><style>@font-face{font-family:Barlow;src:url(data:font/ttf;base64,${font})}*{box-sizing:border-box}body{margin:0;background:#101419;color:#eef1f4;font-family:Arial}h1{font:700 76px/.98 Barlow;text-transform:uppercase;max-width:540px;margin:68px 0 28px}img{position:absolute;right:0;top:110px;width:720px}main{position:relative;padding:44px 48px}p{font-size:22px}.limit{position:absolute;left:48px;top:535px;font-size:17px;line-height:1.6;color:#b0bcc6}.accent{color:#ff9559;font-size:22px}</style><body><img src="data:image/png;base64,${car.toString("base64")}"><main><p class="accent">AeroForge / AF–02</p><h1>Shape your<br>aerodynamic instinct.</h1><p>Scroll from shape to pressure.</p></main><p class="limit">Honest limits · Illustrative car and wing pitch · Isolated NACA predictions<br>α −4° to 8° · Re 100k–500k · No full-car downforce or lap-time prediction</p></body></html>`,
    );
    await card.evaluate(() => document.fonts.ready);
    await card.screenshot({ path: "public/social-preview.png" });
    await card.close();
    const chapters = [];
    const frames = [];
    async function caption(text) {
      chapters.push(text);
      await page.evaluate((text) => {
        document.getElementById("demo-caption").textContent =
          `${text}  |  Illustrative car · isolated sections · α −4° to 8° · Re 100k–500k`;
      }, text);
    }
    let recording = true;
    let captureError;
    const start = Date.now();
    const recorder = (async () => {
      while (recording) {
        if (
          !(await page
            .locator("#demo-caption")
            .textContent()
            .catch(() => ""))
        ) {
          await page.waitForTimeout(120);
          continue;
        }
        const file = `${folder}/${String(frames.length).padStart(4, "0")}.png`;
        const time = Date.now() - start;
        await page.screenshot({ path: file });
        frames.push({ file, time });
        await page.waitForTimeout(120);
      }
    })().catch((error) => {
      captureError = error;
      recording = false;
    });
    try {
      await caption("Explore the AF–02");
      await page.waitForTimeout(1000);
      for (const [id, text] of [
        ["shape", "Shape the section"],
        ["pressure", "See the pressure"],
        ["compare", "Compare and share"],
      ]) {
        await caption(text);
        const distance = await page
          .locator(`#${id}`)
          .evaluate((node) => node.getBoundingClientRect().top - 85);
        for (let i = 0; i < 5; i++) {
          await page.mouse.wheel(0, distance / 5);
          await page.waitForTimeout(170);
        }
        if (id === "shape") {
          await page.getByRole("button", { name: "4412", exact: true }).click();
        }
        if (id === "pressure") await page.locator('[data-pressure-surface="ready"]').waitFor();
        await page.waitForTimeout(900);
      }
      await caption("Choose an original fictional colorway");
      await page.getByRole("radio", { name: "Ion Velocity" }).check();
      await page.waitForTimeout(1200);
      await page.goto(origin + "/studio/?livery=ion");
      await page.locator('[data-render-status="ready"]').waitFor();
      await caption("Save a baseline");
      await page.getByRole("button", { name: "Save baseline", exact: true }).click();
      await page.waitForTimeout(800);
      await page.getByRole("button", { name: "Airfoil", exact: true }).click();
      await caption("Drag the live section");
      const before = await page.getByTestId("cl").innerText();
      const handle = page.locator(".geometry-handle.camber .handle-dot");
      await handle.scrollIntoViewIfNeeded();
      const bounds = await handle.boundingBox();
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.mouse.down();
      for (let step = 1; step <= 12; step++) {
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 - step);
        await page.waitForTimeout(60);
      }
      await page.mouse.up();
      await page.waitForFunction((before) => {
        const value = document.querySelector('[data-testid="cl"]')?.textContent;
        return value && value !== "—" && value !== before;
      }, before);
      await page.waitForTimeout(1200);
      await caption("Inspect ML-predicted Surface Cp");
      await page.getByRole("button", { name: "Surface Cp", exact: true }).click();
      await page.locator('[data-flow-visual="surface"]').scrollIntoViewIfNeeded();
      await page.waitForTimeout(1600);
      await page.getByRole("button", { name: "Studio", exact: true }).click();
      await page.getByRole("button", { name: "Compare on car", exact: true }).click();
      await page.waitForFunction(
        () =>
          document.querySelectorAll('.car-comparison [data-render-status="ready"]').length === 2,
      );
      const sections = await page
        .locator(".car-comparison [data-section-geometry]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-section-geometry")));
      assert.equal(
        new Set(sections).size,
        2,
        "The recorded comparison must contain two different sections",
      );
      await page.locator(".car-comparison").scrollIntoViewIfNeeded();
      await caption("Compare isolated sections on the illustrative car");
      await page.waitForTimeout(2000);
    } finally {
      recording = false;
      await recorder;
    }
    if (captureError) throw captureError;
    await writeFile(
      `${folder}/frames.json`,
      JSON.stringify({ viewport: { width: 1280, height: 800 }, chapters, frames }, null, 2),
    );
    console.log(
      `Captured ${frames.length} frames across ${chapters.length} chapters; updated static social preview.`,
    );
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}
