import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const pass = process.argv[2];
assert(['before', 'after'].includes(pass), 'Specify before or after');
const output = new URL(`../../docs/ui-launch/${pass}/`, import.meta.url);
await mkdir(output, { recursive: true });
const origin = 'http://127.0.0.1:4175';
const server = spawn(process.execPath, ['scripts/serve-static.mjs'], {
  env: { ...process.env, PORT: '4175' }, stdio: 'pipe', windowsHide: true,
});
try {
  await new Promise((resolve, reject) => {
    server.stdout.once('data', resolve);
    server.once('error', reject);
    server.once('exit', code => reject(new Error(`Static server exited: ${code}`)));
  });
  const browser = await chromium.launch(process.platform === 'win32' ? { channel: 'chrome' } : {});
  try {
    const results = [];
    for (const [width, height] of [[1440, 900], [1920, 1080], [768, 1024], [390, 844]]) {
      const mobile = width === 390;
      const page = await browser.newPage({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
      const errors = [];
      const external = [];
      const downloads = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      page.on('request', request => {
        const url = new URL(request.url());
        if (/^https?:$/.test(url.protocol) && url.origin !== origin) external.push(url.origin);
      });
      page.on('requestfinished', request => {
        const path = new URL(request.url()).pathname;
        if (/\.(onnx|wasm|js|mjs)$/.test(path)) downloads.push((async () => {
          const timing = request.timing();
          return { path, encodedBytes: (await request.sizes()).responseBodySize, elapsedMs: Math.round(timing.responseEnd) };
        })());
      });
      await page.goto(origin);
      await page.locator('[role=status]').filter({ hasText: 'Prediction ready' }).waitFor({ state: 'attached' });
      const readiness = await page.evaluate(() => ({
        readyMs: Math.round(performance.now()),
        jsDecodedBytes: performance.getEntriesByType('resource')
          .filter(entry => new URL(entry.name).pathname.endsWith('.js'))
          .reduce((bytes, entry) => bytes + entry.decodedBodySize, 0),
        heapBytes: performance.memory?.usedJSHeapSize ?? null,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      const latencyMs = Number.parseFloat(await page.getByTestId('latency').textContent());
      await page.locator('.spark-line').first().waitFor({ state: 'attached' });
      const prefix = `${width}x${height}`;
      await page.screenshot({ path: filePath(`${prefix}.png`), animations: 'disabled' });
      await page.getByRole('button', { name: 'Charts +', exact: true }).click();
      await page.locator('.chart-line').first().waitFor({ state: 'visible' });
      await page.screenshot({ path: filePath(`${prefix}-charts.png`), animations: 'disabled' });
      const result = { width, height, ...readiness, firstSessionRunMs: latencyMs, downloads: await Promise.all(downloads), errors, external };
      assert(!result.overflow && !errors.length && !external.length, JSON.stringify(result));
      results.push(result);
      await page.close();
    }
    await writeFile(new URL('measurements.json', output), JSON.stringify({ browser: browser.version(), results }, null, 2) + '\n');
    console.log(`Captured ${results.length} viewports for ${pass}`);
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}

function filePath(name) {
  return fileURLToPath(new URL(name, output));
}
