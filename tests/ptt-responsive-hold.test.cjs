const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { stripTypeScriptTypes } = require('node:module');
const { runInNewContext } = require('node:vm');

const root = resolve(__dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

function deferred() {
  let resolveValue;
  const promise = new Promise((resolve) => { resolveValue = resolve; });
  return { promise, resolve: resolveValue };
}

function createPttHarness() {
  const claims = [];
  const releases = [];
  const microphone = { enabled: 0, disabled: 0 };
  const connection = {
    scope: { id: 'scope-1' },
    channel: 1,
    callId: 'ptt_scope1_ch01',
    call: {
      microphone: {
        async enable() { microphone.enabled += 1; },
        async disable() { microphone.disabled += 1; },
      },
    },
  };

  const source = read('src/ptt/buklodPttRuntime.ts');
  const executable = stripTypeScriptTypes(source)
    .replace(/^import[\s\S]*?;\s*/gm, '')
    .replace(/\bexport\s+/g, '') +
    '\n({ pttDown, pttUp, getBuklodPttRuntimeState, setConnection: (value) => { state.connection = value; } });';

  const api = runInNewContext(executable, {
    claimBuklodPttFloor() {
      const claim = deferred();
      claims.push(claim);
      return claim.promise;
    },
    releaseBuklodPttFloor: async (id) => {
      releases.push(id);
      return true;
    },
    refreshBuklodPttFloor: async () => true,
    setInterval: () => 1,
    clearInterval: () => undefined,
    supabase: {},
    console,
  });
  api.setConnection(connection);
  return { api, claims, releases, microphone };
}

async function flush() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

test('PTT release cancels a late grant before opening the microphone', async () => {
  const { api, claims, releases, microphone } = createPttHarness();
  const down = api.pttDown();
  assert.equal(api.getBuklodPttRuntimeState().requestingFloor, true);
  await flush();
  assert.equal(claims.length, 1);

  await api.pttUp();
  assert.equal(api.getBuklodPttRuntimeState().requestingFloor, false);
  claims[0].resolve({ granted: true, transmission_id: 'late-grant' });
  await down;

  assert.deepEqual(releases, ['late-grant']);
  assert.equal(microphone.enabled, 0);
  assert.equal(api.getBuklodPttRuntimeState().transmitting, false);
});

test('rapid press-release-press waits for old floor cleanup', async () => {
  const { api, claims, releases } = createPttHarness();
  const first = api.pttDown();
  await flush();
  assert.equal(claims.length, 1);

  await api.pttUp();
  const second = api.pttDown();
  await flush();
  assert.equal(claims.length, 1, 'second claim must wait for the old RPC');

  claims[0].resolve({ granted: true, transmission_id: 'old-tx' });
  await first;
  await flush();
  assert.deepEqual(releases, ['old-tx']);
  assert.equal(claims.length, 2);

  claims[1].resolve({ granted: true, transmission_id: 'new-tx' });
  await second;
  assert.equal(api.getBuklodPttRuntimeState().transmitting, true);
  assert.equal(api.getBuklodPttRuntimeState().transmissionId, 'new-tx');
  await api.pttUp();
  assert.deepEqual(releases, ['old-tx', 'new-tx']);
});

test('notification actions cannot latch the PTT microphone', () => {
  const source = read('src/ptt/buklodPttDutyNotification.ts');
  assert.match(source, /buttonTitle: 'Open PTT'/);
  assert.match(source, /opensAppToForeground: true/);
  assert.doesNotMatch(source, /void pttDown\(/);
});

test('closed-app PTT alerts expire promptly and headless push uses Expo field', () => {
  const source = read('supabase/functions/push/index.ts');
  assert.match(source, /ttl: 60, \/\/ A delayed PTT push/);
  assert.match(source, /contentAvailable: true/);
  assert.match(source, /androidPttSosReady/);
});
