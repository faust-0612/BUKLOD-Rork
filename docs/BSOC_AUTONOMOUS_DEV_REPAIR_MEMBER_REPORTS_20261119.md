# BUKLOD BSOC autonomous concern → investigation → DEV fix → member report

**Status (2026-11-19): DEV SOURCE ONLY.** Nothing in this branch is deployed to BUKLOD production, database, Edge runtime, installed Android clients, or public web. Season 2 stays frozen. Do not treat a pull request or ChatGPT response as deployed proof.

## Data flow

1. Additive `user_feedback` INSERT trigger creates a queue row **for future cases only** and an idempotent, owner-addressed RECEIVED report. Reopening a resolved case enqueues it again. No historical 762-case backfill and no status rewrite.
2. The internal `bsoc-auto-triage-v1` Edge Function claims at most three cases at once with bounded lease/retry. Only service-role auth may invoke it. Unsafe auth, privacy, account, ID, money and moderation concerns go to NEEDS_HUMAN without AI-side actions.
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
