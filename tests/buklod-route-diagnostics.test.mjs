import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  safeBuklodRoute,
  rememberBuklodRoute,
  resolveBuklodCrashRoute,
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
