# BUKLOD Health Center + SALIKSIK — staging release boundary (14 Nov 2026)

**CONSOLIDATED STAGING OTA NOT READY TO PUBLISH.** This is a source+QA
integration, not a live user release.

## Exact source
- BUKLOD staging candidate PR #802 (on top of Home #800, Profile #801).
- SALIKSIK R1/R2 original SQL, Edge generator, fixtures and test assets copied
  byte-identically from DEV PR #780; only Admin/Cluster entrance inserted
  surgically into latest staging source.
- Separate Health Center backend PR #2 adds an opt-in, bearer-authenticated
  consultation gateway, professional verification/assignment and patient-clinician
  message API. Educational zero-retention screening remains isolated.

## Gates verified independently
- Existing PG17 SALIKSIK R2 role/ledger and +205 pending Points tests: PASS
  on integrated PR #802; live Supabase unchanged.
- Existing Health Center source/Next CI: PASS at base source.
- Health Center PG17 R1 negative/positive actor role tests: PASS on isolated CI
  database (not deployment).
- Current exact-head TypeScript/Expo Android code export: requires this workflow's
  successful Actions receipt. This is NOT native UI/device verification.

## Gates that must remain FALSE
- Isolated nonproduction Supabase project/branch with separate Auth, RLS,
  Storage and Edge runtime. Live BUKLOD Connect has NO staging branch; do not
  apply SALIKSIK migrations to production to make a screenshot work.
- Saliksik Gemini generator secret and admin manuscript extraction / question
  provenance, roles, points, branch isolation & negative tests.
- Health Center clinical identity review, licensed provider availability,
  patient consent, chat verification, retention/deletion/privacy signoff and
  authenticated web session UI; its backend default remains OFF.
- Exact installed signed staging-client / runtime parity, role-staged end-to-end
  interactions and real Android post-OTA visual review.
- Confirm no unrelated Home/Wall/Marites/Connect/Ads/PTT/GIF/native changes and
  no accidental reactivation of retired IGPAT.
- Freeze a verified RC, then separately authorize a single Android
  staging-user OTA. Production, Play and web publication are excluded.

## Cost governance
Supabase preview branch adds compute billed from USD $0.01344/hour (plus
potential usage) and must not be created without explicit recurring-cost
acceptance. Reusing Quiz Dedicated / Attendance production databases is not an
acceptable staging alternative. CI Postgres 17 is ephemeral and free of
persistent production mutations.

No automated release, merge to main, feature-flag enable or production DB write
is authorized by this record.
