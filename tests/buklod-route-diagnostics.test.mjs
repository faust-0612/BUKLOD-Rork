import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  safeBuklodRoute,
  rememberBuklodRoute,
  resolveBuklodCrashRoute,
  diagnoseBuklodRenderError,
} from '../src/lib/buklodRouteDiagnostics.ts';

test('retains known route names and masks dynamic identifiers', () => {
  assert.equal(safeBuklodRoute('/clusters'), 'clusters');
  assert.equal(safeBuklodRoute('/connect/personal/secret-thread-id'), 'connect/personal/:id');
  assert.equal(safeBuklodRoute('/profile/my-username?tab=x'), 'profile/:id');
  assert.equal(safeBuklodRoute(['(tabs)', 'me']), 'me');
  assert.equal(safeBuklodRoute(['scope', 'faith-monitoring', 'report']), 'scope/faith-monitoring/report');
});

test('uses last attempted destination if boundary sees only root path', () => {
  rememberBuklodRoute('/messages');
  assert.equal(resolveBuklodCrashRoute('/', []), 'messages');
  assert.equal(resolveBuklodCrashRoute('/', ['(tabs)', 'me']), 'me');
});


test('classifies a real missing-data render without retaining private exception text', () => {
  const evidence = diagnoseBuklodRenderError({
    name: 'TypeError',
    message: "Cannot read properties of undefined (reading 'privateToken_abc123')",
    stack: 'TypeError\n at render (/app/src/components/connect/MessageList.tsx:22:4)',
  });
  assert.equal(evidence.causeCode, 'NULLISH_ACCESS');
  assert.equal(evidence.originArea, 'CONNECT');
  assert.equal(evidence.correlationKey, 'BUKLOD_SCREEN_RENDER_EXCEPTION.NULLISH_ACCESS.CONNECT');
  assert.equal(evidence.sourcePath,'src/components/connect/MessageList.tsx');
  assert.equal(evidence.sourceLine,22);
  assert.equal(evidence.sourceColumn,4);
  assert.match(evidence.causeLabel, /missing data/i);
  assert.doesNotMatch(JSON.stringify(evidence), /privateToken|MessageList|abc123|\/app\/src/i);
});

test('source area is UNKNOWN without an identifiable first-party frame', () => {
  const evidence = diagnoseBuklodRenderError({
    name: 'TypeError',
    message: 'Unknown release exception with email: sensitive@example.org',
    stack: 'TypeError: error\n  at t (address at index.android.bundle:1:2346)',
  });
  assert.equal(evidence.causeCode, 'TYPE_ERROR');
  assert.equal(evidence.originArea, 'UNKNOWN');
  assert.doesNotMatch(JSON.stringify(evidence), /sensitive@example.org|index.android.bundle/);
});

test('recognizes React render loops and hook ordering without claiming certainty', () => {
  assert.equal(
    diagnoseBuklodRenderError({name:'Error',message:'Maximum update depth exceeded',stack:''}).causeCode,
    'RENDER_LOOP',
  );
  assert.equal(
    diagnoseBuklodRenderError({name:'Error',message:'Rendered fewer hooks than expected',stack:''}).causeCode,
    'HOOK_ORDER',
  );
  assert.equal(
    diagnoseBuklodRenderError({name:'Error',message:'An arbitrary opaque exception',stack:''}).causeCode,
    'UNKNOWN',
  );
});

test('render correlation fields contain only backend-accepted static code characters', () => {
  const sample = diagnoseBuklodRenderError({
    name:'TypeError',
    message:"Cannot read properties of null (reading 'session_token')",
    stack:'at render (/src/providers/AuthProvider.tsx:33:6)',
  });
  assert.equal(sample.originArea,'PROVIDER');
  assert.match(sample.correlationKey,/^[A-Z0-9_.:-]{2,160}$/);
  assert.doesNotMatch(JSON.stringify(sample),/session_token|AuthProvider/);
});


test('captures numeric production Hermes bundle frame without storing the stack',()=>{
  const evidence=diagnoseBuklodRenderError({
    name:'TypeError',
    message:"Cannot read properties of undefined (reading 'secretPassword_123')",
    stack:'TypeError: could not render at address at index.android.bundle:1:492305\n at secretTokenUnsafe(https://private.invalid)',
  });
  assert.equal(evidence.causeCode,'NULLISH_ACCESS');
  assert.equal(evidence.originArea,'UNKNOWN');
  assert.equal(evidence.sourcePath,null);
  assert.equal(evidence.bundleLine,1);
  assert.equal(evidence.bundleColumn,492305);
  assert.doesNotMatch(JSON.stringify(evidence),/secretPassword|secretTokenUnsafe|private.invalid/);
});

test('never trusts dynamic or traversal source path as a first-party module',()=>{
  const evidence=diagnoseBuklodRenderError({
    name:'Error',message:'redacted',
    stack:'at render (/app/src/components/../private/secret.tsx:24:16)',
  });
  assert.equal(evidence.sourcePath,null);
  assert.equal(evidence.originArea,'UNKNOWN');
});
