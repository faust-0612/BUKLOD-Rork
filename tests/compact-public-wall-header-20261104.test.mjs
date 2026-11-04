import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('global BUKLOD header is shorter but retains safe-area and notifications', () => {
  const source = read('src/app/(tabs)/_layout.tsx');
  assert.match(source, /paddingTop: insets\.top/);
  assert.match(source, /minHeight: 48 \+ insets\.top/);
  assert.match(source, /accessibilityLabel=\{/);
  assert.match(source, /unreadCount > 0/);
});

test('public Wall controls are compact and retain their actions', () => {
  const source = read('src/app/(tabs)/buklod.tsx');
  const start = source.indexOf('/* PATCH_161A_COMMUNITY_COMPACT */');
  const end = source.indexOf("{Platform.OS !== 'web' ?", start);
  assert.ok(start >= 0 && end > start);
  const header = source.slice(start, end);
  assert.match(header, /accessibilityLabel="Open My Bible"/);
  assert.match(header, /accessibilityLabel="Open 702 DZAS Radio"/);
  assert.match(header, /marginBottom:6/);
  assert.match(header, /width:38/);
  assert.match(header, /minHeight:38/);
  assert.match(header, /height:38/);
  assert.match(source, /BuklodCommunityWallProfileBubbles/);
});

test('profile rail saves vertical space without removing search or profile bubbles', () => {
  const source = read('src/components/BuklodCommunityWallProfileBubbles.tsx');
  assert.match(source, /const AVATAR_SIZE = 50/);
  assert.match(source, /placeholder="Search messages or people"/);
  assert.match(source, /<ConnectTappableAvatar/);
  assert.match(source, /Add note/);
});

test('Life card has a smaller footprint while retaining CTA and accessible action', () => {
  const source = read('src/components/BuklodLifeWallCard.tsx');
  assert.match(source, /minHeight:\s*100/);
  assert.match(source, /accessibilityLabel=/);
  assert.match(source, /copy\.cta/);
  assert.match(source, /router\.push/);
});
