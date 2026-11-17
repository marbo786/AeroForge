import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const dialog = (page: Page) => page.getByRole("dialog", { name: "Design optimization" });
const status = (page: Page) => dialog(page).getByRole("status", { name: "Search status" });

async function open(page: Page, evaluations: number) {
  await page.getByRole("button", { name: "Optimize", exact: true }).click();
  await dialog(page).getByText("Geometry limits and search settings", { exact: true }).click();
  await dialog(page).getByLabel("Candidate evaluation limit").fill(String(evaluations));
}

test("worker searches with the shared model, exports a shortlist and applies or reverts a design", async ({
  page,
}) => {
  const assets: string[] = [];
  const workers: string[] = [];
  page.on("request", (request) => assets.push(new URL(request.url()).pathname));
  page.on("worker", (worker) => workers.push(worker.url()));
  await page.goto("/studio/?view=airfoil");
  await expect(page.getByTestId("cl")).toHaveText("0.6972");
  expect(assets.some((path) => path.includes("/vehicle/"))).toBe(false);
  expect(workers.filter((url) => url.includes("/_next/"))).toHaveLength(0);
  await open(page, 64);
  await dialog(page).getByRole("button", { name: "Start search" }).click();
  await expect(status(page)).toHaveText("Search complete");
  await expect(dialog(page).getByText("64 of 64 candidate evaluations completed")).toBeVisible();
  await expect(
    dialog(page).getByRole("heading", { name: "Surrogate-predicted candidate" }),
  ).toBeVisible();
  await expect(
    dialog(page).getByRole("img", { name: "Representative NACA section" }).locator("polygon"),
  ).toHaveCount(2);
  expect(workers.filter((url) => url.includes("/_next/"))).toHaveLength(1);
  expect(assets.filter((path) => path.endsWith("/selected.onnx"))).toHaveLength(1);
  const downloadPromise = page.waitForEvent("download");
  await dialog(page).getByRole("button", { name: "Export XFOIL shortlist" }).click();
  const download = await downloadPromise;
  const result = JSON.parse(await readFile((await download.path())!, "utf-8"));
  expect(result.schema).toBe("aeroforge-optimizer-v1");
  expect(result.original).toEqual({ m: 0.02, p: 0.4, t: 0.12, alpha: 4, re: 250000 });
  expect(result.result.baseline.prediction.cl).toBeCloseTo(0.6972, 4);
  expect(result.result.counts).toMatchObject({ baselineRows: 1, submitted: 64, completed: 64 });
  const candidate = result.result.shortlist[0];
  await dialog(page).getByRole("button", { name: "Apply to Studio" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Studio", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("cl")).toHaveText(candidate.prediction.cl.toFixed(4));
  await page.getByRole("button", { name: "Optimize", exact: true }).click();
  await dialog(page).getByRole("button", { name: "Revert applied design" }).click();
  await expect(page.getByTestId("cl")).toHaveText("0.6972");
});

test("cancelling before coverage is ready leaves a later run usable", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  let release: () => void = () => {};
  const coverage = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/coverage-v1.json", async (route) => {
    await coverage;
    await route.continue();
  });
  await page.goto("/studio/?view=airfoil");
  await expect(page.getByTestId("cl")).toHaveText("0.6972");
  await open(page, 16);
  await dialog(page).getByRole("button", { name: "Start search" }).click();
  await dialog(page).getByRole("button", { name: "Cancel search" }).click();
  await expect(status(page)).toHaveText("Search cancelled");
  await expect(dialog(page).getByTestId("search-counts")).toContainText("0 submitted");
  release();
  await dialog(page).getByRole("button", { name: "Start search" }).click();
  await expect(status(page)).toHaveText("Search complete");
  await expect(dialog(page).getByText("16 of 16 candidate evaluations completed")).toBeVisible();
});

test("cancelling an in-flight batch preserves the submitted count and ignores its late reply", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop");
  type Gate = { armed: boolean; accepted: number; send: (() => void)[] };
  type GateWindow = typeof window & { optimizationGate: Gate };
  await page.addInitScript(() => {
    const gate = { armed: false, accepted: 0, send: [] } as Gate;
    (window as GateWindow).optimizationGate = gate;
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message, transfer) {
      const send = () =>
        Reflect.apply(post, this, transfer === undefined ? [message] : [message, transfer]);
      if (gate.armed && message?.type === "run" && ++gate.accepted > 1) gate.send.push(send);
      else send();
    };
  });
  await page.goto("/studio/?view=airfoil");
  await expect(page.getByTestId("cl")).toHaveText("0.6972");
  await open(page, 128);
  await page.evaluate(() => {
    (window as GateWindow).optimizationGate.armed = true;
  });
  await dialog(page).getByRole("button", { name: "Start search" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as GateWindow).optimizationGate.send.length))
    .toBe(1);
  await dialog(page).getByRole("button", { name: "Cancel search" }).click();
  await expect(status(page)).toHaveText("Search cancelled");
  await expect(dialog(page).getByText("0 of 128 candidate evaluations completed")).toBeVisible();
  const counts = await dialog(page).getByTestId("search-counts").textContent();
  expect(counts).toMatch(/(?:[1-9]|1[0-6]) submitted/);
  await page.evaluate(() => {
    const gate = (window as GateWindow).optimizationGate;
    gate.armed = false;
    gate.send.splice(0).forEach((send) => send());
  });
  await dialog(page).getByLabel("Candidate evaluation limit").fill("16");
  await dialog(page).getByRole("button", { name: "Start search" }).click();
  await expect(status(page)).toHaveText("Search complete");
  await expect(dialog(page).getByText("16 of 16 candidate evaluations completed")).toBeVisible();
});
