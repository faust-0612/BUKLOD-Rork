# BUKLOD BSOC autonomous concern → investigation → DEV fix → member report

**Status (2026-11-19): Production BACKEND ADDITIVE QUEUE / FREE SCREENING ACTIVE; client UI stays DEV-only.** Supabase migrations `bsoc_ai_autofix_reports_v1` and `bsoc_zero_budget_scheduler_v1` applied to BUKLOD MAIN. The database triggers send member-only RECEIVED and REOPENED reports for future cases, and pg_cron `buklod-bsoc-zero-budget-screening-r1` screens up to 3 pending cases per 15-minute tick (0 paid inference calls). Existing 762 historical support records and all reward/Season 2 rules remain unchanged. Existing connected ChatGPT automation `6aff0416e0548191af432f4b7e7f80bf` runs hourly for deeper investigation / isolated DEV candidate repairs without paid API calls. No new app OTA, Edge Function, GitHub Action or client release was deployed. Do not describe DEV tests as real client verification.

## Data flow

1. **Live backend:** Additive `user_feedback` INSERT trigger creates a queue row **for future cases only** and an idempotent, owner-addressed RECEIVED report. Reopening a resolved case enqueues it again. No historical 762-case backfill and no status rewrite.
2. **Disabled, paid-path alternative:** The internal `bsoc-auto-triage-v1` Edge Function claims at most three cases at once with bounded lease/retry. Only service-role auth may invoke it. Unsafe auth, privacy, account, ID, money and moderation concerns go to NEEDS_HUMAN without AI-side actions.
3. With **both** explicit paid-inference approval and a configured OpenAI key, GPT reviews ONLY whitelisted technical signals/route/version. Raw member messages, identities, attachments and credentials are not exported. The result is advisory, never proof of a fix.
4. With a **separate explicit DEV dispatch flag** and a scoped GitHub dispatch credential, the backend emits a sanitized `bsoc_ai_triage` event to an isolated GitHub Actions workflow. Codex can modify only client/test files and opens a **draft PR to the dedicated DEV branch**. No production writes or OTA commands are present.
5. The backend reconciles DEV PR presence, then pre-existing audited BSOC fix tracking records. Only `VERIFIED_RESOLVED` tracking with a timestamp permits the matching final member report. A DEV PR or a quiet error chart is not sufficient.
6. Member reports are stored in `bsoc_ai_case_reports` with owner-only RLS, deduplicated by case/report_key, and delivered via the existing `bsoc_support` notifications → push and `/support/live?case_id=...` deeplink. The screen shows the private report history separately from chat without delaying chat rendering.

## Deployment gates (not yet completed)

- Verify actual production baseline, DEV vs RC diff, and separate Season 2 exclusions before applying the migration. This migration has not been run; the new Edge Function has not been deployed.
- Test migration on a non-production DB or in a rollback-only controlled sandbox. Exercise new, reopened, duplicate, anonymous, closed, cross-account, notification-failure, expired-lease and retry cases.
- Run Android/web functional tests for private report history and notification deep link; keep AdMob first-view, navigation latency, media lifecycle, auth and offline/weak-network regressions blocking.
- Verify member RLS, service-only RPC, private tables, JSON redaction, maximum queue depth, safe-key rate limits, token rotation and actual push receipts.
- Configure `BSOC_AI_AUTOFIX_ENABLED=true` **only** after the backend is verified. A scheduled worker or database webhook must invoke the function with the legacy service-role JWT (never expose it in the app). Do not publish any service key in GitHub Actions.
- Paid model invocation additionally requires `BSOC_AI_PAID_INFERENCE_APPROVED=true` and `OPENAI_API_KEY` in Edge secrets; use a bounded usage budget. With either missing, no paid inference occurs.
- DEV coding additionally requires `BSOC_DEV_REPAIR_DISPATCH_ENABLED=true` and `BSOC_GITHUB_DISPATCH_TOKEN` (restricted to the repository). The Actions workflow additionally requires an approved budget flag `BSOC_AI_PAID_ACTIONS_APPROVED=true` and `OPENAI_API_KEY` in GitHub secrets. **Do not enable until credits/costs are approved.**
- GitHub repository dispatch only runs automatically when the workflow exists on the default branch. A separate workflow-only activation commit may be needed AFTER security/CI review. This DEV branch alone does not activate the workflow.
- No staging/RC/production OTA, auto merge, finance changes, account changes or Season 2 enablement is performed by this implementation.
- For a production fix, retain the existing DEV → verified RC → production OTA gates; record exact release reference/version/deployment time, verification evidence and observed member recovery in existing BSOC fix tracking.

## Report semantics

| Report phase | What the member is told |
|---|---|
| RECEIVED | We accepted the concern; it is not fixed |
| INVESTIGATING | Investigation started |
| NEEDS_DETAILS | Exact missing reproduction steps requested privately |
| NEEDS_HUMAN | Sensitive/unclassified/failed automation needs support |
| TRIAGED | Preliminary technical investigation completed; not a fix |
| DEV_FIX_READY | A **draft DEV fix candidate** exists; not live |
| AWAITING_RELEASE_VERIFICATION | A release candidate is recorded but not verified |
| VERIFIED_RESOLVED | Independent BSOC record states actual release fix is verified; user can report recurrence |

## Current explicit blockers

No separately verified staging database/runtime, new Edge deployment, budget/credentials, standalone BSOC web integration, or fully exercised E2E repair-and-report test has been established in this session. The new ChatGPT hourly watch is operational as a safe fallback but cannot substitute for a real event-driven worker or a production service credential.

**Never** bulk-mark the existing 762 resolved cases as verified. Existing production cases and Season 1/2 points are left unchanged.


## Zero-budget path activated (2026-11-19)

- Production SQL *only*: two additive migrations are applied. An existing pg_cron facility runs `private.bsoc_ai_zero_budget_tick_v1(3)` every 15 minutes, without paid API, Edge network calls or GitHub CI. User-facing receipt is issued synchronously by a nonblocking SQL trigger on future case inserts. The scheduled worker does deterministic technical screening only; it MUST NOT be represented as GPT code repair.
- The separate ChatGPT hourly automation is enabled with instructions to investigate new/changed queue cases through connected GitHub/Supabase tools, isolate safe DEV edits and notify the owner of evidence/blockers. It cannot guarantee near-instant execution or complete coding-agent access every run.
- Members receive distinct private phases, including requests for details and a truthful DEV candidate notice only if a real PR exists. When independent audited `bsoc_case_fix_tracking` evidence for an actually deployed production release exists and the canonical case is resolved, the SQL worker can send VERIFIED_RESOLVED. No status updates to `user_feedback` are performed automatically.
- Verification performed: migration DDL + cron compile in rollback; synthetic technical, unknown and sensitive tickets yielded TRIAGED, NEEDS_DETAILS and NEEDS_HUMAN; duplicate receipt emitted one report and one notification (trigger-disabled rollback, no external push); authenticated account owner could read its own report while a stranger saw none; live no-backfill worker returned 0 cases and 0 paid calls; 762 historical case statuses unchanged; no added BSOC performance advisor findings. Internal queue intentionally has no RLS member policy (read privileges revoked).
- **Production runtime safety:** No EAS build, Android OTA, public website publish, agent-generated PR merge, autonomous prod source patch, or paid inference was executed. Member report history UI in `src/app/support/live.tsx` remains DEV-only until separate certified release. Notification Center uses the already existing `bsoc_support` notification type.
- **Zero spend caveat:** Reuses the existing Supabase project and pg_cron; resource usage, push egress and plan allowance must be watched, especially if the project is in a grace/overage state. This approach avoids intentionally buying any new credits or paid services, but cannot guarantee no incidental usage charges imposed by providers.
- **Remaining E2E gate:** a real member with consent must submit an actual case on a compatible app/build to validate push delivery, notification deep link, feedback acceptance on weak networks and private report display on the final installed client. No synthetic member pushes were sent in tests. 
