const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/lib/connectChatWindow.ts'), 'utf8');
const start = source.indexOf('export function connectComposerDockBottom');
const end = source.indexOf('const HISTORY_PAGE_PROBE', start);
assert.ok(start >= 0 && end > start, 'must find production helper implementations');
const code = stripTypeScriptTypes(source.slice(start, end).replaceAll('export function', 'function'));
const { connectComposerDockBottom, connectMediaOnlyMessage } = vm.runInNewContext(
  `${code}\n({ connectComposerDockBottom, connectMediaOnlyMessage })`
);
assert.equal(connectComposerDockBottom(true, 0, 36), 0);
assert.equal(connectComposerDockBottom(true, 65, 36), 65);
assert.equal(connectComposerDockBottom(false, 65, 36), 36);
const media = { deleted: false, bodyText: '', hasReply: false, hasSharedPost: false, hasReaction: false, hasMedia: true };
assert.equal(connectMediaOnlyMessage(media), true);
for (const change of [{ bodyText: 'caption' }, { hasReply: true }, { hasSharedPost: true }, { deleted: true }, { hasMedia: false }]) {
  assert.equal(connectMediaOnlyMessage({ ...media, ...change }), false);
}

const native = fs.readFileSync(path.join(root, 'src/components/BuklodScopeCallLauncher.tsx'), 'utf8');
const web = fs.readFileSync(path.join(root, 'src/components/BuklodScopeCallLauncher.web.tsx'), 'utf8');
const chat = fs.readFileSync(path.join(root, 'src/components/BuklodConnectThread.tsx'), 'utf8');
const actions = fs.readFileSync(path.join(root, 'src/components/connect/ConnectMessageActionSheet.tsx'), 'utf8');
const nativeCompact = native.slice(native.indexOf('if (compact)'), native.indexOf('if (compact)') + 2600);
const webCompact = web.slice(web.indexOf('if (compact)'), web.indexOf('if (compact)') + 2500);
assert.match(nativeCompact, /Choose group voice or video call/);
assert.match(nativeCompact, /Video call/);
assert.doesNotMatch(nativeCompact, /name="video-outline"/);
assert.match(webCompact, /Start group video call/);
assert.doesNotMatch(webCompact, /icon="video-outline"/);
assert.match(native, /safeCallId\(scopeId\)/);
assert.match(web, /buildBuklodScopeCallId\(scopeId\)/);
assert.match(chat, /roomCursorCoversMessage\(selected\.created_at, reader\.lastReadAt\)/);
assert.match(chat, /onSeenBy=/);
assert.match(actions, /label: 'Seen by'/);

const sql = fs.readFileSync(path.join(root, 'supabase/review-only/20261027_connect_fast_history_seen.sql'), 'utf8');
assert.match(sql, /buklod_connect_can_use_scope_room\(_scope_id\)/);
assert.match(sql, /r\.scope_id = _scope_id/);
assert.match(sql, /auth\.uid\(\) is null/);
assert.match(sql, /revoke all on function public\.buklod_connect_scope_readers_v1/);
assert.doesNotMatch(sql, /drop\s+(?:table|function|policy)/i);
console.log('CONNECT CLUSTER POLISH: 14 focused source/behavior assertions passed');
