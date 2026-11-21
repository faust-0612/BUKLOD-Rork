#!/usr/bin/env node
/**
 * DEV-only BUKLOD Arena scene mirror.
 * Fetches exactly the three already-referenced BUKLOD Rork art plates and
 * registers their real bytes in the native Expo image registry. No production writes.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ARENA_APPROVED_SCENE_ORIGINS = Object.freeze({
  "genesis_rift": "https://r2-pub.rork.com/projects/kp3ge50a5t6chyb7gv3jn/assets/7b7ca700-de35-49ab-bf6e-2f8f5a515c28.png",
  "aurora_foundry": "https://r2-pub.rork.com/projects/kp3ge50a5t6chyb7gv3jn/assets/02d290ce-4f4c-41ea-9507-19bf23a3acc9.png",
  "verdant_fracture": "https://r2-pub.rork.com/projects/kp3ge50a5t6chyb7gv3jn/assets/466950a3-d8c9-470d-a13c-847fcbcefe5e.png"
});
const MAX_BYTES = 12 * 1024 * 1024;
const PNG_MAGIC = '89504e470d0a1a0a';

export async function downloadApprovedPng(url) {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://r2-pub.rork.com' ||
      !/^\/projects\/kp3ge50a5t6chyb7gv3jn\/assets\/[0-9a-f-]{36}\.png$/.test(parsed.pathname)) {
    throw new Error('Unexpected image source');
  }
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20_000), redirect: 'error', headers: { accept: 'image/png' },
  });
  if (!response.ok || !response.body) throw new Error('Image source unavailable: HTTP ' + response.status);
  let size = 0;
  const chunks = [];
  const reader = response.body.getReader();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BYTES) throw new Error('Scene too large');
      chunks.push(Buffer.from(part.value));
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = Buffer.concat(chunks);
  if (bytes.length < 512 || bytes.subarray(0, 8).toString('hex') !== PNG_MAGIC) throw new Error('Not a PNG');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (width < 256 || height < 256 || width > 4096 || height > 4096 || width * height > 12_000_000)
    throw new Error('Invalid image dimensions');
  return bytes;
}

async function main() {
  const temp = mkdtempSync(join(tmpdir(), 'buklod-arena-assets-'));
  try {
    for (const [id, url] of Object.entries(ARENA_APPROVED_SCENE_ORIGINS)) {
      const image = await downloadApprovedPng(url);
      const input = join(temp, id + '.png');
      writeFileSync(input, image);
      const result = spawnSync(process.execPath,
        [join(root, 'scripts/ingest-buklod-visual-baseline.mjs'),
         '--source', input, '--kind', 'scene', '--id', id],
        { cwd: root, encoding: 'utf8', timeout: 15_000 });
      if (result.status !== 0) throw new Error(id + ' asset ingestion failed: ' + (result.stderr || result.error));
      const receipt = JSON.parse(result.stdout.trim());
      if (receipt.registered !== 'scene:' + id) throw new Error('Wrong asset receipt');
      process.stdout.write(JSON.stringify({ scene: id, file: receipt.file, sha256: receipt.sha256, bytes: receipt.bytes }) + '\n');
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => { process.stderr.write(String(error) + '\n'); process.exitCode = 1; });
}
