import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dedupeCommunityPhotoItems } from '../src/lib/communityPhotoIdentity.ts';

test('collage collapses duplicate assets even when signed URL tokens differ', () => {
  const items = [
    { media_path: 'member-1/post-a.jpg', media_url: null },
    { media_path: null, media_url: 'https://cdn.example/storage/v1/object/sign/community/member-1/post-a.jpg?token=rotated' },
  ];
  assert.equal(dedupeCommunityPhotoItems(items).length, 1);
});

test('collage detects a duplicate when a row exposes a path and another exposes its signed URL', () => {
  const items = [
    { media_path: 'member-1/post-b.jpg' },
    { media_url: 'https://cdn.example/storage/v1/object/sign/community/member-1/post-b.jpg?token=second' },
  ];
  assert.equal(dedupeCommunityPhotoItems(items).length, 1);
});

test('a shared stale preview sidecar never hides two distinct original photos', () => {
  const items = [
    { media_path: 'member-1/first.jpg', preview_path: 'previews/shared.jpg' },
    { media_path: 'member-1/second.jpg', preview_path: 'previews/shared.jpg' },
  ];
  assert.equal(dedupeCommunityPhotoItems(items).length, 2);
});

test('preview-only legacy rows still collapse when they point to the same sidecar', () => {
  const items = [
    { preview_path: 'previews/shared.jpg' },
    { preview_path: 'previews/shared.jpg' },
  ];
  assert.equal(dedupeCommunityPhotoItems(items).length, 1);
});

test('distinct images retain their original media order and identity', () => {
  const items = [
    { media_position: 0, media_path: 'member-1/first.jpg' },
    { media_position: 1, media_path: 'member-1/second.jpg' },
    { media_position: 2, media_path: 'member-1/third.jpg' },
  ];
  assert.deepEqual(dedupeCommunityPhotoItems(items).map(item => item.media_position), [0, 1, 2]);
});

test('public Wall photo viewer stays mounted while paging and resets only for a new viewer session', () => {
  const wall = readFileSync('src/app/(tabs)/buklod.tsx', 'utf8');
  const listStart = wall.indexOf('<GestureFlatList', wall.indexOf('visible={viewerOpen}'));
  const list = wall.slice(listStart, wall.indexOf('/>', listStart));
  assert.match(wall, /setViewerSession\(current=>current\+1\)/);
  assert.match(list, /'viewer-'\s*\+\s*viewerSession\s*\+\s*'-'\s*\+\s*viewerItems\.length/);
  assert.doesNotMatch(list, /viewerIndex\s*\+/);
  assert.match(list, /pagingEnabled=\{!viewerZoomed\}/);
  assert.match(list, /onMomentumScrollEnd/);
});
