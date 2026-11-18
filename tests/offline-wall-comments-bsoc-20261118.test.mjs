import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';

function loadTs(path, dependencies = {}) {
  const js = ts.transpileModule(read(path), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, {
    exports: module.exports,
    module,
    require: id => {
      if (Object.prototype.hasOwnProperty.call(dependencies, id)) return dependencies[id];
      throw Error('Unexpected dependency ' + id);
    },
    Date, Math, Map, Set, Promise, Error, Number, String, Boolean,
  }, { filename: path, timeout: 2_000 });
  return module.exports;
}

test('offline queue actually persists, isolates accounts and reuses the SAME key on lost acknowledgement', async () => {
  const store = new Map();
  const queue = loadTs('src/lib/offlineSyncQueue.ts', {
    '@react-native-async-storage/async-storage': {
      getItem: async key => store.get(key) ?? null,
      setItem: async (key, value) => { store.set(key, value); },
    },
  });
  const item = await queue.enqueueOfflineAction({
    kind: 'community_wall_comment_v1',
    userId: UUID_A,
    payload: { postId: UUID_B, body: 'Save me', parentId: null, mentionIds: [] },
  });
  assert.match(item.id, /^oq_/);
  assert.equal((await queue.getOfflineQueueSnapshot()).pendingCount, 1);

  const confirmedOnServer = new Set();
  let attempts = 0;
  queue.registerOfflineQueueHandler('community_wall_comment_v1', async row => {
    assert.equal(row.id, item.id);
    confirmedOnServer.add(row.id); // Server acknowledged the durable client ID.
    attempts++;
    if (attempts === 1) throw Error('response lost after DB commit');
  });
  await queue.drainOfflineQueue({ userId: UUID_C }); // Wrong account never sends.
  assert.equal(attempts, 0);
  await queue.drainOfflineQueue({ userId: UUID_A });
  assert.equal(attempts, 1);
  assert.equal((await queue.getOfflineQueueSnapshot()).pendingCount, 1);
  assert.equal(await queue.retryOfflineQueueItem(item.id, UUID_B), false);
  assert.equal(await queue.retryOfflineQueueItem(item.id, UUID_A), true);
  await queue.drainOfflineQueue({ userId: UUID_A });
  assert.equal(attempts, 2);
  assert.equal(confirmedOnServer.size, 1);
  assert.equal((await queue.getOfflineQueueSnapshot()).pendingCount, 0);

  // Corrupt storage must NEVER be treated as an empty queue and overwritten.
  store.set('@buklod/offline-sync/v1', '{corrupt JSON');
  await assert.rejects(
    () => queue.enqueueOfflineAction({
      kind: 'community_wall_comment_v1', userId: UUID_A,
      payload: { postId: UUID_B, body: 'should be retained', parentId: null, mentionIds: [] },
    }),
    /Pending offline work could not be read/,
  );
  assert.equal(store.get('@buklod/offline-sync/v1'), '{corrupt JSON');
});

test('offline Wall comment input is strictly validated; phone-temporary files are not falsely promised offline', async () => {
  const media = loadTs('src/lib/buklodCommentMediaBody.ts');
  let queued = null;
  const offline = loadTs('src/lib/buklodCommunityOfflineComment.ts', {
    '@/lib/buklodCommentMediaBody': media,
    '@/lib/offlineSyncQueue': {
      enqueueOfflineAction: async input => { queued = input; return { id: 'oq_test_request', ...input }; },
    },
  });
  const clean = offline.parsePendingWallComment({
    postId: UUID_B, body: 'Hello offline', parentId: null, mentionIds: [UUID_C, UUID_C, 'bad'],
  });
  assert.equal(clean.postId, UUID_B);
  assert.equal(clean.mentionIds.length, 1);
  await offline.queueWallComment(UUID_A, clean);
  assert.equal(queued.kind, 'community_wall_comment_v1');
  assert.equal(queued.userId, UUID_A);
  assert.equal(queued.payload.body, 'Hello offline');
  assert.equal(queued.maxAttempts, 12);

  assert.equal(offline.parsePendingWallComment({ postId: 'bad', body: 'hello' }), null);
  assert.equal(offline.parsePendingWallComment({ postId: UUID_B, body: '' }), null);
  assert.equal(offline.parsePendingWallComment({ postId: UUID_B, body: 'x'.repeat(2001) }), null);
  assert.equal(offline.parsePendingWallComment({
    postId: UUID_B, body: media.encodeBuklodCommentMediaBody({ kind: 'gif', ref: 'file:///tmp/sticker.gif' }, 'hi'),
  }), null);
  assert.ok(offline.parsePendingWallComment({
    postId: UUID_B, body: media.encodeBuklodCommentMediaBody({ kind: 'image', ref: UUID_A + '/uploaded.jpg' }, 'hi'),
  }));
  assert.deepEqual(
    JSON.parse(JSON.stringify(offline.isPendingWallCommentFor({
      kind: 'community_wall_comment_v1',
      userId: UUID_A,
      payload: clean,
    }, UUID_A, UUID_B))), true,
  );
  assert.equal(offline.isPendingWallCommentFor({
    kind: 'community_wall_comment_v1', userId: UUID_A, payload: clean,
  }, UUID_C, UUID_B), false);
});

test('confirmation is emitted at most once per stable offline request ID', () => {
  const offline = loadTs('src/lib/buklodCommunityOfflineComment.ts', {
    '@/lib/buklodCommentMediaBody': { parseBuklodCommentMediaBody: () => ({ media: null }) },
    '@/lib/offlineSyncQueue': { enqueueOfflineAction: async x => x },
  });
  const events = [];
  const unsub = offline.subscribeConfirmedWallComment(e => events.push(e));
  const input = { itemId: 'oq_test_123', userId: UUID_A, postId: UUID_B };
  offline.emitConfirmedWallComment(input);
  offline.emitConfirmedWallComment(input);
  assert.equal(events.length, 1);
  unsub();
});

test('backend new RPC protects auth, visibility and replay identity; old v4 retained for compatibility', () => {
  const sql = read('supabase/migrations/20261118014500_community_wall_comment_idempotency_v5.sql');
  assert.match(sql, /add column if not exists client_request_key/);
  assert.match(sql, /create unique index if not exists comments_author_request_key_v1/);
  assert.match(sql, /on public\.comments\s*\(user_id, client_request_key\)/);
  assert.match(sql, /create or replace function public\.add_buklod_post_comment_v5/);
  assert.match(sql, /actor uuid := \(select auth\.uid\(\)\)/);
  assert.match(sql, /public\.can_view_community_post_v2/);
  assert.match(sql, /on conflict do nothing/);
  assert.match(sql, /existing\.body <> clean_body/);
  assert.match(sql, /revoke all on function [\s\S]*from public, anon/);
  assert.match(sql, /grant execute on function [\s\S]*to authenticated/);
  assert.doesNotMatch(sql, /drop function/);
});

test('Wall sends to queue first; server only confirms comments; feed/ads are not blocked offline', () => {
  const wall = read('src/app/(tabs)/buklod.tsx');
  const begin = wall.indexOf(' const submitCommunityComment=');
  const end = wall.indexOf(' const reactToComment=', begin);
  assert.ok(begin > 0 && end > begin);
  const submit = wall.slice(begin, end);
  assert.ok(submit.indexOf('await queueWallComment(') < submit.indexOf('void syncNow('));
  assert.doesNotMatch(submit, /add_buklod_post_comment_v4/);
  assert.match(submit, /localPhoto \|\| localGif/);
  assert.match(wall, /subscribeConfirmedWallComment/);
  assert.match(wall, /setCommentNotice\('Comment posted\.'\)/);
  assert.match(wall, /Saved on device/);
  assert.match(wall, /Retry loading comments/);
  assert.match(wall, /comment_preview:previews\[event\.postId\]/);
  const healthAgent = read('src/components/BuklodMainHealthAgent.tsx');
  assert.match(healthAgent, /classifyNetworkQuality\(\) !== 'normal'/);
  const auth = read('src/lib/buklodAuthResilience.ts');
  assert.match(auth, /!isBuklodInvalidCredentialsError\(result\.error\)/);
  const coordinator = read('src/components/BuklodSyncCoordinator.tsx');
  assert.match(coordinator, /registerOfflineQueueHandler\(WALL_COMMENT_QUEUE_KIND/);
  assert.match(coordinator, /p_request_key: item\.id/);
  assert.match(coordinator, /emitConfirmedWallComment/);
  assert.match(coordinator, /recordConfirmedCommunityComment/);
  assert.doesNotMatch(coordinator, /service_role|supabase\.auth\.admin/);
});

test('BSOC keeps single weak-signal auth warnings diagnostic without hiding real error/security cases', () => {
  const sql = read('supabase/migrations/20261118015500_bsoc_low_signal_escalation_threshold_v1.sql');
  assert.match(sql, /he\.privacy_classification = 'MINIMAL'/);
  assert.match(sql, /he\.health_category = 'AUTH'/);
  assert.match(sql, /he\.repeat_count < 3/);
  assert.match(sql, /he\.severity in \('INFO','WARNING'\)/);
  assert.match(sql, /he\.local_self_heal_attempted = false/);
  assert.match(sql, /when 'CRITICAL' then 1/);
  assert.match(sql, /e\.privacy_classification='SECURITY_REVIEW_REQUIRED'/);
  assert.match(sql, /REMOTE_RECOVERY_RUNNING/);
  const triage = loadTs('src/lib/bsocCaseTriage.ts');
  const weak = triage.bsoCaseIntervention({ title: 'Auto escalation: AUTH_REQUEST_TIMEOUT' });
  assert.equal(weak.urgency, 'investigate');
  const failed = triage.bsoCaseIntervention({ title: 'Auto escalation: AUTH_REQUEST_FAILED' });
  assert.equal(failed.urgency, 'investigate');
  const stale = triage.bsoCaseIntervention({ title: 'Auto escalation: AUTH_SESSION_STALE' });
  assert.equal(stale.urgency, 'priority');
});
