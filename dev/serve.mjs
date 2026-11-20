// Local static server for web/ (dev only, not deployed).
// Usage: SERVE_OK=1 DEV_API=1 node web/dev/serve.mjs
// Env: PORT (default 8080), DEV_API=1 serves config.js with WAITLIST_API="/api"
// and proxies /api to the mock at API_TARGET (default http://127.0.0.1:8787).

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// PC rule: a stand must not grab an interactive console unless explicitly allowed.
if (process.stdout.isTTY && process.env.SERVE_OK !== '1') {
  console.error('Refusing to start in an interactive console. Set SERVE_OK=1 to run it here.');
  process.exit(1);
}

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT || 8080);
const HOST = '127.0.0.1';
const DEV_API = process.env.DEV_API === '1';
const API_TARGET = process.env.API_TARGET || 'http://127.0.0.1:8787';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

async function proxy(req, res) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const target = API_TARGET + req.url.replace(/^\/api/, '');
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: { 'Content-Type': req.headers['content-type'] || 'text/plain;charset=utf-8' },
      body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json' });
    res.end(body);
  } catch {
    // Mock is down: behave like a dead network so the page shows its fallback.
    req.socket.destroy();
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  if (url.pathname.startsWith('/api')) return proxy(req, res);
  if (DEV_API && url.pathname === '/config.js') {
    res.writeHead(200, { 'Content-Type': TYPES['.js'], 'Cache-Control': 'no-store' });
    return res.end('window.WAITLIST_API = "/api";\n');
  }
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT + sep)) {
    res.writeHead(403);
    return res.end();
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, HOST, () => console.log(`serving ${ROOT} on http://${HOST}:${PORT} (DEV_API=${DEV_API ? 1 : 0})`));
