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
