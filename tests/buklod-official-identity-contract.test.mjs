import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20261112093000_buklod_official_identity_economy_isolation_v1.sql', 'utf8');
const consoleScreen = readFileSync('src/app/admin/buklod-official.tsx', 'utf8');
const profileScreen = readFileSync('src/app/(tabs)/me.tsx', 'utf8');
const memberScreen = readFileSync('src/app/member/[id].tsx', 'utf8');

test('BUKLOD official is resolved by protected principal rather than generic admin role', () => {
  assert.match(migration, /principal_key\s*=\s*'OFFICIAL_SYSTEM_ADMIN'/);
  assert.match(migration, /private\.buklod_is_platform_official_v1\(p_user_id uuid\)/);
  assert.match(migration, /alter table private\.buklod_official_identity_snapshot_v1 enable row level security/i);
  assert.match(migration, /revoke all on private\.buklod_official_identity_snapshot_v1 from public, anon, authenticated/i);
});
test('official earning paths are guarded without deleting historical ledgers', () => {
  for (const table of [
    'buklod_points_ledger', 'buklod_community_qmp_events',
    'buklod_community_qmp_accounts', 'buklod_points_redemptions',
    'buklod_pf_user_settlements'
  ]) assert.ok(migration.includes('on ' + (table.includes('qmp_') || table.includes('pf_') ? 'private.' : 'public.') + table), 'missing ' + table);
  assert.doesNotMatch(migration, /delete\s+from\s+(?:public|private)\.(?:buklod_points_ledger|buklod_community_qmp_events|buklod_pf_cash_ledger)/i);
  assert.match(migration, /private\.buklod_pf_total_monthly_qmp_v1/);
  assert.match(migration, /private\.buklod_pf_monthly_points_v3/);
  for (const table of ['buklod_r36_bcu_ledger','buklod_r38_rcu_ledger','buklod_kingdom_shards_ledger_v1']) assert.ok(migration.includes('on private.' + table), 'missing guard for ' + table);
});
test('canonical leaderboards filter protected account before ranking', () => {
  for (const fn of ['get_buklod_points_leaderboard', 'get_member_weekly_leaderboard','get_mentor_weekly_leaderboard','admin_bayanihan_leaderboard_v2','admin_bayanihan_leaderboard_v3','get_member_circle_ranks_v1']) {
    const start = migration.indexOf('CREATE OR REPLACE FUNCTION public.' + fn + '(');
    assert.ok(start >= 0, 'missing ' + fn);
    const end = migration.indexOf('$function$;', start);
    assert.ok(end > start, 'unterminated ' + fn);
    assert.match(migration.slice(start,end), /not private\.buklod_is_platform_official_v1\(p\.id\)/i);
  }
});
test('official console is server-verified and existing community services are reused', () => {
  assert.match(consoleScreen, /get_my_buklod_official_dashboard_v1/);
  assert.match(consoleScreen, /<AdminGate>/);
  for (const destination of ['/admin/system-announcement-boards','/admin/mission-bulletins','/admin/bsoc-support']) assert.ok(consoleScreen.includes(destination));
  assert.match(profileScreen, /isBuklodOfficial/);
  assert.match(memberScreen, /get_buklod_official_identity_v1/);
});
