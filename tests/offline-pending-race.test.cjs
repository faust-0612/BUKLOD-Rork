const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');

const root = process.env.BUKLOD_TEST_ROOT || path.resolve(__dirname, '..');

function pendingApi(storage) {
  const source = fs.readFileSync(path.join(root, 'src/lib/buklodOfflineSync.ts'), 'utf8');
  const code = stripTypeScriptTypes(source)
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '')
    .replace(/^export\s+/gm, '');
  return new Function('AsyncStorage', 'SCALE_LIMITS', 'peekCommunityMediaUrl',
    code + '\nreturn { enqueuePendingAction, listPendingActions, removePendingAction };'
  )(storage, {offlineCommunityCachePosts:50,offlineSyncMaxRetries:5}, () => null);
}

function storageMock() {
  const items = new Map();
  let failNextWrite = false;
  return {
    getItem: async key => {
      await new Promise(resolve => setTimeout(resolve, 1));
      return items.get(key) ?? null;
    },
    setItem: async (key, value) => {
      await new Promise(resolve => setTimeout(resolve, 1));
      if (failNextWrite) {
        failNextWrite = false;
        throw new Error('Simulated device storage failure');
      }
      items.set(key, value);
    },
    failOnce: () => { failNextWrite = true; },
  };
}

test('simultaneous offline org saves and concurrent remove do not overwrite each other', async () => {
  const api = pendingApi(storageMock());
  const saves = await Promise.all(Array.from({length:30}, (_, index) =>
    api.enqueuePendingAction({
      type:'org_upsert_record',
      scopeKey:'org-a',
      label:'Draft ' + index,
      payload:{index},
    }),
  ));
  assert.equal(new Set(saves.map(item => item.id)).size,30);
  let pending = await api.listPendingActions();
  assert.equal(pending.length,30);
  assert.equal(new Set(pending.map(item => item.payload.index)).size,30);

  await Promise.all([
    api.removePendingAction(saves[0].id),
    api.enqueuePendingAction({
      type:'org_upsert_record',
      scopeKey:'org-a',
      label:'Newest draft',
      payload:{index:30},
    }),
  ]);
  pending = await api.listPendingActions();
  assert.equal(pending.length,30);
  assert.equal(pending.some(item => item.payload.index === 0), false);
  assert.equal(pending.some(item => item.payload.index === 30), true);
});

test('a failed storage write does not poison the pending-action mutation chain', async () => {
  const storage = storageMock();
  const api = pendingApi(storage);
  storage.failOnce();
  await assert.rejects(api.enqueuePendingAction({
    type:'community_post_draft',
    scopeKey:'public',
    label:'Unstored',
    payload:{index:0},
  }), /storage failure/);
  await api.enqueuePendingAction({
    type:'community_post_draft',
    scopeKey:'public',
    label:'Safe retry',
    payload:{index:1},
  });
  assert.deepEqual((await api.listPendingActions()).map(item => item.payload.index), [1]);
});
