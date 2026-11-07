# BUKLOD Quiz consolidation — verified DEV continuation R2 (2026-11-07)

**Scope:** Resume DEV from the verified private R10/BUILD source archive; do not modify Production or Dedicated until the verified RC and release gates are satisfied.

## Cloud baseline preserved

- Private archive: `faust-0612/BUKLOD-Migrated-Sources`, branch `migration/quiz-canonical-source-20261107`, commit `9cef155f2378fc77a46e20325259e81136525e45`.
- R10 source: 300 original archived files / 65,058,267 bytes / manifest `04e596c8cfeb04bea54a618686d70ca1560628f06967a0bcc3510ad31b41a1f7`.
- BUILD source: 336 original archived files / 75,834,778 bytes / manifest `481385774640c64813eafbb7c2451390541bbff3d63b55c9159da74fc835faad`.
- Archive remains immutable. Separate source development branch created: `dev/quiz-r10-main-db-reconciliation-20261107` on that repo, based on exact commit `9cef155`.
- R10 source has the stronger exam durability stack (submit v4, save v2, secure local/offline lease); still only a **provisional DEV** source pending BUILDs faculty/results feature reconciliation and exact deployed build parity.

## Verified Main private staging: no live data cutover

- 19 corresponding historical source tables were compared with Main `quiz_migration.buklod_quiz_raw_v1`: **95,868 rows on both sides, all 19 table counts match**.
- **19/19 type-cast rehearsals PASSED** on Main (95,868 rows parsed as the matching Main table row types; no runtime SQL write).
- **24/24 staged internal FK relationships PASSED**, **166,253 related historical links**, **0 broken references**. Validated using indexed `(source_table,row_key)` for parent IDs. These checks do not override Main Auth FKs.
- 13 Main Auth-FK checks: **234 missing source references attributable to two unresolved source student UUIDs**: 3 attempts, 200 responses, 28 events, 3 roster entries.
  - One `email_conflicting_uuid` recorded student: 2 attempts/150 responses/7 events/2 roster entries; email candidate exists but is not verified as the same account. **Do not silently reassign ownership.**
  - One `historical_orphan_no_auth`: 1 attempt/50 responses/21 events/1 roster entry; no source Auth snapshot or Main match. **Preserve in private staging until proven.**
- Raw content comparison: 61,959 responses and 25,808 events matched exactly; 952 attempts matched after numeric-scale normalization (nine differences were formatting such as `8.0` versus `8`). Historical audit-log details and live-session snapshots also had **no actual JSON semantic differences** after normalization. All other table contents matched except the expected **live SSO gate delta** below.
- Dedicated `buklod_quiz_main_entry_gate`: exactly **3 of 406** user-gate timestamp rows changed after mirror. Latest Dedicated issuance `2026-11-07T03:49:04.130Z`, versus staged max `2026-11-06T11:25:44.833Z`. This shows the original SSO process remained active. Do not blindly import stale one-time session issuance state; quiesce/drain and transition the bridge at cutover.

## Implemented and readback-verified in BUKLOD Main DEV branch

Branch: `faust-0612/BUKLOD-Rork` / `dev/quiz-consolidation-identity-audit-20261107`.

| DEV artifact | Contract / test status |
| --- | --- |
| `supabase/pending/quiz_consolidation/20261107_source_parity_faculty_execute_grants.sql` | RC-only proposed anonymous EXECUTE revokes for three faculty SECURITY DEFINER RPCs; Main currently differs from Dedicated |
| `supabase/pending/quiz_consolidation/20261107_rc_live_question_snapshot_parity.sql` | RC-only v3_core routing, per-attempt assigned question view, assignment validation; repaired legacy 100-of-200 fallback to fail closed when selected IDs unavailable |
| `supabase/pending/quiz_consolidation/20261107_rc_cutover_preflight_readonly.sql` | Existing read-only data/Auth/Storage/grants/selection gate; expected to fail today |
| `supabase/pending/quiz_consolidation/20261107_rc_type_cast_rehearsal_readonly.sql` | Executed read-only; 19 tables / 95,868 rows / no cast errors |
| `supabase/pending/quiz_consolidation/20261107_rc_staged_fk_rehearsal_readonly.sql` | Executed in bounded six-FK batches; 24 relationships / 166,253 links / zero orphans |
| `supabase/pending/quiz_consolidation/20261107_rc_auth_fk_rehearsal_readonly.sql` | Executed read-only; 13 roles/fields, 234 unresolved Auth foreign-key references |
| `supabase/pending/quiz_consolidation/20261107_rc_100of200_predicate_contract_readonly.sql` | Executed read-only; four predicate cases PASS: selected 100/200, unselected 100/200 fails closed, full 200/200, nonlive 200 |
| `scripts/quiz-storage-reconcile-r1.mjs` | Protected 98-object private-bucket Storage migrator; never overwrites or deletes source, prehashes all source bytes, verifies destination SHA-256 by download, rechecks source inventory and bytes, sequential idempotent retries, explicit verified-RC env gate |
| `scripts/quiz-storage-reconcile-r1.test.mjs` | **7/7 offline mocked behavior tests PASS** including 86 uploads, 12 existing byte matches, rerun=0 uploads, source edit detection, same-path conflicts, inventory change, public bucket rejection, unsafe extension/path |

Storage script is **not executed** against live projects. It requires protected external administrative credentials stored in a secure runtime (never in GitHub source or conversation). No key access is available through current connected action set. Existing source document bucket is private in both projects with identical 50 MiB size/mime rules. **86 source paths still missing in Main; 12 metadata-only matches; 0/98 actual content SHA verified in current DB audit.** Service-key uploads can affect object ownership; student/faculty readback under real RLS sessions remains a separate RC acceptance criterion. Do not alter `storage.objects` metadata directly.

## Standalone Quiz DEV source

Branch: `faust-0612/BUKLOD-Migrated-Sources` / `dev/quiz-r10-main-db-reconciliation-20261107`.

- In R10 `src/lib/supabase.ts`: uses the same `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` then legacy-ANON fallback as `app/login.tsx`; optional build-time target `EXPO_PUBLIC_BUKLOD_QUIZ_EXPECTED_PROJECT=main_rc|dedicated` fails closed on wrong known project URL, missing key, or `sb_secret_` embedded key. **Unset mode maintains historical behavior**.
- Standalone no-network test script `scripts/check-quiz-target.cjs`, command `npm run check:quiz-target`. **8/8 behavior tests PASS** in the local simulated runner. Source archive branch unaffected. Full Expo/TypeScript build and deployed web testing not executed.
- The current BUKLOD Main `buklod-quiz-entry-v1` Edge Function remains a proxy forwarding bearer tokens to the Dedicated `buklod-quiz-main-entry-v1`. The R10 client still requires actual Main-only SSO/session exchange and SSO cutover proof. The Main app launcher still targets Dedicated. **Do not describe the system as Main-only**.

## Release gates remaining

1. Account ownership: resolve both historical UUID issues without guessing or retain affected data in a secure, auditable quarantine until verified; rerun 13-field Auth audit.
2. Private Storage: credentials-only controlled migration after verified RC, all **98/98** content digests plus owner-specific RLS acceptance; no user document exposed publicly.
3. Historical data: apply a proper transactionally safe live import in an isolated RC preserving all 95,868 source table rows/identity mappings, triggers, and related data. Current Main live Quiz remains **0 attempts / 0 responses**; Main private mirror contains all 952/61,959.
4. Backend functionality: verify v3_core, assignment seeding, 100/200 question tests, save/resume/offline, submit once, review, faculty segregation, trigger/score parity, and security-definer grants against RC. SQL candidate **not yet applied to any live Main database**.
5. Source/web integration: reconcile BUILD-only faculty/results behavior vs R10, complete Main-only Quiz one-time SSO bridge and Expo env/build; identify exact current `buklod-quiz.expo.app` deployed artifact.
6. Release: DEV → verified RC → exact production artifact, verify actual runtime and rollback, then retire Dedicated and consider local deletion **only after** source+assets+storage+data+runtime parity.

**Outcome:** VERIFIED cloud source recovery + independent read-only historical audit + DEV code/test artifacts; **PARTIALLY COMPLETE WITH EXPLICIT BLOCKERS / BLOCKED BEFORE RELEASE**. No production OTA, Main DB DDL, live table import, Auth rewrites, or Storage file transfer has been performed in this continuation.
