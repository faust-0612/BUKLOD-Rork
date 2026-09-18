import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function read(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing file: ${rel}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}

function requireTokens(rel, tokens) {
  const text = read(rel);
  for (const token of tokens) {
    if (!text.includes(token)) failures.push(`${rel} missing: ${token}`);
  }
  return text;
}

console.log('BUKLOD NAVIGATION AD OPPORTUNITY CONTRACT R1');
console.log('=============================================');

const strip = requireTokens('src/components/BuklodNavigationAdStrip.tsx', [
  'BUKLOD_NAV_AD_OPPORTUNITY_R1',
  'placement="focus"',
  'requireViewport={false}',
  'showLabel',
  'isBuklodNavigationAdEligiblePath',
  "path.startsWith('/games/')",
  "'/igpat'",
  "'/reels'",
  "'/privacy'",
  "'/delete-account'",
  "'/admin'",
  "'/system'",
]);

if (/key\s*=\s*\{?\s*pathname/.test(strip)) {
  failures.push('Navigation ad strip must not remount the banner on every pathname change.');
}

requireTokens('src/components/BuklodNavSafeShell.tsx', [
  'BuklodNavigationAdStrip',
  'hidden={keyboardVisible}',
]);

requireTokens('src/components/BuklodNavSafeShell.web.tsx', [
  'BuklodNavigationAdStrip',
]);

const ads = requireTokens('src/lib/buklodAds.ts', [
  'NO automatic every-tap ads.',
  'INTERSTITIAL_MIN_EVENT_COUNT',
  'INTERSTITIAL_COOLDOWN_MS',
]);

if (ads.includes("reason: 'navigation'")) {
  failures.push('Interstitial engine must not become an every-navigation trigger.');
}

const androidPolicy = requireTokens('src/lib/buklodAdMonetizationPolicy.android.ts', [
  'INTERSTITIAL_MIN_EVENT_COUNT = 2',
  'INTERSTITIAL_COOLDOWN_MS = 6 * 60 * 1000',
]);

void androidPolicy;

for (const failure of failures) console.error('FAIL: ' + failure);

if (failures.length) {
  console.error(`\nNAVIGATION AD OPPORTUNITY CONTRACT FAILED with ${failures.length} blocker(s).`);
  process.exit(1);
}

console.log('Persistent banner opportunity: PASS');
console.log('No forced per-navigation banner reload: PASS');
console.log('Interstitial every-tap protection: PASS');
console.log('Sensitive/immersive/gameplay exclusions: PASS');
console.log('NAVIGATION AD OPPORTUNITY CONTRACT PASSED.');
