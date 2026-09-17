import fs from 'node:fs';

const checks = [
  {
    file: 'src/components/BuklodCommunityMapNav.android.tsx',
    tokens: [
      'BUKLOD_ANDROID_COMMUNITY_PROFILE_BUBBLES_R1',
      'loadConnectSuggestedContacts',
      "pathname: '/connect/personal/[threadId]'",
      "threadId: 'new'",
      'targetUserId: contact.user_id',
      "pathname: '/member/[id]'",
      'delayLongPress={420}',
      'onPress={() => openConversation(contact)}',
      'onLongPress={() => openProfile(contact)}',
      'Tap to open personal conversation. Long press to view profile.',
      'showsHorizontalScrollIndicator={false}',
    ],
    absentTokens: [
      "from 'react-native-maps'",
      '<MapView',
      'PROVIDER_GOOGLE',
      'Tap map to open',
    ],
  },
  {
    file: 'app.config.js',
    tokens: [
      'GOOGLE_MAPS_ANDROID_API_KEY',
      'androidGoogleMapsApiKey: googleMapsAndroidApiKey',
      "package: packageId",
    ],
  },
  {
    file: 'plugins/withBuklodWebRTC.js',
    tokens: [
      'BUKLOD_ANDROID_GOOGLE_MAPS_MANIFEST_R1',
      'withAndroidManifest',
      'AndroidConfig.Manifest.getMainApplicationOrThrow',
      'AndroidConfig.Manifest.addMetaDataItemToMainApplication',
      'com.google.android.geo.API_KEY',
      'GOOGLE_MAPS_ANDROID_API_KEY',
      "config.android?.package === 'org.mzbministry.buklod'",
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
];

let failures = 0;

console.log('BUKLOD ANDROID COMMUNITY TOP RAIL RELEASE CONTRACT');
console.log('==================================================');
console.log(
  'LOCK: Recent Android only. Public Community top map card is replaced by real member profile bubbles. Tap opens personal conversation; long press opens member profile. Android top rail must not mount react-native-maps. Web/iOS behavior stays outside this contract.',
);

for (const check of checks) {
  if (!fs.existsSync(check.file)) {
    console.error(`FAIL: missing locked file: ${check.file}`);
    failures += 1;
    continue;
  }

  const source = fs.readFileSync(check.file, 'utf8');

  for (const token of check.tokens ?? []) {
    if (!source.includes(token)) {
      console.error(`FAIL: ${check.file} missing locked token: ${token}`);
      failures += 1;
    }
  }

  for (const token of check.absentTokens ?? []) {
    if (source.includes(token)) {
      console.error(`FAIL: ${check.file} contains forbidden Android top-rail token: ${token}`);
      failures += 1;
    }
  }
}

if (failures > 0) {
  console.error(`ANDROID COMMUNITY TOP RAIL RELEASE LOCK FAILED: ${failures} blocker(s).`);
  process.exit(1);
}

console.log('ANDROID COMMUNITY PROFILE BUBBLES RELEASE LOCK PASSED.');
