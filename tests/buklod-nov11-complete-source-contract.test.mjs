import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';

const has = path => assert.ok(existsSync(path), 'missing required consolidated source: '+path);
const read = path => readFileSync(path, 'utf8');
const includes = (path, text) => { has(path); assert.ok(read(path).includes(text), path+' missing '+text); };

test('BUKLOD canonical Green B header and scroll treatment cover all public and scoped dashboards', () => {
  includes('src/app/(tabs)/_layout.tsx','buklod-main-canonical.png');
  includes('src/components/BuklodDashboardContextBar.tsx','compact={scrollCompact}');
  includes('src/components/BuklodScopedDashboardHeader.tsx','subscribeBuklodDashboardScroll');
  includes('src/app/(tabs)/buklod.tsx','reportBuklodDashboardScroll');
  for(const path of ['src/app/(tabs)/hub.tsx','src/app/(tabs)/messages.tsx','src/app/(tabs)/me.tsx','src/app/scope/index.tsx'])
    includes(path,'reportBuklodDashboardScroll');
  for(const route of ['/igpat','/personal-home/radio','/bible/read?source=my_bible'])
    includes('src/components/BuklodWallQuickLinks.tsx',route);
});

test('current Web PTT, privacy/ads and protected release control source are included', () => {
  for(const path of [
    'src/ptt/buklodPttCore.web.ts','src/app/personal-home/ptt.web.tsx',
    'src/components/BuklodPttEntryButton.web.tsx','src/components/BuklodPttConversation.tsx',
    'tests/buklod-ptt-web-contract.test.mjs',
    '.buklod/scopes/ptt-web-expo-release-20261111.json',
    'tests/buklod-ads-appwide-permanent-lock-20261111.test.mjs',
    '.github/workflows/production_android_ota.yml',
    '.github/workflows/production_web_deploy.yml',
  ]) has(path);
  includes('src/lib/buklodGlobalAdController.ts','safeKingdomOptIn');
  includes('.github/workflows/unified_rc_compiled_qa_20261108.yml','RC identity SHA mismatch');
});

test('IGPAT video, GIF comments, Today, Kingdom and approved monetization candidates survive consolidation', () => {
  for(const path of [
    'src/lib/igpat/signBatch.ts','src/lib/igpat/quickEdit.ts',
    'tests/igpat-full-frame-no-zoom-20261111.test.mjs',
    'src/lib/buklodCommentGifShare.ts',
    'src/components/BuklodTodayCard.tsx',
    'src/features/games/kingdom/BuklodKingdomMapPremium.tsx',
    'assets/sounds/buklod-kingdom-cinematic-ambient.wav',
    'src/lib/buklodKingdomShards.ts',
    'src/lib/buklodMonthlyEarnings.ts',
    'src/components/BuklodPhotoCommentsSheet.tsx',
    'src/components/BuklodScopeFundCard.tsx',
    'src/components/home/BuklodHomeUtilityCards.tsx',
    'src/app/profile/buklod-health.tsx',
    'src/components/BuklodHomeCheckinToday.tsx',
    'src/components/BuklodPersistentBottomNav.tsx',
  ]) has(path);
  includes('src/app/(tabs)/buklod.tsx','drawDistance={Platform.OS===\'web\' ? 2400 : 2000}');
});

test('canonical Supabase migrations exactly match previously applied live versions, never aliased duplicates', () => {
  for (const name of [
    '20261110103333_buklod_scope_gcash_contributions_v1.sql',
    '20261111024318_buklod_today_public_dugtong_idle_rotation_v2_20261111.sql',
    '20261111024610_buklod_today_cycles_fk_index_v2_20261111.sql',
    '20261111025018_buklod_today_public_dugtong_paging_v2_20261111.sql',
    '20261111043000_buklod_photo_comments_by_media_v1.sql',
    '20261111053000_kl_trigger_rpc_privilege_lock_v1.sql',
  ]) has('supabase/migrations/'+name);
  for (const stale of [
    '20261111102700_buklod_today_public_dugtong_idle_rotation_v2.sql',
    '20261111113000_buklod_today_cycles_fk_index_v2.sql',
    '20261111115500_buklod_today_public_dugtong_paging_v2.sql',
  ]) assert.equal(existsSync('supabase/migrations/'+stale),false,'dangerous duplicate migration '+stale);
});

test('byte-verified KL and automatic QMP migration filenames match live applied history, never a duplicate alias', () => {
  const installed = [
    '20261111082405_buklod_qmp_automatic_qualification_v2.sql',
    '20261111082459_buklod_qmp_close_legacy_review_requests_v3.sql',
    '20261111082707_buklod_qmp_indirect_reward_guard_v4.sql',
    '20261111085702_kl_verified_reading_10_series_50.sql',
    '20261111085727_buklod_mutual_engagement_r4.sql',
    '20261111090714_buklod_canonical_admin_economy_snapshot_v1.sql',
  ];
  const retired = [
    '20261111093000_buklod_qmp_automatic_qualification_v2.sql',
    '20261111093500_buklod_qmp_close_legacy_review_requests_v3.sql',
    '20261111094000_buklod_qmp_indirect_reward_guard_v4.sql',
    '20261111100000_buklod_canonical_admin_economy_snapshot_v1.sql',
    '20261111152000_kl_verified_reading_10_series_50.sql',
    '20261111152500_buklod_mutual_engagement_r4.sql',
  ];
  for (const file of installed) has('supabase/migrations/' + file);
  for (const file of retired) assert.equal(existsSync('supabase/migrations/' + file), false, file + ' must not reapply');
  includes('src/lib/buklodCanonicalAdminEconomy.ts','admin_get_buklod_canonical_economy_snapshot_v1');
  includes('src/app/admin/economy-operations.tsx','loadCanonicalAdminEconomy');
  includes('src/components/kabihasnang-ligaw/KlReadingQuiz.tsx','10');
});
