import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('Wall navigation and scroll are not held by offline comment replay', () => {
  const source = read('src/app/(tabs)/buklod.tsx');
  assert.match(source, /<ScrollView/);
  const start = source.indexOf(' const submitCommunityComment=');
  const end = source.indexOf(' const reactToComment=', start);
  assert.ok(start > 0 && end > start);
  const submit = source.slice(start, end);
  assert.match(submit, /await queueWallComment\(/); // persist first
  assert.match(submit, /void syncNow\(/); // fire-and-forget network send, never hold tab navigation
  assert.doesNotMatch(submit, /await syncNow\(/);
  assert.doesNotMatch(submit, /router\.replace\(/);
  assert.match(source, /const previousCommentNetworkRef=useRef\(wallNetworkStatus\)/);
  assert.match(source, /void loadComments\(String\(commentPost\.id\),\{silent:true\}\)/);
});

test('Offline comment reconnection cannot block the global ad lifecycle or navigate out', () => {
  const coordinator = read('src/components/BuklodSyncCoordinator.tsx');
  assert.match(coordinator, /registerOfflineQueueHandler\(WALL_COMMENT_QUEUE_KIND/);
  assert.match(coordinator, /withBuklodTimeout\(/);
  assert.match(coordinator, /recordConfirmedCommunityComment/);
  assert.match(coordinator, /warmBuklodAdOpportunity/);
  assert.match(coordinator, /emitConfirmedWallComment/);
  assert.doesNotMatch(coordinator, /showBuklodAdOpportunity\(/);
  const queue = read('src/lib/offlineSyncQueue.ts');
  assert.match(queue, /Math\.min\(3, Number\(options\?\.concurrency/);
  assert.match(queue, /Math\.min\(50, Math\.floor\(requestedLimit\)\)/);
  assert.match(queue, /item\.userId === options\.userId/);
});
