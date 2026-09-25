import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const failures = [];
const passes = [];

function read(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing required brand file: ${rel}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}

function requireAll(rel, needles, label = rel) {
  const text = read(rel);
  let ok = true;

  for (const needle of needles) {
    if (!text.includes(needle)) {
      failures.push(`${label} missing: ${needle}`);
      ok = false;
    }
  }

  if (ok) passes.push(label);
}

function forbidAll(rel, needles, label = rel) {
  const text = read(rel);
  let ok = true;

  for (const needle of needles) {
    if (text.includes(needle)) {
      failures.push(`${label} contains legacy brand marker: ${needle}`);
      ok = false;
    }
  }

  if (ok) passes.push(`${label} legacy-free`);
}

console.log('BUKLOD MAIN BRAND LOCK R1');
console.log('=========================');

const canonicalAsset =
  'assets/release/app-icon.png';

if (!fs.existsSync(path.join(ROOT, canonicalAsset))) {
  failures.push('Canonical Main app icon is missing.');
} else {
  const bytes = fs.readFileSync(
    path.join(ROOT, canonicalAsset),
  );

  if (bytes.length < 20_000) {
    failures.push(
      'Canonical Main app icon looks unexpectedly small/corrupt.',
    );
  } else {
    const hash = crypto
      .createHash('sha256')
      .update(bytes)
      .digest('hex');

    const expectedHash =
      '49260ffb09b162b082b5e4d6773c9c4712834de4f593f836029c0e5df439dc60';

    console.log(`CANONICAL_ICON_SHA256=${hash}`);

    if (hash !== expectedHash) {
      failures.push(
        'Canonical Main app icon hash changed. Restore the locked new BUKLOD logo.',
      );
    } else {
      passes.push('canonical Main app icon exact hash locked');
    }
  }
}

for (const legacy of [
  'assets/release/splash-icon.png',
  'assets/release/buklod-generic.png',
]) {
  if (fs.existsSync(path.join(ROOT, legacy))) {
    failures.push(
      `Legacy Main brand asset must not exist: ${legacy}`,
    );
  } else {
    passes.push(`legacy asset removed: ${legacy}`);
  }
}

requireAll('app.config.js', [
  'BUKLOD_MAIN_CANONICAL_BRAND_R1',
  "const mainBrandIcon = './assets/release/app-icon.png';",
  'icon: isClassroom ?',
  ': mainBrandIcon,',
  'favicon: isClassroom',
  "'expo-splash-screen'",
], 'Expo Main brand config');

forbidAll('app.config.js', [
  './assets/release/splash-icon.png',
  './assets/release/buklod-generic.png',
], 'Expo Main brand config');

requireAll('src/components/BuklodMainBrandIntro.tsx', [
  'BUKLOD_MAIN_CANONICAL_BRAND_R1',
  "require('../../assets/release/app-icon.png')",
  'BUKLOD',
  'Your Daily Companion in Life',
  'Animated.sequence',
  'markScale',
  'textOpacity',
  'screenOpacity',
], 'Animated Main startup identity');

requireAll('src/app/_layout.tsx', [
  "import BuklodMainBrandIntro from '@/components/BuklodMainBrandIntro';",
  '<BuklodMainBrandIntro>',
  '</BuklodMainBrandIntro>',
], 'Root startup brand integration');

forbidAll('src/app/(auth)/login.tsx', [
  'buklod-generic.png',
  'splash-icon.png',
], 'Login brand surface');

requireAll('src/app/(auth)/login.tsx', [
  "../../../assets/release/app-icon.png",
], 'Login canonical logo');

function walkRuntime(dir) {
  if (!fs.existsSync(dir)) return [];

  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      out.push(...walkRuntime(full));
      continue;
    }

    if (
      entry.isFile() &&
      /\.(?:ts|tsx|js|jsx|mjs|cjs|json)$/.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

const runtimeRoots = [
  path.join(ROOT, 'src'),
  path.join(ROOT, 'plugins'),
];

const legacyRuntimeMarkers = [
  'assets/release/buklod-generic.png',
  'assets/release/splash-icon.png',
  '../release/buklod-generic.png',
  '../release/splash-icon.png',
  '../../assets/release/buklod-generic.png',
  '../../assets/release/splash-icon.png',
  '../../../assets/release/buklod-generic.png',
  '../../../assets/release/splash-icon.png',
];

let runtimeLegacyClean = true;

for (const root of runtimeRoots) {
  for (const file of walkRuntime(root)) {
    const text = fs.readFileSync(file, 'utf8');

    for (const marker of legacyRuntimeMarkers) {
      if (text.includes(marker)) {
        failures.push(
          `Legacy Main logo reference found in runtime source: ${path.relative(ROOT, file)} -> ${marker}`,
        );
        runtimeLegacyClean = false;
      }
    }
  }
}

if (runtimeLegacyClean) {
  passes.push('all runtime source is legacy-logo free');
}

if (failures.length) {
  console.error('');
  for (const failure of failures) {
    console.error(`FAIL: ${failure}`);
  }
  console.error('');
  console.error(
    `BUKLOD MAIN BRAND LOCK FAILED with ${failures.length} blocker(s).`,
  );
  console.error('DO NOT BUILD APK OR DEPLOY WEB.');
  process.exit(1);
}

console.log('');
for (const pass of passes) {
  console.log(`PASS: ${pass}`);
}
console.log('');
console.log(
  'BUKLOD MAIN BRAND LOCK PASSED — single canonical brand path is protected.',
);
