# BUKLOD SALIKSIK — Authoritative Product, Learning, Security and Release Contract
**Contract:** SALIKSIK-R2, 2026-11-13. **Status:** DEV specification; NOT production authorization.
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

**Master +35 is NEVER payable solely through objective MCQs.** After all eight verified objective investigations, R2 publishes a ninth, written Master. The learner submits three DISTINCT 220–4000-character essays: thesis with precise citations, fair counterargument with evidence-based response, and transfer to an unfamiliar case. The active System Admin must personally validate citations against the original and surrounding Bible context, enter five competency scores, and provide 80–2000 characters of substantive feedback. A passing score requires >=80 weighted overall, evidence/context/reasoning >=70 each, and explicit citations_verified=true. The server alone decides approval; a score without verified evidence becomes REWORK with actionable feedback, NO credit. The reviewer cannot approve their own response, and the review decision is recorded with reviewer and timestamp. This is a **human-adjudicated** evidence-based release path, not autonomous AI essay grading or religious-agreement scoring. Member rollout is OFF until RC/prod verification.

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
| Master | User + immutable investigation version | 35 | all eight objective investigations; three written arguments; human-verified citations; weighted >=80 plus core >=70; one-time only |
| Collection completion | User + immutable published collection version | 50 | all **nine** published investigations (4 Discover, 4 Investigate, 1 Master) passed; once |
| Cluster contributions | User + qualified content + Manila calendar day | 5 | max 2 rewarded per day; non-duplicate, non-spam, deferred until community anti-abuse integration |

No rewards for attempts, opening, tapping, repeated reading, retry, skipped questions, misleading citations, model-guessable templates, or religious agreement. Do not double-credit KL +10 reading or KL +50 season/series for a SALIKSIK event. Use canonical buklod_points_ledger with unique (user_id, source_key), pending claim_state, and the existing member reward-event claim workflow. Points earned are NOT spendable until claimed. The RPC checks the active BUKLOD point rule's exact amount before any award; if paused or misconfigured, the entire attempted award rolls back and is not silently bypassed. For protection against guesses, allow at most 3 failed graded attempts per Asia/Manila calendar day and require 10 minutes of review after a failed attempt. Studying remains available while graded retry is paused. SALIKSIK Points do not themselves create QMP, cash balances, revenue, or AdMob-based payouts; do not insert into Finance/QMP tables. Separate saliksik_* activity types. Reward insert and completed state must be transactional; two devices/retries must yield exactly one unique credit. System Admin OFFICIAL identity reward guard remains authoritative. QMP and AdMob-only distributions are distinct from raw points; do not imply PHP equivalents, payouts, or guaranteed earnings.
R2's published collection is exactly 4×10 + 4×20 + 1×35 + 1×50 = **205 BUKLOD Points maximum** per user per immutable collection, assuming every stage and written rubric is verified; never bypass the approved Point Rule switches or confuse pending claim credits with available balances. Automated model calls never publish member credits. Changes to reward amounts require versioned policy, current financial review and focused regression tests.

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
Initial implementation provides eight investigations in four resumable two-investigation Admin calls, a private vault, optional Cluster doorway, objective grading and canonical Points. The Admin must keep the screen open during generation or resume manually; no unattended background scheduler is shipped. The written Master +35 is implemented as a human-reviewed, auditable rubric and separately tested in isolated PostgreSQL; **AI-written automatic grading, offline pending submission sync, OCR coverage, recurring unattended generation, retention scheduling, and Cluster contribution points** remain out of current scope and must not be represented as shipped. The user-facing feature remains disabled until runtime and production verification succeeds. No hidden mock completion, manual promotion, or silent blanket autoplay publication to satisfy a deadline.


## 10. R2 release reconciliation and auditable reward flow (2026-11-13)
1. Four resumable Admin generation batches produce 8 source-grounded draft investigations. Admin verifies each answer key and citation before publication.
2. Publication atomically creates one generic written Master (sequence 9). Member Catalog now displays 4 Discover, 4 Investigate, 1 Master, but the backend rollout remains OFF by default.
3. On each correct objective pass, the transactional RPC writes the unique `saliksik:<investigation-id>:v<version>` credit to `buklod_points_ledger`. Native trigger marks it pending and creates its existing reward claim event. Duplicate retry cannot credit twice.
4. Master submission is permitted only after 8 objectively verified parts; the three distinct essays are private and cannot be claimed by opening or auto-generated text. Only audited System Admin source-verification and structured weighted rubric can approve and write unique +35.
5. Final +50 is emitted ONLY when the ninth written Master is approved. The series award has its own unique source key. The System Admin official account remains excluded from member Points.
6. The canonical Finance/QMP AdMob settlement derives from separate qualified QMP activity accounts; BUKLOD SALIKSIK learning points do not automatically create QMP or cash revenue. No separate monetary record is written here.
7. CI must run R1 and R2 migrations in sequence in isolated PostgreSQL 17 and assert 205 pending Points and 10 distinct reward events, plus role-isolation and changed Node tests. SOURCE-only validation and green CI do not activate production.
