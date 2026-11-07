import test from 'node:test';
import assert from 'node:assert/strict';
import { esc, safeLink, formatDate, clampText } from '../src/utils.js';
test('HTML content is escaped', () => {
  assert.equal(esc('<img src=x onerror="x">&'), '&lt;img src=x onerror=&quot;x&quot;&gt;&amp;');
  assert.equal(esc(null), '');
});
test('outgoing links require HTTPS', () => {
  assert.equal(safeLink('javascript:alert(1)'), null);
  assert.equal(safeLink('http://example.com'), null);
  assert.equal(safeLink('data:text/html,<img>'), null);
  assert.equal(safeLink('https://example.com/path'), 'https://example.com/path');
});
test('invalid dates are safe', () => {
  assert.equal(formatDate('xxx'), 'Date unavailable');
  assert.equal(formatDate(null), 'No date set');
});
test('content is bounded', () => { assert.equal(clampText('  abcdef  ',3), 'abc'); });
