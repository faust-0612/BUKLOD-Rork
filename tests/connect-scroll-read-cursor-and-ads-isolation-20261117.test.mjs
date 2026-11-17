import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const windowSource = read('src/lib/connectChatWindow.ts');
const thread = read('src/components/BuklodConnectThread.tsx');

const start = windowSource.indexOf('export function shouldAdvanceConnectReadCursor(');
const end = windowSource.indexOf('\nexport function roomCursorCoversMessage(', start);
assert.ok(start >= 0 && end > start, 'actual shared read cursor helper exists');
const js = ts.transpileModule(
  windowSource.slice(start, end).replace(/^export /, ''),
  { compilerOptions: { module: ts.ModuleKind.None, target: ts.ScriptTarget.ES2022 } }
).outputText;
const shouldAdvance = runInNewContext(js + '\nshouldAdvanceConnectReadCursor;');

test('manual history viewing does not mark an unread room as read', () => {
  assert.equal(shouldAdvance({ listAnchored: false, nearLatest: true, reason: 'open' }), false);
  assert.equal(shouldAdvance({ listAnchored: true, nearLatest: false, reason: 'returned-to-latest' }), false);
  assert.equal(shouldAdvance({ listAnchored: true, nearLatest: true, reason: 'history-reload' }), false);
});

test('arriving at latest and own-send advance read only when visible', () => {
  assert.equal(shouldAdvance({ listAnchored: true, nearLatest: true, reason: 'returned-to-latest' }), true);
  assert.equal(shouldAdvance({ listAnchored: true, nearLatest: true, reason: 'own-send' }), true);
  assert.match(thread, /markVisibleRoomRead\('returned-to-latest'\)/);
  assert.match(thread, /markVisibleRoomRead\('own-send'\)/);
  assert.match(thread, /notifyConnectRead\(profileId\)/);
});

test('scroll stabilization remains isolated from ad and earnings integrations', () => {
  assert.match(thread, /const action = connectScrollAction\(\{/);
  assert.doesNotMatch(thread, /import [^;]*(?:admob|AdsProvider|Qmp|FinanceAllocation)/i);
  assert.match(thread, /const next = mergeConnectServerMessages\(/);
});
