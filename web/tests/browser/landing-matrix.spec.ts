import { test, expect } from "@playwright/test";
import type { AxeResults } from "axe-core";

test("landing stays accessible and within the viewport at five widths in both themes", async ({
  browser,
  isMobile,
  baseURL,
}) => {
  test.skip(isMobile, "The desktop project runs the entire independent viewport matrix.");
  test.setTimeout(180000);
  for (const width of [320, 390, 768, 1440, 1920]) {
    for (const theme of ["dark", "light"]) {
      const page = await browser.newPage({
        baseURL,
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
        hasTouch: width <= 390,
        isMobile: width <= 390,
      });
      try {
        await page.addInitScript((theme) => localStorage.setItem("aeroforge-theme", theme), theme);
        await page.goto("/");
        for (const id of ["shape", "pressure", "compare", "evidence"]) {
          await page.locator(`#${id}`).scrollIntoViewIfNeeded();
          await expect(page.locator(`#${id}`)).toBeInViewport();
        }
        await expect(page.locator('#pressure [data-flow-visual="surface"]')).toBeAttached({
          timeout: 20000,
        });
        await expect(page.locator("#compare .share-card img")).toBeAttached({ timeout: 20000 });
        await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
        const result = await page.evaluate(async () =>
          (
            window as unknown as {
              axe: { run: (node: Document, options: unknown) => Promise<AxeResults> };
            }
          ).axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
          }),
        );
        expect(
          result.violations.map((violation) => ({
            id: violation.id,
            targets: violation.nodes.map((node) => node.target),
          })),
          `${width}px ${theme}`,
        ).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
          ),
          `${width}px ${theme}`,
        ).toBe(true);
        await expect(page.locator("html")).not.toHaveClass(/lenis/);
        await expect(page.locator("canvas")).toHaveCount(0);
      } finally {
        await page.close();
      }
    }
  }
});

test("Tab brings each landing control into view while smooth scrolling is active", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Phones use native scrolling.");
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/lenis/);
  await page.mouse.wheel(0, 180);
  let finished = false;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const bounds = document.activeElement!.getBoundingClientRect();
          return bounds.top >= 0 && bounds.bottom <= innerHeight;
        }),
      )
      .toBe(true);
    if (await page.locator(".story-finish a:focus").count()) {
      finished = true;
      break;
    }
  }
  expect(finished).toBe(true);
});

test("changing motion preference stops Lenis and leaves the final model numbers", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  if (!isMobile) await expect(page.locator("html")).toHaveClass(/lenis/);
  await page.locator("#shape").scrollIntoViewIfNeeded();
  await expect(page.locator("#shape .story-source")).toContainText("Real browser ONNX");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".landing")).toHaveAttribute("data-scroll-motion", "static");
  await expect(page.locator("html")).not.toHaveClass(/lenis/);
  await expect(page.locator("#shape .story-readouts strong").first()).toHaveText("0.6972");
  await expect(page.locator("#shape .story-readouts strong").last()).toHaveText("0.01052");
});

test("studio entry carries its colorway when local persistence is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error("Storage unavailable");
        },
      },
    });
  });
  await page.goto("/");
  await page.getByRole("radio", { name: "Ion Velocity" }).check();
  await page.getByRole("link", { name: "Enter design studio", exact: true }).first().click();
  await page.getByRole("button", { name: "Skip tour", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Ion Velocity" })).toBeChecked();
  await expect(page).toHaveURL(/livery=ion/);
});
