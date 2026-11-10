# BUKLOD consolidated production promotion — November 10, 2026

Owner authorization: consolidated push in the current conversation.

## Exact release source and scope

- Production source: `main` after verified PR #609 squash merge `dc6f2e237f6fc9f6e8a3782dfcc6ad25ca405844`.
- PR #609 exact compiled head: `66d5c81ceed817868f6c0e6e8dbd7e993a0765f7`. Engineering Accountability, Performance R1, Main/Legacy Integration, and Android/Expo Web compiled QA passed on that source.
- Target: production Android OTA `org.mzbministry.buklod`, EAS project `23dad7d0-389a-406e-8dec-08965dab85d8`, runtime `1.3.2`, channel `production`; together with BUKLOD Main Expo Hosting web.
- Includes consolidated November 9 Music/Rank/PTT/Offline/Earnings; Bible V4 Quiz/Flash/Arena/Kingdom audio; app typography and compact spacing; public Home/Profile Health Center entry with privacy-safe routing.
- Preserve native package and versionCode, original security, finance, Ads, scope/account isolation and mandatory production gates. No Google Play AAB submission.
- Excludes unverified PR #611 client changes (post-merge conflict + compiled QA skipped), unreviewed DEV/HOLD branches and separate Classroom / BSOC deployments. AI-reflection backend separately reported live is not re-applied.

## Publication requirements

This source-only marker must not be interpreted as deployment proof. The protected-main merge of the marker with commit title starting `BUKLOD_CONSOLIDATED_PROD_20261108` intentionally triggers the existing canonical `.github/workflows/production_android_ota.yml` and `.github/workflows/production_web_deploy.yml` jobs. Release must independently validate exact merge SHA, EAS production baseline, native compatibility, production environment, all regression gates, freeze RC, publish and verify exact update IDs and served hashes. Halt on any failure. Physical phone verification is waived, not performed.
