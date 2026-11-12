# BUKLOD SALIKSIK — Authoritative Product, Learning, Security and Release Contract
**Contract:** SALIKSIK-R1, 2026-11-12. **Status:** DEV specification; NOT production authorization.
**Owner objective:** System Admin uploads original manuscripts to a private vault. BUKLOD converts approved content into evidence-grounded, continuously developing, interactive Biblical investigations in Cluster Home with trustworthy adaptive comprehension and non-farmable points.

## 0. Authority and precedence
1. This file is the implementation source of truth for SALIKSIK. AGENTS.md, current canonical Supabase permissions, privacy controls, protected-feature lock, and DEV→verified RC→production OTA remain binding. A conflict must block release, not silently weaken rules.
2. Original manuscript is preserved unchanged and private. User-facing guided investigations are derivatives, labeled clearly as author interpretation and source evidence; quotations from third-party publications require source attribution, not unverified verbatim model claims.
3. No direct public upload/write to privileged content, grading keys, published status, or BUKLOD points. No independent payout formula, second economy, or unreviewed model decisions that issue points.
4. No AWS, no new paid infrastructure/project, and no automatically published content merely because an LLM returned parseable JSON.
5. The launch switch defaults OFF. A source code PR, migration file, or a successful test does not constitute a live launch.

## 1. Product placement / audience
- Entry: one compact **SALIKSIK — Tuklasin • Suriin • Unawain** card after important notice in **Cluster Home** if scope_type is CLUSTER and show_faith_content is true; not new bottom navigation, not drawer, not daily KL reading.
- The card is a doorway, not an extra dashboard request; investigation catalog fetch occurs only on open.
- Admin entry: **Admin → Formation & Content → SALIKSIK Knowledge Vault**, guarded in UI AND database by current active System Admin identity.
- Scope: published investigations centrally governed, learning progress keyed to person (and assessment attempt to member's active Cluster), original documents admin-only; normal members cannot view private manuscripts, hidden answer keys, rubric validators, or another member's answers.
- Members of different religious traditions may participate without forced agreement. The program has a disclosed Christ-centered author perspective; opposing views are represented accurately and respectfully, with no personalized religious persuasion algorithm, deception, or rewards for conversion/disparagement.
- Preserve all existing KL, Daily Bible, classroom, Wall, ads, notifications and points functionalities. IGPAT is retired; do not restore it through SALIKSIK.

## 2. Source-first authoring / provenance
**Source identity:** immutable original file, SHA-256, file size, MIME sniff, upload actor, timestamp, private storage path, document version. Reupload of same hash is duplicate-safe; changing content creates a new version, never silently changes a published exam.

**Admin upload contract:** DOCX / PDF / TXT; batch queue, up to configured safe limits, no executable archives, no untrusted active code. Store first; metadata commit second; orphan recovery; retry by idempotency key; content-addressed duplicate detection. No service key on Android/web client. The upload page shows clear statuses: UPLOADED → QUEUED → PROCESSING → DRAFT → REVIEW_READY → PUBLISHED or FAILED (retryable) / ARCHIVED. A failed analysis does not lose the original file.

**Extraction:** DOCX text/preserved paragraph order; TXT decoding; PDF embedded-text parser or supported AI document parser, scanned PDF OCR only if verified. Display coverage, missing text/figures, references and extraction warnings. If text cannot be verified, never auto-publish an evidentiary question. Files remain private in storage, even after a derived module is published.

**Generation:** Split manuscript by thesis and learning objective, not arbitrary page count. Generate discover/investigate/master draft content, target passages, evidence quote spans, alternate interpretations, explanation, common misconceptions, scenario transfer questions, evaluation rubrics, and remediation. Validate returned JSON schema, uniqueness, exact source quote overlap, reference existence, difficulty, attribution, unsupported conclusions, bias, and inappropriate personal attacks. Mark author claims as *interpretation*, biblical passage as *citation*, and any outside claim as *external evidence*.

**Publishing:** Default review required. Admin explicitly signs off on source fidelity and doctrinal representation; system may autonomously publish future revisions only if there is a previously authorized policy, deterministic verification, and source coverage verified. Rejected content remains draft. Every published investigation is immutable-versioned; correction is a new revision. Archived content never retroactively deletes legitimately awarded points.

## 3. Learning structure and adaptive logic
Collection → investigation (Discover +10; Investigate +20; Master +35) → checkpoint → optional Cluster discussion → independent final → retention check. Per-user long-term progress persists across sessions and releases. UI cards lazy-load detail; weak network queues drafts locally but **never grants points offline**.

### Five competencies / fixed weighting
- Understanding: 20%
- Evidence accuracy: 25%
- Context and interpretation: 20%
- Critical reasoning: 25%
- Transfer to unseen situation: 10%

Objective assessment v1: Discover requires 5 equally covered grounded questions and >=80% score; Investigate requires 10 questions, two per competency, >=80% overall AND at least 70% within each of Evidence, Context, Reasoning. This means an item set with 2 questions per core competency requires both answered correctly in each core competency. Questions are versioned, answer keys NEVER serialized to members. Shuffle/question selection is server-owned and snapshot-locked for the attempt. No score for merely opening a page or elapsed reading time.

**Master +35 is NOT payable based solely on objective MCQ performance.** Required before enabling this tier: 3 or more authored argument-and-objection tasks, passage-accurate citations, independently assessed explanation and transfer, threshold >=80 weighted score and >=70% on Evidence/Context/Reasoning, blinded/dual evaluation or calibrated human fallback for uncertain or contradictory AI judgments, an independent unseen variant, hard evidence-integrity checks, and a server-verified attempt. Until those gates are implemented and validated, master is non-published/non-rewardable, not deceptively presented as earned.

### Adaptation without lowering standards
Baseline diagnostic (not rewarded) determines teaching pathway, not final pass criteria:
- score <60: chunk reading, clear vocabulary, side-by-side verse context, worked examples, micro-check, explicit correction.
- score 60–79: focus on weak competency, alternating examples, response-specific feedback, practice cases and retake.
- score >=80: skip redundant remediation, present comparative reasoning, unseen transfer cases and independent mastery.
- high objective/low written reasoning: challenge explanation. Good reasoning/bad evidence: corrective textual analysis. Repeated misses: simplify instruction not threshold. Explain feedback with cited passage. Allow opt-out of adaptive personalization.
- All members face the same competency cutoffs, equivalent item difficulty, anti-bias controls, and skill coverage; never infer learning from denomination, gender, background, or identity.

Retention check recommended at 7/14 days with new equivalent items; low retention triggers review, not clawback of legitimate past points. Grade changes cannot silently modify historical completions.

### Evaluation fairness
AI is a supporting assessor and question author, not the final source of theological truth. Keep exact source snippets and variant Bible translation attribution; avoid anachronistic or out-of-context claims. Grade *evidence, context and logic* rather than agreement with the author. Require unknown, contradictory, low-confidence, malformed or unsupported AI output to fail closed with useful admin retry/quality queue. Provide user a reasoned feedback/appeal flow for qualitative grades.

## 4. Economy: exact earning logic
| Event | Once-per | Points | Requirements |
| --- | --- | ---: | --- |
| Discover | User + immutable investigation version | 10 | independently verified objective mastery |
| Investigate | User + immutable investigation version | 20 | >=80 plus three competency gates |
| Master | User + immutable investigation version | 35 | written, cited, audited mastery rubric; OFF until proven |
| Collection completion | User + immutable published collection version | 50 | all required investigations passed; once |
| Cluster contributions | User + qualified content + Manila calendar day | 5 | max 2 rewarded per day; non-duplicate, non-spam, deferred until community anti-abuse integration |

No rewards for attempts, opening, tapping, repeated reading, retry, skipped questions, misleading citations, model-guessable templates, or religious agreement. Do not double-credit KL +10 reading or KL +50 season/series for a SALIKSIK event. Use existing canonical buklod_points_ledger with unique (user_id, source_key) and existing claim_state/reward triggers; separate saliksik_* activity types. Reward insert and completed state must be transactional; two devices/retries must yield exactly one unique credit. System Admin OFFICIAL identity reward guard remains authoritative. QMP and AdMob-only distributions are distinct from raw points; do not imply PHP equivalents, payouts, or guaranteed earnings.
Cap tuning and promotion to Master must be approved against latest release-specific economic data; never generate uncapped points due to LLM output.

## 5. Data model / APIs (version 1)
- private storage bucket saliksik-source-originals
- public.saliksik_sources: immutable original pointer, hash, type, upload owner, processing lifecycle, error.
- public.saliksik_collections: manuscript-derived, versioned, author disclosure, draft/published state.
- public.saliksik_investigations: ordered content, objective/difficulty, source references, published status, version.
- private/public locked saliksik_question_keys: question bank, exact answer, citations/rubric; no member table access.
- public.saliksik_attempts: owner, active cluster scope, question-order snapshot, expiry, result and verification; no client direct writes.
- public.saliksik_mastery: unique user/investigation/completion and ledger link.
- public.saliksik_rollout: single false-default switch.
- Admin RPC: register upload, list sources, lock processing, save validated draft, publish, list QA.
- Member RPC: catalog, begin/restore, result/feedback, private own progress. Grading in authenticated server Edge using internal key; privileged settlement is service-role only and revalidates ownership/membership + immutable version.
- SQL RLS and explicit REVOKEs on all exposed tables and RPCs. Security-definer functions use SET search_path = '' and explicit qualification, current auth identity, and checks. Never grant service-role processing to a general member API. Do not rely on editable user_metadata claims.

## 6. Reconciliation / storage / reliability
- Reuse current BUKLOD Supabase, Expo, Gemini-powered generation and AdminGate patterns. Do not reuse KL publishing bucket or KL quiz table—different provenance and award semantics.
- Never expose provider API keys. Prompt injection in manuscripts, exam answers and PDFs is untrusted data; model cannot issue SQL, policies, routes or external network actions.
- Use upload checksum, immutable object name, idempotent metadata commit, and reentrant processing queue with lease/timeout, capped retries/backoff + dead-letter review; robust interruption recovery and stale-job fencing. Processing jobs separate from user-facing first paint.
- Limit size, type, pages, extracted chars, output tokens, concurrent generations per admin, and model cost. Compress/cache derived content; do not repeatedly call LLM at read time. No per-question online model request for objective exams.
- Protect privacy: no shared personal answers without consent, no publishing raw manuscript by accident, retention/deletion policy; audit admin access/publish changes; server timestamps Asia/Manila only where calendar-day rewards matter.
- Do not make app screens wait on AI, storage listing or progress telemetry to render. No new native packages unless unavoidable; OTA runtime 1.3.2 compatibility remains required.

## 7. Acceptance/release gates and measurable outcome
**Source:** all model-generated questions linked to an exact reviewed evidence span; no invented Bible quotes, no skipped denominational-context attribution; no hidden answer keys to non-admin.
**Security:** other user cannot read raw file or attempt; non-admin cannot upload, generate, publish or settle; one account cannot claim another's achievements; retry cannot duplicate reward.
**Correctness:** objective pass / fail and per-competency edge cases, 80% vs 79%, core dimension <70, incomplete/extra answer, expired attempt, double-click/races, repeat on second device, archived revision, rejected prompt injection.
**Performance:** cluster dashboard card immediate/no added network call; detail loads on demand, offline text cache, retries without points; no regression in Wall/video, ads, Connect/PTT, KL, Quiz, profile.
**Monitoring:** generation success/error by exact version, backlog age, model spend, question-review failures, active learners, pass/retention, repeated attempts, point issue and duplicate count.
**Rollout:** DEV branch → focused Node and SQL tests → typecheck and Expo export → verified RC + staging security and crash checks → approved production migration → production OTA on exact source/runtime → live Android/web verification. No environment switch or production migration without authorization and evidence.
**Success goals (not pre-existing metrics):** 100% verified published-source references; 0 duplicate credits; 0 unauthorized source reads; >=80 final standard; >=60% started→complete and >=40% 30-day return as monitored objectives.

## 8. Original manuscript content mapping
The uploaded **ANG PAGKADIOS NI JESUS.docx** (29 pages, working title *SINO SI JESUS?*) develops the author's view of Jesus as God and man. Topics: Savior (Isaiah 43 / Luke 2), eternal Word (John 1), Redeemer (Isaiah / 1 Peter), I AM (Exodus 3 / John 8), First and Last (Isaiah / Revelation), Creator (Genesis / Colossians), worship (Exodus / Hebrews / Philippians), Rock (Deuteronomy / 1 Corinthians), King (Psalms / Revelation), incarnation/human limitations (Philippians 2 / John 1), salvation through faith/grace (John 3 / Ephesians 2), and critical analysis of INC-related doctrinal claims. Do not collapse the last topic into a universal description of INC members or present the author's polemical allegations as verified third-party facts. Extract references verbatim and independently verify source translations before publication.
**DO NOT COMMIT THE USER'S PRIVATE ORIGINAL DOCX OR ANY PRIVATE SOURCE TEXT TO THIS PUBLIC REPOSITORY.**

## 9. Immutable scope/non-goals
Initial implementation can deliver a private admin vault, source-grounded objective draft pipeline, read-only Cluster Home doorway, Discover/Investigate protected grading and separate points. Remaining Master open-text double validation, OCR coverage, recurring background job scheduling, contribution points and content authoring expansion are **NOT** considered shipped until specific regression evidence and production tests exist. No hidden mock completion, manual promotion, or silent blanket autoplay publication to satisfy a deadline.
