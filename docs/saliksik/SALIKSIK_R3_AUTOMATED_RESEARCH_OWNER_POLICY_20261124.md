# SALIKSIK R3 — Zero-required-Admin Research Workflow
**Owner direction:** 2026-11-24. **Scope:** product / engineering contract only on a DEV branch. **No runtime deployment, migration, or feature activation in this change.**
**Precedence:** This contract supersedes only the R2 assumptions that an Admin must upload a manuscript, start generation, review content, publish an investigation, or personally grade a Master response before an ordinary member can complete SALIKSIK. Preserve the rest of the R2 source, privacy, competencies, audit, and canonical Points contracts, plus the newer BUKLOD University academic evidence policy. Implementations must not claim R3 is deployed until independently verified.

## User journey: no Step 1 Admin preparation
1. **Member opens SALIKSIK and chooses or enters a research question.** Provide a catalog of versioned, automatically curated verified-source investigations. Optional ad hoc question enters a bounded generation queue and gets an immediately usable verified reference/study view; generation never blocks first paint.
2. **System automatically assembles evidence and the investigation** from existing authorized Bible passages, published BUKLOD 101–107, ABaKa/Formation and source references. Private owner manuscripts are OPTIONAL supporting materials, not a prerequisite. Never invent passages, translations, or copyright permission.
3. **Member investigates, writes and receives formative feedback.** Evidence navigator includes surrounding passage context, source identity, provenance, fair alternative readings, and distinguishing text facts from doctrinal interpretation. Support resumable study on weak networks; no reward while offline.
4. **System evaluates independently and gives an explainable result.** Objective grading stays deterministic/server-owned. Written research has separate evaluator and independent verifier using recorded rubric and exact authorized citation spans. Passing must meet established >=80% weighted overall and >=70% in evidence/context/reasoning; citation verification cannot be inferred from LLM confidence, fabricated references, similarity indicators alone, or agreement with doctrine.
5. **Server verifies and records completion** once, using versioned immutable evidence, anti-farming canonical BUKLOD Points ledger, manual *individual* member claims, and a separate internal BUKLOD University UC / program-completion decision when applicable. No cash/QMP change.

## Automatic generation / publication conditions
- Existing canonical indexed/source-licensed Bible passages and published learning material are the primary corpus. Manually uploaded private sources remain an OPTIONAL advanced admin tool, never a hard dependency for users.
- Background workers produce candidate modules off the member critical path; keep max-generation budgets, per-user creation quotas, retry backoff, idempotency keys, stale-lease fencing, task status, and duplicate-topic/version detection.
- Publication requires deterministic schema, cited-span match, cross-reference availability, question coverage/difficulty, answer validity, translation attribution, policy and anti-abuse checks, plus a separately run independent verifier. A model's self-assessment or syntactically valid JSON is **not** publication authorization.
- If verification is ambiguous, hallucinated, inadequately sourced, policy-sensitive, or unaffordable, **hold the candidate**; don't publish, grade as passed or award Points. The member can still use previously verified questions and reference reading. Human review is an exceptional owner-invoked governance option, **not** a universal approval step or required daily workflow.
- Do not turn every member question into a fresh billable model request; deduplicate/cache validated research modules, reuse curated reference views, queue bounded jobs, and never generate on Cluster Home render.
- The System Admin maintains rubrics, corpus rules, content correction/appeal oversight, quotas and audit visibility. No routine upload/generate/publish/approve gate.

## Automated written assessment / academic reliability
- Collect distinct thesis, fair counter-reading, and new-case transfer answers; defend research through adaptive follow-up questions when relevant. Require contextualized evidence and explicit source references.
- Run a format/provenance checker, a first evidence-grounded rubric evaluator, and an independent second adversarial checker on a frozen submission snapshot. Require agreement and verifiable spans; divergence leads to REWORK or HELD (never automatic credit), without making human sign-off mandatory.
- Store rubric scores, evidence spans, evaluator/verifier model/validator versions, feedback, status, immutable submission hashes, appeal/revision history and the event id linking to canonical Points or internal UC. LLM output cannot write privileged ledgers or credentials.
- High-stakes BUKLOD University awards require separate deterministic program prerequisites and independently validated academic evidence; the authorized issuer signing service controls authentic completion papers. Internal learning recognitions must not be represented as state-accredited degrees.
- Publish doctrinal perspective explicitly, present opposing readings fairly, and evaluate accuracy, reasoning and evidence rather than religious agreement. Private answers, source originals, hidden answer keys and other member records remain protected by RLS.

## Implementation delta from R2 (not yet shipped)
- Add an auto-research catalog/request flow and guarded background preparation API using approved canonical source IDs instead of requiring `saliksik_admin_lease_v1` / private document upload in the member journey.
- Add server-side publication eligibility ledger/dual independent verification and a HELD state with reliable fallback.
- Add verified, auditable automatic written Master assessment with a separate independent checker, and migrate away from the mandatory Admin review dependency in R2 SQL/Edge/UI. Do not bypass the old review gate by granting members Admin powers or writing directly to ledger tables.
- Extend tests for fake citations, poor source coverage, disputed readings, disagreement, duplicate requests, source revisions, cross-account RLS, two-device races, offline reward denial and cost/rate ceilings.
- Retain the existing SALIKSIK feature flags OFF until isolated backend testing, exact-source CI, staging RC, Android/AdMob/navigation regression checks, and authorized verified release. Do not apply R2/R3 SQL to production simply because the design changed.

## Acceptance of the intended behavior
- New member can start a verified-source investigation without Admin upload, Admin app session or Admin approval, even when generation service is temporarily unavailable.
- Background verified generation/publish does not block UI, and a fabricated or unsupported passage never reaches a paid/completed status.
- Independent written verification can pass a genuinely supported response, hold unsupported ones with actionable revision, without a mandatory human approver.
- BUKLOD Points remain pending individual claim and canonical/unique; University Credits remain distinct and derived from verified learning only.
- Existing Wall/Connect/KL/ABaKa/ads/rapid navigation, privacy and production runtime remain unchanged by this design-only DEV commit.


## Post-completion FULL manuscript benefit (owner approval 2026-11-24)
- The UI must show a locked **Complete Manuscript** card for each nine-investigation collection. Once and only once all nine immutable published investigations and final series mastery are server-verified for the signed-in user, enable **DOWNLOAD COMPLETE MANUSCRIPT**. Do not require a BUKLOD Points claim, Admin member approval, or a second award transaction.
- Prefer delivering the complete original manuscript **only when source redistribution rights have been explicitly confirmed for the source**. This one-time rights declaration is not a manual approval workflow for each learner; retain provenance/audit and do not expose originals for unrelated private uploads.
- For every fully qualified learner, even where the original must stay private, provide a complete downloadable compiled study manuscript of all **nine** published investigations, their full study text, ordered chapters, references, disclosure and version. Do not mislabel the compiled study as the author's unreleased private original.
- Generate/cache DOCX once per immutable collection/version; private bucket; short-lived signed URL only after server-owned completion/rights verification. No public storage policy or service-role secret on clients. Re-downloading remains possible for an authorized signed-in learner; expiry of a link requires a fresh authorization.
- Fail closed on missing series mastery, fewer than nine version-matched investigation completions, unpublished content, disabled rollout, invalid collection, source rights conflicts or revoked authority. Do not unlock through local progress state alone. Maintain the original BUKLOD Points ledger/individual claims and separate University Credits unchanged.
- Additional approved implementation tracked on `dev/saliksik-completion-manuscript-r3-20261124`. This source feature is **not** a live production rollout, and the broader R3 AI-auto-generation/automatic written grading remains separate unimplemented runtime work.
