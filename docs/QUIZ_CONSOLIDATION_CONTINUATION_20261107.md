# BUKLOD Quiz → Main consolidation checkpoint (2026-11-07 PHT)

**Release state: PARTIALLY COMPLETE; NO LIVE CUTOVER.**
Dedicated Quiz `cjtehbfspgimyhifnjon` still serves the published standalone Quiz client; Main `yhanxndaqbmuzbdqlblu` has only protected migration staging/audits.
This is not a deployment approval or proof of future exam functionality.

## Verified source-to-private-staging data
- 0 unexpired STARTED attempts when checked; recheck immediately before any cutover.
- Source vs private staging row counts: 22/22 public Quiz tables match, including **61,959 responses**, **952 attempts**, **25,808 events**, and the other nonempty/empty tables.
- Existing 61,959-answer 22-date-group content-checksum validation was completed in the prior checkpoint. This pass rechecked the total, unique staging keys and maximum updated timestamp; a new final content parity pass is required at cutover.
- Live Dedicated Auth users/profiles grew from 409 snapshots to **475**. Imported 66 missing non-secret Auth references and refreshed **344 protected profile snapshots** (66 missing, 278 changed). Final 475/475 profile MD5 matches; 0 missing Auth refs; 0 email mismatches. No passwords, auth.sessions, auth users or public profiles were changed.
- Protected `quiz_migration.buklod_quiz_identity_audit_v1` covers 484 distinct auth/history IDs and all 61,959 responses / 952 attempts. 471 source/Main UUID+email match; 8 historical UUID matches in Main without current Dedicated Auth; 2 same-email/different-UUID; 2 source-only without Main account; 1 historical orphan without current Auth in either project. The 5 unresolved identities account for 200 responses and 3 attempts. Candidate UUID matches are NOT access-control approvals.

## RPC compatibility (metadata only)
Protected `quiz_migration.buklod_quiz_rpc_compatibility_audit_v1` contains 169 unique signatures (source 126 / Main 145):
- 40 exact definition hashes;
- 62 differing same-signature implementations (including submit_attempt_v4); 7 differing Main RPCs have anonymous EXECUTE and SECURITY DEFINER; these require individual auth/body review;
- 24 source-only definitions, all SECURITY DEFINER (including the attempt final-score guard function, main-entry claim, faculty class roster, finalization and release functions);
- 43 Main-only definitions must not be removed.
Main `public.buklod_quiz_attempts` still lacks the dedicated attempt-final-score trigger; do not blindly create it until dependencies and grading invariants are tested.
**No public RPCs, triggers, RLS policies, scores, or attempts were changed.**

## Private Storage delta
- Both source and target bucket `buklod-quiz-source-docs` are **private**.
- Dedicated currently holds **98** objects. Existing 12 original copied paths are in Main with matching sizes totaling **4,458,258 bytes**; 12/12 owner_id metadata differs from source, so access behavior must be verified. Earlier transfer verified these 12 by SHA-256; this pass validated only paths and metadata, not actual file bytes.
- **86 source paths**, totaling **27,536,465 bytes**, are not present in Main. Main also contains 22 other paths in that bucket; preserve them.
- Protected `quiz_migration.buklod_quiz_storage_inventory_audit_v1` now holds all 98 source metadata entries with explicit COPY_REQUIRED (86) / PRESENT_METADATA_MATCH (12) flags. Its content_verified flag is FALSE until source-vs-target SHA-256 is reverified. No document bodies were copied in this pass and no source object was removed.

## Applied migrations in Main's PRIVATE namespace
1. `quiz_consolidation_identity_audit_v1_20261107`
2. `quiz_consolidation_rpc_compatibility_audit_v1_20261107`
3. `quiz_private_storage_delta_audit_v1_20261107`

All three protected audit tables: RLS ENABLED + FORCE RLS, no anon/authenticated schema access or SELECT. Security advisor reports only expected INFO `rls_enabled_no_policy` for the private identity audit (no policies is intentional). Version-controlled source is on DEV branch `dev/quiz-consolidation-identity-audit-20261107` under `supabase/pending/quiz_consolidation/`. **Migrations already applied** — do not replay through CI.

## Still blocking cutover
1. Source/deployment of standalone `buklod-quiz.expo.app` remains unavailable in accessible GitHub repos; Main launcher and dedicated main-entry bridge still issue the standalone session. Need source and config or a verified replacement with complete exam parity.
2. Resolve 5 identity exceptions with proof of ownership, preserving 200 responses/3 attempts; verify archived IDs and downstream grade privacy.
3. Securely copy 86 private source Storage objects and verify each SHA-256, path, ACL/owner policy, and authenticated file retrieval; never claim metadata=bytes.
4. Reconcile source/Main RPC behavior and full exam lifecycle, particularly SECURITY DEFINER grants, grade guard, timed exams, save/resume/offline, duplicate submissions, examiner review and controlled grade release.
5. Final source delta, consistent backup/rollback, canary, authenticated end-to-end regression, and monitored release. Dedicated database must remain active through verified observation.

**Live effects:** NO web/APK/OTA switch, no dedicated retirement, no production exam processing modification, and no billing savings yet.
