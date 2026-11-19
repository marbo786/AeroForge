import { test, expect } from "@playwright/test";

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
