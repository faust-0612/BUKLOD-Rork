# BUKLOD — Individual Claims + Optional Verified +5 BP Ad Bonus

**Owner decision (Nov 24 2026): no isolated Supabase backend.** Nothing
in this branch authorizes modifying the live database or deploying an Edge
Function. This is PREPARED BACKEND CODE ONLY; reward feature is OFF.

The staging-compatible, backend-neutral client is prepared separately on:
`dev/points-manual-claim-staging-compatible-20261124`.

## Current safe rollout

- Use existing RLS-protected `buklod_points_ledger` and
  `buklod_reward_events` for individual claim-card loading.
- Use existing atomic `claim_my_buklod_reward_event` for user-initiated
  manual claims, with existing ad cadence after server-verified success.
- Remove Claim All from new UI; leave legacy backend API intact for old
  installed clients until formally deprecated.
- Do not add a new migration or call a new Supabase RPC from the staging
  client. Rewarded +5 UI remains OFF in staging.
- Keep existing AdMob banner, interstitial, Ad-Light, consent and
  navigation safeguards unchanged.

## Deferred Google server-side verified +5 BP backend

The migration `20261124014500_buklod_individual_points_claim_rewarded_ssv_v1.sql`
and Edge Function `buklod-admob-points-ssv` are saved in this branch
but **MUST NOT** be applied to live Supabase or configured on AdMob yet.

When a future owner-authorized backend change is scheduled, required gates:
1. Read-only reconciliation of authoritative member ledger, QMP and
   protected Official principal before any database write.
2. Backward-compatible migration review with tested rollback/recovery
   procedure; no modification to the QMP/cash/withdrawal settlement paths.
3. Validate Google ECDSA SSV signature, nonce/user binding, unique
   transaction ID, exact ad unit, expiration and daily cap.
4. Verify duplicate, delayed, tampered, failed, offline and concurrent
   callback scenarios using controlled non-production records or
   transactional test fixtures that cannot contaminate real member data.
5. Review Google AdMob rewarded-ad policies and backend service-only RPC
   permissions before enabling a live ad unit.
6. Verify 15/30/60-minute version-specific ad/nav regression, exactly-once
   points credit and payout/QMP isolation. Explicitly approve the backend
   rollout separately; never activate it merely by shipping an OTA.

The admin/config flag defaults OFF; staging hard-disables rewarded BP
even if an environment variable is inherited.

## Release boundary

Staging release must pass Android runtime/package, source/CI, native
dependency, AdMob rendering and production baseline gates. Existing
staging may still point at the live Supabase backend; tapping a claim
on such an installation mutates real member balances. This is a
production-impacting test and must not be used for unreviewed staging QA.
No staging OTA is proof of live backend safety.

Never announce a staging OTA as a production release.
