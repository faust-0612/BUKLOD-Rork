const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');

const root = process.env.BUKLOD_TEST_ROOT || path.resolve(__dirname, '..');
function source(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}
function compile(file, deps, exports) {
  const code = stripTypeScriptTypes(source(file))
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*$/gm, '')
    .replace(/^export\s+/gm, '');
  return new Function(...Object.keys(deps), code + '\nreturn {' + exports.join(',') + '};')(
    ...Object.values(deps)
  );
}
function storageMock() {
  const map = new Map();
  return {
    getItem: async key => map.get(key) ?? null,
    setItem: async (key, value) => { map.set(key, value); },
    removeItem: async key => { map.delete(key); },
  };
}

test('Connect suggestion snapshots survive remount and stay account-scoped', async () => {
  let viewer = 'account-a', rpcCalls = 0;
  const persisted = new Map();
  const supabase = {
    auth: { getSession: async () => ({data:{session:{user:{id:viewer}}}}) },
    rpc: async name => {
      if (name === 'buklod_connect_suggested_contacts_v1') {
        rpcCalls++;
        return {data:[{user_id:'peer-a',full_name:'Person A',avatar_url:'avatar.jpg'}],error:null};
      }
      return {data:[],error:null};
    },
  };
  const cache = compile('src/lib/buklodConnectSuggestedContacts.ts', {
    supabase,
    getOfflineCache: async (key, {userId}) => persisted.get(userId) ?? null,
    setOfflineCache: async (key, data, {userId}) => {
      persisted.set(userId, {data, storedAt:Date.now(),isStale:false});
    },
    repairMojibakeText: x => x,
  }, ['readCachedConnectSuggestedContacts','loadConnectSuggestedContacts']);
  assert.deepEqual(await cache.readCachedConnectSuggestedContacts('account-a'), []);
  const [first, second] = await Promise.all([
    cache.loadConnectSuggestedContacts(14),
    cache.loadConnectSuggestedContacts(14),
  ]);
  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.equal(rpcCalls, 1, 'same-account simultaneous reads should coalesce');
  assert.equal((await cache.readCachedConnectSuggestedContacts('account-a'))[0].user_id,'peer-a');
  assert.deepEqual(await cache.readCachedConnectSuggestedContacts('account-b'), []);
  viewer = 'account-b';
  assert.equal((await cache.loadConnectSuggestedContacts(14))[0].user_id, 'peer-a');
  assert.equal(rpcCalls, 2, 'another account needs its own authorized fetch');
});

test('offline queue deduplicates and defers actions for a different account', async () => {
  const api = compile('src/lib/offlineSyncQueue.ts', {
    AsyncStorage: storageMock(),
  }, [
    'enqueueOfflineAction','registerOfflineQueueHandler','drainOfflineQueue',
    'getOfflineQueueSnapshot','OfflineQueueDeferredError',
  ]);
  let activeAccount = 'B', handled = 0;
  api.registerOfflineQueueHandler('faith_abc_completion_v1', async item => {
    if (item.userId !== activeAccount) throw new api.OfflineQueueDeferredError();
    handled++;
  });
  for (let n = 0; n < 2; n++) {
    await api.enqueueOfflineAction({
      kind:'faith_abc_completion_v1',
      userId:'A',
      dedupeKey:'lesson-01',
      payload:{lessonId:'lesson-01'},
    });
  }
  assert.equal((await api.getOfflineQueueSnapshot()).pendingCount,1);
  await api.drainOfflineQueue();
  let snapshot = await api.getOfflineQueueSnapshot();
  assert.equal(snapshot.pendingCount,1);
  assert.equal(snapshot.items[0].attempts,0, 'account switch must not consume retries');
  activeAccount = 'A';
  await api.drainOfflineQueue();
  assert.equal((await api.getOfflineQueueSnapshot()).pendingCount,0);
  assert.equal(handled,1);
});

test('Show Faith completion stays server-authoritative and queued by user/lesson', () => {
  const screen = source('src/app/faith/abc/[lessonId].tsx');
  const coordinator = source('src/components/BuklodSyncCoordinator.tsx');
  const index = source('src/app/faith/abc/index.tsx');
  const faithPanel = source('src/components/BuklodHomeFaithPanel.tsx');
  assert.match(screen, /dedupeKey:\s*lesson\.id/);
  assert.match(screen, /Saved Offline · Pending Sync/);
  assert.match(screen, /withBuklodTimeout<any>/);
  assert.match(coordinator, /verified\?\.id !== item\.userId/);
  assert.match(coordinator, /await AsyncStorage\.setItem\(key, JSON\.stringify\(completed\)\)/);
  assert.match(index, /\`\$\{COMPLETION_KEY\}\.\$\{accountId\}\`/);
  assert.doesNotMatch(index, /\.getItem\(\s*COMPLETION_KEY\s*\)/);
  assert.match(faithPanel, /getOfflineCache<TodayReading>/);
});
