'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const failures = [];

function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing required Smart Drawer file: ${rel}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}

function requireText(source, needle, label) {
  if (!source.includes(needle)) {
    failures.push(label || `Missing contract: ${needle}`);
  }
}

function forbidText(source, needle, label) {
  if (source.includes(needle)) {
    failures.push(label || `Forbidden Smart Drawer contract: ${needle}`);
  }
}

const types = read('src/lib/smartDrawer/types.ts');
const classify = read('src/lib/smartDrawer/classify.ts');
const store = read('src/lib/smartDrawer/localStore.ts');
const reminders = read('src/lib/smartDrawer/reminders.ts');
const lifecycle = read('src/lib/smartDrawer/lifecycle.ts');
const settings = read('src/lib/smartDrawer/settings.ts');
const service = read('src/lib/smartDrawer/service.ts');
const assets = read('src/lib/smartDrawer/assets.ts');
const wallCard = read('src/components/SmartDrawerWallCard.tsx');
const wall = read('src/app/(tabs)/buklod.tsx');
const layout = read('src/app/_layout.tsx');
const drawer = read('src/app/drawer/index.tsx');
const quickNote = read('src/app/drawer/quick-note.tsx');
const capture = read('src/app/drawer/capture.tsx');
const review = read('src/app/drawer/review.tsx');
const imported = read('src/app/drawer/import.tsx');
const item = read('src/app/drawer/item/[id].tsx');
const drawerSettings = read('src/app/drawer/settings.tsx');

[
  'drawer_items',
  'drawer_search_tokens',
  "openDatabaseAsync('buklod-smart-drawer.db')",
  'PRAGMA journal_mode = WAL',
  'WHERE i.user_id=?',
  'WHERE id = ? AND user_id = ?',
  'LIMIT ? OFFSET ?',
].forEach(marker =>
  requireText(store, marker, `Offline/user-isolation store marker missing: ${marker}`),
);

requireText(
  store,
  "sync_state TEXT NOT NULL DEFAULT 'LOCAL_ONLY'",
  'Local-only must be the default until cloud sync is explicitly enabled.',
);
forbidText(
  store,
  "sync_state TEXT NOT NULL DEFAULT 'PENDING'",
  'Drawer must not pretend a cloud sync worker exists.',
);
requireText(
  assets,
  'smart-drawer/',
  'User-scoped local asset storage is missing.',
);
requireText(
  assets,
  'safeUserId(input.userId)',
  'Local asset path must include the signed-in user scope.',
);

[
  'scheduleNotificationAsync',
  'cancelScheduledNotificationAsync',
  'buklod-smart-drawer',
].forEach(marker =>
  requireText(reminders, marker, `Local reminder invariant missing: ${marker}`),
);
requireText(
  service,
  'The item was saved',
  'Reminder failure must not block the local save.',
);

requireText(
  lifecycle,
  "view: 'recently-removed'",
  'Lifecycle cleanup may operate only on Recently Removed content.',
);
forbidText(
  lifecycle,
  "'WRITING'",
  'Lifecycle cleanup must not age-delete writing.',
);
forbidText(
  lifecycle,
  "'POEM'",
  'Lifecycle cleanup must not age-delete poems.',
);
forbidText(
  lifecycle,
  "'DUE_TASK'",
  'Lifecycle cleanup must not age-delete due tasks.',
);
requireText(
  settings,
  'recentlyRemovedRetentionDays: 30',
  'Default Recently Removed retention should remain centrally configured at 30 days.',
);

[
  'Scan',
  'Camera',
  'Import',
  'Quick Note',
  'Search your Drawer',
  'For You Now',
].forEach(marker =>
  requireText(wallCard, marker, `Wall first-view Drawer marker missing: ${marker}`),
);
forbidText(
  wallCard,
  'Set Reminder',
  'Manual Set Reminder must not become a main Smart Drawer action.',
);
requireText(
  wall,
  "import SmartDrawerWallCard from '@/components/SmartDrawerWallCard';",
  'Community Wall must import the compact Smart Drawer card.',
);
requireText(
  wall,
  '<SmartDrawerWallCard />',
  'Community Wall first view must mount Smart Drawer.',
);
requireText(
  wall,
  '<BuklodTodayCard onRespond=',
  'BUKLOD Today must remain mounted.',
);
requireText(
  wall,
  '<BuklodMaritesBoard',
  'Marites must remain mounted.',
);

[
  'drawer/index',
  'drawer/quick-note',
  'drawer/capture',
  'drawer/import',
  'drawer/review',
  'drawer/item/[id]',
  'drawer/settings',
].forEach(route =>
  requireText(layout, route, `Drawer route not registered: ${route}`),
);

[
  drawer,
  quickNote,
  capture,
  review,
  imported,
  item,
  drawerSettings,
].forEach((source, index) => {
  forbidText(
    source,
    "from '@/lib/supabase'",
    `Drawer route ${index + 1} must not require Supabase for core use.`,
  );
  forbidText(
    source,
    'BuklodCommunityInlineAd',
    `Drawer route ${index + 1} must not introduce intrusive ads.`,
  );
  forbidText(
    source,
    'react-native-google-mobile-ads',
    `Drawer route ${index + 1} must not introduce custom ad logic.`,
  );
});

requireText(
  capture,
  "Platform.OS === 'web'",
  'Scan/Camera must expose an honest web unsupported state.',
);
requireText(
  imported,
  'allowsMultipleSelection: true',
  'Gallery import must support multi-select where the existing picker supports it.',
);
requireText(
  review,
  'Review Detected Details',
  'Structured scan/import review screen is missing.',
);
requireText(
  quickNote,
  'classifySmartDrawerText',
  'Quick Note must use local classification.',
);
requireText(
  item,
  "label="Mark as Done"",
  'Item actions must support Done.',
);
requireText(
  item,
  "label="Move to Archive"",
  'Item actions must support Archive.',
);
requireText(
  item,
  "label="Delete"",
  'Item actions must support safe delete to Recently Removed.',
);
requireText(
  item,
  "label="Restore"",
  'Recently Removed items must support Restore.',
);
requireText(
  item,
  'Related from your Drawer',
  'Resurfacing UI is missing.',
);
requireText(
  item,
  'BUKLOD does not auto-merge',
  'Related content must not silently auto-merge.',
);

for (const source of [
  store,
  service,
  quickNote,
  capture,
  review,
  imported,
  item,
]) {
  forbidText(
    source,
    'organization_id',
    'Private Smart Drawer ownership must never be inferred from Organization context.',
  );
  forbidText(
    source,
    'suborganization_id',
    'Private Smart Drawer ownership must never be inferred from Sub-Organization context.',
  );
}

for (const forbidden of [
  'applicationId',
  'bundleIdentifier',
  'EAS_PROJECT_ID',
  'eas build',
  'firebase deploy',
]) {
  [
    store,
    service,
    wallCard,
    drawer,
    quickNote,
    capture,
    review,
    imported,
    item,
  ].forEach(source =>
    forbidText(
      source,
      forbidden,
      `Smart Drawer must not define standalone identity/deployment: ${forbidden}`,
    ),
  );
}

requireText(
  classify,
  "'SHOPPING_LIST'",
  'Local shopping list classification is missing.',
);
requireText(
  classify,
  "'DUE_TASK'",
  'Local due task classification is missing.',
);
requireText(
  classify,
  "'POEM'",
  'Local writing/poem classification is missing.',
);
requireText(
  types,
  "'RECENTLY_REMOVED'",
  'Recently Removed lifecycle state is missing.',
);

if (failures.length) {
  console.error('\nBUKLOD SMART DRAWER R1 CONTRACT FAILED');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('BUKLOD SMART DRAWER R1 CONTRACT PASS');
console.log('OFFLINE_FIRST=PASS');
console.log('PRIVATE_USER_SCOPE=PASS');
console.log('LOCAL_REMINDERS=PASS');
console.log('COMMUNITY_WALL_ROOT=PASS');
console.log('NO_STANDALONE_APP=PASS');
console.log('NO_MANUAL_REMINDER_MAIN_ACTION=PASS');
console.log('CONSERVATIVE_RETENTION=PASS');
console.log('OCR_STATUS=PARTIAL_NO_VERIFIED_NATIVE_TEXT_RECOGNIZER');
console.log('CLOUD_SYNC_STATUS=LOCAL_ONLY_NOT_ENABLED');
