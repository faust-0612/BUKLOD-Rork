import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isBuklodCallOriginator,
  isBuklodRecipientPresentationReceipt,
} from '../src/lib/buklodCallFeedback.ts';

const call = {
  cid: 'default:buklod-personal-new-id',
  isCreatedByMe: true,
  state: {
    createdBy: { id: 'caller' },
    members: [{ user: { id: 'caller' } }, { user: { id: 'callee' } }],
  },
};
const receipt = (sender, cid=call.cid) => ({
  user: { id: sender },
  custom: { type: 'buklod.call.presented', call_cid: cid },
});

test('originator check never makes recipient play caller ringback', () => {
  assert.equal(isBuklodCallOriginator(call, 'caller'), true);
  assert.equal(isBuklodCallOriginator(call, 'callee'), false);
  assert.equal(isBuklodCallOriginator({ isCreatedByMe: false }, 'callee'), false);
});

test('delivery receipt requires another real member and the exact call attempt', () => {
  assert.equal(isBuklodRecipientPresentationReceipt(call, receipt('callee'), 'caller'), true);
  assert.equal(isBuklodRecipientPresentationReceipt(call, receipt('caller'), 'caller'), false);
  assert.equal(isBuklodRecipientPresentationReceipt(call, receipt('stranger'), 'caller'), false);
  assert.equal(isBuklodRecipientPresentationReceipt(call, receipt('callee', 'default:old-call'), 'caller'), false);
  assert.equal(isBuklodRecipientPresentationReceipt(call, { custom: receipt('callee').custom }, 'caller'), false);
  assert.equal(isBuklodRecipientPresentationReceipt(call, { ...receipt('callee'), custom: { type: 'call.ring', call_cid: call.cid } }, 'caller'), false);
});

test('source cannot claim remote delivery from server ringing alone', () => {
  const ring = readFileSync('src/components/RingingCalls.tsx', 'utf8');
  const thread = readFileSync('src/components/BuklodConnectThread.tsx', 'utf8');
  const lifecycle = readFileSync('src/lib/buklodCallLifecycle.ts', 'utf8');
  assert.match(ring, /isBuklodRecipientPresentationReceipt/);
  assert.match(ring, /sendCustomEvent/);
  assert.match(ring, /playerStatus\.isLoaded/);
  assert.match(ring, /Hindi pa nakumpirma kung naabot/);
  assert.match(ring, /setBuklodCallSoundSuppressed\(Boolean\(activeCall\)\)/);
  assert.doesNotMatch(thread, /PATCH_171H_PERSONAL_CALL_STATUS/);
  assert.match(lifecycle, /eventName === 'call.missed'/);
  assert.match(lifecycle, /maybeShowCallerOutcome\([\s\S]*?readCallEnvelope\(event\)/);
  assert.doesNotMatch(lifecycle, /person is not available or offline/i);
});
