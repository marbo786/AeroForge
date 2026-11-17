import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { generateGeometry } from "../../lib/geometry/naca4";

async function openControls(page: Page) {
  const toggle = page.getByRole("button", { name: "Edit parameters" });
  if (await toggle.isVisible()) await toggle.click();
}

async function closeControls(page: Page) {
  const close = page.getByRole("button", { name: "Close Design parameters" });
  if (await close.isVisible()) await close.click();
}

test("Studio starts with the car, and workspace modes share edits and comparisons", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Workspace views" });
  await expect(navigation.getByRole("button", { name: "Studio", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("heading", { name: "AF–02" })).toBeVisible();
  await expect(page.locator(".inspection-bay")).toBeVisible();
  const dock = page.getByRole("navigation", { name: "Analysis dock" });
  await expect(dock.getByRole("button", { name: "Section", exact: true })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await dock.getByRole("button", { name: "Section", exact: true }).click();
  await expect(page.getByRole("img", { name: "Representative NACA section" })).toBeVisible();
  await dock.getByRole("button", { name: "Collapse dock" }).click();
  await expect(page.getByRole("img", { name: "Representative NACA section" })).toHaveCount(0);

  const lift = page.getByTestId("cl");
  await expect(lift).toHaveText("0.6972");
  await navigation.getByRole("button", { name: "Airfoil", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("group", { name: "Airfoil at 4 degrees" })).toBeVisible();
  await page.getByRole("button", { name: "Save design", exact: true }).click();
  await openControls(page);
  await page.getByLabel("Airfoil preset").selectOption("4412");
  await page.getByLabel("Angle of attack", { exact: true }).fill("5");
  await page.getByLabel("Reynolds number", { exact: true }).fill("500000");
  await closeControls(page);
  await expect(lift).not.toHaveText("0.6972");
  await expect(lift).toHaveText(/\d+\.\d{4}/);
  const currentLift = await lift.innerText();

  await navigation.getByRole("button", { name: "Analysis", exact: true }).click();
  const analysis = page.getByRole("region", { name: "Section analysis" });
  await expect(
    analysis.getByRole("img", { name: "Lift / angle of attack", exact: true }),
  ).toBeVisible();
  await expect(
    analysis.getByRole("img", { name: "Drag / angle of attack", exact: true }),
  ).toBeVisible();
  await expect(analysis.getByRole("row", { name: /^Design / })).toContainText("NACA 2412");
  await expect(analysis.getByRole("row", { name: /^Design / })).toContainText("NACA 4412");
  await expect(analysis.getByRole("row", { name: /^Condition / })).toContainText("Re 250,000");
  await expect(analysis.getByRole("row", { name: /^Condition / })).toContainText("Re 500,000");
  await expect(analysis.locator(".v2-saved-outline")).toBeVisible();
  await expect(lift).toHaveText(currentLift);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const share = await page.getByRole("textbox", { name: "Design URL" }).inputValue();
  expect(new URL(share).searchParams.get("view")).toBe("analysis");
  expect(new URL(share).searchParams.get("re")).toBe("500000");
  await page.keyboard.press("Escape");
  await expect(analysis.getByTestId("inspect-cl")).toContainText(`Current ${currentLift}`);
  await analysis.getByRole("spinbutton", { name: "Inspect CL angle" }).fill("6.5");
  await analysis.getByRole("button", { name: "Export +", exact: true }).click();
  const download = page.waitForEvent("download");
  await analysis.getByRole("button", { name: "csv", exact: true }).click();
  const rows = (await readFile((await (await download).path())!, "utf8")).trim().split("\n");
  expect(rows).toHaveLength(26);
  expect(Number(rows.find((row) => row.startsWith("5,"))?.split(",")[1]).toFixed(4)).toBe(
    currentLift,
  );

  await navigation.getByRole("button", { name: "Studio", exact: true }).click();
  await expect(lift).toHaveText(currentLift);
  await dock.getByRole("button", { name: "Lift & drag", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Inspect CD angle" })).toHaveValue("6.5");
  await page.getByRole("button", { name: "Follow design angle" }).click();
  await expect(page.getByRole("spinbutton", { name: "Inspect CL angle" })).toHaveValue("5");
  await dock.getByRole("button", { name: "Comparison", exact: true }).click();
  await expect(page.getByRole("row", { name: /^Design / })).toContainText("NACA 4412");
  await navigation.getByRole("button", { name: "Airfoil", exact: true }).click();
  await expect(page.getByRole("group", { name: "Airfoil at 5 degrees" })).toBeVisible();
  await expect(page.getByTestId("saved-contour")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("2D deep links avoid vehicle assets and legacy links retain their design", async ({
  page,
}) => {
  const vehicleAssets: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/vehicle/")) vehicleAssets.push(request.url());
  });
  for (const mode of ["airfoil", "analysis"]) {
    await page.goto(`/studio/?view=${mode}&m=.04&p=.4&t=.12&aoa=4&re=250000`);
    await expect(page.getByRole("heading", { name: "NACA 4412", exact: true })).toBeVisible();
    await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
    await expect(page.locator(".inspection-bay")).toHaveCount(0);
  }
  expect(vehicleAssets).toEqual([]);
  const lift = await page.getByTestId("cl").innerText();
  await page.goto("/studio/?m=.04&p=.4&t=.12&aoa=4&re=250000");
  await expect(page.getByRole("heading", { name: "AF–02", exact: true })).toBeVisible();
  await expect(page.getByTestId("cl")).toHaveText(lift);
});

test("superseded ONNX results stay hidden and sweeps preserve missing rows and recover from errors", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop");
  type WorkerProbe = {
    hold: boolean;
    pending: (() => void)[];
    replies: number;
    nextBatch: "gap" | "error" | null;
  };
  type ProbeWindow = typeof window & { inferenceProbe: WorkerProbe };
  await page.addInitScript(() => {
    const control: WorkerProbe = { hold: false, pending: [], replies: 0, nextBatch: null };
    (window as ProbeWindow).inferenceProbe = control;
    const send = Worker.prototype.postMessage;
    const observed = new WeakSet<Worker>();
    Worker.prototype.postMessage = function (this: Worker, message, transfer) {
      const exactSend = () =>
        Reflect.apply(send, this, transfer === undefined ? [message] : [message, transfer]);
      if (message?.type !== "run") return exactSend();
      if (!observed.has(this)) {
        observed.add(this);
        const receive = this.onmessage;
        this.onmessage = (event) => {
          if (event.data?.type === "run") {
            control.replies++;
            const coefficients = event.data.out?.[0];
            if (coefficients?.[1]?.[0] === 25 && control.nextBatch) {
              if (control.nextBatch === "gap")
                coefficients[2][8 * 2] = NaN; // One missing sample at 0°.
              else event.data.err = "Injected batch failure";
              control.nextBatch = null;
            }
          }
          receive?.call(this, event);
        };
      }
      if (control.hold) control.pending.push(exactSend);
      else exactSend();
    };
  });
  await page.goto("/studio/?view=analysis");
  const lines = page.locator(".chart-line");
  const lift = page.getByTestId("cl");
  await expect(lift).toHaveText("0.6972");
  await expect(lines).toHaveCount(2);
  await page.evaluate(() => {
    const probe = (window as ProbeWindow).inferenceProbe;
    probe.hold = true;
    probe.replies = 0;
  });
  const thickness = page.getByLabel("Thickness", { exact: true });
  await thickness.fill("13");
  await expect
    .poll(() => page.evaluate(() => (window as ProbeWindow).inferenceProbe.pending.length))
    .toBe(2);
  await thickness.fill("16");
  await expect
    .poll(() => page.evaluate(() => (window as ProbeWindow).inferenceProbe.pending.length))
    .toBe(4);
  await page.evaluate(() =>
    (window as ProbeWindow).inferenceProbe.pending.splice(0, 2).forEach((send) => send()),
  );
  await expect
    .poll(() => page.evaluate(() => (window as ProbeWindow).inferenceProbe.replies))
    .toBe(2);
  await expect(lift).toHaveText("—");
  await expect(lines).toHaveCount(0);
  await page.evaluate(() => {
    const probe = (window as ProbeWindow).inferenceProbe;
    probe.nextBatch = "gap";
    probe.hold = false;
    probe.pending.splice(0).forEach((send) => send());
  });
  await expect(lift).toHaveText(/^\d+\.\d{4}$/);
  await expect(lines).toHaveCount(2);
  for (const line of await lines.all())
    expect((await line.getAttribute("d"))!.match(/M/g)).toHaveLength(2);
  await page.getByRole("spinbutton", { name: "Inspect CL angle" }).fill("0");
  await expect(page.getByTestId("inspect-cl")).toHaveText("Current —");
  await expect(page.getByTestId("inspect-cd")).toHaveText("Current —");

  await page.evaluate(() => {
    (window as ProbeWindow).inferenceProbe.nextBatch = "error";
  });
  await thickness.fill("17");
  await expect(page.getByRole("alert").filter({ hasText: "Current sweep." })).toContainText(
    "Sweep unavailable",
  );
  await expect(lines).toHaveCount(0);
  await page.getByRole("button", { name: "Retry current sweep" }).click();
  await expect(lines).toHaveCount(2);
  await expect(page.getByTestId("inspect-cl")).toHaveText(/Current -?\d/);
});

test("studio uses real model outputs and accurate geometry without external requests", async ({
  page,
  request,
}) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("request", (r) => {
    if (r.url().startsWith("http") && new URL(r.url()).origin !== "http://127.0.0.1:4173")
      external.push(r.url());
  });
  await page.goto("/?view=airfoil");
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  const original = await page.getByTestId("cl").innerText();
  await expect(page.getByTestId("cd")).toHaveText(/^0\.\d{5}$/);
  await expect(page.getByTestId("latency")).toHaveText(/\d+\.\d{2} ms/);
  const geometry = generateGeometry({ m: 0.02, p: 0.4, t: 0.12 });
  const expectedPath = `M${geometry.contour.map(([x, y]) => `${(120 + x * 560).toFixed(4)},${(240 - y * 560).toFixed(4)}`).join(" L")} Z`;
  await expect(page.getByTestId("foil-path")).toHaveAttribute("d", expectedPath);
  await expect(page.locator(".foil-rotation")).toHaveAttribute("transform", "rotate(4 260 240)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await openControls(page);
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name: "4418", exact: true }).click();
  await expect(page.getByLabel("Thickness", { exact: true })).toHaveValue("18");
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  await expect(page.getByTestId("cl")).not.toHaveText(original);
  await expect(page.getByTestId("foil-path")).not.toHaveAttribute("d", expectedPath);
  // Match a frozen source-model vector in original units, through visible controls.
  const golden = await (await request.get("/models/recovery-v1-complete/golden.json")).json();
  const [m, p, t, alpha, logRe] = golden.features[0] as number[];
  for (const [label, value] of [
    ["Maximum camber", m * 100],
    ["Thickness", t * 100],
    ["Angle of attack", alpha],
    ["Reynolds number", Math.round(10 ** logRe)],
  ] as const)
    await page.getByLabel(label, { exact: true }).fill(String(Number(value.toFixed(5))));
  if (m !== 0)
    await page
      .getByLabel("Camber position", { exact: true })
      .fill(String(Number((p * 100).toFixed(5))));
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  expect(
    Math.abs(Number(await page.getByTestId("cl").innerText()) - golden.expected.selected[0][0]),
  ).toBeLessThan(0.00006);
  expect(
    Math.abs(Number(await page.getByTestId("cd").innerText()) - golden.expected.selected[0][1]),
  ).toBeLessThan(0.000006);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByTestId("foil-path")).toHaveAttribute("d", expectedPath);
  await page.getByRole("button", { name: "0012", exact: true }).click();
  await expect(page.getByLabel("Camber position", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Camber position", { exact: true })).toHaveValue("0");
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test("parameters validate, withhold out-of-domain predictions and recover through keyboard sliders", async ({
  page,
}) => {
  await page.goto("/studio/?view=airfoil");
  await openControls(page);
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  await page.getByLabel("Thickness", { exact: true }).fill("");
  await expect(page.getByLabel("Thickness", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByTestId("cl")).toHaveText("—");
  await page.getByLabel("Thickness", { exact: true }).fill("14");
  await page.getByLabel("Angle of attack", { exact: true }).fill("10");
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Outside model bounds");
  await expect(page.getByTestId("cl")).toHaveText("—");
  await page.getByLabel("Angle of attack", { exact: true }).fill("4");
  await page.getByLabel("Reynolds number", { exact: true }).fill("750000");
  await expect(page.getByTestId("cd")).toHaveText("—");
  await page.getByLabel("Reynolds number", { exact: true }).fill("300000");
  await expect(page.getByTestId("applicability")).toContainText("interpolation");
  await page.getByLabel("Thickness slider", { exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Thickness", { exact: true })).toHaveValue("14.1");
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  // Rapid changes must settle on the latest input.
  for (const a of [2, 6, 0])
    await page.getByLabel("Angle of attack", { exact: true }).fill(String(a));
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  await expect(page.locator(".airfoil-svg")).toHaveAccessibleName(/at 0 degrees/);
  await expect(
    page.getByRole("slider", { name: "Angle of attack slider" }),
  ).toHaveAccessibleDescription("Model range -4 to 8°.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.locator(".foil-rotation").evaluate((e) => getComputedStyle(e).transitionDuration),
  ).toBe("0s");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("a boundary edit clears every live readout and the return action clamps only unsupported inputs", async ({
  page,
}) => {
  await page.goto("/studio/?view=analysis&m=.04&p=.4&t=.12&aoa=8&re=500000");
  await expect(page.getByRole("status", { name: "Prediction status" })).toHaveText(
    "Prediction ready",
  );
  await openControls(page);
  const angle = page.getByLabel("Angle of attack", { exact: true });
  const re = page.getByLabel("Reynolds number", { exact: true });
  await angle.fill("8.01");
  for (const id of ["cl", "cd", "ratio", "latency"]) {
    await expect(page.getByTestId(id)).toHaveText("—");
  }
  await expect(page.locator(".chart-line")).toHaveCount(2);
  await re.fill("500001");
  await expect(page.locator(".chart-line")).toHaveCount(0);
  const sheet = page.getByRole("dialog", { name: "Design parameters" });
  const controls = (await sheet.isVisible())
    ? sheet
    : page.getByRole("complementary", { name: "Predicted performance" });
  await controls.getByRole("button", { name: "Return to model range" }).click();
  await expect(angle).toHaveValue("8");
  await expect(re).toHaveValue("500000");
  await expect(page.getByLabel("Maximum camber", { exact: true })).toHaveValue("4");
  if (await sheet.isVisible())
    await sheet.getByRole("button", { name: "Close Design parameters" }).click();
  await expect(page.getByRole("status", { name: "Prediction status" })).toHaveText(
    "Prediction ready",
  );
  await expect(page.locator(".chart-line")).toHaveCount(2);
});

test("reliability separates model bounds, nearby training coverage and the frozen evidence", async ({
  page,
}) => {
  const indexRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/coverage-v1.json")) indexRequests.push(request.url());
  });
  await page.goto("/studio/?view=airfoil&m=.06&p=.6&t=.18&aoa=8&re=160000");
  const banner = page.getByRole("status", { name: "Training coverage status" });
  await expect(banner).toHaveText("Limited nearby training coverage");
  await expect(page.getByTestId("cl")).toHaveText(/^-?\d+\.\d{4}$/);
  await expect(page.getByTestId("applicability")).toContainText("interpolation");
  await page.getByRole("button", { name: "Details / evidence" }).click();
  const details = page.getByRole("dialog", { name: "Details" });
  const coverage = details.getByRole("status", { name: "Current design coverage" });
  await expect(coverage).toHaveText("Limited nearby training coverage");
  await expect(details.getByText("0.434", { exact: true })).toBeVisible();
  await expect(details.getByText("0.333", { exact: true })).toBeVisible();
  await expect(details.getByText(/165 eligible cases \/ 8 unseen geometries/)).toBeVisible();
  await expect(details.getByText(/0\.01484 \/ 0\.000683/)).toBeVisible();
  await details.getByRole("button", { name: "Close Details" }).click();
  await openControls(page);
  const angle = page.getByLabel("Angle of attack", { exact: true });
  await angle.fill("8.01");
  await expect(banner).toHaveCount(0);
  await expect(page.getByTestId("cl")).toHaveText("—");
  const sheet = page.getByRole("dialog", { name: "Design parameters" });
  if (await sheet.isVisible())
    await sheet.getByRole("button", { name: "Close Design parameters" }).click();
  await page.getByRole("button", { name: "Details / evidence" }).click();
  await expect(coverage).toHaveText("Outside model bounds");
  await expect(details.getByText("0.434", { exact: true })).toHaveCount(0);
  await details.getByRole("button", { name: "Close Details" }).click();
  await openControls(page);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  if (await sheet.isVisible())
    await sheet.getByRole("button", { name: "Close Design parameters" }).click();
  await page.getByRole("button", { name: "Details / evidence" }).click();
  await expect(coverage).toHaveText("Nearby training examples");
  expect(indexRequests).toHaveLength(1);
});

for (const fault of ["missing", "tampered"]) {
  test(`model predictions remain usable when the coverage index is ${fault}`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop");
    await page.route("**/coverage-v1.json", (route) =>
      route.fulfill(fault === "missing" ? { status: 404 } : { json: { threshold: 1 } }),
    );
    await page.goto("/studio/?view=airfoil");
    await expect(page.getByRole("status", { name: "Training coverage status" })).toHaveText(
      "Training coverage unavailable",
    );
    await expect(page.getByRole("status", { name: "Prediction status" })).toHaveText(
      "Prediction ready",
    );
    await expect(page.getByTestId("cl")).toHaveText("0.6972");
  });
}

test("loading state withholds telemetry; failed model and corrupt model can be retried", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/selected.onnx", async (route) => {
    await gate;
    await route.fulfill({ status: 503, body: "Unavailable" });
  });
  await page.goto("/studio/?view=airfoil");
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText(
    "Loading / calculating",
  );
  await expect(page.getByTestId("cl")).toHaveText("—");
  release();
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Model unavailable");
  await expect(page.getByRole("alert").filter({ hasText: "could not run" })).toBeVisible();
  await page.unroute("**/selected.onnx");
  await page.route("**/selected.onnx", (route) =>
    route.fulfill({
      status: 200,
      body: "corrupt model",
      headers: { "x-test-model": "corrupt" },
    }),
  );
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith("/selected.onnx") &&
        response.headers()["x-test-model"] === "corrupt",
    ),
    page.getByRole("button", { name: "Retry model" }).click(),
  ]);
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Model unavailable");
  await expect(page.getByTestId("cd")).toHaveText("—");
  await page.unroute("**/selected.onnx");
  await page.getByRole("button", { name: "Retry model" }).click();
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
});

test("missing WASM shows a recoverable instruction and no coefficients", async ({ page }) => {
  await page.route("**/*.wasm", (route) => route.fulfill({ status: 404, body: "Missing" }));
  await page.goto("/studio/?view=airfoil");
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Model unavailable");
  await expect(page.getByTestId("cl")).toHaveText("—");
  await expect(page.getByRole("alert").filter({ hasText: "reload this page" })).toBeVisible();
});

test("direct manipulation changes geometry and real predictions; scrubber and drawers work", async ({
  page,
}) => {
  await page.goto("/studio/?view=airfoil");
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  const before = await page.getByTestId("cl").innerText();
  const handle = page.locator(".geometry-handle.camber .handle-dot");
  const box = await handle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 - 12, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  await expect(page.getByTestId("cl")).not.toHaveText(before);
  const airfoil = page.getByRole("group", { name: /Airfoil at/ });
  await airfoil.getByRole("slider", { name: "Drag maximum camber" }).focus();
  await page.keyboard.press("Shift+ArrowUp");
  const rotation = airfoil.getByRole("slider", { name: "Drag angle of attack" });
  await rotation.focus();
  for (let step = 0; step < 3; step++) await page.keyboard.press("ArrowUp");
  await expect(rotation).toHaveAttribute("aria-valuenow", "4.3");
  await page.getByRole("slider", { name: "Alpha sweep", exact: true }).fill("6");
  await expect(page.locator(".airfoil-svg")).toHaveAccessibleName("Airfoil at 6 degrees");
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  const currentLift = await page.getByTestId("cl").innerText();
  await expect(page.locator(".v2-metrics .readout-number").first()).toHaveText(currentLift);
  await page.getByRole("button", { name: "Charts +", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Charts", exact: true })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Lift / angle of attack", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Drag / angle of attack", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "Inspect CL angle" })).toHaveValue("6");
  await expect(page.getByTestId("inspect-cl")).toHaveText(`Current ${currentLift}`);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Charts", exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Details / evidence", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Details", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Details", exact: true })).toContainText(
    "finite panel",
  );
  await page.getByRole("button", { name: "Close Details", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Details", exact: true })).not.toBeVisible();
});

test("alpha sweep gives predictions time to read and pauses on manual input", async ({ page }) => {
  await page.goto("/?view=airfoil");
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  const header = page.getByRole("banner");
  await expect(header.getByText(/model status|domain status/i)).toHaveCount(0);
  await expect(header.getByTestId("latency")).toHaveCount(0);
  await expect(
    page.getByRole("complementary", { name: "Predicted performance" }).getByTestId("latency"),
  ).toBeVisible();
  const scrubber = page.getByRole("slider", { name: "Alpha sweep", exact: true });
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('[aria-label="Alpha sweep"]')!;
    const samples: string[][] = [];
    new MutationObserver(() => {
      if (input.value !== "4.5") return;
      samples.push(
        ["cl", "cd", "ratio", "latency"].map((id) =>
          document.querySelector(`[data-testid="${id}"]`)!.textContent!.trim(),
        ),
      );
    }).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    Object.assign(window, { sweepReadouts: samples });
  });
  const originalLift = await page.getByTestId("cl").textContent();
  await page.getByRole("button", { name: "Play alpha sweep" }).click();
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Alpha sweep playing");
  await expect(page.getByLabel("Predicted performance").getByText("Latest sample")).toHaveCount(3);
  // Enforce a readable dwell rather than merely checking that the angle advances.
  await page.waitForTimeout(300);
  await expect(scrubber).toHaveValue("4");
  await expect(scrubber).toHaveValue("4.5");
  await expect(page.getByTestId("cl")).toHaveText(/^-?\d+\.\d{4}$/);
  await expect(page.getByTestId("cl")).not.toHaveText(originalLift!);
  const samples = await page.evaluate(
    () => (window as typeof window & { sweepReadouts: string[][] }).sweepReadouts,
  );
  expect(samples[0]).toEqual(["—", "—", "—", "—"]);
  await scrubber.fill("8");
  await expect(page.getByRole("button", { name: "Play alpha sweep" })).toBeVisible();
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  await page.getByRole("button", { name: "Play alpha sweep" }).click();
  await expect(scrubber).toHaveValue("8.5");
  await expect(page.getByTestId("cl")).toHaveText("—");
  await page.getByRole("button", { name: "Pause alpha sweep" }).click();
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Outside model bounds");
  await scrubber.fill("4");
  await page.getByRole("button", { name: "Play alpha sweep" }).click();
  await page.getByRole("button", { name: "Analysis", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Inspect CL angle" })).toHaveValue("4");
  await page.getByRole("button", { name: "Airfoil", exact: true }).click();
  await expect(page.getByRole("button", { name: "Play alpha sweep" })).toBeVisible();
});

test("controls drawer, display toggles, reduced motion and real exports remain usable", async ({
  page,
}, info) => {
  await page.goto("/studio/?view=airfoil");
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  await openControls(page);
  if (info.project.name === "mobile") {
    await expect(page.getByRole("dialog", { name: "Design parameters" })).toBeVisible();
    await expect(page.getByLabel("Airfoil preset")).toBeVisible();
  }
  await closeControls(page);
  await page.getByRole("button", { name: "Grid", exact: true }).click();
  await expect(page.locator(".airfoil-svg rect[fill='url(#paper-grid)']")).toBeVisible();
  await page.getByRole("button", { name: "Flow [conceptual]", exact: true }).click();
  await expect(page.locator(".conceptual-flow")).toContainText("CONCEPTUAL / NOT SIMULATED");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("button", { name: "Play alpha sweep", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Export +", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "json", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("naca-2412.json");
  await page.getByRole("button", { name: "Export +", exact: true }).click();
  const pngPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "png", exact: true }).click();
  expect((await pngPromise).suggestedFilename()).toBe("naca-2412.png");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("model evidence page loads without console errors and returns to studio", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const disclosure =
    "The model’s Reynolds number range of 100,000 to 500,000 is below typical full-scale Formula 1 front-wing conditions, so its predictions apply only to isolated airfoil sections.";
  await page.goto("/model/");
  await expect(page.getByRole("heading", { name: "Model evidence /", exact: true })).toBeVisible();
  await expect(page.getByText("0.01484", { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByText(disclosure, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Return to studio", exact: true }).click();
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  await page.getByRole("button", { name: "Details / evidence", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Details", exact: true });
  await expect(details.getByText(disclosure, { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("saved comparisons overlay airfoils and real sweeps, restore and clear", async ({
  page,
}, info) => {
  await page.goto("/studio/?view=airfoil");
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  const saved = await page.getByTestId("cl").innerText();
  await page.getByRole("button", { name: "Save design", exact: true }).click();
  await openControls(page);
  await page.getByRole("button", { name: "4412", exact: true }).click();
  await closeControls(page);
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  await expect(page.getByTestId("cl")).not.toHaveText(saved);
  const current = await page.getByTestId("cl").innerText();
  await expect(page.getByTestId("saved-contour")).toBeVisible();
  const capture = process.env.AEROFORGE_REVIEW;
  const review = `../docs/phase-6/${capture}`;
  if (capture === "initial" || capture === "final") {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mkdir(review, { recursive: true });
    await page.screenshot({ path: `${review}/${info.project.name}-overlay.png` });
  }
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.locator(".comparison-line")).toHaveCount(2);
  const curves = await page
    .locator(".chart-line,.comparison-line")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("d")));
  expect(curves[0]).not.toBe(curves[1]);
  await expect(page.getByRole("row", { name: /^CL / })).toContainText(saved);
  const inspect = page.getByRole("spinbutton", { name: "Inspect CL angle" });
  await expect(page.getByTestId("inspect-cl")).toContainText(`Current ${current}`);
  await expect(page.getByTestId("inspect-cl")).toContainText(`Saved ${saved}`);
  await inspect.fill("9");
  await expect(page.getByTestId("inspect-cl")).toHaveText("Current — / Saved —");
  await expect(page.getByRole("spinbutton", { name: "Inspect CD angle" })).toHaveValue("9");
  await expect(page.getByTestId("inspect-cd")).toHaveText("Current — / Saved —");
  await inspect.fill("4");
  await page.waitForFunction(
    () =>
      Number(getComputedStyle(document.querySelector("dialog[open] .drawer-body")!).opacity) >
      0.999,
  );
  expect(
    await page
      .getByRole("dialog", { name: "Charts" })
      .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
  ).toBe(true);
  if (capture === "initial" || capture === "final") {
    await page.getByRole("button", { name: "Close Charts", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${review}/${info.project.name}-charts.png` });
  }
  await page.getByRole("button", { name: "Restore saved design", exact: true }).click();
  await expect(
    page
      .getByRole("row", { name: /^Design / })
      .getByRole("cell")
      .first(),
  ).toHaveText("NACA 2412");
  await page.getByRole("button", { name: "Clear saved comparison", exact: true }).click();
  await expect(page.locator(".comparison-line")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("saved-contour")).toHaveCount(0);
  await expect(page.getByTestId("cl")).toHaveText(saved);
  await expect(page.getByRole("heading", { name: "NACA 2412", exact: true })).toBeVisible();
  for (const format of ["svg", "csv"]) {
    await page.getByRole("button", { name: "Export +", exact: true }).click();
    const option = page.getByRole("button", { name: format, exact: true });
    await expect(option).toBeEnabled();
    const pending = page.waitForEvent("download");
    await option.click();
    const file = await pending;
    expect(file.suggestedFilename()).toBe(`naca-2412.${format}`);
    const content = await readFile((await file.path())!, "utf8");
    if (format === "svg") {
      expect(content).toContain("<svg");
      expect(content).toContain("foil-surface");
    } else {
      const rows = content.trim().split("\n");
      expect(rows).toHaveLength(26);
      expect(rows[0]).toBe("alpha_deg,CL,CD,L_D");
      expect(rows[25].split(",")[0]).toBe("8");
    }
  }
});

test("share restores exact design, handles malformed links, and keeps model bounds", async ({
  page,
  context,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/studio/?view=airfoil&m=0.04321&p=0.512&t=0.145&aoa=6.25&re=345678");
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  const original = await page.getByTestId("cl").innerText();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Share design" });
  const link = await dialog.getByRole("textbox", { name: "Design URL" }).inputValue();
  expect(new URL(link).searchParams.get("m")).toBe("0.04321");
  expect(new URL(link).searchParams.get("view")).toBe("airfoil");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await dialog.getByRole("button", { name: "Copy link" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Link copied.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  if (process.env.AEROFORGE_REVIEW === "final") {
    const review = "../docs/phase-6/final";
    await mkdir(review, { recursive: true });
    await page.waitForFunction(
      () =>
        Number(getComputedStyle(document.querySelector("dialog[open] .drawer-body")!).opacity) >
        0.999,
    );
    await page.screenshot({ path: `${review}/${info.project.name}-share.png` });
  }
  await page.goto(link);
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  await expect(page.getByTestId("cl")).toHaveText(original);
  await expect(page.locator(".airfoil-svg")).toHaveAccessibleName("Airfoil at 6.25 degrees");
  await openControls(page);
  await expect(page.getByLabel("Reynolds number", { exact: true })).toHaveValue("345678");

  await page.goto("/studio/?view=airfoil&m=0&p=.4&t=.12&aoa=9&re=250000");
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Outside model bounds");
  await expect(page.getByTestId("cl")).toHaveText("—");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  expect(
    new URL(
      await dialog.getByRole("textbox", { name: "Design URL" }).inputValue(),
    ).searchParams.get("p"),
  ).toBe("0");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Charts +", exact: true }).click();
  await expect(page.locator(".chart-line")).toHaveCount(2);

  for (const query of [
    "m=0.02",
    "m=0.02&m=0.04&p=.4&t=.12&aoa=4&re=250000",
    "m=0.02&p=.4&t=.12&aoa=99&re=250000",
  ]) {
    await page.goto(`/studio/?view=airfoil&${query}`);
    await expect(
      page.getByRole("complementary", { name: "Invalid design link" }).getByRole("alert"),
    ).toContainText("This design link is invalid.");
    await expect(page.getByRole("heading", { name: "NACA 2412", exact: true })).toBeVisible();
    await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  }
  expect(errors).toEqual([]);
});
