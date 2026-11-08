// Minimal static server for playing in a desktop browser: `npm run serve`, then open the URL.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../www/', import.meta.url));
const devRoot = fileURLToPath(new URL('./dev/', import.meta.url));
const port = Number(process.env.PORT || 8123);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.hdr': 'application/octet-stream', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream',
  '.gltf': 'model/gltf+json', '.txt': 'text/plain; charset=utf-8',
};
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    if (p === '' || p.endsWith('/')) p += 'index.html';
    const base = p.startsWith('dev/') ? devRoot : root;
    const file = join(base, p.startsWith('dev/') ? p.slice(4) : p);
    if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch (e) {
    res.writeHead(404); res.end('not found');
  }
}).listen(port, () => console.log(`The Great Lawn: http://localhost:${port}/`));
