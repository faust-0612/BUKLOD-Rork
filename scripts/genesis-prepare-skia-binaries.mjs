#!/usr/bin/env node
/**
 * Prepare only the locked @shopify/react-native-skia native Android assets after a
 * --ignore-scripts npm ci. Never enable arbitrary dependency lifecycle scripts.
 * This is build preparation, not an APK/native acceptance result.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const manifestPath = require.resolve('@shopify/react-native-skia/package.json', { paths: [root] });
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.version !== '2.6.2') throw Error('Skia native installer not audited for version ' + manifest.version);
const installer = manifest.bin?.['install-skia'];
if (installer !== 'scripts/install-libs.js') {
  throw Error('Unexpected Skia native install binary: ' + String(installer));
}
const dir = path.dirname(manifestPath);
const entry = path.resolve(dir, installer);
if (!entry.startsWith(dir + path.sep) || !existsSync(entry)) {
  throw Error('Skia installer missing or escapes pinned package');
}
execFileSync(process.execPath, [entry], { cwd: root, stdio: 'inherit', timeout: 180000 });
for (const abi of ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64']) {
  const lib = path.join(dir, 'libs', 'android', abi, 'libskia.a');
  if (!existsSync(lib) || statSync(lib).size === 0) {
    throw Error('Skia prebuilt missing after install: ' + abi);
  }
}
console.log('Locked Skia 2.6.2 Android assets present for all four ABIs; no full dependency postinstall run.');
