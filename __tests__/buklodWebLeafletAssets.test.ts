import { spawnSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';

import { buildBuklodLiveSatelliteMapDocument } from '@/lib/buklodLiveSatelliteMapDocument';

const ROOT = path.resolve(__dirname, '..');
const LEAFLET_JS = path.join(
  ROOT,
  'public/vendor/leaflet/leaflet.js',
);
const LEAFLET_CSS = path.join(
  ROOT,
  'public/vendor/leaflet/leaflet.css',
);
const LEAFLET_ICON = path.join(
  ROOT,
  'public/vendor/leaflet/images/marker-icon.png',
);

function readText(file: string) {
  return fs.readFileSync(file, 'utf8');
}

function assertEngineFile(file: string, marker: string) {
  expect(fs.existsSync(file)).toBe(true);
  const body = readText(file);
  expect(body.length).toBeGreaterThan(1000);
  expect(body.trimStart().startsWith('<')).toBe(false);
  expect(body.toLowerCase().includes('<!doctype html')).toBe(false);
  expect(body.includes(marker)).toBe(true);
}

function request(
  baseUrl: string,
  asset: string,
): Promise<{ status: number; type: string; body: string }> {
  const url = new URL(asset, baseUrl);
  return new Promise((resolve, reject) => {
    const req = http.request(url, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        resolve({
          status: response.statusCode || 0,
          type: String(response.headers['content-type'] || ''),
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function servePublic(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const root = path.join(ROOT, 'public');
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    const relative = decodeURIComponent(url.pathname).replace(
      /^\/+/,
      '',
    );
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) && file !== root) {
      response.writeHead(403);
      response.end('forbidden');
      return;
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<!doctype html><title>SPA fallback</title>');
      return;
    }
    const type = file.endsWith('.js')
      ? 'text/javascript'
      : file.endsWith('.css')
        ? 'text/css'
        : 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(file).pipe(response);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Leaflet test server did not bind.');
      }
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((done, reject) => {
            server.close((error) => (error ? reject(error) : done()));
          }),
      });
    });
  });
}

describe('BUKLOD web Leaflet assets', () => {
  it('serves licensed local Leaflet JS and CSS instead of the SPA HTML fallback', async () => {
    assertEngineFile(LEAFLET_JS, '1.9.4');
    assertEngineFile(LEAFLET_CSS, '.leaflet-container');
    expect(fs.existsSync(LEAFLET_ICON)).toBe(true);
    expect(readText(path.join(ROOT, 'public/vendor/leaflet/LICENSE'))).toMatch(
      /BSD/i,
    );

    const server = await servePublic();
    try {
      for (const asset of [
        '/vendor/leaflet/leaflet.js?v=1.9.4-buklod-r4',
        '/vendor/leaflet/leaflet.css?v=1.9.4-buklod-r4',
      ]) {
        const response = await request(server.baseUrl, asset);
        expect(response.status).toBe(200);
        expect(response.type.includes('text/html')).toBe(false);
        expect(response.body.trimStart().startsWith('<')).toBe(false);
        expect(response.body.toLowerCase().includes('<!doctype html')).toBe(
          false,
        );
      }
    } finally {
      await server.close();
    }
  });

  it('points the srcDoc map at the local engine and keeps a same-version CDN fallback', () => {
    const document = buildBuklodLiveSatelliteMapDocument({
      points: [],
      center: { latitude: 14.5, longitude: 121.0 },
    });

    expect(document).toContain(
      '/vendor/leaflet/leaflet.js?v=1.9.4-buklod-r4',
    );
    expect(document).toContain(
      '/vendor/leaflet/leaflet.css?v=1.9.4-buklod-r4',
    );
    expect(document).toContain(
      'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    );
    expect(document).toContain(
      'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    );
    expect(document).toContain('buklodBootLiveMap');
    expect(document).toContain('BUKLOD_LOCAL_LEAFLET_ENGINE_MISSING');
    expect(document).toContain('L.map(');
    expect(document).toContain('L.marker(');

    const inline = document.match(/<script>([\s\S]*)<\/script>/);
    expect(inline?.[1]).toBeTruthy();
    const scriptFile = path.join(os.tmpdir(), 'buklod-map-script-check.js');
    fs.writeFileSync(scriptFile, inline?.[1] ?? '');
    const check = spawnSync(process.execPath, ['--check', scriptFile], {
      encoding: 'utf8',
    });
    expect(check.status).toBe(0);
  });
});
