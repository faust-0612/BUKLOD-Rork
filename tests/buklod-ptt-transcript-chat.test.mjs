import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const runtime = read('src/ptt/buklodPttRuntime.ts');
const core = read('src/ptt/buklodPttCore.ts');
const ui = read('src/components/BuklodPttConversation.tsx');
const screen = read('src/app/personal-home/ptt.tsx');
const data = read('src/ptt/buklodPttConversation.ts');
const server = read('supabase/functions/buklod-ptt-captions/index.ts');
const schema = read('supabase/migrations/20261110191500_buklod_ptt_channel_messages.sql');

test('hold/release/floor safety survives the additive caption listener', () => {
  assert.match(runtime, /export async function pttDown/);
  assert.match(runtime, /export async function pttUp/);
  assert.match(runtime, /claimBuklodPttFloor/);
  assert.match(runtime, /dropFloor/);
  assert.match(core, /call\.microphone\.disable\(\)/);
  assert.match(runtime, /call\.on\('call\.closed_caption'/);
  assert.match(runtime, /captionUnsubscribe/);
  assert.match(runtime, /try \{\s+captionUnsubscribe = connection\.call\.on/);
  assert.match(runtime, /catch \{\s+\/\/ Captions are optional/);
  assert.match(runtime, /captionUnsubscribe = null;\s+console\.warn/);
});

test('only own opted-in speech with live transmission identity persists', () => {
  assert.match(runtime, /speakerId !== connection\.userId/);
  assert.match(runtime, /hasBuklodPttCaptionConsent/);
  assert.match(runtime, /state\.transmissionId/);
  assert.match(data, /if \(speaker !== connection\.userId\) return/);
  assert.match(data, /if \(caption\.translated/);
  assert.match(data, /error\.code !== '23505'/);
});

test('PTT chat is channel isolated, realtime and reachable without moving talk button', () => {
  assert.match(screen, /<LiveHoldButton/);
  assert.match(screen, /<BuklodPttConversation/);
  assert.match(screen, /chatScrollRef/);
  assert.match(screen, /scope && chatOpen/);
  assert.match(screen, /setChatOpen\(\(open\) => !open\)/);
  assert.match(ui, /postgres_changes/);
  assert.match(ui, /Number\(item\.channel\) !== channel/);
  assert.match(ui, /setDraft\(''\)/);
  assert.match(data, /\.eq\('channel', channel\)/);
});

test('captions can only be started by authenticated active members on own channel', () => {
  assert.match(server, /authClient\.auth\.getUser\(\)/);
  assert.match(server, /membership_status", "ACTIVE"/);
  assert.match(server, /scope_type", \["ORGANIZATION", "CLUSTER", "LOCAL"\]/);
  assert.match(server, /settings_override/);
  assert.match(server, /call\.startClosedCaptions/);
  assert.doesNotMatch(server, /Deno\.env\.get\(".*"\).*return response\(\{[^}]*streamSecret/);
});

test('SQL requires active membership, PTT floor and stable dedupe for captions', () => {
  assert.match(schema, /enable row level security/);
  assert.match(schema, /grant select, insert/);
  assert.match(schema, /revoke update, delete/);
  assert.match(schema, /membership_status = 'ACTIVE'/);
  assert.match(schema, /tx\.sender_user_id = \(select auth\.uid\(\)\)/);
  assert.match(schema, /buklod_ptt_messages_caption_dedupe_idx/);
  assert.match(schema, /supabase_realtime/);
});
