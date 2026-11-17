import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(
  await readFile(new URL("../../../artifacts/pressure-v1/model.json", import.meta.url), "utf8"),
) as { version: string; file: string; bytes: number; stations: number; rejected: string[] };
const graph = `/models/${manifest.version}/${manifest.file}`;
const title = "ML-predicted surface pressure coefficient";

test("loads pressure on demand, links inspection to the section and clears unsupported curves", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await page.goto("/studio/?view=airfoil");
  await expect(page.locator('[aria-label="Prediction status"]')).toHaveText("Prediction ready");
  expect(requests.filter((path) => path === graph)).toHaveLength(0);
  await page.getByRole("button", { name: "Pressure", exact: true }).click();
  const region = page.getByRole("region", { name: title });
  const plot = region.locator("[data-pressure-plot]");
  await expect(plot).toBeVisible();
  for (const side of ["upper", "lower"]) {
    const points = await plot.locator(`[data-pressure-side="${side}"]`).getAttribute("points");
    expect(points?.split(" ")).toHaveLength(257);
  }
  await expect(
    plot.getByRole("img", { name: /More negative pressure coefficients are higher/ }),
  ).toBeVisible();
  await plot.getByRole("button", { name: "Lower surface" }).click();
  const station = plot.getByRole("slider", { name: "Surface station" });
  await station.focus();
  await station.press("End");
  await expect(station).toHaveValue("256");
  await expect(plot.locator("[data-pressure-readout]")).toHaveText(
    /Lower · x\/c .* · y\/c -.* · Cp /,
  );
  await expect(
    plot.getByRole("img", { name: "Matching point on unrotated airfoil section" }),
  ).toBeVisible();
  const before = await plot.locator('[data-pressure-side="upper"]').getAttribute("points");
  await region.getByLabel("Pressure angle").selectOption("6");
  await expect(plot.locator('[data-pressure-side="upper"]')).not.toHaveAttribute("points", before!);
  await expect(plot).toBeVisible();
  const drawer = page.getByRole("button", { name: "Edit parameters" });
  if (await drawer.isVisible()) await drawer.click();
  await page.getByLabel("Reynolds number", { exact: true }).fill("240000");
  const close = page.getByRole("button", { name: "Close Design parameters" });
  if (await close.isVisible()) await close.click();
  await expect(region.getByRole("status")).toContainText(
    "Choose a sampled angle and Reynolds number",
  );
  await expect(plot).toHaveCount(0);
  await region.getByLabel("Pressure Reynolds number").selectOption("250000");
  await expect(plot).toBeVisible();
  expect(requests.filter((path) => path === graph)).toHaveLength(1);
  expect(requests.filter((path) => path.endsWith(".wasm"))).toHaveLength(1);
});

test("withholds known XFOIL rejections without fetching the model", async ({ page }) => {
  const [code, reynolds, alpha] = /^([0-9]{4})-(\d+)-([+-]\d+)$/
    .exec(manifest.rejected[0])!
    .slice(1);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await page.goto(
    `/studio/?view=airfoil&m=${Number(code[0]) / 100}&p=${Number(code[1]) / 10}&t=${Number(code.slice(2)) / 100}&aoa=${Number(alpha)}&re=${reynolds}`,
  );
  await page.getByRole("button", { name: "Pressure", exact: true }).click();
  await expect(page.getByRole("region", { name: title }).getByRole("status")).toContainText(
    "The XFOIL run did not pass the data checks.",
  );
  expect(requests).not.toContain(graph);
});

test("rejects same-length corrupt model bytes and recovers on retry", async ({ page }) => {
  await page.route(graph, async (route) => {
    await route.fulfill({
      body: Buffer.alloc(manifest.bytes),
      contentType: "application/octet-stream",
    });
  });
  await page.goto("/studio/?view=airfoil");
  await page.getByRole("button", { name: "Pressure", exact: true }).click();
  const region = page.getByRole("region", { name: title });
  await expect(region.getByRole("status")).toContainText(
    "The model could not return a valid profile",
  );
  await expect(region.locator("[data-pressure-plot]")).toHaveCount(0);
  await page.unroute(graph);
  await region.getByRole("button", { name: "Retry pressure" }).click();
  await expect(region.locator("[data-pressure-plot]")).toBeVisible();
});

test("production WASM matches every frozen pressure value", async ({ page }, info) => {
  const golden = JSON.parse(
    await readFile(new URL("../../../artifacts/pressure-v1/parity.json", import.meta.url), "utf8"),
  );
  await page.goto("/spike/");
  const result = await page.evaluate(
    async ({ graph, golden }) => {
      const runtimePath = `${location.origin}/runtime/1.31.1/`;
      const ort = (await import(
        `${runtimePath}ort.wasm.min.mjs`
      )) as typeof import("onnxruntime-web");
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = true;
      ort.env.wasm.wasmPaths = runtimePath;
      const session = await ort.InferenceSession.create(graph, { executionProviders: ["wasm"] });
      const output = (
        await session.run({
          features: new ort.Tensor("float32", Float32Array.from(golden.features.flat()), [
            golden.shape[0],
            5,
          ]),
        })
      ).cp;
      const reference = golden.cp.flat(2) as number[];
      const data = output.data as Float32Array;
      const maxAbs = data.reduce(
        (max, value, i) => Math.max(max, Math.abs(value - reference[i])),
        0,
      );
      await session.release();
      return { shape: output.dims, maxAbs };
    },
    { graph, golden },
  );
  expect(result.shape).toEqual(golden.shape);
  expect(result.maxAbs).toBeLessThanOrEqual(1e-5);
  await info.attach("pressure-browser-parity", {
    body: JSON.stringify(result),
    contentType: "application/json",
  });
});

test("maps a frozen model vector to physical solver-aligned coordinates and an inverted Cp axis", async ({
  page,
}) => {
  const golden = JSON.parse(
    await readFile(new URL("../../../artifacts/pressure-v1/parity.json", import.meta.url), "utf8"),
  );
  const fixture = JSON.parse(
    await readFile(
      new URL("../../../artifacts/pressure-v1/plot-coordinate-fixture.json", import.meta.url),
      "utf8",
    ),
  );
  const [m, p, t, alpha, re] = golden.features[fixture.parityIndex];
  const design = { m: m / 100, p: p / 10, t: t / 100, alpha, re };
  await page.goto(
    `/studio/?view=airfoil&m=${design.m}&p=${design.p}&t=${design.t}&aoa=${alpha}&re=${re}`,
  );
  await page.getByRole("button", { name: "Pressure", exact: true }).click();
  const chart = page.getByRole("img", { name: /Upper and lower surface pressure versus/ });
  await expect(chart).toBeVisible();
  const mapped = await chart.evaluate((svg) => {
    const labels = [...svg.querySelectorAll("g > text")];
    const x = labels.filter((label) => label.getAttribute("text-anchor") === "middle");
    const y = labels.filter((label) => label.getAttribute("text-anchor") === "end");
    const x0 = Number(x[0].getAttribute("x"));
    const xScale = Number(x[x.length - 1].getAttribute("x")) - x0;
    const y0 = Number(y[0].getAttribute("y")) - 4;
    const y1 = Number(y[1].getAttribute("y")) - 4;
    const cp0 = Number(y[0].textContent);
    const cp1 = Number(y[1].textContent);
    return {
      slope: (cp1 - cp0) / (y1 - y0),
      profiles: [...svg.querySelectorAll("polyline")].map((line) =>
        line
          .getAttribute("points")!
          .split(" ")
          .map((point) => {
            const [pointX, pointY] = point.split(",").map(Number);
            return [(pointX - x0) / xScale, cp0 + ((pointY - y0) * (cp1 - cp0)) / (y1 - y0)];
          }),
      ),
    };
  });
  const section = page.getByRole("img", { name: "Matching point on unrotated airfoil section" });
  const sections = await section.locator("polyline").evaluateAll((lines) =>
    lines.map((line) =>
      line
        .getAttribute("points")!
        .split(" ")
        .map((point) => point.split(",").map(Number)),
    ),
  );
  expect(mapped.slope).toBeGreaterThan(0);
  for (const side of [0, 1]) {
    expect(mapped.profiles[side]).toHaveLength(manifest.stations);
    const maxCp = Math.max(
      ...mapped.profiles[side].map(([, cp], station) =>
        Math.abs(cp - golden.cp[fixture.parityIndex][side][station]),
      ),
    );
    fixture.stations.forEach((station: number, i: number) => {
      const [x, invertedY] = sections[side][station];
      const [referenceX, referenceY] = fixture.solverCoordinates[side][i];
      expect(Math.abs(mapped.profiles[side][station][0] - x)).toBeLessThan(1e-9);
      expect(Math.hypot(x - referenceX, -invertedY - referenceY)).toBeLessThan(0.0004);
    });
    expect(maxCp).toBeLessThanOrEqual(1e-5);
  }
});
