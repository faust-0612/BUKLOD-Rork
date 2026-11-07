import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Living Community appears in canonical Wall and Home without touching legacy feeds', () => {
  const wall = read('src/app/(tabs)/buklod.tsx');
  const home = read('src/app/(tabs)/hub.tsx');
  assert.match(wall, /<BuklodLivingWallMoments \/>/);
  assert.match(wall, /<BuklodLivingNetworkMoments \/>/);
  assert.match(home, /<BuklodLivingWallMoments \/>/);
  assert.match(wall, /BuklodCommunitySponsoredAd/);
  assert.match(home, /BuklodCommunitySponsoredAd/);
  assert.match(wall, /<KabihasnangLigawWallCard \/>/);
});

test('network audience is Organization, Cluster and followers, not retired churches', () => {
  const source = read('supabase/migrations/20261107225000_buklod_living_network_cluster_followers_r1.sql');
  assert.match(source, /'CLUSTER','ORGANIZATION'/);
  assert.match(source, /buklod_user_follows/);
  assert.doesNotMatch(source, /\bchurch_id\b|\bdirectory_preferences\b/i);
  assert.match(source, /buklod_scope_memberships/);
  assert.match(source, /profile_locked/);
  assert.match(source, /coalesce\(cp\.birthday_to_network,false\)/);
  assert.match(source, /on conflict do nothing/);
});

test('birthday and public KL push are opt-out aware and activation is manual', () => {
  const network = read('supabase/migrations/20261107225000_buklod_living_network_cluster_followers_r1.sql');
  const global = read('supabase/migrations/20261107225500_buklod_living_global_events_r1.sql');
  const activation = read('scripts/release/activate-buklod-living-community-r1.sql');
  assert.doesNotMatch(network, /perform cron\.schedule/);
  assert.doesNotMatch(global, /perform cron\.schedule/);
  assert.match(network, /buklod_living_dispatch_notifications/);
  assert.match(global, /coalesce\(np\.announcements,true\)/);
  assert.match(global, /coalesce\(up\.show_faith_content,false\)/);
  assert.match(activation, /buklod-living-global-generator-r1/);
  assert.match(activation, /buklod-living-birthdays-r1/);
  assert.match(activation, /MANUAL RELEASE ACTIVATION ONLY/);
});

test('birthday broadcasts are off by default and opt-in remains member-owned', () => {
  const prefs = read('src/app/notifications/celebrations.tsx');
  const network = read('supabase/migrations/20261107225000_buklod_living_network_cluster_followers_r1.sql');
  assert.match(prefs, /birthday_to_network:\s*false/);
  assert.match(network, /birthday_to_network boolean not null default false/);
  assert.match(network, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(prefs, /Nai-save ang iyong celebration preferences/);
});

test('release script cannot mislabel the V28 APK runtime', () => {
  const runtime = read('app.config.js');
  const script = read('scripts/PUSH_MAIN_OTA.ps1');
  assert.match(runtime, /runtimeVersion:\s*isClassroom\s*\?\s*'1\.3\.0'\s*:\s*'1\.3\.2'/);
  assert.match(script, /runtime=1\.3\.2/);
  assert.doesNotMatch(script, /runtime=1\.3\.3/);
  assert.match(script, /production runtime guard failed/);
});
