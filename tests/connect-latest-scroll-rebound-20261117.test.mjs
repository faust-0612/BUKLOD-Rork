import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const windowSource = read('src/lib/connectChatWindow.ts');
const thread = read('src/components/BuklodConnectThread.tsx');

function loadScrollFunction(name) {
  const start = windowSource.indexOf('export function ' + name + '(');
  assert.ok(start >= 0, name + ' must be exported by the live chat helper');
  const end = windowSource.indexOf('\nexport function ', start + 1);
  assert.ok(end > start, name + ' must have a next export boundary');
  // CI's fast scope gate intentionally installs no node_modules.
  // Both isolated functions have JS bodies; strip their known TS signatures
  // and execute the REAL source to test behavior without extra dependencies.
  const source = windowSource.slice(start, end);
  const js = name === 'connectScrollAction'
    ? source.replace(
        /export function connectScrollAction\(args: \{[\s\S]*?\}\) \{/,
        'function connectScrollAction(args) {'
      ).replace(/ as const/g, '')
    : source.replace(
        /export function connectOlderPrependScrollOffset\([\s\S]*?\): number \| null \{/,
        'function connectOlderPrependScrollOffset(anchor, currentHeight) {'
      );
  assert.ok(js.startsWith('function ' + name + '('), name + ' TS signature must be removed');
  return runInNewContext(js + '\n' + name + ';');
}

const scrollAction = loadScrollFunction('connectScrollAction');
const prependOffset = loadScrollFunction('connectOlderPrependScrollOffset');

test('manual drag and kinetic scroll never trigger content-resize snap-to-latest', () => {
  assert.equal(scrollAction({
    intent: 'content', nearBottom: true, initialSettled: true, userInteracting: true,
  }), 'none');
  assert.equal(scrollAction({
    intent: 'content', nearBottom: false, initialSettled: true, userInteracting: true,
  }), 'none');
  assert.match(thread, /onScrollBeginDrag=\{\(\) => \{ userDraggingRef\.current = true; \}\}/);
  assert.match(thread, /onMomentumScrollBegin=\{\(\) => \{ userMomentumRef\.current = true; \}\}/);
  assert.match(thread, /onMomentumScrollEnd=\{\(\) => \{ userMomentumRef\.current = false; \}\}/);
  assert.match(thread, /userDraggingRef\.current \|\| userMomentumRef\.current/);
});

test('idle chat near latest follows new messages and own send still follows', () => {
  assert.equal(scrollAction({
    intent: 'content', nearBottom: true, initialSettled: true, userInteracting: false,
  }), 'stick-end');
  assert.equal(scrollAction({
    intent: 'content', nearBottom: false, initialSettled: true, userInteracting: false,
  }), 'none');
  assert.equal(scrollAction({
    intent: 'own-send', nearBottom: false, initialSettled: true, userInteracting: true,
  }), 'stick-end');
  assert.equal(scrollAction({
    intent: 'open', nearBottom: true, initialSettled: false,
  }), 'wait');
});

test('older history offsets preserve the visible message without two controllers', () => {
  const anchor = { offset: 84, height: 1000 };
  assert.equal(prependOffset(anchor, 1570), 654);
  assert.equal(prependOffset(anchor, 1000), null);
  assert.equal(prependOffset(anchor, 940), 24);
  assert.equal(prependOffset({offset: 10, height: 1000}, 900), 0);
  assert.equal(prependOffset(anchor, Number.NaN), null);
  assert.equal(prependOffset(null, 1200), null);
  assert.match(thread, /pendingOlderAnchorRef\.current = \{/);
  assert.match(thread, /const offset = connectOlderPrependScrollOffset\(/);
  assert.match(thread, /pendingOlderAnchorRef\.current = null;/);
  // A zero-height prepend must consume its anchor instead of making a later
  // attachment/keyboard resize unexpectedly shift the reader's viewport.
  assert.match(
    thread,
    /pendingOlderAnchorRef\.current = null;[\s\S]*?const offset = connectOlderPrependScrollOffset\(anchor, height\);[\s\S]*?if \(offset !== null\)/
  );
  assert.doesNotMatch(thread, /maintainVisibleContentPosition=/);
  assert.match(thread, /bounces=\{false\}/);
  assert.match(thread, /overScrollMode="never"/);
});

test('thread session, read cursors and pagination remain wired', () => {
  assert.match(thread, /pendingOlderAnchorRef\.current = null;[\s\S]*?initialLoadSettledRef\.current = false/);
  assert.match(thread, /if \(\s*contentOffset\.y <= CONNECT_LOAD_OLDER_PX/);
  assert.match(thread, /markVisibleRoomRead\('returned-to-latest'\)/);
  assert.match(thread, /connectScrollAction\(\{\s*intent: 'content'/);
  assert.match(thread, /listRef\.current\?\.scrollToEnd\(\{/);
  assert.match(thread, /const next = mergeConnectServerMessages\(/);
});
