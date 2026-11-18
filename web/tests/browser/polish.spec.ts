import { test, expect } from "@playwright/test";

test("landing enters a skippable tour and remembers its completion", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Shape your aerodynamic instinct." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Enter design studio" }).click();
  const tour = page.getByRole("dialog", { name: "AeroForge tour" });
  await expect(tour).toBeVisible();
  for (let i = 0; i < 4; i++) await tour.getByRole("button", { name: "Next step" }).click();
  await expect(tour).toContainText("Re 100k–500k");
  await tour.getByRole("button", { name: "Start designing" }).click();
  await page.goto("/studio/?tour=1");
  await expect(tour).not.toBeVisible();
  await page.getByRole("button", { name: "Tour", exact: true }).click();
  await expect(tour).toBeVisible();
  await tour.getByRole("button", { name: "Skip tour" }).click();
  await expect(tour).not.toBeVisible();
});

test("theme persists across engineering views and reloads", async ({ page }) => {
  await page.goto("/studio/?view=airfoil");
  const theme = page.getByRole("button", { name: "Light theme", exact: true });
  await expect(theme).toHaveAttribute("aria-pressed", "false");
  await theme.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Analysis", exact: true }).click();
  await page.reload();
  await expect(theme).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /social-preview.png$/,
  );
});
