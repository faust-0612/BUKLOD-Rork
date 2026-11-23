import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(
  new URL('../src/components/BuklodConnectThread.tsx', import.meta.url),
  'utf8'
);

// Execute the actual production onScroll history-prepend guard, not a
// reimplementation. Other message callbacks stay in the real chat component.
const start = source.indexOf('          if (\n            contentOffset.y <= CONNECT_LOAD_OLDER_PX');
const end = source.indexOf('\n        }}\n        scrollEventThrottle=', start);
assert.ok(start > 0 && end > start, 'historical paging guard must be in onScroll');
const guard = source.slice(start, end);
assert.match(guard, /userScrolledUpRef\.current = false;\s*void loadOlder\(\);/);

function tryPrepend({
  offset = 0, upward = false, anchored = true,
  pinning = false, hasOlder = true, loading = false,
} = {}) {
  let calls = 0;
  const gesture = { current: upward };
  runInNewContext(guard, {
    contentOffset: { y: offset },
    CONNECT_LOAD_OLDER_PX: 72,
    hasOlder,
    loadingOlderRef: { current: loading },
    listAnchoredRef: { current: anchored },
    pinLatestOnOpenRef: { current: pinning },
    userScrolledUpRef: gesture,
    loadOlder: () => { calls += 1; },
  });
  return { calls, armed: gesture.current };
}

test('initial top offset and programmatic latest anchor never fetch older history', () => {
  assert.deepEqual(tryPrepend(), { calls: 0, armed: false });
  assert.deepEqual(tryPrepend({ upward: true, anchored: false }), { calls: 0, armed: true });
  assert.deepEqual(tryPrepend({ upward: true, pinning: true }), { calls: 0, armed: true });
});

test('only intentional upward history reading can request one older page', () => {
  assert.deepEqual(tryPrepend({ upward: true }), { calls: 1, armed: false });
  assert.deepEqual(tryPrepend({ upward: true, offset: 100 }), { calls: 0, armed: true });
  assert.deepEqual(tryPrepend({ upward: true, hasOlder: false }), { calls: 0, armed: true });
  assert.deepEqual(tryPrepend({ upward: true, loading: true }), { calls: 0, armed: true });
});

test('cached conversations wait for measured layout rather than timed jump', () => {
  const cache = source.slice(
    source.indexOf('    void getOfflineCache<'),
    source.indexOf('  const loadReactions =')
  );
  assert.match(cache, /initialLoadSettledRef\.current = true;/);
  assert.doesNotMatch(cache, /anchorTimer|setTimeout\([^;]*64\)/);
  assert.doesNotMatch(cache, /scrollToEnd\(/);
  assert.match(source, /style=\{\{ flex: 1, opacity: listAnchored \? 1 : 0 \}\}/);
  assert.match(source, /if \(contentOffset\.y < previousOffset - 2\)/);
  assert.match(source, /userScrolledUpRef\.current = false;[\s\S]*?pendingOlderAnchorRef\.current = null;/);
});

test('scope and direct threads preserve existing paging and read behavior', () => {
  assert.match(source, /fetchScopeConnectHistoryPage\(/);
  assert.match(source, /fetchDirectConnectHistoryPage\(/);
  assert.match(source, /markVisibleRoomRead\('returned-to-latest'\)/);
  assert.match(source, /connectOlderPrependScrollOffset\(anchor, height\)/);
  assert.match(source, /onScrollBeginDrag=\{\(\) => \{ userDraggingRef\.current = true; \}\}/);
  assert.match(source, /listRef\.current\?\.scrollToEnd\(\{ animated: false \}\)/);
});
