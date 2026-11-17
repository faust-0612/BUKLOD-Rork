# BUKLOD official AdMob daily and QMP monthly preview

Status: DEV source only. No production backend deployment, live scheduler activation, APK, or OTA.

- Current month is the official Network report month-to-date; Today is its provider reporting day (account timezone shown to user).
- Share = floor(floor(official AdMob PHP centavos × 3000/10000) × qualified user QMP / total qualified monthly QMP). No fixed peso per point.
- The day share is a subset of the current month; do not add Today to This Month or Projected Overall.
- An hourly opt-in GitHub schedule fetches fresh official reports only after BUKLOD_ADMOB_SYNC_ENABLED and scheduler secrets/URL are configured. Google reports can lag; this is not real-time per ad impression.
- If the AdMob timezone differs from Manila at a calendar-month boundary, fail closed instead of mixing QMP periods.
- If the latest source is older than 36 hours or no official day is present, display no current estimate, not cash.
- Last Month remains immutable only after canonical Finance V3 reconciled month close; otherwise Awaiting Finalization.
- Projected Overall = available finalized + This Month estimate, excluding reserved/paid. Paid remains historical and never reduces the earned-history figure.
- No Finance V3 settlement, withdrawal, RLS access scope or provider ad-fill path is modified.
- Deploy order after CI: additive migration + DB security contract, Edge Function + confirmed provider response, staging OTA + ad/nav regression gates, verified RC, production only when separately approved.
- Live scheduler config is not verified. Prior official snapshot was November 9 (Manila); no observed Nov 17 invocation. Neither cash nor availability is backfilled without verified reconciliation.

- Live apply_migration assigned version `20261117180753`, so the source migration is named `20261117180753_buklod_admob_daily_qmp_preview_v2_20261118.sql` for future db push parity. Do not reapply. The add-on table and RPCs have been verified live; source report scheduler remains unverified.
