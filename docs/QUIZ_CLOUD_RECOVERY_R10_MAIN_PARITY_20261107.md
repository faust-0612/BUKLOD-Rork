# BUKLOD Quiz cloud source + Main DB reconciliation — 2026-11-07

## Outcome: CLOUD SOURCE RECOVERY VERIFIED; FULL PRODUCTION MIGRATION BLOCKED

### Independent remote source evidence

GitHub private repository `faust-0612/BUKLOD-Migrated-Sources`, branch `migration/quiz-canonical-source-20261107`, commit `9cef155f2378fc77a46e20325259e81136525e45` was verified by fetching both manifests and primary application source files directly through the authenticated GitHub connector.

| Source snapshot | Verified source files | Bytes | Manifest fingerprint |
| --- | ---: | ---: | --- |
| `BUKLODQ_R10_BUILD_project_3d5647803088_04e596c8cfeb` | 300 | 65,058,267 | `04e596c8cfeb04bea54a618686d70ca1560628f06967a0bcc3510ad31b41a1f7` |
| `BUKLODQ_BUILD_project_8374b517b993_481385774640` | 336 | 75,834,778 | `481385774640c64813eafbb7c2451390541bbff3d63b55c9159da74fc835faad` |

Uploaded Git index parity verified 638 source/manifests in the owner's Windows log. Both manifests are intact and `verified_for_release=false`; no source auto-deletion. Archive contains some generated Android/CMake and smoke assets as originally staged; this is **not** a clean distributable package. Archive is private and MUST remain private.

### Comparative source analysis

- Shared paths: **91**. Identical checksums: **75**. Different checksums: **16**. R10-only: **209**. BUILD-only: **245** (many Android-generated files). None of the meaningful `app/`, `src/`, or `supabase/` source paths were BUILD-only under the current static classification. The R10 screen structure has additional separate `manage-exams`, `pre-live`, `security`, `exam-preview`, `released-answer-review` routes and `src/lib/quizSecureLocal.ts`.
- R10 exam: `buklod_quiz_submit_attempt_v4`, `save_answer_v2`, `start_attempt_v2`, `issue_offline_lease_v2`, `attempt_heartbeat_v1`, secure local recovery module. BUILD exam: submit v2, save/start v1, no local secure module.
- R10 `live-faculty.tsx` (19,175 chars) vs BUILD (43,090); R10 `results.tsx` (7,783) vs BUILD (15,442). R10 code uses different/newer RPCs and splits workflows across more routes. **Do not infer functional superiority solely from smaller or newer files**: require regression tests for every faculty control, member list, published results, student integrity report, attempt release, retries, and review.
- R10 Expo dependency `~57.0.18` vs BUILD `~57.0.19`; R10 `app.config.js` uses a separate R10 base and pins Quiz `runtimeVersion:'1.2.6'`, BUILD uses an Expo appVersion policy. **Do not confuse Quiz with BUKLOD Main v28 production OTA runtime `1.3.2`**. Source restore/build/deployment parity NOT verified.
- Recommendation: use **R10 as provisional development base** for the exam durability workflow, retain BUILD as independent reference to reconcile faculty/results behavior. No production source promotion.

### Backend evidence (read-only inspections)

| Metric | Dedicated source live | Main public live | Main private staged |
| --- | ---: | ---: | ---: |
| Attempts | 952 | 0 | 952 |
| Saved responses | 61,959 | 0 | 61,959 |
| Auth users | 475 | 556 | 475 auth reference records |
| Private source documents | 98 | 34 Main objects in the same bucket | 98 source-path audit entries |

The Main private storage audit shows **86 `COPY_REQUIRED`**, **12 `PRESENT_METADATA_MATCH`**, and **0/98 `content_verified=true`**. These are *not* verified matching bytes. Do not retire Dedicated or remove local backup.

Verified **58/58 unique R10 Quiz RPC names are present on Main** (source Dedicated 53/58, missing five older exam-management routines). This is name coverage, *not* matching function bodies/signatures/behavior/permissions: many DB functions differ and at least 24 source-only functions from prior inventory still need separate compatibility review.

**Auth isolation blocking real live materialization:** exactly two unmatched source student UUIDs account for **3 attempts, 200 responses, 28 events, 3 roster rows** (**234** foreign-key references). Other historical identity exceptions from the prior 484-ID reconciliation remain review-required; do not autoassign to a similarly named person.

**DB schema mismatch:** in six audited core tables, all 104 Source columns have compatible matching Main names/types/nullability/defaults; Main has ten extra fields for device binding, security and response-change tracking. Main attempts/responses have extra Auth FKs. Dedicated uses `private.buklod_quiz_attempt_questions_r1` + assignment/answer-validation/score triggers; Main instead has `public.buklod_quiz_attempt_questions` and `buklod_quiz_live_question_snapshots` with different per-question score fields, but lacks those three legacy triggers. Blindly copying private Source functions or tables would fail or collide. The Main snapshot table has RLS enabled with no direct policies.

**Confirmed functional gap:** Main `buklod_quiz_live_start_attempt_v3` currently calls legacy `v1` instead of existing `v3_core`, and Main `buklod_quiz_student_questions_v1` enumerates all active bank questions instead of reading frozen `public.buklod_quiz_attempt_questions`. Therefore 200 available / 100 assigned items could display incorrectly. Existing Main `v3_core` and `buklod_quiz_seed_attempt_questions_v2` already implement a more capable public snapshot model with question count and score targets, but must be wired and regression-tested rather than replaced blindly.

**Confirmed security gap:** Dedicated exposes three faculty `SECURITY DEFINER` RPCs to `authenticated` / `service_role` but not `anon`; Main currently permits `anon` execution for the identical signatures `faculty_live_room_v2(uuid)`, `live_bulk_action_v2(uuid,text,uuid[])`, and `live_control_v3(uuid,text)`. The three function bodies themselves match between Source and Main, so EXECUTE grants are the key disparity. Do not add privileged APIs accessible anonymously.

### Implemented in DEV repository (NOT APPLIED TO ANY LIVE DATABASE)

1. `supabase/pending/quiz_consolidation/20261107_source_parity_faculty_execute_grants.sql`: tightly-scoped grant parity with a postcondition test.
2. `supabase/pending/quiz_consolidation/20261107_rc_live_question_snapshot_parity.sql`: *candidate* wiring of R10 Main live-start to `v3_core`; reads frozen per-attempt/snapshot questions; assignment validation trigger; fallback for historical attempts; preserves current 2-minute/offline-lease recovery logic. Not yet PostgreSQL-runtime validated or end-to-end tested. All **53 referenced target columns** were confirmed to exist by read-only information_schema checks.
3. `supabase/pending/quiz_consolidation/20261107_rc_cutover_preflight_readonly.sql`: read-only gate for Auth FK references, 98 private document byte checks, attempts/responses live-staging parity, faculty grants and function wiring. Designed to **fail on the current Main database** until all blockers are resolved. No mutating SQL executed against Main.

### Release gate and required evidence

- Resolve two orphaned historical student UUIDs with owner-confirmed account mapping / quarantined preservation; do not rewrite records speculatively. Reaudit all 13 Main Quiz Auth FK fields across historical staging.
- Transfer 86 missing source private Storage objects using a sanctioned, authenticated path, verify SHA-256 readback for **all 98**. The prior cross-project connector transfer was blocked and rolled back, do not bypass it.
- Freeze source writes or otherwise capture and replay deltas, reconcile all historical tables, restore live Main records without breaking FKs and RLS.
- Apply and test DEV candidates in an isolated RC (200-item bank, 100-item selection, per-student ordering, save/refresh/offline, repeated submit, invalid-question reject, student/faculty identity isolation, results/reviews, abandoned attempts and duplicate requests).
- Reconcile R10 vs BUILD faculty/results UI, source `app.config`/Expo runtime, SSO bridge and deployment assets. Confirm exactly which source runs at `buklod-quiz.expo.app`; web fetch did not authenticate/verify the live app.
- Publish only an exact **verified RC** through intended release process. **No production OTA, source Auth switchover, dedicated retirement or local-file deletion** until proof.

**Status: PARTIALLY COMPLETE WITH EXPLICIT BLOCKERS / BLOCKED BEFORE RELEASE.** Cloud source-backup milestone complete, production Quiz migration not complete.
