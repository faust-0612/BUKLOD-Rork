import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const failures = [];

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

function newestMtime(files) {
  return Math.max(
    ...files
      .map(rel => path.join(root, rel))
      .filter(file => fs.existsSync(file))
      .map(file => fs.statSync(file).mtimeMs),
  );
}

const criticalSources = [
  'src/app/city.web.tsx',
  'src/app/index.web.tsx',
  'src/components/BuklodCityDashboardR6.web.tsx',
  'src/components/BuklodCityMap.web.tsx',
  'src/components/BuklodCommunityBulletinR6.web.tsx',
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
]);

requireText('src/components/BuklodCommunityBulletinR6.web.tsx', [
  'Refresh latest weather',
  'WALANG PASOK / CLASS SUSPENSIONS',
  'PUBLIC ANNOUNCEMENTS',
  'IMPORTANT NEWS',
  'Linking.openURL',
  'onOpenMapItem',
]);

requireText('src/app/index.web.tsx', ["'/city'"]);

let head = 'unknown';
try {
  head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();

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
    failures.push('dist is older than a critical City source file. Re-export to dist before deploy.');
  }
}

if (fs.existsSync(bundleDir)) {
  const bundles = fs.readdirSync(bundleDir).filter(name => name.endsWith('.js'));
  if (!bundles.length) failures.push('No web JS bundle found under dist/_expo/static/js/web.');
}

if (failures.length) {
  console.error(`\nBUKLOD CITY RELEASE GATE: BLOCKED @ ${head}\n`);
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('\nDO NOT run EAS production deploy until every item passes.\n');
  process.exit(1);
}

console.log(`BUKLOD CITY RELEASE GATE: PASS @ ${head}`);
console.log('Critical Home/City/map/bulletin anchors present.');
console.log('dist is fresh and was exported to the canonical dist directory.');
console.log('Proceed to production deploy, then perform physical mobile smoke checks before declaring complete.');
