import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const ring = read('src/components/RingingCalls.tsx');
const provider = read('src/providers/StreamVideoProvider.tsx');

test('call UI does not obscure app or ads while no call is active', () => {
  assert.match(ring, /if \(!activeCall\) \{\s*return null;/);
  assert.match(ring, /if \(!activeCall\) \{\s*previousCallKey\.current/);
  assert.match(provider, /\{children\}[\s\S]*?<RingingCalls \/>/);
});

test('only genuine live non-PTT calls suppress other sounds and show call overlay', () => {
  assert.match(ring, /findActiveNonPttCall\(/);
  assert.match(ring, /setBuklodCallSoundSuppressed\(Boolean\(activeCall\)\)/);
  assert.match(ring, /return \(\) => setBuklodCallSoundSuppressed\(false\)/);
  assert.match(ring, /if \(!outgoing \|\| !ringing\) return null/);
  assert.match(ring, /<BuklodCallRenderBoundary/);
});
