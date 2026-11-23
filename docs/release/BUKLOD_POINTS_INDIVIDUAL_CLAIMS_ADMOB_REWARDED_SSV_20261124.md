# BUKLOD — Individual Manual Claims + Optional Verified Ad Bonus

Status: **DEV SOURCE ONLY — reward feature OFF.** No backend migration, Edge Function,
AdMob dashboard change, staging OTA, or production OTA is implicit in this commit.

## User flow

1. Activity becomes verified in canonical `buklod_points_ledger` (pending).
2. Points screen lists claimable activity cards by category, with pagination.
3. User manually taps `CLAIM +N` for each event. Existing atomic
   `claim_my_buklod_reward_event` owns balance/rank history. No Claim All button
   or synthetic Claim All client dispatcher remains.
4. After verified claim completion, legacy cadence-controlled interstitial
   opportunity remains; ad loading is not a precondition for Points.
5. Optional `WATCH AD +5` is offered per eligible earning activity, including
   immediately following a manual claim. A backend-issued nonce is bound to
   the AdMob SSV `userId`/`customData`. **Only a verified Google SSV callback**
   can credit the bonus. Client `EARNED_REWARD` never writes Points.
6. One bonus per source activity; maximum 20 verified bonuses/day by default;
   eligible source window 30 days; pending nonces expire after one hour.
   User sees "verification pending" if Google's callback is delayed.

## Separation and controls

- Award is **regular non-transferable, app-only BUKLOD Points**, not a QMP event.
  No transfer, cash conversion, direct monetary redemption or financial payout.
- `private.buklod_ad_points_attempts` is not exposed to anon or authenticated.
- `confirm_buklod_ad_points_bonus_ssv_v1` is callable only by `service_role`.
  It serializes on the user's profile before crediting, checks active account,
  canonical Official exclusion, source eligibility, cap and unique receipt.
- SSV URL is verified with Google's ECDSA P-256 public keys (key cache 12h),
  DER signature conversion, exact signed payload order, timestamp freshness,
  ad unit and unique transaction ID.
- `private.buklod_ad_points_config.enabled` begins **false**; bonus = 5,
  cap = 20/day (Asia/Manila). Official-only
  `admin_configure_buklod_ad_points_bonus_v1` controls those values.
- Existing banner/native ads, Ad-Light, cooldown, consent, interstitial route
  safety and QMP/Finance settlement are not changed.

## Deployment prerequisites (REQUIRED; not executed by this DEV work)

1. Provision a verified **isolated staging backend**. The connected MAIN
   Supabase project is not a safe substitute.
2. Apply migration `20261124014500_buklod_individual_points_claim_rewarded_ssv_v1.sql`
   to staging first. Run DB security advisors; validate authenticated member
   views, duplicate retries, forged receipt denial, official identity exclusion,
   old-client claim compatibility, 30-day eligibility, and daily boundaries.
3. Deploy `buklod-admob-points-ssv` as a function with **verify_jwt=false**.
   This is safe ONLY because the function checks Google's ECDSA signature and
   performs service-role-only grant RPC. Configure server-only secret
   `BUKLOD_ADMOB_REWARDED_UNIT_ID` to the exact rewarded ad unit's numeric
   suffix (or full unit ID). Do not expose `SUPABASE_SERVICE_ROLE_KEY` to client.
4. In the AdMob rewarded ad unit settings, enable Server-Side Verification.
   Point its callback URL to
   `https://<staging-project-ref>.supabase.co/functions/v1/buklod-admob-points-ssv`.
   Use staging's appropriate test inventory; Google's sample test ad ID does
   not prove a live signed credit from your own AdMob unit.
5. Complete Google AdMob SSV test tool check, real Android ad-earned callback,
   signed duplicate replay, signature tampering, wrong ad unit, expired nonce,
   old/claimed activity, offline/no-fill, navigation and interstitial adjacency.
   Reward status must credit **exactly once** after callback, never on local tap.
6. Only then enable bonus in **staging** via authenticated Official Admin RPC:
   `admin_configure_buklod_ad_points_bonus_v1(true,5,20)`.
7. Verify full DEV → consolidated RC → production OTA compatibility, including
   first-view ad rendering, 15/30/60-minute build-specific AdMob metrics,
   instant tab navigation, page spacing and withdrawal/QMP isolation.
   Do **not** enable the bonus in production before both backend and client
   artifacts are verified live, and do not announce a staging OTA.

## Compatibility and rollout caveats

- Old installed clients may still use historical Claim All API. Source UI
  removes it for upgraded clients; safely retiring the backend API requires
  minimum-version enforcement and a separate migration after uptake.
- The enabled flag is false on first migration; therefore the new optional
  button will not display before the signed webhook/AdMob unit are live.
- Points screen now requires `get_my_buklod_pending_claim_cards_v1`; deploy
  backend before shipping the matching client. Never publish client first.
- All secure-SSV verification and real inventory tests remain release gates.
  A source contract test is not proof of live AdMob impressions.
