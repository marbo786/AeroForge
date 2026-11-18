import { chromium, expect, test, type Locator, type Page } from "@playwright/test";
import { generateGeometry, type Parameters } from "../../lib/geometry/naca4";

const canvas = (page: Page) => page.locator(".inspection-render canvas");
const bay = (page: Page) => page.locator(".inspection-bay");
const inspection = (page: Page) => page.getByRole("region", { name: "Front wing", exact: true });
const wingButton = (page: Page) =>
  page.getByRole("button", { name: "Inspect front wing", exact: true });
const returnButton = (page: Page) =>
  page.getByRole("button", { name: "Return to car", exact: true });
const pitchLabel = (page: Page) =>
  page.getByText("Wing pitch is illustrative, not a simulation.", { exact: true });
const alpha = (page: Page) =>
  page.getByRole("slider", { name: "Angle of attack slider", exact: true });

async function expectOutline(outline: Locator, design: Parameters) {
  const expected = generateGeometry(design).contour.flatMap(([x, y]) => [x, -y]);
  const actual = (await outline.getAttribute("points"))!.trim().split(/\s+/).map(Number);
  expect(actual).toHaveLength(expected.length);
  expect(Math.max(...actual.map((value, index) => Math.abs(value - expected[index])))).toBeLessThan(
    1e-13,
  );
}

test("the phone keeps the live wing section in view while editing its parameters", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile");
  await page.goto("/studio/");
  await wingButton(page).tap();
  await expect(bay(page).getByRole("img")).toBeVisible();
  await page.getByRole("button", { name: "Edit parameters" }).tap();
  const sheet = page.getByRole("dialog", { name: "Design parameters" });
  await sheet.getByLabel("Airfoil preset").selectOption("0012");
  const inset = sheet.getByRole("img", { name: "Representative NACA section" });
  await expect(sheet.getByLabel("Camber position", { exact: true })).toBeDisabled();
  await expectOutline(inset.locator("polygon"), { m: 0, p: 0, t: 0.12 });
  const outline = await inset.locator("polygon").getAttribute("points");
  const angle = sheet.getByLabel("Angle of attack", { exact: true });
  await angle.scrollIntoViewIfNeeded();
  await angle.fill("8");
  await expect(inset).toBeInViewport({ ratio: 1 });
  await expect(inset.locator("g")).toHaveAttribute("transform", "rotate(8 .25 0)");
  await expect(inset.locator("polygon")).toHaveAttribute("points", outline!);
  await sheet.getByRole("button", { name: "Close Design parameters" }).tap();
  await expect(inspection(page).locator("g")).toHaveAttribute("transform", "rotate(8 .25 0)");
  await expect(page.getByRole("status", { name: "Prediction status" })).toHaveText(
    "Prediction ready",
  );
});

test.use({ launchOptions: { args: ["--enable-unsafe-swiftshader"] } });

async function frame(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  return canvas(page).screenshot();
}

async function frontWingPoint(page: Page, mobile = false) {
  await page.getByRole("button", { name: "Front", exact: true }).click();
  await canvas(page).scrollIntoViewIfNeeded();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const box = (await canvas(page).boundingBox())!;
  const candidates = [
    [0.3, mobile ? 0.58 : 0.606],
    ...[0.5, 0.56, 0.62, 0.68, 0.74, 0.8].flatMap((y) =>
      [0.3, 0.4, 0.2, 0.6, 0.7, 0.8].map((x) => [x, y]),
    ),
  ];
  for (const [x, y] of candidates) {
    const point = { x: box.x + box.width * x, y: box.y + box.height * y };
    await page.mouse.move(point.x, point.y);
    if ((await canvas(page).evaluate((node) => getComputedStyle(node).cursor)) === "pointer")
      return point;
  }
  throw new Error("No selectable front-wing point found in the rendered view.");
}

test("click and keyboard focus the same wing and Return restores the prior camera", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio/");
  await expect(bay(page)).toHaveAttribute("data-render-status", "ready");
  await frontWingPoint(page);
  await page.getByRole("button", { name: "Zoom in" }).click();
  const overview = await frame(page);
  await wingButton(page).focus();
  await page.keyboard.press("Enter");
  await expect(inspection(page)).toBeVisible();
  await expect(returnButton(page)).toBeFocused();
  const keyboardView = await frame(page);
  expect(keyboardView.equals(overview)).toBe(false);

  await returnButton(page).press("Enter");
  await expect(inspection(page)).toHaveCount(0);
  await expect(wingButton(page)).toBeFocused();
  expect((await frame(page)).equals(overview)).toBe(true);

  const point = await frontWingPoint(page);
  await page.mouse.move(point.x, point.y);
  await expect(canvas(page)).toHaveCSS("cursor", "pointer");
  await page.mouse.click(point.x, point.y);
  await expect(returnButton(page)).toBeFocused();
  await expect(page.getByRole("status", { name: "Component selection" })).toContainText(
    "Front wing selected",
  );
  expect((await frame(page)).equals(keyboardView)).toBe(true);
  await inspection(page).getByRole("button", { name: "Open Airfoil editor" }).click();
  await expect(canvas(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Studio", exact: true }).click();
  await expect(bay(page)).toHaveAttribute("data-render-status", "ready");
  await expect.poll(async () => (await frame(page)).equals(keyboardView)).toBe(true);

  await returnButton(page).click();
  const dragStart = await frontWingPoint(page);
  await page.mouse.move(dragStart.x, dragStart.y);
  await expect(canvas(page)).toHaveCSS("cursor", "pointer");
  await page.mouse.down();
  await page.mouse.move(dragStart.x + 68, dragStart.y - 44, { steps: 6 });
  await page.mouse.up();
  await expect(inspection(page)).toHaveCount(0);

  await wingButton(page).click();
  await expect(pitchLabel(page)).toBeVisible();
  const beforePitch = await frame(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await alpha(page).fill("-4");
  await expect(inspection(page).locator("figcaption")).toContainText("-4°");
  await expect.poll(async () => !(await frame(page)).equals(beforePitch)).toBe(true);
});

test("touch pinch orbits without selection and a single tap selects the wing", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio/");
  await expect(bay(page)).toHaveAttribute("data-render-status", "poster");
  await wingButton(page).tap();
  await expect(inspection(page)).toBeVisible();
  await returnButton(page).tap();
  await page.getByRole("button", { name: "Enable 3D" }).tap();
  await expect(bay(page)).toHaveAttribute("data-render-status", "ready");
  const { x, y } = await frontWingPoint(page, true);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x, y, id: 1 },
      { x: x + 62, y, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: x - 15, y, id: 1 },
      { x: x + 78, y, id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(inspection(page)).toHaveCount(0);
  const point = await frontWingPoint(page, true);
  await page.touchscreen.tap(point.x, point.y);
  await expect(inspection(page)).toBeVisible();
  await expect(pitchLabel(page)).toBeVisible();
  const beforePitch = await frame(page);
  await page.getByRole("button", { name: "Edit parameters" }).tap();
  const controls = page.getByRole("dialog", { name: "Design parameters" });
  await controls.getByLabel("Airfoil preset").selectOption("4418");
  await alpha(page).fill("8");
  await page.keyboard.press("Escape");
  await expect(inspection(page).locator("figcaption")).toContainText("NACA 4418");
  const clamped = await frame(page);
  expect(clamped.equals(beforePitch)).toBe(false);
  await page.getByRole("button", { name: "Edit parameters" }).tap();
  await alpha(page).fill("12");
  await page.keyboard.press("Escape");
  await expect(inspection(page).locator("figcaption")).toContainText("12°");
  expect((await frame(page)).equals(clamped)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("without WebGL the section shares exact geometry and live edits with Airfoil", async ({
  baseURL,
}, info) => {
  test.skip(info.project.name !== "desktop");
  const browser = await chromium.launch({
    ...(process.platform === "win32" ? { channel: "chrome" } : {}),
    args: ["--disable-webgl"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    const vehicleLoads: string[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith(".glb")) vehicleLoads.push(request.url());
    });
    await page.goto(new URL("/studio/", baseURL).href);
    await expect(bay(page)).toHaveAttribute("data-render-status", "unsupported");
    await expect(pitchLabel(page)).toBeVisible();
    await expect(page.getByTestId("cl")).toHaveText("0.6972");
    await wingButton(page).press("Space");
    const outline = inspection(page).locator("polygon");
    const initial = await outline.getAttribute("points");
    await page.getByLabel("Thickness", { exact: true }).fill("16");
    await expect(outline).not.toHaveAttribute("points", initial!);
    await expect(page.getByTestId("cl")).not.toHaveText("0.6972");
    await expect(page.getByRole("status", { name: "Prediction status" })).toHaveText(
      "Prediction ready",
    );
    await page.getByLabel("Maximum camber", { exact: true }).fill("3.4");
    await page.getByLabel("Camber position", { exact: true }).fill("50");
    await expectOutline(outline, { m: 0.034, p: 0.5, t: 0.16 });
    await expect(page.getByRole("status", { name: "Prediction status" })).toHaveText(
      "Prediction ready",
    );
    const updated = await outline.getAttribute("points");
    const coefficient = await page.getByTestId("cl").textContent();
    await inspection(page).getByRole("button", { name: "Open Airfoil editor" }).click();
    const path = await page.getByTestId("foil-path").getAttribute("d");
    const editor = path!
      .slice(1, -2)
      .split(" L")
      .map((pair) => pair.split(",").map(Number));
    const preview = updated!.trim().split(/\s+/).map(Number);
    expect(preview).toHaveLength(editor.length * 2);
    editor.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(120 + 560 * preview[2 * i], 4);
      expect(y).toBeCloseTo(240 + 560 * preview[2 * i + 1], 4);
    });
    await page.getByRole("button", { name: "Analysis", exact: true }).click();
    await expect(page.locator(".chart-line")).toHaveCount(2);
    await page.getByRole("button", { name: "Studio", exact: true }).click();
    await expect(outline).toHaveAttribute("points", updated!);
    await expect(page.getByTestId("cl")).toHaveText(coefficient!);
    expect(vehicleLoads).toEqual([]);
  } finally {
    await browser.close();
  }
});
