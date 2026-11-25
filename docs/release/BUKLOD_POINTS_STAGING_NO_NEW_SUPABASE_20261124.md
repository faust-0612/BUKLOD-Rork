# BUKLOD Points — staging-ready client, no new Supabase

**Owner decision (Nov 24 2026):** Do not create isolated Supabase; do not
apply live-database migrations or deploy new Edge Functions while implementing
staging-safe UI changes. Keep these changes prepared for later controlled release.

## What may be staged without a new backend
- Eliminate Claim All from the current Points screen and client dispatcher.
- List individual claim cards using existing authenticated, RLS-protected
  \`buklod_points_ledger\` and \`buklod_reward_events\` read access.
- Claim through existing atomic \`claim_my_buklod_reward_event\` only.
  A successful claim may still present the existing cadence-controlled
  interstitial. No ad may gate claiming or navigation.
- Keep the optional rewarded +5 BP UI code, but **disabled** throughout
  staging, regardless of inherited preview environment variables.
- Preserve existing ad rendering, ad-light pass, consent, QMP settlement,
  and the separate Bayanihan cash ledger.

## Changes intentionally NOT promoted
- \`supabase/migrations/20261124014500_buklod_individual_points_claim_rewarded_ssv_v1.sql\`
- \`supabase/functions/buklod-admob-points-ssv/index.ts\`
- Any change to live Supabase schema/RPCs, AdMob live SSV callback or cash/QMP.

These remain prepared in \`dev/points-individual-claim-rewarded-ssv-20261124\`.
Do not claim +5 BP is live. It cannot be enabled until the server-side Google
SSV callback and exactly-once crediting are authorized and verified.

## Release boundary
This branch is a staging-compatible **source candidate**, not evidence of a
published OTA. Before release, verify exact staging APK package, runtime,
EAS preview environment, immutable production baseline, CI, app content,
ad fill/nav regression and the staging target Supabase permissions.

**Critical:** Existing staging configuration must not be silently changed
to access production member data just to pass a gate. If the currently
installed staging APK points to live Supabase, normal claiming operations
can mutate live member balances; do not bypass release safety gates or run
a staging OTA against unreviewed backend connectivity. Source-only QA
is allowed; live backend mutation is not.

No production announcement for staging.
