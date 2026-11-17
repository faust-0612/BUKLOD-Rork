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

test('Follow is beside the author and Report is beneath it in the right rail', () => {
  assert.match(header, /flexDirection:'row',alignItems:'flex-start',gap:5/);
  assert.match(header, /<View style=\{\{alignItems:'flex-end',flexShrink:0,gap:2\}\}>/);
  assert.match(header, /<BuklodTappablePersonName[\s\S]*?numberOfLines=\{1\}/);
  assert.match(header, /formatCompactWallDateTime\(item.created_at\)/);
  assert.match(header, /flexDirection:'column',\s*alignItems:'flex-end',\s*gap:2/);
  assert.match(header, /minHeight:29/);
  assert.match(header, /toggleAuthorFollow\(/);
  assert.match(header, /openReport\('post', item.id\)/);
  assert.match(header, /onEdit=\{async/);
  assert.match(header, /onDelete=\{async/);
  assert.ok(header.indexOf('BuklodTappablePersonName') < header.indexOf("alignItems:'flex-end',flexShrink:0,gap:2"));
  assert.ok(header.indexOf('toggleAuthorFollow(') < header.indexOf("openReport('post', item.id)"));
});

test('Post media, reaction, comment and AdMob placement contracts remain', () => {
  for (const marker of ['renderCommunityMedia(item)', 'BuklodCommunityPostEngagement', 'BuklodCommunityInlineAd', 'BuklodAdMobBanner']) {
    assert.ok(wall.includes(marker), marker);
  }
});
