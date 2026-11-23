# Genesis Season 2 — production fix reconciliation (source-only)

- Production source assessed: `7b224c39624827282c3cbf003060317045b0a73f` (`main` on 2026-11-22).
- Genesis source ancestor: `0d4cfcab304c78addfff22826084ebfb2e3c2d7f` (PR #1074, DEV staging, no new OTA).
- Merge base: `551e54602addd6f7bbe7bcdddd1589d35424c964`.
- GitHub 3-way inventory: 76 production-side paths; 10 identical; 51 safe source paths selected and copied; three overlaps reconciled through reviewed source (two exact contextual patches plus mentor evidence production superset); four overlaps retained as Genesis-specific implementations after checking production semantics; 8 production-only publisher artifacts intentionally excluded.
- Excluded publisher-specific JSON markers, marker-only tests and production web deploy workflow. These are not Genesis features; no published-update receipt is inherited.

## Verified safe source paths
- `.buklod/scopes/consent-verification-contrast-20261122.json`
- `.buklod/scopes/dzas-web-audio-recovery-20261122.json`
- `.buklod/scopes/mentor-ccp5-production-rc-hold-20261121.json`
- `.buklod/scopes/mentor-submit-prod-backport-20261120.json`
- `.github/workflows/buklod-consent-prod-rc-no-publish-20261122.yml`
- `.github/workflows/mentor-ccp5-isolated-postgres-qa-20261121.yml`
- `.github/workflows/unified_rc_compiled_qa_20261108.yml`
- `docs/incidents/20261121_live_mentor_ccp5_access_and_receipt.md`
- `src/app/admin/learning/mentors.tsx`
- `src/app/admin/points-r2-monitor.tsx`
- `src/app/clusters/home-checkin-review.tsx`
- `src/app/clusters/scope-manage.tsx`
- `src/app/learn/[id].tsx`
- `src/app/learn/lesson.tsx`
- `src/app/mentoring/index.tsx`
- `src/app/personal-home/radio.web.tsx`
- `src/app/privacy/consent.tsx`
- `src/components/BuklodHomeCheckinToday.tsx`
- `src/components/LearningQuestionResponse.tsx`
- `src/lib/buklodAdminPriority.ts`
- `src/lib/buklodGlobalAdController.ts`
- `src/lib/buklodNativeAdRecovery.ts`
- `src/providers/ComplianceProvider.tsx`
- `supabase/migrations/20261119214500_buklod_admin_new_registration_inbox_v1.sql`
- `supabase/migrations/20261121132000_mentor_report_catalog_titles_and_role_clarity.sql`
- `supabase/migrations/20261121141000_admin_mentor_capability_review_audit_v1.sql`
- `supabase/migrations/20261122065000_mentor_full_published_catalog_v1.sql`
- `supabase/migrations/20261122090000_cluster_scoped_home_checkin_review_v1.sql`
- `supabase/tests/admin_new_registration_security_20261119.sql`
- `supabase/tests/buklod_cluster_admin_isolated_rc_20261122.sql`
- `supabase/tests/buklod_points_r3_home_earning_contract.sql`
- `supabase/tests/mentor_capability_release_guard_20261121.sql`
- `supabase/tests/mentor_full_published_catalog_security_20261122.sql`
- `tests/admin-new-registration-inbox-20261119.test.cjs`
- `tests/admin-registration-navigation-scroll-20261119.test.cjs`
- `tests/admin-registration-notification-route-20261119.test.cjs`
- `tests/admin-registration-security-20261119.test.cjs`
- `tests/auth-consent-boot-recovery.test.mjs`
- `tests/buklod-cluster-checkin-ads-monetization.test.cjs`
- `tests/buklod-cluster-checkin-navigation-scroll.test.cjs`
- `tests/buklod-cluster-home-checkin-review.test.cjs`
- `tests/buklod-points-r3-classroom-quiz-attendance.test.mjs`
- `tests/buklod-prod-native-ad-recovery-circuit-20261122.test.cjs`
- `tests/cluster-connect-notifications-points-20261108.test.mjs`
- `tests/dzas-signal-deck-implementation.test.mjs`
- `tests/dzas-web-production-deploy.test.mjs`
- `tests/fixtures/mentor-capability-postgres17-20261121.sql`
- `tests/fixtures/mentor-capability-postgres17-verification-20261121.sql`
- `tests/lesson-checking-mentor-options-20261122.test.mjs`
- `tests/mentor-catalog-auth-permission-20261122.test.mjs`
- `tests/mentor-report-selector-access-20261121.test.mjs`

## Context-exact three-way patch paths
- `src/app/_layout.tsx`
- `src/components/BuklodClusterHomeCommandCenterImpl.tsx`

## Reviewed overlapping paths (no destructive overwrite)
- `src/app/faith/mentor-evidence.tsx`: production file is a semantic superset of Genesis's four reporting-feedback edits, and adds server-verified mentor capability, catalog access handling, and safe retry states; take full production blob.
- `src/lib/buklodNotificationNavigation.ts`: Genesis has the same System Admin route with the **correct five-field UUID regex**; production's four-field regex is defective. Preserve Genesis.
- `src/ptt/buklodPttRuntime.ts`: Genesis contains production's serialized account preference/target switching plus extra Entry Map audio-focus and normal PTT end lifecycle. Preserve Genesis.
- `tests/buklod-mandatory-update-runtime.test.mjs`: preserve Genesis 2.0.1 runtime/OTA guards, not production 1.3.2 version assertions.
- `tests/ota-restart-safe-area.test.cjs`: preserve Genesis SOS/native host lifecycle tests; do not install production-only exporter assertions in isolated Genesis staging.
- Add dedicated cross-branch source regression assertions in `tests/genesis-production-fix-reconciliation-20261122.test.mjs`.

## Outstanding independent DEV feature intakes
Pending PRs listed below are **not** claimed merged or verified. Gate consolidation until every approved PR's exact head, tests and platform compatibility are reconciled.

## Additional current DEV intakes pending their own QA
PRs #1118 (Wall layout anchoring), #1116 (Stream JWT expiry), #1114 (report feedback), #1113 (compact/loading comments), #1108 (Kingdom arcade), #1107 (IMCI/AJA), #1106 (public lifetime BP), #1104 (comments UI), #1101/#1100 (world/game assets), #1093/#1091 (doors/formation).

## Hard release boundary
Source-only integration branch. No Supabase migration applied by this commit, no APK/AAB/OTA published, no production deployment. Keep Genesis 2.0.1 SOS/new native APK, isolated staging backend, security/AdMob/instant-navigation regression, real Android audio/network QA and owner-approved Season 2 production release gates CLOSED. All merged production code must be compiled/tested before promotion. Do not merge this integration source until unresolved semantic conflicts are reviewed and full gates pass.
