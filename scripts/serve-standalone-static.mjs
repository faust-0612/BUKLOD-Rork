import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const rootArg = String(process.argv[2] ?? '').trim();
const port = Number(process.argv[3] ?? 0);

if (!rootArg || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Usage: node scripts/serve-standalone-static.mjs <dist-dir> <port>');
  process.exit(2);
}

const root = resolve(process.cwd(), rootArg);
const indexFile = resolve(root, 'index.html');

if (!existsSync(indexFile)) {
  console.error(`Missing standalone export: ${indexFile}`);
  process.exit(1);
}

const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.ttf', 'font/ttf'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function safeAssetPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const candidate = resolve(root, '.' + decoded);
  if (candidate !== root && !candidate.startsWith(root + sep)) return null;
  return candidate;
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const candidate = safeAssetPath(url.pathname);
  const asset =
    candidate && existsSync(candidate) && statSync(candidate).isFile()
      ? candidate
      : indexFile;

  const ext = extname(asset).toLowerCase();
  const isIndex = asset === indexFile;

  res.statusCode = 200;
  res.setHeader('Content-Type', types.get(ext) ?? 'application/octet-stream');
  res.setHeader('Cache-Control', isIndex ? 'no-store' : 'public, max-age=60');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  createReadStream(asset).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log(`BUKLOD_STANDALONE_STATIC=http://127.0.0.1:${port}`);
  console.log(`ROOT=${root}`);
});
