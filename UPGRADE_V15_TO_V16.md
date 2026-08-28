# Upgrade v15 → v16

v16 adds no new database migration.

Canonical migration count remains 13.

New operational files:
- `scripts/configure-production-eas.*`
- `scripts/link-production-supabase.*`
- `scripts/build-android-production.*`
- `scripts/submit-google-play-draft.*`
- `scripts/submit-google-play-internal.*`
- `production/execution/*`
- `store/GOOGLE_PLAY_FIRST_UPLOAD_EXECUTION.md`
- `qa/ANDROID_PRODUCTION_SMOKE_TEST.md`
- `release/execution/EXECUTION_STATE.json`
- `release/execution/PRODUCTION_ACTION_LOG.csv`

`eas.json` now contains two Android submission profiles:
- `google-play-draft`
- `google-play-internal`

Read `V16_PRODUCTION_EXECUTION.md` before running external commands.
