import { test, expect } from "@playwright/test";

test("telemetry names best, better and worse and clears session bars outside the domain", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio/?view=airfoil");
  const clDelta = page.locator(".v2-metric").first().locator(".metric-delta");
  const edit = page.getByRole("button", { name: "Edit parameters", exact: true });
  const close = page.getByRole("button", { name: "Close Design parameters", exact: true });
  async function camber(value: string) {
    if (await edit.isVisible()) await edit.click();
    await page.getByLabel("Maximum camber", { exact: true }).fill(value);
    if (await close.isVisible()) await close.click();
    await expect(page.getByLabel("Prediction status")).toContainText("Prediction ready");
  }
  await expect(clDelta).toContainText("Baseline");
  await camber("4");
  await expect(clDelta).toContainText("Session best");
  await expect(
    page.getByRole("meter", { name: "CL session position", exact: true }),
  ).toHaveAttribute("aria-valuenow", "100");
  await camber("3");
  await expect(clDelta).toContainText("Better");
  const position = Number(
    await page
      .getByRole("meter", { name: "CL session position", exact: true })
      .getAttribute("aria-valuenow"),
  );
  expect(position).toBeGreaterThan(0);
  expect(position).toBeLessThan(100);
  await camber("1");
  await expect(clDelta).toContainText("Worse");
  expect(
    await clDelta.evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
  ).toBeGreaterThanOrEqual(13);
  expect(
    await page.getByTestId("cl").evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("none");
  if (await edit.isVisible()) await edit.click();
  await page.getByLabel("Angle of attack", { exact: true }).fill("12");
  if (await close.isVisible()) await close.click();
  await expect(page.getByTestId("cl")).toHaveText("—");
  await expect(page.getByRole("meter")).toHaveCount(0);
  await expect(clDelta).toHaveText("Δ —");
});

test("View keeps primary actions visible and returns keyboard focus after Escape and Tour", async ({
  page,
}) => {
  await page.goto("/studio/?view=airfoil");
  const view = page.getByRole("button", { name: "View", exact: true });
  const light = page.getByRole("button", { name: "Light theme", exact: true });
  await expect(light).not.toBeVisible();
  for (const name of ["Optimize", "Share"])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Model evidence", exact: true })).toBeVisible();
  await view.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(light).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("Escape");
  await expect(view).toBeFocused();
  await expect(view).toHaveAttribute("aria-expanded", "false");
  await view.click();
  await page.getByRole("button", { name: "Tour", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "AeroForge tour" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "AeroForge tour" })).not.toBeVisible();
  await expect(view).toBeFocused();
  await view.click();
  await page.getByRole("button", { name: "Analysis", exact: true }).click();
  await expect(view).toHaveAttribute("aria-expanded", "false");
});

test("desktop rail keeps the live operating point within the viewport", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Compact screens use the existing parameter sheet.");
  await page.goto("/studio/?view=airfoil");
  const point = page.getByLabel("Operating point", { exact: true });
  await expect(point).toContainText("250,000");
  await page.getByLabel("Angle of attack", { exact: true }).fill("5");
  await expect(point).toContainText("5°");
  const bounds = await point.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);
});

test("swatches support arrow keys and share the persisted landing and studio colorway", async ({
  page,
}) => {
  await page.goto("/");
  const ember = page.getByRole("radio", { name: "Ember Works" });
  await ember.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Ion Velocity" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Ion Velocity" })).toBeFocused();
  await expect(page).toHaveURL(/livery=ion/);
  await page.keyboard.press("ArrowLeft");
  await expect(ember).toBeChecked();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("radio", { name: "Violet Apex" })).toBeChecked();
  await page.goto("/studio/?view=airfoil");
  await expect(page.getByRole("radio", { name: "Violet Apex" })).toBeChecked();
  await page.reload();
  await expect(page.getByRole("radio", { name: "Violet Apex" })).toBeChecked();
});

test("desktop scroll reuses one camera and colors its wing from pressure", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Phones keep the still preview and native scrolling.");
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/lenis/);
  await page.locator('[data-render-status="ready"]').waitFor();
  await expect(page.locator("canvas")).toHaveCount(1);
  const before = await page.locator("canvas").screenshot();
  await page.locator("#shape").scrollIntoViewIfNeeded();
  await expect
    .poll(async () => (await page.locator("canvas").screenshot()).equals(before))
    .toBe(false);
  await page.locator("#pressure").scrollIntoViewIfNeeded();
  await expect(page.locator('[data-pressure-surface="ready"]')).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.getByRole("link", { name: "Enter design studio", exact: true }).first().click();
  await expect(page.getByRole("dialog", { name: "AeroForge tour" })).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/lenis/);
});

test("landing chapters are reachable with native anchors and both studio entries work", async ({
  page,
}) => {
  await page.goto("/");
  for (const name of ["Shape", "Pressure", "Compare", "Evidence", "Start"]) {
    await page
      .getByRole("navigation", { name: "Landing chapters" })
      .getByRole("link", { name: new RegExp(name) })
      .click();
    await expect(page.locator(`#${name.toLowerCase()}`)).toBeInViewport();
  }
  await expect(page.getByRole("link", { name: "Enter design studio", exact: true })).toHaveCount(2);
  await page.getByRole("link", { name: "Enter design studio", exact: true }).last().click();
  await expect(page.getByRole("dialog", { name: "AeroForge tour" })).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/lenis/);
});

test("reduced motion keeps the complete static story without Lenis", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".landing")).toHaveAttribute("data-scroll-motion", "static");
  await expect(page.locator("html")).not.toHaveClass(/lenis/);
  for (const id of ["shape", "pressure", "compare", "evidence"]) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Honest limits" })).toContainText(
    "100,000–500,000",
  );
});
