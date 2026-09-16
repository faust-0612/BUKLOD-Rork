import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const failures = [];

/*
 * BUKLOD_CITY_HOME_FREEZE_R8
 *
 * These are the exact committed Git blob identities of the approved City/Home
 * production baseline. A normal source edit must NOT silently change them.
 * Intentional future City/Home work must explicitly update this contract after
 * review; otherwise the production release gate blocks deployment.
 */
const FROZEN_RELEASE_BLOBS = {
  'src/app/city.web.tsx': '427a9c53a5b12e357c575a7992f140b7212f6cb1',
  'src/app/index.web.tsx': '767735cbef429d35fbe2350faa1726dab09bed7d',
  'src/app/personal-home/index.tsx': 'd15fe20456d778638ac0234846fae12fd3e70cf9',
  'src/app/personal-home/index.web.tsx': 'd15fe20456d778638ac0234846fae12fd3e70cf9',
  'src/app/personal-home/index.native.tsx': 'd15fe20456d778638ac0234846fae12fd3e70cf9',
  'src/components/BuklodCityDashboardR6.web.tsx': '24d039c759ab0af94e30e1970e1625ccd68719f4',
  'src/components/BuklodCityMap.web.tsx': '769b9aa6e0f18cef72f1bd15a6132ff3968f0caa',
  'src/components/BuklodCommunityBulletin.web.tsx': '1a9d9867f84621d122ba3299f1d2d6e957449b92',
  'src/components/BuklodCommunityBulletinR6.web.tsx': '0c4b095861485ba784586718c3d2faa1d2a0ef26',
  'src/components/home/BuklodSpatialHomeV2.tsx': '7b818b429d2631f5819403c74449bce049384e0d',
};

function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing required file: ${rel}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}

function requireText(rel, needles) {
  const text = read(rel);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      failures.push(`${rel} is missing required release anchor: ${needle}`);
    }
  }
}

function requirePattern(rel, pattern, label) {
  const text = read(rel);
  if (!pattern.test(text)) {
    failures.push(`${rel} is missing required release anchor: ${label}`);
  }
}

function requireCommittedBlob(rel, expectedBlob) {
  try {
    const actualBlob = execFileSync('git', ['rev-parse', `HEAD:${rel}`], {
      cwd: root,
      encoding: 'utf8',
    }).trim();

    if (actualBlob !== expectedBlob) {
      failures.push(
        `${rel} changed from frozen City/Home baseline ` +
        `(expected ${expectedBlob.slice(0, 8)}, found ${actualBlob.slice(0, 8)}). ` +
        'Restore the approved baseline or deliberately update the freeze contract.',
      );
    }
  } catch (error) {
    failures.push(
      `Could not verify frozen blob for ${rel}: ` +
      (error instanceof Error ? error.message : String(error)),
    );
  }
}

function newestMtime(files) {
  return Math.max(
    ...files
      .map(rel => path.join(root, rel))
      .filter(file => fs.existsSync(file))
      .map(file => fs.statSync(file).mtimeMs),
  );
}

const criticalSources = [
  ...Object.keys(FROZEN_RELEASE_BLOBS),
];

requireText('src/app/city.web.tsx', [
  'BuklodCityDashboardR6',
  'home-outline',
  "router.push('/(tabs)/me' as any)",
  'Open BUKLOD Home',
]);

requireText('src/components/BuklodCityDashboardR6.web.tsx', [
  "route: '/church'",
  "route: '/profile/buklod-classrooms'",
  "route: '/profile/buklod-market'",
  "route: '/profile/buklod-business'",
  "route: '/organizations'",
  "route: '/profile/buklod-local'",
  "openRoute('/(tabs)/buklod')",
  'Refresh City',
  'Clear City search',
  'Show all map layers',
  'onShareLocation',
  'onManagePlace={openManage}',
  'BuklodCommunityBulletinR6',
]);

requireText('src/components/BuklodCityMap.web.tsx', [
  'BUKLOD Navigation',
  'Tap map to open',
  'onShareLocation',
  'onManagePlace',
  'loadMyBuklodHomeMapLocation',
  "window.top.location.assign('/personal-home')",
]);

requireText('src/components/BuklodCommunityBulletinR6.web.tsx', [
  'Refresh latest weather',
  'WALANG PASOK / CLASS SUSPENSIONS',
  'PUBLIC ANNOUNCEMENTS',
  'IMPORTANT NEWS',
  'Linking.openURL',
  'onOpenMapItem',
]);

requirePattern(
  'src/app/index.web.tsx',
  /<Redirect\s+href=["']\/city["']\s*\/>/,
  '<Redirect href="/city" />',
);

requireText('src/app/personal-home/index.tsx', [
  'BuklodSpatialHomeV2',
  'export default BuklodSpatialHomeV2',
]);

requireText('src/components/home/BuklodSpatialHomeV2.tsx', [
  "router.replace('/city' as any)",
  'COMMUNITY MAP',
  'Back to BUKLOD City',
  'MARKET / DELIVERY',
]);

let head = 'unknown';
try {
  head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();

  for (const [rel, expectedBlob] of Object.entries(FROZEN_RELEASE_BLOBS)) {
    requireCommittedBlob(rel, expectedBlob);
  }

  const trackedChanges = execFileSync(
    'git',
    ['status', '--porcelain', '--untracked-files=no'],
    { cwd: root, encoding: 'utf8' },
  ).trim();
  if (trackedChanges) {
    failures.push(`Tracked working tree changes detected:\n${trackedChanges}`);
  }
} catch (error) {
  failures.push(`Could not verify Git HEAD/status: ${error instanceof Error ? error.message : String(error)}`);
}

const distDir = path.join(root, 'dist');
const distIndex = path.join(distDir, 'index.html');
const distMetadata = path.join(distDir, 'metadata.json');
const bundleDir = path.join(distDir, '_expo', 'static', 'js', 'web');

if (!fs.existsSync(distIndex)) failures.push('Missing dist/index.html. Export specifically to dist before deploy.');
if (!fs.existsSync(distMetadata)) failures.push('Missing dist/metadata.json. Export specifically to dist before deploy.');
if (!fs.existsSync(bundleDir)) failures.push('Missing dist/_expo/static/js/web. Export specifically to dist before deploy.');

if (fs.existsSync(distIndex)) {
  const distMtime = fs.statSync(distIndex).mtimeMs;
  const ageMinutes = (Date.now() - distMtime) / 60000;
  if (ageMinutes > 15) {
    failures.push(`dist/index.html is stale (${ageMinutes.toFixed(1)} minutes old). Re-export to dist immediately before deploy.`);
  }

  const sourceMtime = newestMtime(criticalSources);
  if (Number.isFinite(sourceMtime) && distMtime + 1000 < sourceMtime) {
    failures.push('dist is older than a critical City/Home source file. Re-export to dist before deploy.');
  }
}

if (fs.existsSync(bundleDir)) {
  const bundles = fs.readdirSync(bundleDir).filter(name => name.endsWith('.js'));
  if (!bundles.length) failures.push('No web JS bundle found under dist/_expo/static/js/web.');
}

if (failures.length) {
  console.error(`\nBUKLOD CITY/HOME RELEASE GATE: BLOCKED @ ${head}\n`);
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nDO NOT run EAS production deploy until every item passes.\n');
  process.exit(1);
}

console.log(`BUKLOD CITY/HOME RELEASE GATE: PASS @ ${head}`);
console.log('Frozen City/Home fingerprints and critical anchors verified.');
console.log('dist is fresh and was exported to the canonical dist directory.');
console.log('Proceed to production deploy, then perform physical mobile smoke checks before declaring complete.');
