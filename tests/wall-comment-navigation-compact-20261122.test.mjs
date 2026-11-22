import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(file, 'utf8');
const bubble = read('src/components/BuklodCommunityCommentBubble.tsx');
const thread = read('src/components/BuklodCommunityCommentThread.tsx');
const composer = read('src/components/BuklodCommunityCommentComposer.tsx');
const sheet = read('src/app/(tabs)/buklodCommunityStyles.ts');
const wall = read('src/app/(tabs)/buklod.tsx');

test('compact comments hide absent cluster metadata and shorten footer time', () => {
  assert.ok(bubble.includes('const showMeta = Boolean(visibleMeta && !/^no cluster$/i.test(visibleMeta))'));
  assert.ok(bubble.includes('{showMeta && ('));
  assert.ok(bubble.includes('formatCompactCommentDateTime(comment.created_at)'));
  assert.ok(bubble.includes('{compactTime}'));
  assert.ok(bubble.includes("'Posted: ' + timeLabel"), 'full date remains in View Details');
  assert.match(bubble, /body: {\s*marginTop: 2,\s*fontSize: 15,\s*lineHeight: 20,/);
  assert.match(sheet, /communityCommentHeader:{\s*minHeight:52,/);
  assert.match(sheet, /communityCommentList:{\s*paddingHorizontal:8,\s*paddingTop:6,/);
});

test('reply tree, actions and accessibility remain functional', () => {
  for (const anchor of [
    'buildThreads(comments)', 'COLLAPSE_AFTER = 2',
    'onReply={() => onReply(comment, root)}',
    'onFocusedCommentLayout', 'inlineAd && threadIndex',
  ]) assert.ok(thread.includes(anchor), anchor);
  assert.match(thread, /thread: {\s*gap: 4,\s*marginBottom: 3,/);
  for (const anchor of [
    'onReply', 'onReact(', 'onReactionSummaryPress', 'onEdit(', 'onDelete(',
    'onReport(', 'BuklodMentionText', 'resolveCommunityMediaUrl',
  ]) assert.ok(bubble.includes(anchor), anchor);
  assert.ok(wall.includes('placementId="public_wall_comments_engagement_inline"'));
});

test('compact composer keeps send, photo, GIF, emoji and touch spacing', () => {
  for (const label of ['Add photo', 'Add GIF', 'Add reaction'])
    assert.ok(composer.includes('accessibilityLabel="' + label + '"'), label);
  assert.equal((composer.match(/hitSlop=\{4\}/g) || []).length, 3);
  assert.match(composer, /tool: {\s*width: 36,\s*height: 36,/);
  assert.ok(composer.includes('onPress={onSend}'));
  assert.ok(composer.includes("onMediaChange({ kind: 'gif'"));
  assert.ok(composer.includes('BuklodMentionField'));
});
