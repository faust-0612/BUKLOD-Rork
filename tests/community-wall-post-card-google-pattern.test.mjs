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

test('Public and scoped Community Wall renderers use the shared post card boundary', () => {
  const publicFeed = readFileSync(
    new URL('../src/app/(tabs)/buklod.tsx', import.meta.url),
    'utf8',
  );
  const scopedFeed = readFileSync(
    new URL('../src/components/BuklodExclusiveScopeCommunity.tsx', import.meta.url),
    'utf8',
  );

  assert.match(publicFeed, /import BuklodCommunityWallPostCard from ['"]@\/components\/BuklodCommunityWallPostCard['"]/);
  assert.match(publicFeed, /<BuklodCommunityWallPostCard containerStyle=/);
  assert.match(publicFeed, /<\/BuklodCommunityWallPostCard>/);

  assert.match(scopedFeed, /import BuklodCommunityWallPostCard from ['"]@\/components\/BuklodCommunityWallPostCard['"]/);
  assert.match(scopedFeed, /<BuklodCommunityWallPostCard/);
  assert.match(scopedFeed, /containerStyle=\{focusId === item\.id \?/);
  assert.doesNotMatch(scopedFeed, /<View\\s+style=\\{\\[styles\\.postCard/);
  assert.match(scopedFeed, /<\/BuklodCommunityWallPostCard>/);
});

test('Feed integration preserves each renderer-owned rich post content and actions', () => {
  const publicFeed = readFileSync(
    new URL('../src/app/(tabs)/buklod.tsx', import.meta.url),
    'utf8',
  );
  const scopedFeed = readFileSync(
    new URL('../src/components/BuklodExclusiveScopeCommunity.tsx', import.meta.url),
    'utf8',
  );

  for (const token of ['renderCommunityMedia(item)', 'BuklodExpandableWallCaption', 'BuklodPostInternalShare']) {
    assert.ok(publicFeed.includes(token), `Public feed lost ${token}`);
  }
  for (const token of ['communityPhotoCollageItems(', 'recoverScopedWallVideo(item)', 'BuklodPostInternalShare']) {
    assert.ok(scopedFeed.includes(token), `Scoped feed lost ${token}`);
  }
});

test('Shared card wrapper delegates children without duplicating feed data or authorization', () => {
  assert.match(source, /function BuklodCommunityWallPostCard\(props: Props\)/);
  assert.match(source, /if \(children !== undefined\)/);
  assert.match(source, /return <DefaultBuklodCommunityWallPostCard \{\.\.\.props\} post=\{post\} \/>/);
  assert.match(source, /const \{ theme \} = useBuklodTheme\(\)/);
  assert.match(source, /styles\.feedCard/);
  assert.match(source, /backgroundColor: theme\.surface, borderColor: theme\.border/);
  assert.match(source, /borderRadius: 18/);
  assert.match(source, /padding: 14/);
  assert.match(source, /marginBottom: 12/);
  assert.match(source, /gap: 10/);
});
