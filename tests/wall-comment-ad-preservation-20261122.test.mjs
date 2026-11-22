import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const thread = readFileSync('src/components/BuklodCommunityCommentThread.tsx', 'utf8');
const wall = readFileSync('src/app/(tabs)/buklod.tsx', 'utf8');

test('comment ad stays behind its same original Android-only consent and error guard', () => {
  assert.ok(wall.includes("inlineAd={Platform.OS === 'android' && !!commentPost && !commentPost.author_only && !commentLoadError ? ("));
  assert.ok(wall.includes('<BuklodAdMobBanner'));
  for (const line of [
    'placement="community"',
    'placementId="public_wall_comments_engagement_inline"',
    'format="adaptive"',
    'compact',
    'requireViewport',
    'showLabel',
  ]) assert.ok(wall.includes(line), line);
});

test('inline ad still appears after the organic reply tree with a single inserted slot', () => {
  assert.ok(thread.includes('inlineAd && threadIndex === (threads.length === 1 ? 0 : 1)'));
  assert.ok(thread.includes('<View style={styles.inlineAd}>{inlineAd}</View>'));
  assert.ok(thread.includes('const visibleReplies ='));
  assert.ok(thread.includes('const COLLAPSE_AFTER = 2'));
});
