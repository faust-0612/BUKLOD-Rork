import fs from 'node:fs';

const checks = [
  {
    file: 'src/components/BuklodCommunityMapNav.native.tsx',
    tokens: [
      'BUKLOD_ANDROID_COMMUNITY_SATELLITE_MAP_R1',
      "from 'react-native-maps'",
      'PROVIDER_GOOGLE',
      'mapType="hybrid"',
      'Tap map to open',
      'BUKLOD LIVE MAP',
      'BUKLOD NAVIGATION',
      'overpass-api.de/api/interpreter',
      'overpass.kumi.systems/api/interpreter',
      'hospital|clinic|doctors|pharmacy|police|fire_station|school|college|university',
      '["shop"]["name"]',
      '["office"]["name"]',
      'getBuklodCitySnapshot',
      'loadMyBuklodHomeMapLocation',
      "router.push('/personal-home' as any)",
      "home.localityLabel || 'My saved address'",
      "point.kind !== 'PERSON'",
      'POI_RELOAD_DISTANCE_KM',
      'Keep BUKLOD + Home markers usable when external POI data is unavailable.',
    ],
  },
  {
    file: 'src/components/BuklodDashboardContextBar.tsx',
    tokens: [
      'import BuklodCommunityMapNav',
      '<BuklodCommunityMapNav />',
      'activeScope?.scope_type',
      "'PUBLIC'",
      'communityRoute',
    ],
  },
  {
    file: 'src/lib/buklodHomeLocation.ts',
    tokens: [
      'The resulting coordinates are intentionally NOT written to the public City',
      'localityLabel',
      'buklod_user_addresses',
    ],
  },
];

let failures = 0;

console.log('BUKLOD ANDROID COMMUNITY SATELLITE MAP RELEASE CONTRACT');
console.log('=======================================================');
console.log(
  'LOCK: Android Public Community uses the real native satellite/hybrid map, Tap map to open stays, nearby places load safely, BUKLOD Navigation remains, and private Home stays local-only.',
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
  console.error(`ANDROID COMMUNITY MAP RELEASE LOCK FAILED: ${failures} blocker(s).`);
  process.exit(1);
}

console.log('ANDROID COMMUNITY SATELLITE MAP RELEASE LOCK PASSED.');
