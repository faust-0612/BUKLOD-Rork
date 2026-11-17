import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wall = readFileSync(new URL('../src/app/(tabs)/buklod.tsx', import.meta.url), 'utf8');
const start = wall.indexOf('BUKLOD_WALL_TWO_COLUMN_HEADER_R3_20261117');
const end = wall.indexOf('<BuklodPostMotion preset=', start);
const header = start >= 0 && end > start ? wall.slice(start, end) : '';

test('Wall avatar column and full-width one-line author identity are preserved', () => {
  assert.ok(header, 'Active Wall header was not found');
  assert.match(header, /flexDirection:'row',alignItems:'flex-start',gap:8/);
  assert.match(header, /<BuklodTappableAvatar[\s\S]*?size=\{42\}/);
  assert.match(header, /<View style=\{\{flex:1,minWidth:0\}\}>/);
  assert.match(header, /<BuklodTappablePersonName[\s\S]*?numberOfLines=\{1\}/);
  assert.match(header, /<ProfileAvatarNoteChip userId=\{item.user_id\}/);
});

test('Wall date remains one line, Following and Report share an adjacent row', () => {
  assert.match(header, /flexDirection:'row',alignItems:'center',gap:6,marginTop:3,minWidth:0/);
  assert.match(header, /style=\{\[s.meta,\{flex:1,minWidth:0,marginTop:0\}\]\}/);
  assert.match(header, /formatCompactWallDateTime\(item.created_at\)/);
  assert.match(header, /flexDirection:'row',alignItems:'center',gap:4,flexShrink:0/);
  assert.match(header, /toggleAuthorFollow\(/);
  assert.match(header, /openReport\('post', item.id\)/);
  assert.doesNotMatch(header, /justifyContent:'flex-end',alignItems:'center',marginTop:3,gap:6/);
  assert.ok(header.indexOf('formatCompactWallDateTime(item.created_at)') < header.indexOf('toggleAuthorFollow('));
});

test('Post media, reaction, comment and AdMob placement contracts remain', () => {
  for (const marker of ['renderCommunityMedia(item)', 'BuklodCommunityPostEngagement', 'BuklodCommunityInlineAd', 'BuklodAdMobBanner']) {
    assert.ok(wall.includes(marker), marker);
  }
});
