const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { stripTypeScriptTypes } = require('node:module');
const { runInNewContext } = require('node:vm');

const root = resolve(__dirname, '..');

function configure(platform) {
  let config;
  const source = readFileSync(resolve(root, 'src/utils/setPushConfig.ts'), 'utf8');
  const executable = stripTypeScriptTypes(source)
    .replace(/^import[\s\S]*?;\s*/gm, '')
    .replace(/\bexport\s+/g, '') + '\nsetPushConfig();';
  runInNewContext(executable, {
    Platform: { OS: platform },
    __DEV__: false,
    process: { env: {
      EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_STREAM_IOS_PUSH_PROVIDER_NAME: 'test-ios-provider',
    } },
    StreamVideoRN: { setPushConfig(value) { config = value; } },
    console,
  });
  return config;
}

test('Android PTT/non-ringing sessions do not enter Telecom ongoing-call mode', () => {
  assert.equal(configure('android').android.enableOngoingCalls, false);
});

test('Android real ringing calls retain push, alerts, speaker route and busy protection', () => {
  const config = configure('android');
  assert.equal(config.android.pushProviderName, 'firebase-video-production');
  assert.equal(config.android.incomingChannel.id, 'buklod_incoming_calls_v2');
  assert.equal(config.android.incomingChannel.vibration, true);
  assert.equal(config.android.defaultDeviceEndpointType, 'speaker');
  assert.equal(config.shouldRejectCallWhenBusy, true);
  assert.equal(typeof config.createStreamVideoClient, 'function');
});

test('iOS call configuration is preserved', () => {
  const config = configure('ios');
  assert.equal(config.ios.enableOngoingCalls, true);
  assert.equal(config.ios.callsHistory, true);
});

test('Connect resolver ignores PTT through joining, joined and reconnecting', () => {
  const source = readFileSync(resolve(root, 'src/lib/buklodActiveNonPttCall.ts'), 'utf8');
  const executable = stripTypeScriptTypes(source).replace(/\bexport\s+/g, '') +
    '\n({ findActiveNonPttCall, restoreActiveNonPttCallIfAny, minimizeBuklodCallSurface, getBuklodCallSurfaceMode });';
  const api = runInNewContext(executable, {});
  for (const state of ['joining', 'joined', 'reconnecting', 'migrating']) {
    const ptt = { type: 'buklod_ptt', state: { callingState: state } };
    api.minimizeBuklodCallSurface();
    assert.equal(api.restoreActiveNonPttCallIfAny([ptt]), null);
    assert.equal(api.getBuklodCallSurfaceMode(), 'minimized');
    const call = { type: 'default', state: { callingState: state } };
    assert.equal(api.findActiveNonPttCall([ptt, call]), call);
  }
});
