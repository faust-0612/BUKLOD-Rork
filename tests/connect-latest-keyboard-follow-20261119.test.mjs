import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const windowSource = read('src/lib/connectChatWindow.ts');
const thread = read('src/components/BuklodConnectThread.tsx');

const start = windowSource.indexOf('export function connectFollowingLatest(');
const end = windowSource.indexOf('\nexport function ', start + 1);
assert.ok(start >= 0 && end > start, 'follow policy is part of the real chat helper');
const source = windowSource.slice(start, end).replace(
  /export function connectFollowingLatest\(args: \{[\s\S]*?\}\): boolean \{/,
  'function connectFollowingLatest(args) {'
);
const follow = runInNewContext(source + '\nconnectFollowingLatest;');
test('IME resize keeps latest following until reader gestures', () => {
  assert.equal(follow({composerFocused:true,jumpPending:false,userInteracting:false}), true);
  assert.equal(follow({composerFocused:true,jumpPending:false,userInteracting:true}), false);
  assert.equal(follow({composerFocused:false,jumpPending:false,userInteracting:false}), false);
});
test('latest button follows through transient reflow until actual bottom event', () => {
  assert.equal(follow({composerFocused:false,jumpPending:true,userInteracting:false}), true);
  assert.equal(follow({composerFocused:false,jumpPending:true,userInteracting:true}), false);
  assert.match(thread, /onLayout=\{\(\) => \{[\s\S]{0,170}followingLatest\(\)/);
  assert.match(thread, /if \(!keyboardVisible \|\| !followingLatest\(\)\) return/);
  assert.match(thread, /if \(nearBottom && listAnchoredRef\.current\) \{\s*pendingLatestScrollRef\.current = false/);
});
test('do not show stale Latest while following or falsely mark read by timer', () => {
  assert.match(thread, /\{listAnchored && !followingLatest\(\) && \(awayFromLatest/);
  assert.match(thread, /onPress=\{\(\) => \{\s*followOwnSendRef\.current = false;\s*pendingLatestScrollRef\.current = true/);
  assert.doesNotMatch(thread, /pendingVisibleReadRef\.current = 'returned-to-latest';\s*setTimeout/);
  assert.match(thread, /if \(userDraggingRef\.current \|\| userMomentumRef\.current\) \{\s*if \(contentOffset\.y < previousOffset - 2\) \{\s*userScrolledUpRef\.current = true;\s*\}\s*composerFollowsLatestRef\.current = false;\s*pendingLatestScrollRef\.current = false/);
});
test('preserve history, send and keyboard-independent list behavior', () => {
  assert.match(thread, /pendingOlderAnchorRef\.current = null;[\s\S]*?connectOlderPrependScrollOffset/);
  assert.match(thread, /pinLatestOnOpenRef\.current &&[\s\S]*?pendingLatestScrollRef\.current = true/);
  assert.match(thread, /if \(followOwnSendRef\.current\)/);
  assert.match(thread, /markVisibleRoomRead\('returned-to-latest'\)/);
});
