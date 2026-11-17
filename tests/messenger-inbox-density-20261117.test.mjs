import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const block = (s,key) => s.match(new RegExp(key + ':\\s*\\{([\\s\\S]*?)\\n\\s*\\},'))?.[1] ?? '';

test('Connect search and Notes precede conversations without duplicate banners', () => {
  const s = read('src/app/(tabs)/messages.tsx');
  assert.ok(s.indexOf('<View style={styles.searchDock}>') < s.indexOf('<ConnectInboxTabs'));
  assert.ok(s.indexOf('<ConnectInboxTabs') < s.indexOf('<ConnectSuggestedContacts'));
  assert.doesNotMatch(s, /<View style=\{styles\.hero\}>|style=\{styles\.priorityCard\}/);
  assert.match(s, /: regularThreads\s*\) as any\[\]/);
  assert.match(s, /BuklodFirstViewAd/);
  assert.match(s, /BuklodNativeSponsoredCard/);
  assert.match(s, /personalUnread=\{regularThreads\.reduce/);
});

test('Wall search/Notes rail comes before shortcuts while genuine ads remain', () => {
  const wall = read('src/app/(tabs)/buklod.tsx');
  const rail = wall.indexOf('<BuklodCommunityWallProfileBubbles />');
  const links = wall.indexOf('<BuklodWallQuickLinks', rail);
  const ad = wall.indexOf('<BuklodFirstViewAd', rail);
  assert.ok(rail >= 0 && rail < links && links < ad);
  assert.match(wall, /BuklodCommunitySponsoredAd|BuklodCommunityInlineAd/);
  const context = read('src/components/BuklodDashboardContextBar.tsx');
  assert.match(context, /if \(messagesRoute \|\| communityRoute\) return null;/);
  assert.match(context, /BuklodPublicDailyMessageBar forceVisible/);
});

test('Empty note rails have zero height but editing and 56dp avatars survive', () => {
  for (const p of ['src/components/connect/ConnectQuickContacts.tsx',
                   'src/components/BuklodCommunityWallProfileBubbles.tsx']) {
    const s = read(p), empty = block(s, 'noteZoneEmpty');
    assert.match(empty, /height:\s*0/);
    assert.match(empty, /minHeight:\s*0/);
    assert.match(s, /return <View style=\{styles\.noteZoneEmpty\} \/>/);
    assert.match(s, /const NOTE_MAX_LINES = 5/);
    assert.match(s, /const AVATAR_SIZE = 56/);
  }
});

test('Flat chat rows retain touch targets, timestamps and unread counters', () => {
  for (const p of ['src/components/connect/ConnectInboxRow.tsx',
                   'src/components/connect/ConnectCommunityRow.tsx']) {
    const s = read(p), row = block(s, 'row');
    assert.match(row, /minHeight:\s*72/);
    assert.match(row, /marginBottom:\s*0/);
    assert.match(row, /borderBottomWidth:\s*StyleSheet\.hairlineWidth/);
    assert.match(s, /unread > 0/);
    assert.match(s, /timeLabel/);
    assert.match(s, /onPressRow/);
  }
});
