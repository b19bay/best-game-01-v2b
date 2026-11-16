// EMBERKEEPER — serve.ts
// Tiny static server for game/ (dev convenience, Node 22, stdlib only).
// Serves game/ on 127.0.0.1, port from --port (default 8080).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const gameDir = resolve(join(root, 'game'));
let port = 8080;
const portArg = process.argv.indexOf('--port');
if (portArg >= 0 && process.argv[portArg + 1]) {
  port = parseInt(process.argv[portArg + 1], 10) || 8080;
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = resolve(join(gameDir, '.' + rel));
    // Refuse any path outside game/.
    if (file !== gameDir && !file.startsWith(gameDir + '/')) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('forbidden');
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch (e) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`EMBERKEEPER serving game/ at http://127.0.0.1:${port}/`);
});
