import fs from 'node:fs';

const checks = [
  {
    file: 'src/components/BuklodWebCommunityMapHeader.web.tsx',
    tokens: [
      'BUKLOD_WEB_COMMUNITY_MAP_R5',
      "import { BuklodCityMap } from '@/components/BuklodCityMap.web';",
      'getBuklodCitySnapshot',
      '<BuklodCityMap',
      'canManagePlace={false}',
    ],
  },
  {
    file: 'src/components/BuklodCityMap.web.tsx',
    tokens: [
      'Tap map to open',
      '{iframe(false)}',
      '{iframe(true)}',
      "pointerEvents: interactive ? 'auto' : 'none'",
      'buklod-home-marker',
      'buklod-home-door',
      'buklod-home-address',
      'privateHomePoint.localityLabel',
      "window.top.location.assign('/personal-home')",
      "title: interactive ? 'BUKLOD City interactive community map' : 'BUKLOD City map preview'",
    ],
  },
  {
    file: 'src/lib/buklodHomeLocation.ts',
    tokens: [
      'buklod_user_addresses',
      'localityLabel',
      'The resulting coordinates are intentionally NOT written to the public City',
    ],
  },
  {
    file: 'src/components/BuklodDashboardContextBar.tsx',
    tokens: [
      'WEB_COMMUNITY_MAP_R5',
      'the real City map is rendered inside the Community Wall list',
      'if (webCommunityRoute)',
    ],
  },
];

let failures = 0;

console.log('BUKLOD COMMUNITY LIVE MAP RELEASE CONTRACT');
console.log('==========================================');
console.log('LOCK: Community Wall uses the real map preview; Tap map to open stays; Home door remains inside the map above the saved address label.');

for (const check of checks) {
  if (!fs.existsSync(check.file)) {
    console.error(`FAIL: missing locked file: ${check.file}`);
    failures += 1;
    continue;
  }

  const source = fs.readFileSync(check.file, 'utf8');
  for (const token of check.tokens) {
    if (!source.includes(token)) {
      console.error(`FAIL: ${check.file} missing locked token: ${token}`);
      failures += 1;
    }
  }
}

if (failures > 0) {
  console.error(`COMMUNITY LIVE MAP RELEASE LOCK FAILED: ${failures} blocker(s).`);
  process.exit(1);
}

console.log('COMMUNITY LIVE MAP RELEASE LOCK PASSED.');
