# 2026-11-24 BUKLOD staging UI — read-only Points preview

**Status:** source candidate only, not a published OTA.

## Hard release boundary
The existing EAS preview configuration points to the LIVE MAIN Supabase.
It is not permissible to create an isolated Supabase project; it is also
not permissible to perform staging tests that mutate live member Points.

## Included and safe by construction
- Individual pending-activity **preview** (paginated, RLS-account-scoped reads).
- Claim All remains absent; activity names/point values can be inspected.
- Staging Points claim button is disabled and labeled PENDING/PREVIEW.
- Callback is separately guarded before existing single-claim RPC.
- Optional rewarded +5 BP feature remains OFF, with an additional staging
  callback guard. No SSV migration/function/config deployment.
- Existing AdMob banner/interstitial and navigation systems unchanged;
  no new Native deps, app.config.js, eas.json, packages, Android or iOS.
- Sound, animation, rank/leaderboard and history remain available.

## Intentionally held
- **Functional individual claiming** on staging: existing claim RPC changes
  LIVE member ledger balances. Keep this in DEV for a separately authorized
  production-linked release; do not pretend the staging preview claims Points.
- Rewarded Google SSV +5 BP, Points/QMP anti-farming migrations and
  new teaching-evidence/children-story functions.
- ABaKa unlimited-doctrine server content/assessment/points migrations.
- Any Genesis/Season 2 native, backend or divergent changes not reconciled
  with MAIN and the currently signed staging APK runtime.
- Production OTA/Play/main, APK/native rebuild, live backend migrations.

## Exact release gates
- Require frozen current MAIN baseline and reviewed source allowlist.
- Pass Claim All removal, direct/disabled claim, account/RLS, duplicate
  safety, 19 prior tests and ad/nav regression checks.
- Pass TypeScript and Android Hermes export with **preview** env and a
  static \`EXPO_PUBLIC_APP_ENV=staging\` read-only claim guard.
- Verify signed staging Android package, runtime, channel mapping, preview
  Supabase URL, production manifest non-mutation before any publish.
- On eventual publish, only EAS \`staging-user\` Android channel; verify
  exact update manifest ID and production manifest unchanged. Do not
  announce a staging-only OTA as a production release.

This candidate is a **read-only review surface**, not a guarantee that other
unchanged staging app screens can never perform their own existing writes
against the shared backend. Their existing behavior is outside this change.
