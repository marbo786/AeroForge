import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(fileURLToPath(new URL('../out/', import.meta.url)));
const port = Number(process.env.PORT ?? 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream', '.json': 'application/json', '.txt': 'text/plain', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
// Local verification server only. It serves files, never performs inference.
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const original = await readFile(file);
    const gzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '') && original.length > 1024;
    const bytes = gzip ? gzipSync(original) : original;
    const etag = `"${bytes.length}-${(await stat(file)).mtimeMs}-${gzip ? 'gzip' : 'raw'}"`;
    const cache = /\/(runtime|models)\//.test(pathname) ? 'public, max-age=31536000, immutable' : 'no-cache';
    const headers = { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': cache, ETag: etag,
      'Content-Length': bytes.length, Vary: 'Accept-Encoding', ...(gzip ? { 'Content-Encoding': 'gzip' } : {}) };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers).end(); return; }
    res.writeHead(200, headers).end(bytes);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Static export: http://127.0.0.1:${port}`));
