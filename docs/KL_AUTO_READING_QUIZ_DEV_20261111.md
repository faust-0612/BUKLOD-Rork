# KL Auto Reading Quiz — DEV Release Notes (2026-11-11)

Scope: `codex/kl-auto-reading-quiz-20261111` only. **Not deployed to production, not part of a published OTA.**

## Member experience
- Chapter remains accessible under existing publication rules.
- Reader taps "Natapos magbasa? Sagutin ang 3 tanong" instead of a 60-second waiting requirement.
- Backend randomly selects 3 of 5 simple, manuscript-evidenced multiple-choice questions.
- Exactly 3/3 correct is required to verify a chapter through the new flow. Failure permits rereading/retry.
- **Staged rollout fallback:** if the question bank is still pending, the reader can temporarily complete using the legacy server 60-second + two paced pings rule ONLY while `enforce_quiz=false`. After strict enforcement the fallback is forbidden.
- Server awards existing idempotent +5 BP (and once-per-30-chapter +30 BP) only on verified success. Optional natural-break interstitial follows completion, never precedes it.
- Existing completed chapters remain completed and are not re-awarded.

## Approval → auto-generation
1. Existing KL Admin approval RPC succeeds (only after preview/media checks).
2. Database approval trigger queues the approved manuscript fingerprint without changing the chapter’s publication status.
3. KL Admin automatically invokes `kl-generate-reading-quiz`; the Edge function authenticates the system admin, reads the latest approved manuscript, requests exactly five simple questions from the configured server-side model, and rejects a bank unless all five questions contain a verbatim manuscript-evidence passage.
4. Secure `kl_quiz_store_generated_v1` stores source-fingerprint-bound questions and confidential answer indexes.
5. If model/config/network validation fails, the approved chapter is preserved, question status remains pending, and the admin may use “Check / Retry 5 Reading Questions.” The KL release button makes one additional automatic generation attempt and requires a ready bank before newly publishing a chapter.
6. Already released Panimula and Kabanata 1–5 are seeded as pending (no automatic model spend on migration). An admin can trigger generation for them through the retry button.

## Non-negotiable security protections
- No member Data API access to answer keys: RLS enabled; `REVOKE ALL` on quiz bank/questions/attempts.
- Authentication and chapter release validated server-side for quiz begins.
- User must own attempt; answer keys are checked inside `SECURITY DEFINER` RPC only.
- Attempt expiration, replay handling, capped attempts/10 min, and immutable manuscript fingerprints.
- No manuscript or member record transmitted via client-side model calls. AI key remains in Edge secrets.
- Manuscript revisions automatically invalidate stale question banks.
- When quiz-only enforcement is enabled, a backend trigger blocks scheduling or releasing a new chapter if its current manuscript question bank is missing.
- **Transitional compatibility**: `kl_quiz_rollout.enforce_quiz=false` initially. Legacy time+pings path remains supported until minimum app build cutoff and consolidated OTA have been verified. Do NOT turn on enforcement before older supported clients receive quiz UI.

## Required sequence at release
1. Reconcile the authoritative BUKLOD Main DEV/RC baseline; verify no existing OTA candidate was lost.
2. Static unit tests and full typecheck; no Android device verification required if owner explicitly skips it.
3. Apply migration `20261111010000_kl_auto_reading_quiz_v1.sql` to approved target DB with rollback plan. Verify RLS, function grants, and current legacy completion.
4. Deploy `kl-generate-reading-quiz` Edge Function, `verify_jwt=true`; verify `OPENAI_API_KEY` server configuration and bounded generation costs.
5. Use a draft/admin test chapter to approve and verify exactly five questions with manuscript-backed evidence. Validate 3/3 pass, 2/3 fail, retry, missing/expired/duplicate attempts, rewards exactly once, anon denied, and unchanged preview/release gates.
6. Generate questions for pre-existing approved chapters with admin retry where needed; inspect outputs.
7. Consolidate into a verified RC with other authorized Main fixes, then publish exact OTA only after release gates; verify exact deployment runtime and device/app minimum support.
8. Only after supported old clients are retired, enable quiz enforcement in a separately verified backend change; turn off timer bypass. Do not mistake schema migration for an OTA.

## Evidence / known blockers
- 33 focused source-level contract checks passed on the isolated branch on 2026-11-11. This is **not** a TypeScript compilation, SQL execution, model-output verification, or Android test.
- Package is registered under `.buklod/scopes/kl-auto-reading-quiz-consolidated-ota-20261111.json` for selective inclusion in ONE consolidated Main OTA.
- Owner explicitly waived actual-device verification. Do not waive backend safety/typecheck/RC compilation gates.
- Vercel status on a prior DEV commit returned `build-rate-limit`; this is not a passing compilation.
- OpenAI key availability and model API response have not been confirmed.
- Production Supabase remains unchanged by this work; GitHub branch only.
- Correct Expo Main runtime is `1.3.2` per `app.config.js`, app version `1.3.6` source; no new native dependency is introduced.
- Do not trigger Vercel CI/build for this task: the new feature uses the Main Expo runtime plus Supabase only.
