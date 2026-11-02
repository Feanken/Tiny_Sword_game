// Optional local server; opening index.html directly also works.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.md': 'text/plain; charset=utf-8' };
export const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end('Bad request'); return; }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep) || path.relative(root, file).split(path.sep).some(p => p.startsWith('.'))) { res.writeHead(403).end('Forbidden'); return; }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    const stream = fs.createReadStream(file); stream.on('error', () => res.destroy()); stream.pipe(res);
  });
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} sedang dipakai. Buka http://localhost:${port}, atau jalankan dengan PORT lain.` : error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Penjaga Pulau siap: http://localhost:${port}\nCtrl+C untuk menghentikan server.`));
