import fs from 'node:fs';

const checks = [
  {
    file: 'src/components/BuklodCommunityMapNav.android.tsx',
    tokens: [
      'BUKLOD_ANDROID_COMMUNITY_CONNECT_BUBBLES_R4_SCROLL_HEADER',
      "import { ConnectInboxSearch } from '@/components/connect/ConnectInboxSearch';",
      "import { ConnectTappableAvatar } from '@/components/connect/ConnectTappableAvatar';",
      'ConnectThemeProvider',
      'loadConnectSuggestedContacts',
      'enrichConnectSuggestedContactsWithNotes',
      "'buklod_connect_people_search'",
      'loadMessagesStatusNote',
      'markConnectStatusNoteSeen',
      'contact.quick_note',
      'selfNote?.quick_note',
      'placeholder="Search messages or people"',
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
      "import { Platform, View } from 'react-native';",
      'BUKLOD_ANDROID_COMMUNITY_SCROLL_HEADER_R4',
      "Platform.OS === 'android'",
      '<BuklodPublicDailyMessageBar />',
      '<BuklodCommunityMapNav />',
      'communityRoute',
    ],
  },
  {
    file: 'src/components/BuklodMaritesBoard.android.tsx',
    tokens: [
      'BUKLOD_ANDROID_COMMUNITY_SCROLL_HEADER_R4',
      "import BuklodCommunityMapNav from '@/components/BuklodCommunityMapNav';",
      "require('./BuklodMaritesBoard.tsx')",
      '<BuklodCommunityMapNav />',
      '<BaseBuklodMaritesBoard {...props} />',
    ],
  },
];

let failures = 0;

console.log('BUKLOD ANDROID COMMUNITY SCROLL HEADER RELEASE CONTRACT');
console.log('=======================================================');
console.log(
  'LOCK: Recent Android only. Public Community map card stays removed. Search plus the exact Connect profile bubbles are mounted inside the Community Wall scroll header, not the fixed dashboard context bar, so they scroll away with the Wall. Quick notes/self note/unread/rank stay visible, tap opens personal conversation, long press keeps the Connect profile interaction, and Android must not mount react-native-maps here. Web/iOS/backend stay outside this contract.',
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
      console.error(`FAIL: ${check.file} contains forbidden Android Community token: ${token}`);
      failures += 1;
    }
  }
}

if (failures > 0) {
  console.error(`ANDROID COMMUNITY SCROLL HEADER RELEASE LOCK FAILED: ${failures} blocker(s).`);
  process.exit(1);
}

console.log('ANDROID COMMUNITY SCROLL HEADER RELEASE LOCK PASSED.');
