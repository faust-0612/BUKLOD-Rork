import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(file,'utf8');
const own = read('src/app/(tabs)/me.tsx');
const member = read('src/app/member/[id].tsx');
const hero = read('src/components/points/BuklodLifetimePointsHero.tsx');
const api = read('src/lib/buklodMemberProfile.ts');
const sql = read('supabase/migrations/20261122104500_buklod_profile_lifetime_points_v1.sql');

test('own Profile uses canonical earned lifetime BP with large golden card', () => {
  assert.match(own, /loadBuklodPointsDashboard\(\)/);
  assert.match(own, /dashboard\?\.lifetime_points/);
  assert.match(own, /<BuklodLifetimePointsHero points=\{lifetimePoints\} \/>/);
  assert.match(own, /!isBuklodOfficial && !!profile\?\.id/);
  assert.match(own, /useProfileFocusEffect\(useProfileFocusCallback\(\(\) => \{/);
  assert.match(hero, /testID="profile-lifetime-gold-card"/);
  assert.match(hero, /fontSize: 42/);
  assert.match(hero, /color: '#986100'/);
  assert.match(hero, /colors=\{\['#FFF8DB', '#F9DF96', '#F1CA68'\]\}/);
  assert.match(hero, /Number\.isSafeInteger\(points\)/);
  assert.match(hero, /const formatted = verified \? numberFormat\.format\(points\) : '—'/);
});

test('View Profile uses a server-authorized exact number, never local balance guesses', () => {
  assert.match(member, /loadMemberPublicLifetimePoints\(next\.user_id\)/);
  assert.match(member, /<BuklodLifetimePointsHero points=\{publicLifetimePoints\} \/>/);
  assert.match(member, /profile\?\.is_locked \|\| !profile\?\.can_view_details/);
  assert.match(member, /\{publicIdentity\}/);
  assert.match(member, /member-public-profile-background/);
  assert.match(member, /member-public-rank/);
  assert.match(member, /member-public-cluster-memberships/);
  assert.match(member, /member-public-profile-note/);
  assert.match(member, /ProfileAvatar/);
  assert.match(api, /return authData\.user\?\.id === id \? loadMemberPublicProfileDirect\(id\) : null/);
  assert.match(member, /!isOfficialProfile/);
  assert.match(api, /get_buklod_member_lifetime_points_v1/);
  assert.doesNotMatch(api, /\.from\('buklod_user_points_balances'\)/);
  assert.match(api, /Number\.isSafeInteger\(points\)/);
  assert.match(member, /Contact details, address, and earnings stay private/);
});

test('server guards profile lock, authentication, Official account and exposes only lifetime', () => {
  assert.match(sql, /STABLE SECURITY DEFINER/);
  assert.match(sql, /SET search_path TO ''/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /p\.is_active = true/);
  assert.match(sql, /private\.buklod_is_platform_official_v1\(p_user_id\)/);
  assert.match(sql, /profile_row\.profile_background_url/);
  assert.match(sql, /get_member_circle_ranks_v1/);
  assert.match(sql, /s\.scope_type = 'CLUSTER'/);
  assert.match(sql, /IF viewer <> target AND locked THEN/);
  assert.match(sql, /'can_view_details', false/);
  assert.match(sql, /'username', null, 'member_since', null/);
  assert.match(sql, /'avatar_url', NULLIF\(btrim\(profile_row\.avatar_url\)/);
  assert.match(sql, /'cluster_labels', clusters/);
  assert.match(sql, /st\.quick_note_expires_at IS NULL OR st\.quick_note_expires_at > now\(\)/);
  assert.match(sql, /b\.lifetime_points/);
  assert.doesNotMatch(sql, /b\.available_points|buklod_points_ledger|earnings_ledger/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_buklod_member_lifetime_points_v1\(uuid\)\s+TO authenticated, service_role/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.buklod_lifetime_points_for\(uuid\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.buklod_points_for\(uuid\) FROM PUBLIC, anon, authenticated/);
});
