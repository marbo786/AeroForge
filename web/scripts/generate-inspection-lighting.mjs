import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const origin = "http://aeroforge-lighting.test";
const threeRoot = new URL("../node_modules/three/", import.meta.url);
const output = new URL("../public/vehicle/lighting-v1/room.rgba16f.gz", import.meta.url);
const browser = await chromium.launch(process.platform === "win32" ? { channel: "chrome" } : {});

try {
  const page = await browser.newPage();
  await page.route(origin + "/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/") {
      await route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><title>AeroForge studio lighting bake</title>
          <script type="importmap">{"imports":{"three":"/build/three.module.js"}}</script>`,
      });
    } else {
      await route.fulfill({
        contentType: "text/javascript",
        body: await readFile(new URL("." + path, threeRoot)),
      });
    }
  });
  await page.goto(origin);
  const encoded = await page.evaluate(async () => {
    const { DataUtils, PMREMGenerator, WebGLRenderer } = await import("/build/three.module.js");
    const { RoomEnvironment } = await import("/examples/jsm/environments/RoomEnvironment.js");
    const renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    const room = new RoomEnvironment();
    const pmrem = new PMREMGenerator(renderer);
    const target = pmrem.fromScene(room, 0.05, 0.1, 100, { size: 256 });
    const context = renderer.getContext();
    const reduction = 4;
    let text = "";

    // Convert Three's render-target orientation to its uploaded cubemap convention.
    for (const face of [1, 0, 2, 3, 4, 5]) {
      for (let level = 0; level < target.texture.mipmaps.length; level++) {
        const edge = target.width >> level;
        renderer.setRenderTarget(target, face, level);
        const type = context.getParameter(context.IMPLEMENTATION_COLOR_READ_TYPE);
        const floating = type === context.FLOAT;
        if (!floating && type !== context.HALF_FLOAT) throw new Error("Expected HDR cube faces.");
        const pixels = floating
          ? new Float32Array(edge * edge * 4)
          : new Uint16Array(edge * edge * 4);
        context.readPixels(0, 0, edge, edge, context.RGBA, type, pixels);
        if (context.getError()) throw new Error("Could not read studio lighting.");

        // Reduce spatial resolution at every level and keep the complete roughness chain.
        const width = edge / reduction;
        const bytes = new Uint8Array(width * width * 8);
        const halfFloats = new DataView(bytes.buffer);
        for (let y = 0; y < width; y++) {
          for (let x = 0; x < width; x++) {
            const sum = [0, 0, 0, 0];
            for (let dy = 0; dy < reduction; dy++) {
              for (let dx = 0; dx < reduction; dx++) {
                const sourceX = edge - 1 - (x * reduction + dx);
                const offset = ((y * reduction + dy) * edge + sourceX) * 4;
                for (let channel = 0; channel < 4; channel++) {
                  const component = pixels[offset + channel];
                  sum[channel] += floating ? component : DataUtils.fromHalfFloat(component);
                }
              }
            }
            for (let channel = 0; channel < 4; channel++) {
              const half = DataUtils.toHalfFloat(sum[channel] / reduction ** 2);
              halfFloats.setUint16(((y * width + x) * 4 + channel) * 2, half, true);
            }
          }
        }
        for (let i = 0; i < bytes.length; i += 8192) {
          text += String.fromCharCode(...bytes.subarray(i, i + 8192));
        }
      }
    }
    renderer.setRenderTarget(null);
    target.dispose();
    room.dispose();
    pmrem.dispose();
    renderer.dispose();
    return btoa(text);
  });
  const bytes = Buffer.from(encoded, "base64");
  const compressed = gzipSync(bytes, { level: 9 });
  await mkdir(new URL("./", output), { recursive: true });
  await writeFile(output, compressed);
  console.log(`Baked room lighting. ${bytes.length} bytes, ${compressed.length} after gzip.`);
} finally {
  await browser.close();
}
