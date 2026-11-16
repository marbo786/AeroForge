import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const host = new URL(process.argv[2] ?? 'http://127.0.0.1:4177/');
assert(host.protocol === 'https:' || (host.protocol === 'http:' && host.hostname === '127.0.0.1'),
  'Use an HTTPS Pages URL or a loopback URL for local emulation');
const manifest = JSON.parse(await readFile(new URL('../../artifacts/recovery-v1-complete/model.json', import.meta.url)));
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url)));
const version = lock.packages['node_modules/onnxruntime-web'].version;
const model = `/models/${manifest.version}/${manifest.model_file}`;
const wasm = `/runtime/${version}/ort-wasm-simd-threaded.wasm`;
const modulePath = `/runtime/${version}/ort.wasm.min.mjs`;
const browser = await chromium.launch(process.platform === 'win32' ? { channel: 'chrome' } : {});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  const external = [];
  const runtimePaths = new Set();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => {
    const url = new URL(request.url());
    if (!['http:', 'https:'].includes(url.protocol)) return;
    if (url.origin !== host.origin) external.push(url.origin);
    runtimePaths.add(url.pathname);
  });
  for (const [path, pattern] of [
    ['/', /NACA 2412/],
    ['/studio/?m=.04&p=.4&t=.12&aoa=4&re=250000', /NACA 4412/],
    ['/model/', /Model evidence/i],
    ['/spike/', /inference/i],
  ]) {
    const response = await page.goto(new URL(path, host).href);
    assert.equal(response?.status(), 200, path);
    assert.match(response.headers()['content-type'], /text\/html/i, path);
    assert.equal(response.headers()['x-content-type-options'], 'nosniff', path);
    await page.getByRole('heading', { level: 1, name: pattern }).waitFor();
    if (path === '/' || path.startsWith('/studio/')) {
      await page.getByRole('status').filter({ hasText: 'Prediction ready' }).waitFor({ state: 'attached' });
      assert.match(await page.getByTestId('cl').innerText(), /^-?\d+\.\d{4}$/);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile overflow');
    }
  }
  for (const [path, type] of [[model, /application\/octet-stream/i], [wasm, /application\/wasm/i], [modulePath, /javascript/i]]) {
    assert(runtimePaths.has(path), `Browser did not request ${path}`);
    const response = await page.request.get(new URL(path, host).href);
    assert.equal(response.status(), 200, path);
    assert.match(response.headers()['content-type'], type, path);
    assert.match(response.headers()['cache-control'], /immutable/i, path);
    if (path === model) assert.equal(createHash('sha256').update(await response.body()).digest('hex'), manifest.model_sha256);
  }
  const missing = await page.request.get(new URL(`/runtime/${version}/missing.wasm`, host).href);
  assert.equal(missing.status(), 404, 'Missing runtime files must return HTTP 404');
  const serverManifest = await page.request.get(new URL(`/models/${manifest.version}/model.json`, host).href);
  assert.equal(serverManifest.status(), 200);
  assert.deepEqual(await serverManifest.json(), manifest, 'Published model manifest differs from the accepted manifest');
  const preprocessing = await page.request.get(new URL(`/models/${manifest.version}/preprocessing.json`, host).href);
  assert.equal(preprocessing.status(), 200);
  assert.equal(createHash('sha256').update(await preprocessing.body()).digest('hex'), manifest.preprocessing_sha256);
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(JSON.stringify({ origin: host.origin, browser: browser.version(), routes: 4, sameOriginInference: true,
    modelAndPreprocessingVerified: true, headers: 'MIME, nosniff, immutable', missingAssetStatus: 404, browserErrors: errors.length }, null, 2));
} finally {
  await browser.close();
}
