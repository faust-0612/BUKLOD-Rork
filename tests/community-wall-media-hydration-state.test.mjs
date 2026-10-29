import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  applyCommunityWallMediaHydration,
  applyCommunityWallMetadata,
} from '../src/lib/communityWallHydration.ts';

test('late author metadata never erases photos that arrived after initial timeout', () => {
  const early = { id: 'p1', media_path: 'u/photo.jpg', media_url: null, media_items: [], my_reaction: 'love' };
  const loaded = applyCommunityWallMediaHydration([early], {
    p1: [{ media_path: 'u/photo-2.jpg', media_position: 1 }, { media_path: 'u/photo.jpg', media_position: 0 }],
  });
  const updated = applyCommunityWallMetadata(loaded, [{
    ...early, media_items: [], cluster_name: 'Bayan', author_rank_name: 'Rank', comment_preview: 'preview',
  }]);
  assert.deepEqual(updated[0].media_items.map(item => item.media_path), ['u/photo.jpg', 'u/photo-2.jpg']);
  assert.equal(updated[0].my_reaction, 'love');
  assert.equal(updated[0].cluster_name, 'Bayan');
  assert.equal(early.media_items.length, 0);
});

test('hydration updates only matched posts and ignores an empty result', () => {
  const before = [{ id:'first', media_items:[{media_path:'photo.jpg'}] }, {id:'second',media_items:[]}];
  const empty = applyCommunityWallMediaHydration(before, {first:[]});
  assert.strictEqual(empty[0], before[0]);
  const late = applyCommunityWallMediaHydration(before,{second:[{media_path:'second.jpg'}]});
  assert.strictEqual(late[0], before[0]);
  assert.equal(late[1].media_items[0].media_path,'second.jpg');
});

test('first paint uses a durable photo path even without a fresh signed URL', () => {
  const wall = fs.readFileSync('src/app/(tabs)/buklod.tsx', 'utf8');
  assert.match(wall, /\(p\.media_path \|\| p\.media_url\) &&/);
  assert.match(wall, /applyCommunityWallMetadata\(previous, preparedPosts186L\)/);
  assert.match(wall, /appendPage186L && \(!Array\.isArray\(mediaResult\?\.data\)/);
  assert.match(wall, /applyCommunityWallMediaHydration\(current, mediaByPost\)/);
});
