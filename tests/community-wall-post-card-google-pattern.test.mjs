import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../src/components/BuklodCommunityWallPostCard.tsx', import.meta.url),
  'utf8',
);

test('Wall card composes the canonical BUKLOD media and engagement renderers', () => {
  assert.match(source, /BuklodCommunityPhotoCollage/);
  assert.match(source, /CommunityVideo/);
  assert.match(source, /BuklodCommunityPostEngagement/);
});

test('Wall card exposes author, timestamp, privacy and social actions', () => {
  for (const token of [
    'authorName',
    'authorAvatarUrl',
    'createdAt',
    'privacy',
    'onReact',
    'onOpenComments',
    'onShare',
  ]) {
    assert.ok(source.includes(token), `missing Wall card contract: ${token}`);
  }
});

test('Wall card keeps feed authorization and mutations outside the presentation component', () => {
  assert.match(source, /Feed ownership, authorization, loading, pagination and mutations stay/);
  assert.doesNotMatch(source, /from\(['"]community_posts['"]\)/);
  assert.doesNotMatch(source, /supabase/);
});

test('Wall photo collage and video playback remain lazy/canonical component paths', () => {
  assert.match(source, /preserveSinglePhotoAspectRatio/);
  assert.match(source, /active=\{active\}/);
  assert.match(source, /posterUri=\{video\.preview_url\}/);
});
