import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.use({ launchOptions: { args: ["--enable-unsafe-swiftshader"] } });

test("320px phones reflow the actions and fit every coefficient", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/studio/?view=airfoil");
  await expect(page.getByTestId("cl")).toHaveText("0.6972");
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await expect(page.getByRole("button", { name: "Share", exact: true })).toBeInViewport();
  const fits = await page.locator(".v2-metric .readout-number").evaluateAll((nodes) =>
    nodes.every((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect().right <= node.getBoundingClientRect().right;
    }),
  );
  expect(fits).toBe(true);
});

test("car compare uses the saved baseline and keeps phone 3D opt-in", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio/");
  await expect(page.getByTestId("cl")).toHaveText("0.6972");
  await page.getByRole("button", { name: "Save baseline", exact: true }).click();
  const edit = page.getByRole("button", { name: "Edit parameters", exact: true });
  if (await edit.isVisible()) await edit.click();
  await page.getByLabel("Airfoil preset", { exact: true }).selectOption("4412");
  const close = page.getByRole("button", { name: "Close Design parameters", exact: true });
  if (await close.isVisible()) await close.click();
  await page.getByRole("button", { name: "Compare on car", exact: true }).click();
  const comparison = page.getByRole("region", { name: "Side-by-side wing comparison" });
  await expect(comparison.getByRole("region", { name: "Current section" })).toContainText(
    "NACA 4412",
  );
  await expect(comparison.getByRole("region", { name: "Saved baseline" })).toContainText(
    "NACA 2412",
  );
  await expect(comparison.getByRole("region", { name: "Saved baseline" })).toContainText("0.6972");
  if (info.project.name === "mobile") {
    await expect(comparison.locator("canvas")).toHaveCount(0);
    await expect(comparison.getByRole("button", { name: "Enable 3D", exact: true })).toHaveCount(2);
  } else {
    await expect(comparison.locator('[data-render-status="ready"]')).toHaveCount(2);
    await expect(comparison.locator("canvas")).toHaveCount(2);
  }
  await comparison.getByRole("button", { name: "Exit car compare" }).click();
  await expect(comparison).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Compare on car", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("share exports a designed PNG with coefficients, livery and limits", async ({ page }) => {
  await page.goto("/studio/?view=airfoil&livery=ion");
  await expect(page.getByTestId("cl")).toHaveText("0.6972");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Share design", exact: true });
  const svg = decodeURIComponent(
    (await dialog.locator(".share-card img").getAttribute("src"))!.split(",").slice(1).join(","),
  );
  expect(svg).toContain("Ion Velocity");
  expect(svg).toContain("0.6972");
  expect(svg).toContain("Honest limits");
  expect(svg).toContain("No lap-time or full-car downforce prediction");
  const event = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download share card PNG" }).click();
  const download = await event;
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 675]);
  const pixel = await page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 675;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    return [...context.getImageData(2, 20, 1, 1).data];
  }, bytes.toString("base64"));
  expect(pixel).toEqual([134, 184, 255, 255]);
});

test("a completed optimizer challenge produces a shareable result card", async ({ page }) => {
  await page.goto("/studio/?view=airfoil");
  await page.getByRole("button", { name: "Optimize", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Design optimization" });
  await dialog.getByText("Geometry limits and search settings", { exact: true }).click();
  await dialog.getByLabel("Candidate evaluation limit").fill("64");
  await dialog.getByRole("button", { name: "Start search", exact: true }).click();
  const card = dialog.getByRole("region", { name: "Optimizer challenge card" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("figure")).toHaveAttribute(
    "aria-label",
    "Optimizer challenge card preview",
  );
  const url = await card.getByLabel("Design URL").inputValue();
  expect(new URL(url).searchParams.get("livery")).toBe("ember");
  const event = page.waitForEvent("download");
  await card.getByRole("button", { name: "Download share card PNG" }).click();
  expect((await event).suggestedFilename()).toContain("challenge.png");
});
