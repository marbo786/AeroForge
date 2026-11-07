import { test, expect, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { generateGeometry } from "../../lib/geometry/naca4";

async function openControls(page: Page) {
  const toggle = page.getByRole("button", { name: "Edit parameters" });
  if (await toggle.isVisible()) await toggle.click();
}

test("studio uses real model outputs and accurate geometry without external requests", async ({ page, request }, info) => {
  const errors: string[] = [], external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", (r) => { if (r.url().startsWith("http") && new URL(r.url()).origin !== "http://127.0.0.1:4173") external.push(r.url()); });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Prediction ready");
  const original = await page.getByTestId("cl").innerText();
  await expect(page.getByTestId("cd")).toHaveText(/^0\.\d{5}$/);
  await expect(page.getByTestId("latency")).toHaveText(/\d+\.\d{2} ms/);
  const geometry = generateGeometry({ m: .02, p: .4, t: .12 });
  const expectedPath = `M${geometry.contour.map(([x,y]) => `${(120+x*560).toFixed(4)},${(240-y*560).toFixed(4)}`).join(" L")} Z`;
  await expect(page.getByTestId("foil-path")).toHaveAttribute("d", expectedPath);
  await expect(page.locator(".foil-rotation")).toHaveAttribute("transform", "rotate(4 260 240)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await mkdir("../docs/ui-redesign/final", { recursive: true });
  await page.screenshot({ path: `../docs/ui-redesign/final/${info.project.name}.png`, fullPage: true });
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name: "4418", exact: true }).click();
  await openControls(page);
  await expect(page.getByLabel("Thickness", { exact: true })).toHaveValue("18");
  await expect(page.getByRole("status")).toHaveText("Prediction ready");
  await expect(page.getByTestId("cl")).not.toHaveText(original);
  await expect(page.getByTestId("foil-path")).not.toHaveAttribute("d", expectedPath);
  // Match a frozen source-model vector in original units, through visible controls.
  const golden = await (await request.get("/models/recovery-v1-complete/golden.json")).json();
  const [m,p,t,alpha,logRe] = golden.features[0] as number[];
  for (const [label, value] of [["Maximum camber",m*100],["Thickness",t*100],["Angle of attack",alpha],["Reynolds number",Math.round(10**logRe)]] as const)
    await page.getByLabel(label, { exact: true }).fill(String(Number(value.toFixed(5))));
  if (m !== 0) await page.getByLabel("Camber position", { exact: true }).fill(String(Number((p*100).toFixed(5))));
  await expect(page.getByRole("status")).toHaveText("Prediction ready");
  expect(Math.abs(Number(await page.getByTestId("cl").innerText()) - golden.expected.selected[0][0])).toBeLessThan(.00006);
  expect(Math.abs(Number(await page.getByTestId("cd").innerText()) - golden.expected.selected[0][1])).toBeLessThan(.000006);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByTestId("foil-path")).toHaveAttribute("d", expectedPath);
  const hide=page.getByRole("button",{name:"Hide parameters",exact:true});
  if(await hide.isVisible())await hide.click();
  await page.getByRole("button", { name: "0012", exact: true }).click();
  await openControls(page);
  await expect(page.getByLabel("Camber position", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Camber position", { exact: true })).toHaveValue("0");
  await expect(page.getByRole("status")).toHaveText("Prediction ready");
  expect(external).toEqual([]); expect(errors).toEqual([]);
});

test("parameters validate, withhold out-of-domain predictions and recover through keyboard sliders", async ({ page }) => {
  await page.goto("/studio/"); await openControls(page);
  await expect(page.getByRole("status")).toHaveText("Prediction ready");
  await page.getByLabel("Thickness", { exact: true }).fill("");
  await expect(page.getByLabel("Thickness", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByTestId("cl")).toHaveText("—");
  await page.getByLabel("Thickness", { exact: true }).fill("14");
  await page.getByLabel("Angle of attack", { exact: true }).fill("10");
  await expect(page.getByRole("status")).toHaveText("Outside model bounds");
  await expect(page.getByTestId("cl")).toHaveText("—");
  await page.getByLabel("Angle of attack", { exact: true }).fill("4");
  await page.getByLabel("Reynolds number", { exact: true }).fill("750000");
  await expect(page.getByTestId("cd")).toHaveText("—");
  await page.getByLabel("Reynolds number", { exact: true }).fill("300000");
  await expect(page.getByTestId("applicability")).toContainText("interpolation");
  await page.getByLabel("Thickness slider", { exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByLabel("Thickness", { exact: true })).toHaveValue("14.1");
  await expect(page.getByRole("status")).toHaveText("Prediction ready");
  // Rapid changes must settle on the latest input.
  for (const a of [2, 6, 0]) await page.getByLabel("Angle of attack", { exact: true }).fill(String(a));
  await expect(page.getByRole("status")).toHaveText("Prediction ready");
  await expect(page.locator(".airfoil-svg")).toHaveAccessibleName(/at 0 degrees/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.locator(".foil-rotation").evaluate((e) => getComputedStyle(e).transitionDuration)).toBe("0s");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("loading state withholds telemetry; failed model and corrupt model can be retried", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/selected.onnx", async (route) => { await gate; await route.fulfill({ status: 503, body: "Unavailable" }); });
  await page.goto("/studio/");
  await expect(page.getByRole("status")).toHaveText("Loading / calculating");
  await expect(page.getByTestId("cl")).toHaveText("—");
  release();
  await expect(page.getByRole("status")).toHaveText("Model unavailable");
  await expect(page.getByRole("alert").filter({ hasText: "could not run" })).toBeVisible();
  await page.unroute("**/selected.onnx");
  await page.route("**/selected.onnx", (route) => route.fulfill({ status: 200, body: "corrupt model" }));
  await page.getByRole("button", { name: "Retry model" }).click();
  await expect(page.getByRole("status")).toHaveText("Model unavailable");
  await expect(page.getByTestId("cd")).toHaveText("—");
  await page.unroute("**/selected.onnx");
  await page.getByRole("button", { name: "Retry model" }).click();
  await expect(page.getByRole("status")).toHaveText("Prediction ready");
});

test("missing WASM shows a recoverable instruction and no coefficients", async ({ page }) => {
  await page.route("**/*.wasm", (route) => route.fulfill({ status: 404, body: "Missing" }));
  await page.goto("/studio/");
  await expect(page.getByRole("status")).toHaveText("Model unavailable");
  await expect(page.getByTestId("cl")).toHaveText("—");
  await expect(page.getByRole("alert").filter({ hasText: "reload this page" })).toBeVisible();
});

test("direct manipulation changes geometry and real predictions; scrubber and drawers work", async ({ page }) => {
  await page.goto("/studio/");
  await expect(page.getByRole("status")).toHaveText("Prediction ready");
  const before=await page.getByTestId("cl").innerText();
  const handle=page.locator(".geometry-handle.camber .handle-dot");
  const box=await handle.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
  await page.mouse.down();await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2-12,{steps:12});await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Prediction ready");
  await expect(page.getByTestId("cl")).not.toHaveText(before);
  await page.locator(".geometry-handle.camber").focus();await page.keyboard.press("Shift+ArrowUp");
  await page.getByRole("slider",{name:"Alpha sweep",exact:true}).fill("6");
  await expect(page.locator(".airfoil-svg")).toHaveAccessibleName("Airfoil at 6 degrees");
  await expect(page.getByRole("status")).toHaveText("Prediction ready");
  await page.getByRole("button",{name:"Charts +",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Charts",exact:true})).toBeVisible();
  await expect(page.getByRole("img",{name:"Drag polar",exact:true})).toBeVisible();
  await page.keyboard.press("Escape");await expect(page.getByRole("dialog",{name:"Charts",exact:true})).not.toBeVisible();
  await openControls(page);
  await page.getByRole("button",{name:"Details / evidence",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Details",exact:true})).toBeVisible();
  await expect(page.getByRole("dialog",{name:"Details",exact:true})).toContainText("finite panel");
  await page.getByRole("button",{name:"Close Details",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Details",exact:true})).not.toBeVisible();
});

test("sheet snaps, display toggles, reduced motion and real exports remain usable", async ({ page },info) => {
  await page.goto("/studio/");await expect(page.getByRole("status")).toHaveText("Prediction ready");
  await openControls(page);
  if(info.project.name==="mobile"){
    await page.getByRole("button",{name:"full",exact:true}).click();
    await expect(page.locator(".control-column")).toHaveClass(/sheet-full/);
  }
  await page.getByRole("button",{name:"Grid",exact:true}).click();
  await expect(page.locator(".airfoil-svg rect[fill='url(#paper-grid)']")).toBeVisible();
  await page.getByRole("button",{name:"Flow [conceptual]",exact:true}).click();
  await expect(page.locator(".conceptual-flow")).toContainText("CONCEPTUAL / NOT SIMULATED");
  if(info.project.name==="mobile")await page.getByRole("button",{name:"peek",exact:true}).click();
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect(page.getByRole("button",{name:"Play alpha sweep",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Export +",exact:true}).click();
  const downloadPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:"json",exact:true}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe("naca-2412.json");
  await page.getByRole("button",{name:"Export +",exact:true}).click();
  const pngPromise=page.waitForEvent("download");
  await page.getByRole("button",{name:"png",exact:true}).click();
  expect((await pngPromise).suggestedFilename()).toBe("naca-2412.png");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("model evidence page loads without console errors and returns to studio",async({page})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
  await page.goto("/model/");
  await expect(page.getByRole("heading",{name:"Model evidence /",exact:true})).toBeVisible();
  await expect(page.getByText("0.01484",{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole("link",{name:"Return to studio",exact:true}).click();
  await expect(page.getByRole("status")).toHaveText("Prediction ready");expect(errors).toEqual([]);
});

test("saved comparisons use real sweeps and SVG/CSV exports contain usable data",async({page})=>{
  await page.goto("/studio/");
  await expect(page.getByRole("status")).toHaveText("Prediction ready");
  const saved=await page.getByTestId("cl").innerText();
  await page.getByRole("button",{name:"Save design",exact:true}).click();
  await page.getByRole("button",{name:"4412",exact:true}).click();
  await expect(page.getByTestId("cl")).not.toHaveText(saved);
  await page.getByRole("button",{name:"Charts +",exact:true}).click();
  await expect(page.locator(".comparison-line")).toHaveCount(4);
  const curves=await page.locator(".chart-line,.comparison-line").evaluateAll(nodes=>nodes.map(node=>node.getAttribute("d")));
  expect(curves[0]).not.toBe(curves[1]);
  await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"Saved",exact:true}).click();
  await expect(page.getByTestId("cl")).toHaveText(saved);
  await expect(page.getByRole("heading",{name:"NACA 2412",exact:true})).toBeVisible();
  for(const format of ["svg","csv"]){
    await page.getByRole("button",{name:"Export +",exact:true}).click();
    const option=page.getByRole("button",{name:format,exact:true});
    await expect(option).toBeEnabled();
    const pending=page.waitForEvent("download");await option.click();
    const file=await pending;
    expect(file.suggestedFilename()).toBe(`naca-2412.${format}`);
    const content=await readFile((await file.path())!,"utf8");
    if(format==="svg"){expect(content).toContain("<svg");expect(content).toContain("foil-surface");}
    else {const rows=content.trim().split("\n");expect(rows).toHaveLength(26);expect(rows[0]).toBe("alpha_deg,CL,CD,L_D");expect(rows[25].split(",")[0]).toBe("8");}
  }
});
