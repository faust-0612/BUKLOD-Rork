import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const detail = read('src/app/post/[id].tsx');
const reaction = read('src/components/BuklodReactionAction.tsx');

test('post detail reaction counts have a wrapping numeric summary', () => {
  assert.match(detail, /<BuklodReactionAction\s+layout="detail"/);
  assert.match(detail, /counts=\{counts\}/);
  assert.match(reaction, /const fillRow = isComment \|\| isWall \|\| isDetail/);
  assert.match(reaction, /flexGrow: fillRow \? 1 : 0/);
  assert.match(reaction, /flexWrap: fillRow \? 'wrap' : 'nowrap'/);
  assert.match(reaction, /isDetail\s*\? 34/);
  assert.match(reaction, /\{Number\(counts\?\.\[option\.key\] \?\? 0\)\}/);
});

test('post detail total reconciles with visible breakdown and backend fallback', () => {
  assert.match(detail, /Object\.keys\(counts\)\.length/);
  assert.match(detail, /sumCommunityReactionCounts\(counts\)/);
  assert.match(detail, /Number\(post\.total_reactions\?\?0\)/);
  assert.match(detail, /\{totalReactions\} \{totalReactions===1\?'reaction':'reactions'\}/);
  assert.match(detail, /set_buklod_post_reaction_v3/);
});

test('detail-only variant preserves Wall layout and native ads', () => {
  assert.match(reaction, /layout\?: 'default' \| 'comment' \| 'wall' \| 'detail'/);
  assert.match(detail, /BuklodFirstViewAd placement="community_entry"/);
  assert.match(detail, /BuklodPostInternalShare/);
});
