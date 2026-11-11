import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

const mustExist = (name) => assert.ok(existsSync(name), 'Required consolidated source missing: ' + name);

test('November consolidated source contains the current public experience, media and support workstreams', () => {
  const files = [
    'src/lib/buklodDashboardScroll.ts',
    'src/components/BuklodWallQuickLinks.tsx',
    'src/components/BuklodPublicDailyMessageBar.tsx',
    'src/app/igpat/index.tsx',
    'src/app/igpat/index.web.tsx',
    'src/lib/igpat/signBatch.ts',
    'src/components/BuklodPhotoCommentsSheet.tsx',
    'src/lib/buklodCommentGifShare.ts',
    'src/components/BuklodTodayCard.tsx',
    'src/app/personal-home/ptt.web.tsx',
    'src/ptt/buklodPttCore.web.ts',
    'src/components/BuklodPttEntryButton.web.tsx',
    'src/components/BuklodScopeFundCard.tsx',
    'src/app/profile/buklod-health.tsx',
    'src/features/games/kingdom/BuklodKingdomMapPremium.tsx',
    'src/features/games/kingdom/platform/KingdomOfflineContinuation.tsx',
    'src/components/kabihasnang-ligaw/KlReadingQuiz.tsx',
    'src/components/BuklodReelsInlineAd.tsx',
  ];
  for (const file of files) mustExist(file);
});

test('November backend release dependency files stay present and guarded', () => {
  const files = [
    'supabase/migrations/20261110213500_mentor_report_evidence_review_r4.sql',
    'supabase/migrations/20261111010000_kl_auto_reading_quiz_v1.sql',
    'supabase/migrations/20261111014500_buklod_kingdom_shards_game_only_v1.sql',
    'supabase/migrations/20261111015000_buklod_monthly_earnings_carryforward_readonly_v1.sql',
    'supabase/migrations/20261111023000_buklod_qmp_canonical_finance_identity_v1.sql',
    'supabase/migrations/20261111024500_buklod_pf_v3_qmp_single_settlement_v1.sql',
    'supabase/migrations/20261111025000_buklod_pf_v3_monthly_summary_qmp_v1.sql',
    'supabase/migrations/20261111031000_buklod_finance_qmp_readiness_audit_v1.sql',
    'supabase/migrations/20261111032000_buklod_qmp_finance_review_queue_v1.sql',
    'supabase/migrations/20261111043000_buklod_photo_comments_by_media_v1.sql',
    'supabase/migrations/20261111053000_kl_trigger_rpc_privilege_lock_v1.sql',
    'supabase/migrations/20261111102700_buklod_today_public_dugtong_idle_rotation_v2.sql',
    'supabase/migrations/20261111113000_buklod_today_cycles_fk_index_v2.sql',
    'supabase/migrations/20261111115500_buklod_today_public_dugtong_paging_v2.sql',
  ];
  for (const file of files) mustExist(file);
  assert.match(readFileSync('src/lib/buklodGlobalAdController.ts', 'utf8'), /safePersonalMediaBanner/);
  assert.match(readFileSync('src/lib/buklodGlobalAdController.ts', 'utf8'), /safeKingdomPassive/);
  assert.match(readFileSync('.github/workflows/production_android_ota.yml','utf8'), /BUKLOD_CONSOLIDATED/);
});

test('Protected native-only Smart Drawer Google Drive changes are not part of source intake', () => {
  const manifest = JSON.parse(readFileSync('.buklod/scopes/nov11-current-main-complete-hold.json', 'utf8'));
  assert.equal(manifest.releaseState.startsWith('HOLD'), true);
  assert.match(manifest.excludedWorkstreams.join(' '), /Smart Drawer Google Drive/);
  assert.ok(manifest.componentScopePaths.includes('.buklod/scopes/shared-dashboard-header-scroll-20261111.json'));
  assert.ok(manifest.componentScopePaths.includes('.buklod/scopes/igpat-real-first-frame-20261111.json'));
});
