import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261108025000_buklod_living_greetings_v1.sql');
const banner=read('src/components/BuklodLivingGreetingsBanner.tsx');
const settings=read('src/app/settings/buklod-greetings.tsx');
const wall=read('src/app/(tabs)/buklod.tsx');

test('Living community uses canonical BUKLOD followers and Organization/Cluster membership, not legacy church ID',()=>{
  assert.match(migration,/public\.buklod_user_follows/);
  assert.match(migration,/public\.buklod_scope_memberships/);
  assert.match(migration,/in \('CLUSTER','ORGANIZATION'\)/);
  // A comment documenting retirement may name church_id; query logic must not use it.
  const sqlWithoutComments=migration.replace(/^\s*--.*$/gm,'');
  assert.doesNotMatch(sqlWithoutComments,/\bchurch_id\b/i);
  assert.match(migration,/new\.membership_status <> 'ACTIVE'/);
});

test('Birthdays are private by default, community sharing requires per-user consent',()=>{
  assert.match(migration,/share_birthday boolean not null default false/);
  assert.match(migration,/user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration,/gp\.share_birthday/);
  assert.match(migration,/v_recipient<>v_event\.actor_id/);
  assert.match(migration,/p_allow is null then raise exception/);
  assert.match(settings,/Community members are not notified|followers and Cluster members/i);
  assert.match(settings,/buklod_set_my_birthday_sharing_v1/);
  assert.doesNotMatch(banner,/birth_date/);
});

test('Event queue delivers at most 100 per minute, respects notifications preferences, and deduplicates',()=>{
  assert.match(migration,/primary key\(event_id,recipient_id\)/);
  assert.match(migration,/on conflict\(event_key\) do nothing/);
  assert.match(migration,/pg_try_advisory_xact_lock/);
  assert.match(migration,/least\(coalesce\(p_limit,100\),100\)/);
  assert.match(migration,/public\.queue_notification\(/);
  assert.match(migration,/buklod-living-greetings-dispatch-v1/);
  assert.match(migration,/buklod-living-greetings-daily-v1/);
  assert.match(migration,/revoke all on function private\.buklod_living_dispatch_greetings_v1/);
});

test('Notifications use explicit safe routes, real approved KL releases and no event retroactive spam',()=>{
  assert.match(migration,/new\.status<>'approved'/);
  assert.match(migration,/k\.release_at <= now\(\)/);
  assert.match(migration,/k\.release_at >= now\(\)-interval '48 hours'/);
  assert.match(migration,/event_key.*unique/);
  assert.match(migration,/\/kabihasnang-ligaw/);
  assert.match(migration,/\/member\//);
  assert.match(migration,/created_at < now\(\)-interval '120 days'/);
});

test('Prominent Wall banner is compact/expandable, preserves first-view ads and provides privacy controls',()=>{
  assert.match(banner,/setExpanded\(value=>!value\)/);
  assert.match(banner,/numberOfLines=\{expanded\?3:1\}/);
  assert.match(banner,/new_member_count/);
  assert.match(banner,/router\.push\('\/notifications'/);
  assert.doesNotMatch(banner,/router\.push\('\/settings\/buklod-greetings'/);
  assert.match(wall,/BuklodLivingGreetingsBanner/);
  assert.ok(wall.indexOf('<BuklodFirstViewAd')<wall.indexOf('<BuklodLivingGreetingsBanner />'));
  assert.match(banner,/Legacy\/offline clients keep Wall usable|Legacy\/offline clients/);
});

test('Only verified rank and discovered character rewards create personal interaction events',()=>{
  assert.match(migration,/buklod_living_rank_milestone_v1/);
  assert.match(migration,/on public\.buklod_rank_history/);
  assert.match(migration,/trigger_ledger_id is null/);
  assert.match(migration,/buklod_living_character_reward_v1/);
  assert.match(migration,/on public\.buklod_character_collectible_state/);
  assert.match(migration,/new\.discovered_at is null/);
  assert.match(migration,/s\.scope_type in \('CLUSTER','ORGANIZATION'\)/);
  assert.match(banner,/my_recent_rank/);
  assert.match(banner,/my_recent_reward/);
});
test('Exactly numbered KL release is announced only after publish time, including scheduled releases',()=>{
  assert.match(migration,/Series %s: Kabanata %s available na!/);
  assert.match(migration,/k\.season_number,k\.episode_number/);
  assert.match(migration,/status='approved' and k\.release_at<=now\(\)/);
  assert.match(migration,/buklod-living-greetings-kl-releases-v1/);
  assert.match(migration,/\*\/5 \* \* \* \*/);
});
test('The interaction strip is automatic, rotates verified events and never asks for birthday approval',()=>{
  assert.match(migration,/birthday:'\|\|v_user\.id|birthday:'\|\|v_user\.id/);
  assert.match(banner,/useFocusEffect/);
  assert.match(banner,/Next community update/);
  assert.doesNotMatch(banner,/admin approval|Approve Birthday|Birthday approval/i);
  assert.match(banner,/share_birthday/);
});
