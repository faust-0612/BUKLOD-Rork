import fs from 'node:fs';

const checks = [
  {
    file: 'src/components/BuklodWebCommunityMapHeader.web.tsx',
    tokens: [
      'BUKLOD_WEB_COMMUNITY_MAP_R6_SATELLITE',
      "import { BuklodLiveSatelliteMap } from '@/components/BuklodLiveSatelliteMap.web';",
      'getBuklodCitySnapshot',
      '<BuklodLiveSatelliteMap',
      'canManagePlace={false}',
    ],
  },
  {
    file: 'src/components/BuklodLiveSatelliteMap.web.tsx',
    tokens: [
      'BUKLOD_LIVE_SATELLITE_MAP_R1',
      'Tap map to open',
      '{iframe(false)}',
      '{iframe(true)}',
      "pointerEvents: interactive ? 'auto' : 'none'",
      'World_Imagery/MapServer/tile',
      'World_Boundaries_and_Places/MapServer/tile',
      "'Satellite': satellite",
      "'Nearby places': nearbyPlaces",
      'overpass-api.de/api/interpreter',
      'overpass.kumi.systems/api/interpreter',
      'hospital|clinic|doctors|pharmacy|police|fire_station|school|college|university',
      '["shop"]["name"]',
      '["office"]["name"]',
      'buklod-home-marker',
      'buklod-home-door',
      'buklod-home-address',
      'privateHomePoint.localityLabel',
      "window.top.location.assign('/personal-home')",
      "Satellite • loading nearby places",
      "title: interactive\n        ? 'BUKLOD live satellite interactive community map'",
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

console.log('BUKLOD COMMUNITY LIVE SATELLITE MAP RELEASE CONTRACT');
console.log('====================================================');
console.log(
  'LOCK: Community Wall uses the real satellite map preview; Tap map to open stays; full map loads nearby real-world places; Home door remains inside the map above the saved address label.',
);

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
  console.error(
    `COMMUNITY LIVE SATELLITE MAP RELEASE LOCK FAILED: ${failures} blocker(s).`,
  );
  process.exit(1);
}

console.log('COMMUNITY LIVE SATELLITE MAP RELEASE LOCK PASSED.');
