import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const detail = source('src/app/post/[id].tsx');
const feed = source('src/components/BuklodCommunityPostEngagement.tsx');
const action = source('src/components/BuklodReactionAction.tsx');

test('detail reaction layout is opt-in; the Wall keeps its existing layout', () => {
  assert.match(detail, /layout="detail"/);
  assert.match(feed, /layout="wall"/);
  assert.doesNotMatch(feed, /layout="detail"/);
  assert.match(action, /layout = 'default'/);
});

test('the individual post retains existing media, permissions and interaction routes', () => {
  assert.match(detail, /BuklodCommunityPhotoCollage/);
  assert.match(detail, /CommunityVideo uri=\{post\.media_url\}/);
  assert.match(detail, /set_buklod_post_reaction_v3/);
  assert.match(detail, /BuklodContentOverflowMenu/);
  assert.match(detail, /BuklodFirstViewAd placement="community_entry"/);
});
