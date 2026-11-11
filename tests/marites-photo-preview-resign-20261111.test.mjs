import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const collage = readFileSync('src/components/BuklodMaritesPhotoCollage.tsx', 'utf8');
const board = readFileSync('src/components/BuklodMaritesBoard.tsx', 'utf8');
const image = readFileSync('src/components/BuklodCachedMediaImage.tsx', 'utf8');

test('Marites feed passes durable authorized paths to every collage photo', () => {
  assert.ok(board.includes('mediaPaths={story.photo_paths}'));
  assert.ok(collage.includes('mediaPath={photos[0].mediaPath}'));
  assert.ok(collage.includes('mediaPath={photo.mediaPath}'));
  assert.ok(collage.includes('mediaPaths?.[index]'));
});

test('Full View uses the same storage path on single and multi photo stories', () => {
  assert.ok(board.includes('mediaPath={viewStory.photo_paths?.[0] ?? null}'));
  assert.ok(board.includes('mediaPath={viewStory.photo_paths?.[index] ?? null}'));
});

test('Existing media cache recovers expired signed access using private path', () => {
  assert.ok(image.includes('resolveCommunityMediaUrl(path, null)'));
  assert.ok(image.includes('resignCommunityMediaUrl(path)'));
  assert.ok(image.includes('communityMediaCacheKey(path,'));
});

// A recycled tile keeps its stable object path across signed-URL rotation.
test('Marites photo tile identity is stable across credential renewal', () => {
  assert.ok(collage.includes('photo.mediaPath || photo.uri'));
  assert.ok(collage.includes('mediaPaths?.[index]'));
  assert.ok(board.includes('mediaPaths={story.photo_paths}'));
});
