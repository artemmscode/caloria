/*
 * Minimal zero-dependency static server for local CALORIA development.
 * Serves frontend/ on http://localhost:5500 with no caching, so edits are picked
 * up on refresh. Production frontend is served by GitHub Pages.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import http from 'node:http';

const ROOT = resolve(process.cwd(), 'frontend');
const PORT = Number(process.env.STATIC_PORT || 5500);
const HOST = process.env.STATIC_HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function safePath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent((urlPath || '/').split('?')[0]);
  } catch {
    return null;
  }
  const clean = normalize(decoded).replace(/^([/\\])+/, '');
  const target = resolve(join(ROOT, clean));
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return null;
  return target;
}

const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('Method Not Allowed');
    return;
  }

  let target = safePath(req.url);
  if (!target) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
  if (!existsSync(target) || !statSync(target).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found. The Mini App uses hash routes, so only real files exist here.');
    return;
  }

  const type = MIME[extname(target).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'no-store, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(target).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`CALORIA frontend: http://${HOST}:${PORT}/`);
  console.log('API expected at the URL from frontend/config.js (default http://localhost:3000).');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}