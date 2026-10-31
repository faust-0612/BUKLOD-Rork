import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitConnectMessageLinks } from '../src/lib/connectMessageLinks.ts';

const id = '556fb895-0324-431e-853e-bc2810b07bb8';

function links(message) {
  return splitConnectMessageLinks(message).filter(part => part.href).map(part => part.href);
}

test('already-sent custom-scheme Cluster invite becomes tappable inside Connect', () => {
  const message = `Join Burol on BUKLOD.\nbuklod://clusters/${id}\nOpen the link to request membership`;
  const parts = splitConnectMessageLinks(message);
  assert.deepEqual(links(message), [`buklod://clusters/${id}`]);
  assert.equal(parts.map(part => part.text).join(''), message, 'body text must not be rewritten');
});

test('new HTTPS invites and ordinary HTTPS URLs become independent tap targets', () => {
  const a = `https://buklod.expo.app/clusters/${id}?fromInvite=1`;
  const b = 'https://example.com/test';
  const message = `Visit ${a}, then ${b}. Salamat!`;
  assert.deepEqual(links(message), [a, b]);
  assert.equal(splitConnectMessageLinks(message).map(p => p.text).join(''), message);
});

test('punctuation, emojis and multiline chat bodies remain unchanged', () => {
  const message = `Hello! 🌱\n${'buklod-staging://clusters/' + id}.)\nDone 🌟`;
  assert.deepEqual(links(message), [`buklod-staging://clusters/${id}`]);
  assert.equal(splitConnectMessageLinks(message).map(p => p.text).join(''), message);
});

test('unknown schemes, script URLs, malformed Cluster IDs stay inert', () => {
  for (const message of [
    'javascript:alert(1)',
    'file:///etc/passwd',
    'buklod://unknown/thing',
    'buklod://clusters/not-a-uuid',
    'buklod-staging://clusters/not-a-uuid',
    'plain message without a link',
  ]) {
    assert.deepEqual(links(message), [], message);
    assert.equal(splitConnectMessageLinks(message).map(p => p.text).join(''), message);
  }
});

test('empty body remains a valid non-clickable text segment', () => {
  assert.deepEqual(splitConnectMessageLinks(''), [{ text: '', href: null }]);
});
