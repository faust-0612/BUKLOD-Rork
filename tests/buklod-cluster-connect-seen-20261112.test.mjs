import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const thread = readFileSync('src/components/BuklodConnectThread.tsx', 'utf8');
const bubble = readFileSync('src/components/connect/ConnectMessageBubble.tsx', 'utf8');
const readers = readFileSync('src/lib/connectScopeReaders.ts', 'utf8');
const sql = readFileSync('supabase/migrations/20261027130045_connect_scope_readers_member_gated_v1.sql', 'utf8');

test('Cluster exposes accurate, clickable room-cursor report on own messages', () => {
  assert.match(thread, /setIsClusterConnect\(scopeType === 'CLUSTER'\)/);
  assert.match(thread, /isClusterConnect\s*\? scopeReaders\.filter\(reader =>/);
  assert.match(thread, /roomCursorCoversMessage\(item\.created_at, reader\.lastReadAt\)/);
  assert.match(thread, /showSeenReport=\{mode === 'scope' && isClusterConnect && own && !messageDeleted\}/);
  assert.match(bubble, /Seen by 0 · Details/);
  assert.match(bubble, /seenReportAvailable \? 'Seen by 0/);
});

test('Organization retains original reader-window grouping, explicit refresh never forges seen', () => {
  assert.match(thread, /: readersForMessageWindow\(\{/);
  assert.match(thread, /fetchScopeConnectReaders\(effectiveContainerId\)/);
  assert.match(thread, /currentLoadSessionRef\.current !== session/);
  assert.doesNotMatch(readers, /\.insert\(|\.update\(|\.upsert\(/);
});

test('Reader report respects authenticated active room members, no admin bypass', () => {
  assert.match(sql, /buklod_connect_can_use_scope_room\(_scope_id\)/);
  assert.match(sql, /sm\.membership_status = 'ACTIVE'/);
  assert.match(sql, /r\.user_id <> auth\.uid\(\)/);
  assert.match(sql, /revoke all on function public\.buklod_connect_scope_readers_v1\(uuid\) from public, anon/i);
});
