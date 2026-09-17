import fs from 'node:fs';

const checks = [
  {
    file: 'src/components/BuklodCommunityMapNav.android.tsx',
    tokens: [
      'BUKLOD_ANDROID_COMMUNITY_CONNECT_BUBBLES_R3',
      "import { ConnectTappableAvatar } from '@/components/connect/ConnectTappableAvatar';",
      'loadConnectSuggestedContacts',
      'loadMessagesStatusNote',
      'markConnectStatusNoteSeen',
      'contact.quick_note',
      'selfNote?.quick_note',
      "pathname: '/connect/personal/[threadId]'",
      "threadId: 'new'",
      'targetUserId: contact.user_id',
      'onPress={() => openConversation(contact)}',
      'enableLongPressSheet',
      'showsHorizontalScrollIndicator={false}',
      "contact.rank_name || 'Circle Starter V'",
    ],
    absentTokens: [
      "from 'react-native-maps'",
      '<MapView',
      'PROVIDER_GOOGLE',
      'Tap map to open',
      'openProfile(contact)',
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

console.log('BUKLOD ANDROID COMMUNITY CONNECT BUBBLES RELEASE CONTRACT');
console.log('=========================================================');
console.log(
  'LOCK: Recent Android only. Public Community top map card stays removed. The Community Wall reuses the exact Connect profile bubble component. Quick notes are visible, self note is mirrored, unread/rank remain, tap opens personal conversation, and long press uses the existing Connect profile interaction. Android top rail must not mount react-native-maps. Web/iOS/backend stay outside this contract.',
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
  console.error(`ANDROID COMMUNITY CONNECT BUBBLES RELEASE LOCK FAILED: ${failures} blocker(s).`);
  process.exit(1);
}

console.log('ANDROID COMMUNITY CONNECT BUBBLES RELEASE LOCK PASSED.');
