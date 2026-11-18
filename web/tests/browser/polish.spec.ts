import { test, expect } from "@playwright/test";

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
