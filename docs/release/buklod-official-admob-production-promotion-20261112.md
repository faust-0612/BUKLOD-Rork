# BUKLOD Official and AdMob-only Finance — release promotion 2026-11-12

## Exact candidate and release identity
- Production main source commit: `3569fe85a56ff30812ef1d3ced1a4a9e68ecb8a3` (PR #730, exact source tree `e5f82847d608ee31017ffa81be402f140ac7dc93`).
- Verified compiled RC branch commit: `48011b5df95ef5b288d6db11ffc8dceaad2d67ca` (same tree SHA `e5f82847d608ee31017ffa81be402f140ac7dc93`; product code identical to reviewed main).
- GitHub Actions run: `43144593151` BUKLOD Unified RC Android + Expo Web Compile QA SUCCESS (exact RC source; no publish). Also successful Engineering Accountability `43144593313`, Performance `43144593276`, R38 Economy `43144593203`, Official Focused `43144593302`, Report Door `43144593285`.
- Android package `org.mzbministry.buklod`, runtimeVersion `1.3.2`; no new native libraries or native runtime changes. Production OTA targets Android production channel, and Expo Hosting Web.
- Reviewed PR #730 is merged in main. This document is release-only; no additional executable change.

## Live backend verified before release
The following migrations were applied successfully and their rollback-only post-migration SQL tests passed on production Supabase `yhanxndaqbmuzbdqlblu`:
1. `20261112093000_buklod_official_identity_economy_isolation_v1.sql`
2. `20261112094000_buklod_admob_only_member_revenue_v1.sql`
3. `20261112094500_buklod_official_wall_control_and_notices_v1.sql`

Protected admin now has public identity BUKLOD and retains system_admin privileges; private snapshot is inaccessible to authenticated user role. November sponsor income ₱5,994 remains separate platform revenue, with zero AdMob-funded distributable base; verified AdMob estimate ₱8.64 is provisional (noncash), and there are no finalized November shares or direct cash credits.

## Production gates
Release marker `BUKLOD_CONSOLIDATED_PROD_20261108` starts both existing production GitHub workflows. Both must verify production Expo environment, exact source SHA, runtime/channel, existing regressions and RC freeze. Android must publish the frozen, verified RC with `eas update --channel production --platform android --input-dir rc --skip-bundler`. Web must export and deploy to Expo Hosting. Do not declare complete without successful production job receipts and verification. A job failure means no verified publish; do not bypass old-client, ads or other guardrails.

## Boundaries
This release includes only production-main code; independent unmerged DEV/HOLD pull requests are not certified by this marker. Historical media, member finance records, Wall video/Marites, PTT, ads, backend capacity monitor, and Android video memory fix are preserved. Bulk unsolicited user direct-message blasts are NOT included: new official notices are individually addressed and idempotent, with existing announcement boards for broad messages.
