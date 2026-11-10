const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const ui = fs.readFileSync('src/components/home/BuklodBahayHome.tsx', 'utf8');
const client = fs.readFileSync('src/lib/buklodBahay.ts', 'utf8');
const sql = fs.readFileSync('supabase/migrations/20261110113000_buklod_bahay_invite_suggestions.sql', 'utf8');

test('Bahay invitation UI provides searchable suggestions and selection', () => {
  for (const token of [
    "searchBahayInvitees(activeHomeId,query)",
    "setSelectedInvitee(candidate)",
    "inviteKasambahayById(activeHomeId,selectedInvitee.user_id,inviteRole,expires)",
    "loadBahayPendingInvites(activeHomeId)",
    "subscribeBahayInvitations(userId",
    "useFocusEffect(useCallback(",
    "Waiting for acceptance.",
    "await refreshHomes(homeId)",
    "await switchHome(homeId)",
    "setSnapshot(null)",
  ]) assert.ok(ui.includes(token), `missing invite UI flow: ${token}`);
  assert.match(ui, /const timer=setTimeout\(/);
  assert.match(ui, /if \(!cancelled\)/);
  assert.match(ui, /disabled=\{busy\|\|\(!selectedInvitee/);
});

test('Bahay client RPCs remain typed and invite by server-side user ID', () => {
  assert.match(client, /export type BahayInviteCandidate/);
  assert.match(client, /export async function searchBahayInvitees/);
  assert.match(client, /'buklod_home_search_invitees_v1'/);
  assert.match(client, /'buklod_home_invite_user_v2'/);
  assert.match(client, /'buklod_home_pending_invites_v1'/);
  assert.match(client, /m.status === 'PENDING' && \(!m.expires_at/);
  assert.match(client, /m.status === 'ACTIVE' && \(!m.expires_at/);
  assert.match(client, /'buklod_home_invite_v1'/);
});

test('Backend safeguards existing membership, expiry and owner/admin scope', () => {
  const required = [
    'public.buklod_home_is_admin(p_home_id)',
    'p_user_id = (select auth.uid())',
    "raise exception 'Invalid Kasambahay role'",
    'on conflict on constraint buklod_home_members_pkey do update',
    "public.buklod_home_members.status in ('DECLINED', 'REMOVED')",
    "raise exception 'This user is already a Kasambahay'",
    "raise exception 'Invitation is already pending'",
    "raise exception 'Invitation expired or no longer pending'",
    "m.status not in ('ACTIVE','PENDING')",
    'public.buklod_connect_suggested_contacts_v1(80)',
    'public.buklod_user_follows',
    'limit v_limit',
    'grant execute on function public.buklod_home_invite_user_v2',
  ];
  for (const token of required) assert.ok(sql.includes(token), `missing backend guard: ${token}`);
  assert.equal((sql.match(/create or replace function public\.buklod_home_/g) || []).length,5);
  assert.ok(!sql.includes('au.email'), 'invite search must not expose private email');
});

test('Authorization and notification happen only on controlled invite paths', () => {
  const start = sql.indexOf('create or replace function public.buklod_home_invite_user_v2');
  const end = sql.indexOf('-- Retain legacy clients');
  const invite = sql.slice(start,end);
  assert.ok(invite.indexOf('buklod_home_is_admin') < invite.indexOf('insert into public.buklod_home_members'));
  assert.ok(invite.indexOf('returning public.buklod_home_members.user_id into v_saved') <
    invite.indexOf('insert into public.notifications'));
  assert.match(invite, /on conflict on constraint buklod_home_members_pkey do update[\s\S]+where public\.buklod_home_members\.status/);
  assert.match(sql, /revoke all on function public\.buklod_home_search_invitees_v1\(uuid,text,integer\) from public, anon;/);
});
