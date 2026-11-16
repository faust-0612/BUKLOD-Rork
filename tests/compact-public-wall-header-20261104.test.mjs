import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('global BUKLOD header is shorter but retains safe-area and notifications', () => {
  const source = read('src/app/(tabs)/_layout.tsx');
  assert.match(source, /paddingTop: insets\.top/);
  assert.match(source, /minHeight: \(scrollCompact \? 48 : 56\) \+ insets\.top/);
  assert.match(source, /minWidth: 48, minHeight: 48/);
  assert.match(source, /accessibilityLabel=\{/);
  assert.match(source, /unreadCount > 0/);
});

test('public Wall controls stay compact and accessible after extraction', () => {
  const wall = read('src/app/(tabs)/buklod.tsx');
  const shortcuts = read('src/components/BuklodWallQuickLinks.tsx');
  assert.match(wall, /<BuklodWallQuickLinks/);
  assert.match(shortcuts, /Open My Bible/);
  assert.match(shortcuts, /Open 702 DZAS Radio/);
  assert.doesNotMatch(shortcuts, /IGPAT|\/igpat/i);
  assert.doesNotMatch(shortcuts, />BUKLOD<\/Text>/);
  assert.equal((shortcuts.match(/<Pressable\b/g) ?? []).length, 3);
  assert.match(shortcuts, /accessibilityLabel="Open My Bible"/);
  assert.match(shortcuts, /onCommunityPress/);
  assert.match(shortcuts, /minHeight:42/);
  assert.match(wall, /BuklodCommunityWallProfileBubbles/);
});

test('profile rail retains readable Notes and larger 56px avatars without losing search or bubbles', () => {
  const source = read('src/components/BuklodCommunityWallProfileBubbles.tsx');
  assert.match(source, /const AVATAR_SIZE = 56/);
  assert.match(source, /const NOTE_MAX_LINES = 5/);
  assert.match(source, /placeholder="Search messages or people"/);
  assert.match(source, /<ConnectTappableAvatar/);
  assert.match(source, /Add note/);
});

test('daily encouragement strip uses less vertical space without truncating the verse reference', () => {
  const source = read('src/components/BuklodPublicDailyMessageBar.tsx');
  assert.match(source, /numberOfLines=\{compact \? 1 : 2\}/);
  assert.match(source, /showFaithContent && !compact/);
  assert.match(source, /<Text style=\{styles\.reference\}>/);
  assert.match(source, /paddingVertical: 6/);
  assert.match(source, /compactShell: \{[\s\S]*?height: 49,[\s\S]*?paddingVertical: 3/);
  assert.match(source, /width: 36,\s*height: 36/);
  assert.match(source, /reference/);
});

test('Life card has a smaller footprint while retaining CTA and accessible action', () => {
  const source = read('src/components/BuklodLifeWallCard.tsx');
  assert.match(source, /minHeight:\s*100/);
  assert.match(source, /accessibilityLabel=/);
  assert.match(source, /copy\.cta/);
  assert.match(source, /router\.push/);
});
