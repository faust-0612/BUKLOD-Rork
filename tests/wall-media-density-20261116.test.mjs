import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Wall media density preserves full-size media rendering, real ads, and notes',()=>{
  const card=read('src/components/BuklodCommunityWallPostCard.tsx');
  const notes=read('src/components/BuklodCommunityWallProfileBubbles.tsx');
  const wall=read('src/app/(tabs)/buklod.tsx');
  assert.match(card,/feedCard:\s*\{[\s\S]*?marginBottom:\s*6/);
  assert.match(card,/padding:\s*buklodVisual\.space\.card/);
  assert.match(notes,/noteZone:\s*\{[\s\S]{0,180}minHeight:\s*44/);
  const zone = notes.match(/noteZone:\s*\{([\s\S]*?)\n\s*\},/)?.[1] || '';
  assert.doesNotMatch(zone,/^\s*height\s*:/m);
  assert.match(notes,/row:\s*\{[\s\S]{0,180}alignItems:\s*'flex-end'/);
  assert.ok(wall.includes('BuklodAdMobBanner'));
  assert.ok(wall.includes('BuklodCommunityInlineAd'));
  assert.ok(wall.includes('BuklodCommunityCommentThread'));
});