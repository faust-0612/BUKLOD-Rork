# BUKLOD official AdMob daily and QMP monthly preview

Status: **Supabase noncash backend deployed** (migration `20261117180753`, AdMob Edge Function v12 with JWT verification). **Android UI remains DEV only**; no live scheduler activation, APK, staging OTA, production OTA or cash activation.

- Current month is the official Network report month-to-date; Today is its provider reporting day (account timezone shown to user).
- Share = floor(floor(official AdMob PHP centavos × 3000/10000) × qualified user QMP / total qualified monthly QMP). No fixed peso per point.
- The day share is a subset of the current month; do not add Today to This Month or Projected Overall.
- An hourly opt-in GitHub schedule fetches fresh official reports only after BUKLOD_ADMOB_SYNC_ENABLED and scheduler secrets/URL are configured. Google reports can lag; this is not real-time per ad impression.
- If the AdMob timezone differs from Manila at a calendar-month boundary, fail closed instead of mixing QMP periods.
- If the latest source is older than 36 hours or no official day is present, display no current estimate, not cash.
- Last Month remains immutable only after canonical Finance V3 reconciled month close; otherwise Awaiting Finalization.
- Projected Overall = available finalized + This Month estimate, excluding reserved/paid. Paid remains historical and never reduces the earned-history figure.
- No Finance V3 settlement, withdrawal, RLS access scope or provider ad-fill path is modified.
- Deployment status: additive migration and private privilege contract VERIFIED; AdMob Edge v12 ACTIVE and exact-source readback VERIFIED. A real refreshed AdMob API response is still unverified. Staging Android compilation, ad/nav regression gates and RC integration are required before any OTA.
- Live scheduler config is not verified. Prior official snapshot was November 9 (Manila); no observed Nov 17 invocation. Neither cash nor availability is backfilled without verified reconciliation.

- Live apply_migration assigned version `20261117180753`, so the source migration is named `20261117180753_buklod_admob_daily_qmp_preview_v2_20261118.sql` for future db push parity. Do not reapply. The add-on table and RPCs have been verified live; source report scheduler remains unverified.

- Reversible SQL runtime test validated the service-only writer, exact 30% QMP monthly/today calculation, refusal of an authenticated user's writer call, and older-report monotonic guard. `ROLLBACK` restored the November preview to ₱8.64, left daily rows/cash ledger at zero and finance payout flags OFF.

## Trusted internal cron replacement (Nov 18)

The dedicated Postgres pg_cron + pg_net sender uses a Vault-generated 256-bit token, checked by a separate limited Edge bridge. It proxies only to the existing JWT-verified official importer. No token is in GitHub or mobile source; no user-finance write, and GitHub manual workflow remains an optional break-glass fallback. Enable the hourly job only after a successful authenticated end-to-end provider API response and verified DB ACLs. A new migration must be applied once and its resulting Supabase history ID reconciled into source filename. No production OTA without Android release gates.

## Nov 18 server-side cron bridge verification

The live migration was applied as Supabase history `20261118015337` and source renamed to that exact version. One encrypted 256-bit Vault credential and private digest are live. Supabase Edge `buklod-admob-cron-bridge-v1` is ACTIVE v1; official AdMob importer's v12 is still gateway-JWT gated. Live test of the bridge (request 26602) authenticated the cron bearer, then found the existing importer rejects a modern `sb_secret_` key with HTTP 401 after gateway minted compatibility. The DEV source now supports the exact server-held modern key while retaining `verify_jwt=true`, JWT role verification and no client access; deploy importer only after focused CI. No cron job is enabled until the official provider path succeeds. Neither cash nor payout flags changed.

- When official imports fail, only the authorized Vault-backed scheduler sees a bounded diagnostic stage and provider HTTP status; OAuth/Google error bodies and any credentials remain hidden. A 503 must never be shown as current earnings or retried in a tight loop.

- A failed OAuth refresh may emit an allowlisted OAuth error code only through the authenticated Vault-backed bridge. This is operational metadata, never a payment record or Google error body. If OAuth returns `invalid_grant`, the Google owner must renew the refresh-token authorization; the app cannot fabricate or mint a new Google OAuth refresh token.
