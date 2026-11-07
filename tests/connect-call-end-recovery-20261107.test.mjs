import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  subscribeBuklodCallingStateChanges,
} from '../src/lib/buklodCallStateSubscription.ts';
import {
  isBuklodActiveNonPttCall,
  findActiveNonPttCall,
} from '../src/lib/buklodActiveNonPttCall.ts';

const read = path => readFileSync(path, 'utf8');
const ring = read('src/components/RingingCalls.tsx');
const boundary = read('src/components/BuklodCallRenderBoundary.tsx');
const provider = read('src/providers/StreamVideoProvider.tsx');
const caller = read('src/components/BuklodConnectThread.tsx');
const sdkPush = read('src/utils/setPushConfig.ts');

function fakeCall(state, ringing = false) {
  return { type: 'default', ringing, state: { callingState: state } };
}

test('unanswered call cancellation and missed/rejected terminal states cannot keep the call UI mounted', () => {
  for (const state of [
    'idle', 'left', 'offline', 'reconnecting-failed',
    'reconnecting_failed', 'cancelled', 'canceled',
    'rejected', 'declined', 'missed', 'ended', 'failed', 'closed', 'disconnected',
  ]) {
    assert.equal(isBuklodActiveNonPttCall(fakeCall(state, true)), false, state);
  }
  assert.equal(isBuklodActiveNonPttCall({
    type: 'default', ringing: true, state: null,
  }), false, 'disposed call with stale ringing flag');
  assert.equal(isBuklodActiveNonPttCall(fakeCall('unexpected-terminal-state', true)), false);
  assert.equal(findActiveNonPttCall([
    fakeCall('cancelled', true),
    fakeCall('left', true),
  ]), null);
});

test('normal ringing, outgoing and connected call UI remain supported; PTT remains excluded', () => {
  for (const state of ['ringing', 'joining', 'joined', 'reconnecting', 'migrating']) {
    assert.equal(isBuklodActiveNonPttCall(fakeCall(state)), true, state);
  }
  assert.equal(isBuklodActiveNonPttCall(fakeCall('unknown', true)), true);
  assert.equal(isBuklodActiveNonPttCall(fakeCall('', true)), true);
  assert.equal(isBuklodActiveNonPttCall(fakeCall('unknown', false)), false);
  assert.equal(isBuklodActiveNonPttCall({
    type: 'buklod_ptt', ringing: true, state: { callingState: 'joined' },
  }), false);
});

test('synchronous BehaviorSubject snapshot never triggers a React rerender loop', () => {
  let callback = null;
  let unsubscribed = false;
  let changes = 0;
  const subscription = subscribeBuklodCallingStateChanges([{
    state: {
      callingState$: {
        subscribe(handler) {
          callback = handler;
          handler(); // Immediate initial state emission (not a transition)
          return { unsubscribe() { unsubscribed = true; } };
        },
      },
    },
  }], () => { changes++; });
  assert.equal(changes, 0, 'initial subscribe must not render a second time');
  callback();
  assert.equal(changes, 1);
  subscription();
  assert.equal(unsubscribed, true);
  callback(); // Late SDK event after cancelled call
  assert.equal(changes, 1, 'unmounted React must not be updated');
});

test('detaching a disposed or faulty Stream observable cannot crash the caller app', () => {
  let changes = 0;
  let notify = null;
  const cleanup = subscribeBuklodCallingStateChanges([
    null,
    { state: null },
    { state: { callingState$: null } },
    { state: { callingState$: { subscribe() { throw Error('disposed call'); } } } },
    { state: { callingState$: {
      subscribe(handler) {
        notify = handler;
        return { unsubscribe() { throw Error('already detached'); } };
      },
    } } },
  ], () => { changes++; });
  notify();
  assert.equal(changes, 1);
  assert.doesNotThrow(cleanup);
  notify();
  assert.equal(changes, 1);
});

test('global call render failures are isolated and auto-reset on the next call identity', () => {
  assert.match(ring, /<BuklodCallRenderBoundary[\s\S]*?key=\{activeKey\}/);
  assert.match(ring, /callActive=\{Boolean\(activeCall\)\}/);
  assert.match(ring, /<RingingCallsCore \/>/);
  assert.match(ring, /subscribeBuklodCallingStateChanges\(/);
  assert.match(ring, /activeCall \? callIdentity\(activeCall\) \|\| 'active' : 'idle'/);
  assert.match(boundary, /getDerivedStateFromError/);
  assert.match(boundary, /componentDidCatch/);
  assert.match(boundary, /BUKLOD_CALL_SURFACE_EXCEPTION/);
  assert.match(boundary, /if \(!this\.props\.callActive\) return null/);
  assert.match(boundary, /RETRY CALL SCREEN/);
  assert.match(boundary, /LEAVE CALL/);
  assert.match(provider, /<RingingCalls \/>/);
  assert.match(boundary, /privacyClassification: 'OPERATIONAL'/);
});

test('ringback cleanup tolerates player already disposed after caller hangs up', () => {
  assert.match(ring, /if \(disposed \|\| !enabled\) return/);
  assert.match(ring, /try \{[\s\S]*?player\.pause\(\);[\s\S]*?\} catch \{/);
  assert.match(ring, /Promise\.resolve\(player\.seekTo\(0\)\)\.catch/);
  assert.match(ring, /setBuklodCallSoundSuppressed\(Boolean\(activeCall\)\)/);
});

test('call launch still uses unique fresh ID and Stream ringing, without extra navigation or native config changes', () => {
  assert.match(caller, /buildBuklodPersonalCallId\(/);
  assert.match(caller, /ring: true/);
  assert.match(caller, /auto_cancel_timeout_ms: 45000/);
  assert.match(caller, /incoming_call_timeout_ms: 30000/);
  assert.match(sdkPush, /firebase-video-production/);
  assert.match(sdkPush, /buklod_incoming_calls_v2/);
  assert.match(sdkPush, /shouldRejectCallWhenBusy:/);
  assert.doesNotMatch(sdkPush, /buklod_incoming_calls_v3/);
});
