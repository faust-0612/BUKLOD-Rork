# BUKLOD Quiz — Source-Grounded Assessment + Fair Integrity R1 (DEV, 29 Oct 2026)

**Release gate:** SOURCE-ONLY. Never deploy or modify active scores while students are taking an exam. This branch is neither RC nor production. No native build, OTA or web deploy is needed for this backend work.

## Forensic baseline (read-only verification)
- Seven `STARTED` attempts existed in the latest check; 16 live sessions reported `LIVE`, some possibly stale.
- Event telemetry includes thousands of `CONTEXT_MENU_ATTEMPT`, `COPY_ATTEMPT`, `WINDOW_BLUR`, app backgrounds and returns. Counts are **not** proof of cheating.
- Configured owner deduction rules currently enable 1 point per `CONTEXT_MENU_ATTEMPT`, 2 per `COPY_ATTEMPT`, 2 per developer-tools shortcut, 0.5 per app-background, etc.; `WINDOW_BLUR` is excluded.
- The live `buklod_quiz_integrity_deductions` table returned zero rows in the audit. Therefore there is no verified applied deduction record from that table at the time of inspection.
- `Integrity 335` on the live faculty card is a **canonical signal count**, not a score, integrity percentage or verified guilt. Current canonical RPC groups departure events within five seconds, but raw copy/context-menu events still count individually.
- Existing Auto Set v3 can populate deductions and recompute even released scores if staff invoke it, so **do not activate Auto Set without reviewing each event**. It has not been replaced in production.

## Lecture-grounded board-style exam engine

The checked-in `supabase/functions/buklod-quiz-pdf/index.ts` is a source snapshot of the currently untracked dedicated Quiz Edge Function, upgraded as a candidate only.

1. Require instructionally important lecture concepts; exclude source activities, pre/post-tests, worksheets, sample questions and answer keys. Never output stems referencing an activity number, uploaded page, lecture notes or source document.
2. Choose an explicit cognitive blueprint according to selected Easy/Medium/Hard/Mixed level. Emphasize application, analysis, interpretation, prioritization and judgment. A complicated sentence does not constitute higher-order thinking.
3. Multiple-choice questions must have four parallel, credible alternatives with **one defensible best answer**, plus an explanation of why the best alternative is preferable. Avoid `all/none of the above`, obvious answer length, and repeated templates.
4. Cases may be original, but all **knowledge used to solve them** must be explicitly covered by the lecture. Avoid outside protocols, local regulations, and obscure trivia.
5. Require a lecture quote (`source_evidence`), location and cognitive label for every generated item. For Word files, verify the quote against extracted text; for PDFs, the model's page reference is **not independently machine-verified** and faculty must inspect it.
6. Exclude duplicate and malformed items, wrong answer/option mappings, activity-source references, and ungrounded Word evidence; reject the entire batch if too few legitimate items exist. Candidate generator blocks live/paused rooms and **any prior non-void student attempt**; it rechecks both immediately before insertion, so faculty must clone an exam rather than silently altering an existing assessment.
7. Keep existing question-table shape/API. The source quote and cognitive label are appended to the faculty-viewable explanation; no schema migration is required to run the generator after QA.
8. Generated items remain **faculty-editable proposals**; faculty must inspect every answer key and citation before use. Existing UI determines final publishing; the Edge Function currently inserts `is_active=true` for backward compatibility, so the faculty gate must be checked before release.

### Independent quality acceptance before RC
- Generate ≥20 questions from a representative real lecture containing an embedded `Activity 1` and answer key.
- Manually inspect **every** question, its 4 distractors, answer, Word/PDF evidence, stated cognitive level and source coverage.
- Reject any item requiring external knowledge, activity copying, questionable single-best-answer semantics, ambiguous clinical priority or incorrect teaching.
- Verify Filipino/English/Taglish modes, mixed PDF/DOCX inputs, duplicate prompts, inactive sources, sparse lectures, 429/retry behavior and permission checks.
- Source validation smoke tests executed in an isolated JS runtime (six examples): clean MCQ accepted; unsupported evidence, activity references, all-of-the-above, mismatched correct answer rejected; legitimate medical phrase 'physical activity' accepted. Cognitive hard-level check rejects a 15-item recall-only set. **This is not a TypeScript build, end-to-end Gemini test, or production proof.**

## Honest integrity monitoring

**Observation ≠ Suspicion ≠ Verified misconduct.** Browser telemetry can indicate a key press, tab background, focus transition, copied text or capture signal; it cannot reliably distinguish a notification, accessibility action, OS popup, involuntary call, second device or actual cheating. Neither a 100% score nor rapid answers alone proves dishonesty.

| Event | Default treatment | Faculty-only point suggestion if independently verified |
|---|---|---:|
| Window blur, brief tab switch / notification, fullscreen or app background | Observation only; **0 automatic deduction** | 0 |
| Mobile long-press/context menu | Observation only; **0 automatic deduction** | 0 |
| Copy gesture | Review context; no proof data was extracted | Maximum 1 **per verified finding**, not per click |
| Developer-tools shortcut | Check device/platform and whether tools actually opened | Maximum 2 **per verified finding** |
| Screenshot/capture reported by client | Require independent corroboration; browser event does not establish an image exists | Maximum 2–3 **per verified finding** |
| Several departure signals within five seconds | Count as one **episode**, never stack duplicates | 0 by default |

The `supabase/pending/BUKLOD_QUIZ_FAIR_INTEGRITY_REVIEW_R1.sql` proposal creates a faculty-only, read-only RPC returning event grouping, reliability class, evidence caveat and **suggested maximum**. It never writes deductions. Suggested TOTAL default maximum: lower of **5 exam points or 5% of max score**, only after instructor confirmation and student chance to explain; faculty can choose zero. Preserve an audit trail of the reason, evidence, approval and any successful appeal. Do not alter grades during live exams, or retroactively punish prior attempts for false-prone signals.

**Important integration gap:** The standalone Quiz web app source is not in the authoritative BUKLOD-Rork repository. The live app still exposes the old Auto Set v3 and an inflated `Integrity N` label. To finish, the Quiz frontend must consume review suggestions, display raw vs canonical vs verified counts separately, offer student explanations/appeal, and require explicit manual approval before deducting. Replace/restrict the old Auto Set before safe public rollout.

## Intelligent assessment analytics

`supabase/pending/BUKLOD_QUIZ_ASSESSMENT_ITEM_ANALYSIS_R1.sql` adds a read-only, faculty-only RPC with:
- Latest graded attempt per student (avoid double-weighting retakes).
- Per-item percent correct and provisional upper-vs-lower-group discrimination with the item score removed from the comparison ranking.
- A review flag for uninformatively easy (>95%), unexpectedly difficult (<20%), or negative-discrimination items.
- Minimum 15 graded responses before interpreting discrimination. Small classes remain labeled low-sample, not unfit students.
- These metrics are **question-design diagnostics**, not proof of an individual cheating. Faculty should review lecture coverage, ambiguity, answer key and feedback before any equitable correction.

Longer-term classroom improvements: diverse item pools per outcome, randomized order/options, spaced formative quizzes, short answer justification, optional oral follow-up sampled across students, outcome-level feedback, and exam fairness/appeals. Use the same standards for every student; do not single out a high scorer based solely on suspicion.

## Verified checks and protected deployment path
1. Source baseline inspected directly from deployed dedicated Quiz and main Supabase Edge Functions. Candidate changes isolated to GitHub DEV.
2. Six deterministic validator cases and hard-level cognitive-level failure were checked in JS runtime.
3. Both SQL candidate SELECT bodies were parsed by Postgres `EXPLAIN` in the dedicated Quiz DB **without creating functions or changing data**.
4. **Not yet verified:** TypeScript/Deno full compilation, integration with Gemini + real PDF/Word, auth-gated RPC result calls, standalone Quiz UI, changed scoring, RC, production. The execution container is unavailable; there is no staging and ongoing attempts prohibit production deployment.
5. After all active exams end: restore a disposable test environment; validate source/UI, verify requested snapshot/migrations against both databases; freeze RC; deploy review-only backend; verify exam generation on a test exam; replace unsafe Auto Set/UI and confirm no unintended penalty; only then publish web production. Keep releases and grading audit independent; do not touch existing results without documented approved review.

## Cross-question / page reference gate (DEV addition, 31 Oct 2026)
- Every AI-created item must be self-contained even when the faculty uses K-of-N, shuffle, one-at-a-time, or pagination. A shared passage/case must be copied into a single question stem or represented by a future atomic stimulus-group feature; referencing another question number is invalid.
- A deterministic, source-shared validator (`questionIndependence.mjs`) rejects cross-item numbers, previous/next/above/below question or case references, hidden chart/table/passage references, uploaded page/slide references, and Filipino equivalents **before any item is inserted**. It checks prompt, MCQ options and explanation. Legitimate 'Which of the following' wording remains allowed.
- Prompt guidance now demands independent scenarios; the deterministic gate covers prompt noncompliance. Items that fail do not enter the question bank. If fewer than the requested number survive, existing generation behavior fails the whole batch rather than saving an incomplete exam.
- Dedicated regression source: `tests/quiz-question-independence.test.mjs` (24 cases for invalid/valid stems and hidden references). A lightweight JS evaluator of the exact committed matcher passed 24 of 24 checks. This does **not** constitute full Node, Deno, browser, real-document, or production verification.
- **Deployment status: DEV ONLY.** Live dedicated Quiz Edge Function is still `buklod-quiz-pdf` version 3; 18 rooms report LIVE/PAUSED and 22 attempts report STARTED on the 31 Oct read-only audit (some can be stale). Do not replace the production generator during those exam states. Current question banks and previous results are untouched. Deployment bundling must include both `index.ts` and `questionIndependence.mjs`; after tests, perform an RC verification and controlled dedicated Quiz Edge deployment, not Android OTA.
- Existing malformed items require separate examiner review, preserving historical attempt snapshots and published scores. The standalone Quiz web frontend remains outside this repository; future group-stimulus UI needs its own source/verification.
