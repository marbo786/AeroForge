import { chromium, expect, test, type Page } from "@playwright/test";

const path = "/inspection/";
const model = "**/vehicle/af02-v1/car.glb";
const status = (page: Page) => page.locator(".inspection-bay");

test.use({launchOptions:{args:["--enable-unsafe-swiftshader"]}});

test("loads the local mesh, presents four rendered views, and allows zoom and orbit", async ({page}, info) => {
  test.skip(info.project.name !== "desktop");
  await page.emulateMedia({reducedMotion:"reduce"});
  const errors:string[]=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("console",message=>{if(message.type()==="error") errors.push(message.text());});
  let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route(model,async route=>{await gate; await route.continue();});
  try {
    await page.goto(path);
    await expect(status(page)).toHaveAttribute("data-render-status","loading");
    await expect(page.getByRole("link",{name:"Open Airfoil editor"})).toBeVisible();
  } finally { release(); }
  await expect(status(page)).toHaveAttribute("data-render-status","ready");
  const triangles=Number(await status(page).getAttribute("data-triangles"));
  const drawCalls=Number(await status(page).getAttribute("data-draw-calls"));
  expect(triangles).toBeGreaterThan(1000);
  expect(triangles).toBeLessThanOrEqual(80_000);
  expect(drawCalls).toBeGreaterThan(1);
  expect(drawCalls).toBeLessThanOrEqual(85);

  const canvas=page.locator(".inspection-render canvas");
  const frames:Buffer[]=[];
  const frame=async()=>{
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    return canvas.screenshot();
  };
  for(const view of ["Three-quarter","Front","Side","Top"]){
    const button=page.getByRole("button",{name:view,exact:true});
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed","true");
    const shot=await frame();
    expect(frames.some(previous=>shot.equals(previous))).toBe(false);
    frames.push(shot);
  }
  await page.getByRole("button",{name:"Zoom in"}).click();
  const zoomed=await frame();
  expect(zoomed.equals(frames[3])).toBe(false);
  const keyboardCamera=page.getByRole("group",{name:"AF–02 camera"});
  await keyboardCamera.focus();
  await expect(keyboardCamera).toBeFocused();
  await keyboardCamera.press("ArrowLeft");
  await page.getByRole("button",{name:"Zoom in"}).focus();
  const orbited=await frame();
  expect(orbited.equals(zoomed)).toBe(false);
  const box=await canvas.boundingBox();
  expect(box).not.toBeNull();
  const x=box!.x+box!.width/2, y=box!.y+box!.height/2;
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(x+100,y+50,{steps:8});
  await page.mouse.up();
  expect((await frame()).equals(orbited)).toBe(false);
  expect(errors).toEqual([]);
});

test("falls back after an asset failure and allows a retry", async ({page},info) => {
  test.skip(info.project.name !== "desktop");
  await page.route(model,route=>route.fulfill({status:404,body:"missing"}),{times:1});
  await page.goto(path);
  await expect(status(page)).toHaveAttribute("data-render-status","failed");
  await expect(page.getByRole("link",{name:"Continue in 2D"})).toHaveAttribute("href","/studio/?view=airfoil");
  await page.getByRole("button",{name:"Retry 3D"}).click();
  await expect(status(page)).toHaveAttribute("data-render-status","ready");
});

test("shows the poster and retains the 2D route after a lost graphics context", async ({page},info) => {
  test.skip(info.project.name !== "desktop");
  await page.goto(path);
  await expect(status(page)).toHaveAttribute("data-render-status","ready");
  await page.locator("canvas").evaluate((canvas:HTMLCanvasElement)=>{
    const extension=canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context");
    if (!extension) throw new Error("Context loss extension unavailable");
    extension.loseContext();
  });
  await expect(status(page)).toHaveAttribute("data-render-status","lost");
  await expect(page.getByRole("img",{name:/AF–02 from/})).toBeVisible();
  await page.getByRole("link",{name:"Continue in 2D"}).click();
  await expect(page.getByRole("status",{name:"Prediction status"})).toHaveText("Prediction ready");
});

test("works without WebGL and never requests the car asset", async ({baseURL},info) => {
  test.skip(info.project.name !== "desktop");
  const browser=await chromium.launch({
    ...(process.platform==="win32"?{channel:"chrome"}:{}),args:["--disable-webgl"],
  });
  try{
    const page=await browser.newPage();
    const loads:string[]=[];
    page.on("request", request=>{if(request.url().endsWith(".glb")) loads.push(request.url());});
    await page.goto(new URL(path,baseURL).href);
    await expect(status(page)).toHaveAttribute("data-render-status","unsupported");
    await page.getByRole("link",{name:"Continue in 2D"}).click();
    await expect(page.getByRole("status",{name:"Prediction status"})).toHaveText("Prediction ready");
    await expect(page.getByTestId("cl")).toHaveText("0.6972");
    expect(loads).toEqual([]);
  } finally {await browser.close();}
});

test("keeps 3D opt-in on mobile", async ({page},info) => {
  test.skip(info.project.name !== "mobile");
  const requests:string[]=[];
  page.on("request", request=>{if(request.url().endsWith(".glb")) requests.push(request.url());});
  await page.goto(path);
  await expect(status(page)).toHaveAttribute("data-render-status","poster");
  expect(requests).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole("button",{name:"Enable 3D"}).click();
  await expect(status(page)).toHaveAttribute("data-render-status","ready");
  await expect(status(page)).toHaveAttribute("data-render-tier","compact");
  expect(requests.map(url=>new URL(url).pathname)).toEqual(["/vehicle/af02-mobile-v1/car.glb"]);
  expect(Number(await status(page).getAttribute("data-triangles"))).toBeLessThanOrEqual(35_000);
  expect(Number(await status(page).getAttribute("data-draw-calls"))).toBeLessThanOrEqual(45);
});
