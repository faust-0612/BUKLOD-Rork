# BUKLOD MAIN | Real-name ID and withdrawal security

**DEV-only as of 2026-11-18. Not deployed to Main Supabase, staging OTA, RC or production.**

## Binding security contract

- An existing member's first/middle/surname/suffix/full_name cannot be changed in `profiles` without a verified government-ID review matching the requested name. Old clients and direct API updates hit the same database trigger.
- `profiles.is_verified` is Church/membership verification; it is **not** a KYC flag. The private `buklod_legal_identity_v1.status='VERIFIED'` is independent and additionally required for any withdrawal.
- Every canonical PF and old R38 withdrawal request is checked against fresh database state, plus the approved legal beneficiary name; preexisting/legacy payout rows are checked again before payment.
- ID pictures are kept in a non-public, owner-scoped Supabase Storage bucket. Only the protected official System Admin may open others' ID pictures for human review. No public ID URLs, client deletion, anonymous access or overwrite.
- A new ID submission temporarily revokes the previous approval until reviewed; version/revision checks prevent stale approvals. Name review is **not** a claim of automated ID authenticity verification.
- Do not modify Season 1 or Season 2 reward economics, cash ledgers, AdMob revenue rules, or the current finance activation flags.

## Mandatory blockers before any release

1. Confirm the authoritative **BUKLOD MAIN** Supabase staging project is accessible. The currently connected Supabase projects in this session did not include Main. DO NOT target Connect, Quiz or Attendance projects.
2. Reconcile the exact production/staging RPC signatures and return types of all existing PF V2 and R38 payout functions. Renaming/wrapping existing functions is a critical migration; confirm every caller, service-role payment route, rollback and PostgREST schema cache.
3. Apply migration on an isolated Main staging database, run `supabase/tests/buklod_legal_identity_withdrawal_20261118.sql`, and test direct API name edits, unverified/verified payouts, legacy callers, payout snapshot mismatch, pending re-review, concurrency, authenticated storage rules and protected admin review.
4. Establish a **document retention and erasure** process for raw ID photos, including orphan uploads, superseded documents and rejected applications, in line with a published privacy notice. This automated retention process is not included in the current implementation. Do not release public ID collection until this gate is met.
5. Verify clear user notice/consent, identity-review access logs and that screenshots, telemetry, errors, public posts and logs do not contain ID images, IDs or signed URLs.
6. Run existing first-view AdMob and instant-navigation regression tests and staging real-device verification. Do not publish a Main OTA or enable finance switches from this branch.
7. After a separately approved Main DB/OTA release, verify production migration hash, actual payout request acceptance/denial, admin payout blockade, active app runtime and live Android OTA update ID before announcing success.

## Test artifacts

- `tests/buklod-legal-identity-withdrawal-20261118.test.mjs`: source security and anti-alias contracts.
- `supabase/tests/buklod_legal_identity_withdrawal_20261118.sql`: staged database grant, policy, trigger and RPC contracts.

This change introduces new KYC processing. Existing member financial balances and payout history are retained; current users are not silently auto-marked ID-verified.
