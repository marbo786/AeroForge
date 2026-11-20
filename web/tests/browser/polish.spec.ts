import { test, expect } from "@playwright/test";

test("landing enters a skippable tour and remembers its completion", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Shape your aerodynamic instinct." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Enter design studio" }).first().click();
  const tour = page.getByRole("dialog", { name: "AeroForge tour" });
  await expect(tour).toBeVisible();
  for (let i = 0; i < 4; i++) await tour.getByRole("button", { name: "Next step" }).click();
  await expect(tour).toContainText("Re 100k–500k");
  await tour.getByRole("button", { name: "Start designing" }).click();
  await page.goto("/studio/?tour=1");
  await expect(tour).not.toBeVisible();
  await page.getByRole("button", { name: "View", exact: true }).click();
  await page.getByRole("button", { name: "Tour", exact: true }).click();
  await expect(tour).toBeVisible();
  await tour.getByRole("button", { name: "Skip tour" }).click();
  await expect(tour).not.toBeVisible();
});

test("theme persists across engineering views and reloads", async ({ page }) => {
  await page.goto("/studio/?view=airfoil");
  await page.getByRole("button", { name: "View", exact: true }).click();
  const theme = page.getByRole("button", { name: "Light theme", exact: true });
  await expect(theme).toHaveAttribute("aria-pressed", "false");
  await theme.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Analysis", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "View", exact: true }).click();
  await expect(theme).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /social-preview.png$/,
  );
});

test("fictional colorways restore from shared URLs", async ({ page }) => {
  await page.goto("/studio/?view=airfoil");
  await page.getByRole("radio", { name: "Ion Velocity" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-livery", "ion");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const link = await page.getByLabel("Design URL").inputValue();
  expect(new URL(link).searchParams.get("livery")).toBe("ion");
  await page.goto(link);
  await expect(page.getByRole("radio", { name: "Ion Velocity" })).toBeChecked();
});

test("illustrative track briefs set objective, angle and lift requirement", async ({ page }) => {
  await page.goto("/studio/?view=airfoil");
  await page.getByRole("button", { name: "Optimize", exact: true }).click();
  const brief = page.getByLabel("Illustrative track brief");
  await brief.selectOption("low-drag");
  await expect(page.getByRole("combobox", { name: "Objective", exact: true })).toHaveValue("drag");
  await expect(page.getByLabel("Fixed angle (°)", { exact: true })).toHaveValue("2");
  await expect(page.getByLabel("Minimum lift coefficient")).toHaveValue("0.35");
  await brief.selectOption("high-lift");
  await expect(page.getByRole("combobox", { name: "Objective", exact: true })).toHaveValue("lift");
  await expect(page.getByLabel("Fixed angle (°)", { exact: true })).toHaveValue("8");
  await page.getByRole("combobox", { name: "Objective", exact: true }).selectOption("drag");
  await expect(page.getByLabel("Minimum lift coefficient")).toHaveValue("1");
});

test("initialization lights stay still under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/selected.onnx", async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto("/studio/?view=airfoil");
    await expect(page.locator(".start-lights i")).toHaveCount(5);
    expect(
      await page
        .locator(".start-lights i")
        .first()
        .evaluate((node) => getComputedStyle(node).animationName),
    ).toBe("none");
    release();
    await expect(page.getByTestId("cl")).toHaveText("0.6972");
    await expect(page.locator(".start-lights")).toHaveCount(0);
  } finally {
    release();
  }
});

test("telemetry compares a saved baseline and clears deltas outside the domain", async ({
  page,
}) => {
  await page.goto("/studio/?view=airfoil");
  await expect(page.getByTestId("cl")).toHaveText("0.6972");
  await page.getByRole("button", { name: "Save design", exact: true }).click();
  const edit = page.getByRole("button", { name: "Edit parameters", exact: true });
  if (await edit.isVisible()) await edit.click();
  await page.getByLabel("Airfoil preset", { exact: true }).selectOption("4412");
  const close = page.getByRole("button", { name: "Close Design parameters", exact: true });
  if (await close.isVisible()) await close.click();
  await expect(page.locator(".delta-best").first()).toContainText("Session best");
  if (await edit.isVisible()) await edit.click();
  await page.getByLabel("Angle of attack", { exact: true }).fill("12");
  if (await close.isVisible()) await close.click();
  await expect(page.getByTestId("cl")).toHaveText("—");
  await expect(page.locator(".metric-delta").first()).toHaveText("Δ —");
});
