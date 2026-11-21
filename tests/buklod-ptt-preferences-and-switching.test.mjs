import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const readSource = (file) => readFileSync(resolve(root, file), 'utf8');
function compile(source) {
  return stripTypeScriptTypes(source)
    .replace(/(?:^|\n)import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?/g, '\n')
    .replace(/\bexport\s+/g, '');
}

function setupHarness() {
  const records = new Map();
  let failWrite = false;
  const AsyncStorage = {
    async getItem(key) { return records.get(key) ?? null; },
    async setItem(key, value) { if (failWrite) throw new Error('DISK_WRITE_FAILED'); records.set(key, value); },
  };
  const api = runInNewContext(compile(readSource('src/ptt/buklodPttSetup.ts')) +
    '\n({ loadBuklodPttUserSettings, saveBuklodPttUserSettings, subscribeBuklodPttUserSettings, resolveBuklodPttRoute })', {
    AsyncStorage, Platform: { OS: 'android', Version: 35 }, NetInfo: {},
    Notifications: {}, Linking: {}, PermissionsAndroid: {},
    getRecordingPermissionsAsync: async () => ({ granted: true }),
    requestRecordingPermissionsAsync: async () => ({ granted: true }),
  });
  return { api, records, failWrites(value) { failWrite = value; } };
}

test('PTT restores saved route, channel, listening and ordinary talk mode for the same account', async () => {
  const { api } = setupHarness();
  const before = await api.loadBuklodPttUserSettings('user-12345678');
  assert.equal(before.routeMode, 'AUTO');
  assert.equal(before.listening, true);
  await api.saveBuklodPttUserSettings('user-12345678', {
    routeMode: 'INTERNET', scopeId: 'cluster-8', channel: 7,
    listening: false, talkMode: 'PRIORITY',
  });
  const restored = await api.loadBuklodPttUserSettings('user-12345678');
  assert.equal(restored.scopeId, 'cluster-8');
  assert.equal(restored.channel, 7);
  assert.equal(restored.listening, false);
  assert.equal(restored.routeMode, 'INTERNET');
  assert.equal(restored.talkMode, 'PRIORITY');
  assert.equal((await api.loadBuklodPttUserSettings('user-87654321')).scopeId, '');
  assert.equal((await api.loadBuklodPttUserSettings('user-87654321')).listening, true);
});

test('PTT notifies active screen only after successful per-user storage writes', async () => {
  const { api, failWrites } = setupHarness();
  const alice = 'user-12345678', bob = 'user-87654321';
  const updates = [];
  const unsubscribe = api.subscribeBuklodPttUserSettings(alice, saved => updates.push(saved.listening));
  await api.saveBuklodPttUserSettings(bob, {
    routeMode: 'AUTO', scopeId: 'other', channel: 1,
    listening: false, talkMode: 'NORMAL',
  });
  assert.equal(updates.length, 0);
  await api.saveBuklodPttUserSettings(alice, {
    routeMode: 'AUTO', scopeId: 'mine', channel: 2,
    listening: false, talkMode: 'NORMAL',
  });
  assert.deepEqual(updates, [false]);
  failWrites(true);
  await assert.rejects(() => api.saveBuklodPttUserSettings(alice, {
    routeMode: 'AUTO', scopeId: 'mine', channel: 2,
    listening: true, talkMode: 'NORMAL',
  }), /DISK_WRITE_FAILED/);
  assert.deepEqual(updates, [false]);
  unsubscribe();
});

test('Notification Stop requests persistent listening off, not just mic release', () => {
  const duty = readSource('src/ptt/buklodPttDutyNotification.ts');
  assert.match(duty, /action === STOP_ACTION[\\s\\S]*stopBuklodPttListening\\(\\)/);
});

test('PTT storage failures do not silently claim a new saved setting', async () => {
  const { api, failWrites } = setupHarness();
  const original = {
    routeMode: 'AUTO', scopeId: 'cluster-1', channel: 3,
    listening: true, talkMode: 'NORMAL',
  };
  await api.saveBuklodPttUserSettings('user-12345678', original);
  failWrites(true);
  await assert.rejects(
    () => api.saveBuklodPttUserSettings('user-12345678', { ...original, listening: false }),
    /DISK_WRITE_FAILED/,
  );
  assert.equal((await api.loadBuklodPttUserSettings('user-12345678')).listening, true);
  await assert.rejects(() => api.loadBuklodPttUserSettings('x'), /signed-in member/);
});

test('AUTO never calls non-existent Nearby transport ready when Internet is down', () => {
  const { api } = setupHarness();
  const setup = { internet: false, wifiConnected: false, nearby: false };
  assert.equal(api.resolveBuklodPttRoute('AUTO', setup, 0), 'INTERNET');
  assert.equal(api.resolveBuklodPttRoute('NEARBY', setup, 0), 'NEARBY');
});

function runtimeHarness() {
  const operations = [];
  let failing = '';
  let delayed = null;
  const conn = (scope, channel) => ({
    scope, channel, userId: 'user-12345678', callId: scope.id + channel,
    call: { on: () => () => {}, microphone: { disable: async () => {}, enable: async () => {} } },
  });
  const mocks = {
    connectBuklodPtt: async (scope, channel) => {
      operations.push('join:' + scope.id);
      if (delayed && scope.id === delayed.id) await delayed.promise;
      if (scope.id === failing) throw new Error('JOIN_FAILED');
      return conn(scope, channel);
    },
    disconnectBuklodPtt: async (connection) => { operations.push('leave:' + connection.scope.id); },
    setBuklodPttMonitor: async (id, channel, active) => { operations.push('monitor:' + id + ':' + active); },
    claimBuklodPttFloor: async () => ({ granted: false }),
    releaseBuklodPttFloor: async () => true,
    refreshBuklodPttFloor: async () => true,
    loadBuklodPttScopes: async () => [],
    supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
    loadBuklodPttUserSettings: async () => ({ listening: true }),
    hasBuklodPttCaptionConsent: async () => false,
    persistOwnBuklodPttCaption: async () => {},
    console, setInterval, clearInterval, Date, Set, Map, Promise,
  };
  const api = runInNewContext(compile(readSource('src/ptt/buklodPttRuntime.ts')) +
    '\n({ connectBuklodPttRuntime, disconnectBuklodPttRuntime, getBuklodPttRuntimeState })', mocks);
  return { api, operations,
    failJoin(id) { failing = id; },
    delayJoin(id) {
      let resolve;
      const promise = new Promise(r => { resolve = r; });
      delayed = { id, promise };
      return resolve;
    },
  };
}

test('failed PTT target switch keeps the previous real connection and monitor', async () => {
  const { api, operations, failJoin } = runtimeHarness();
  const a = { id: 'alpha' }, b = { id: 'beta' };
  await api.connectBuklodPttRuntime(a, 1);
  failJoin('beta');
  await assert.rejects(() => api.connectBuklodPttRuntime(b, 2), /JOIN_FAILED/);
  assert.equal(api.getBuklodPttRuntimeState().connection.scope.id, 'alpha');
  assert.equal(operations.includes('leave:alpha'), false);
  assert.equal(operations.includes('monitor:alpha:false'), false);
});

test('PTT target joins are serialized; Stop waits for in-flight join and wins', async () => {
  const { api, operations, delayJoin } = runtimeHarness();
  const release = delayJoin('beta');
  const pending = api.connectBuklodPttRuntime({ id: 'beta' }, 3);
  const stop = api.disconnectBuklodPttRuntime();
  release();
  await Promise.all([pending, stop]);
  assert.equal(api.getBuklodPttRuntimeState().connection, null);
  assert.ok(operations.indexOf('join:beta') < operations.indexOf('leave:beta'));
});

test('UI requires a confirmed live channel before marking channel chips active', () => {
  const screen = readSource('src/app/personal-home/ptt.tsx');
  assert.match(screen, /targetMatched\s*&&\s*channel === ch\s*&&\s*styles\.channelCellOn/);
  assert.match(screen, /SAVED \/ NOT CONNECTED/);
  assert.match(screen, /persistPreferences\(\{ \.\.\.preferences, listening: false \}\)/);
  assert.match(screen, /disabledLabel=/);
});
