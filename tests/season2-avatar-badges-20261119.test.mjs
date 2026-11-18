import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getBuklodCircleRankArt, BUKLOD_CIRCLE_RANK_FAMILIES, BUKLOD_CIRCLE_RANK_LEVELS } from '../src/lib/buklodCircleRankArt.ts';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('40 owner-approved badges map exactly 8 canonical families × V through I', () => {
  assert.equal(BUKLOD_CIRCLE_RANK_FAMILIES.length, 8);
  assert.deepEqual(BUKLOD_CIRCLE_RANK_LEVELS, ['V','IV','III','II','I']);
  const orders = [];
  for (const family of BUKLOD_CIRCLE_RANK_FAMILIES) {
    for (const level of BUKLOD_CIRCLE_RANK_LEVELS) {
      const art = getBuklodCircleRankArt(family + ' ' + level);
      assert.ok(art);
      assert.equal(art.name, family + ' ' + level);
      assert.ok(art.borderColor.startsWith('#'));
      orders.push(art.order);
    }
  }
  assert.deepEqual(orders, Array.from({length:40},(_,i)=>i+1));
  assert.equal(getBuklodCircleRankArt('Circle Unknown V'), null);
  assert.equal(getBuklodCircleRankArt(null), null);
  assert.equal(getBuklodCircleRankArt('Circle Starter VI'), null);
});

test('shared avatar uses exact image silhouette with rank-colored ring, upper left and online at bottom', () => {
  const avatar=read('src/components/ProfileAvatar.tsx');
  const badge=read('src/components/points/BuklodCircleRankBadge.tsx');
  const presence=read('src/lib/buklodAvatarPresence.ts');
  const tappable=read('src/components/BuklodTappableAvatar.tsx');
  const connect=read('src/components/connect/ConnectTappableAvatar.tsx');
  const connectWeb=read('src/components/connect/ConnectTappableAvatar.web.tsx');
  assert.match(avatar, /get_member_circle_ranks_v1/);
  assert.match(avatar, /getBuklodCircleRankArt/);
  assert.match(avatar, /buklod-circle-ranks-atlas\.webp/);
  assert.match(avatar, /borderColor:\s*rankBorder/);
  assert.match(avatar, /top:\s*-badgeSize/);
  assert.match(avatar, /isBuklodAvatarOnline/);
  assert.match(avatar, /backgroundColor:\s*'#00AAFF'/);
  assert.match(badge, /buklod-circle-ranks-atlas\.webp/);
  assert.match(presence, /presenceState/);
  assert.match(presence, /AppState\.currentState/);
  assert.match(tappable, /overflow: 'visible'/);
  assert.match(connect, /overflow: 'visible'/);
  assert.match(connectWeb, /overflow: 'visible'/);
});
