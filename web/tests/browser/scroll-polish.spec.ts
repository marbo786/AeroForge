import { test, expect } from "@playwright/test";

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
