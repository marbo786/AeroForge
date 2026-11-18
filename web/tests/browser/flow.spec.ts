import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.use({ launchOptions: { args: ["--enable-unsafe-swiftshader"] } });

test("surface colors carry frozen pressure values and smoke clears at unsupported flow", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const golden = JSON.parse(
    await readFile(new URL("../../../artifacts/pressure-v1/parity.json", import.meta.url), "utf8"),
  );
  const [m, p, t, alpha, re] = golden.features[0];
  await page.goto(
    `/studio/?view=airfoil&m=${m / 100}&p=${p / 10}&t=${t / 100}&aoa=${alpha}&re=${re}`,
  );
  await page.getByRole("button", { name: "Surface Cp", exact: true }).click();
  const study = page.getByRole("region", { name: "Pressure-driven section study" });
  await expect(study.locator('[data-flow-visual="surface"]')).toBeVisible();
  const actual = await study
    .locator("[data-cp]")
    .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("data-cp"))));
  const expected = golden.cp[0].flatMap((side: number[]) => side.slice(0, 256));
  expect(actual).toHaveLength(512);
  expect(Math.max(...actual.map((value, i) => Math.abs(value - expected[i])))).toBeLessThanOrEqual(
    1e-5,
  );
  await page.getByRole("button", { name: "Smoke lines", exact: true }).click();
  await expect(study.locator(".smoke-trace")).toHaveCount(6);
  await expect(study).toContainText("not predicted streamlines or a velocity field");
  expect(
    await study
      .locator(".smoke-trace")
      .first()
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("none");
  const edit = page.getByRole("button", { name: "Edit parameters", exact: true });
  if (await edit.isVisible()) await edit.click();
  await page.getByLabel("Reynolds number", { exact: true }).fill("240000");
  const close = page.getByRole("button", { name: "Close Design parameters", exact: true });
  if (await close.isVisible()) await close.click();
  await expect(study.getByRole("status")).toContainText(
    "Choose a sampled angle and Reynolds number",
  );
  await expect(study.locator("[data-flow-visual]")).toHaveCount(0);
});

test("flow respects known rejected pressure cases without fetching the graph", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/studio/?view=airfoil&m=0&p=0&t=.08&aoa=8&re=100000");
  await page.getByRole("button", { name: "Surface Cp", exact: true }).click();
  await expect(page.getByRole("region", { name: "Pressure-driven section study" })).toContainText(
    "XFOIL run did not pass the data checks",
  );
  expect(requests.some((url) => url.endsWith("pressure-v1.onnx"))).toBe(false);
});

test("failed flow pressure shows no colors and can retry", async ({ page }) => {
  await page.route("**/pressure-v1.onnx", (route) =>
    route.fulfill({ status: 404, body: "Missing" }),
  );
  await page.goto("/studio/?view=airfoil");
  await page.getByRole("button", { name: "Surface Cp", exact: true }).click();
  const study = page.getByRole("region", { name: "Pressure-driven section study" });
  await expect(study.getByRole("status")).toContainText("Pressure unavailable");
  await expect(study.locator("[data-flow-visual]")).toHaveCount(0);
  await page.unroute("**/pressure-v1.onnx");
  await study.getByRole("button", { name: "Retry flow pressure" }).click();
  await expect(study.locator('[data-flow-visual="surface"]')).toBeVisible();
});

test("the live car section changes geometry and accepts the same Cp surface", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/studio/");
  const bay = page.locator(".inspection-bay");
  await expect(bay).toHaveAttribute("data-render-status", "ready");
  await page.getByRole("button", { name: "Inspect front wing", exact: true }).click();
  const canvas = bay.locator("canvas");
  const before = await canvas.screenshot();
  await page.getByLabel("Thickness", { exact: true }).fill("14");
  await expect(bay).toHaveAttribute("data-section-geometry", "0.02/0.4/0.14");
  await expect.poll(async () => !(await canvas.screenshot()).equals(before)).toBe(true);
  await page.getByRole("button", { name: "Surface Cp", exact: true }).click();
  await expect(bay).toHaveAttribute("data-pressure-surface", "ready");
  await expect(page.locator('[data-flow-visual="surface"]')).toBeVisible();
});
