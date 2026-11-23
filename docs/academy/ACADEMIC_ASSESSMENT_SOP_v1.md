# BAHL-SOP-001 — Verified Assessment, UC, Awards and Learner Protection

**Status:** Pilot procedure draft | **Version:** 1.0 | **Quality owner:** Founder/Director acting as facilitator, curriculum designer and rubric controller; actual MZB designation to be documented.

## A. Approve curriculum and publish it safely

1. Identify existing canonical source lesson ID; compare the intended doctrine/practice with the published BUKLOD curriculum. Never introduce new required lessons to satisfy the Academy's 53 tracks.
2. Founder/Director publishes auditable versioned learning outcomes, prerequisites, rubrics and accessibility options. AI can draft but cannot secretly revise the founder's published policies or canonical doctrine.
3. Check source ownership/licensing, data protection, originality and published status. Reject unlicensed or unverifiable quoted content.
4. Owner-controlled authenticated publication selects an effective version, archives the superseded source IDs and automatically checks that curriculum changes cannot create unverified awards.

## B. Assess and record competence

1. Trust authenticated, server-owned source IDs only. Enforce authorization/RLS and publication version at the source adapter, not a button press or client grade.
2. Evidence: correct user; published lesson/chapter/story; source ID/version; assessment result and rubric; review identity/time when necessary; unique event key. Incomplete submissions remain pending or return actionable REWORK feedback; no manual approval queue.
3. A server event idempotently settles UC into a distinct nonmonetary ledger. Preserve original BP, individual manual claims, QMP, ads, Character XP and other awards unchanged. Replays must produce no second credit.
4. Calculate eligibility recursively: UC threshold, all direct prerequisites and independent exact-source gates. Devotional+Word and SALIKSIK caps apply to qualifying UC under approved canonical policy where required. An unverified source or unpublished 105/106/107 gate blocks graduation regardless of total UC.
5. High-stakes SALIKSIK: independently check citations and exact context, originality, analysis and limitations against a published rubric; record a second check/decision and defense for advanced programs. Advanced research requires a second separately invoked automatic adversarial rubric check. If verification fails, return REWORK or retryable PENDING; no UC or manual grading queue. A model rating alone never bypasses independent source, competency, capstone/defense requirements.

## C. Issue and verify completion papers

- Only server-side authorized registrar creates an immutable award/evidence snapshot and issuance receipt; record credential ID, policy/catalog/source version, approved UC, artifact hash, issue time and issuer authority.
- Do not display 'digitally signed' or paste an unverified handwritten signature unless an actual authorized protected signing operation occurred. Printed authorized signatory name does not substitute for protected signing.
- Send completion paper + transcript to authenticated recipient, access-controlled private storage and minimal-consent QR verifier. Never publicly reveal child teaching photos, private papers, grades, birth date or sensitive membership data.
- Only completed certificate/diploma/bachelor's-level/master's-level programs receive academic completion papers, not each UC event or story reaction. PDF failures must be retried idempotently without duplicating the underlying award; qualification does not depend on downloading paper.
- Statuses are `PENDING_SOURCE`, `ELIGIBLE`, `ISSUED`, `HELD`, `REVOKED`, `SUPERSEDED`; use auditable reasoned corrections instead of hard delete/rewrite.

## D. Learner support, complaints, appeals and correction

- Offer concise explanations of 'What counted', 'What's missing', accessibility assistance and a protected appeal form accessible from the academy record.
- Complaint record: case number, member, category, date, disputed source/rubric, supporting evidence, responsible reviewer, acknowledgement, decision, learner notice and resolution timestamp. Prefer a reviewer independent from original decision.
- Set an owner-defined and automatically monitored SLA; proposed pilot: acknowledgement within five working days. No automatic penalty for filing an appeal.
- If a source error is deterministically confirmed, make an authenticated audited correction event to UC/credential history; no fabricated backfill. Follow-up must test whether similar historical learners are affected.
- Permit accessibility accommodations without bypassing the same learning outcome and core assessment requirements. Protect minors and sensitive research. Publish retention periods only after privacy/legal approval.

## E. Source-specific essential tests

1. Attempt duplicate approved Daily Reading: UC remains once; BP claim state unchanged.
2. Unapproved Word reflection: zero UC and no eligibility change; approve later: exactly one authorized UC event.
3. KL chapter without quiz or required comment: zero UC; on both verified: unique credit once.
4. ABaKa lesson unit mismatch, unpublished deep tier or noncanonical A–Z mapping: zero UC and detailed hold.
5. Formation 105 with missing official lesson or unauthorized 106 track: no advanced award.
6. Fake research citation or copied capstone: hold; no automatic master's paper.
7. Malicious member requesting another member's transcript/child evidence: authorization denied and logged.
8. Network retry, double submit and repeated PDF generation: at most one UC event and award per canonical key, existing signed artifact stable.
9. Old credentials remain verifiable after curriculum revision; revocations and corrected awards auditable.

**Operational rule:** No new production database object, Edge deployment, public Academy route or OTA is authorized by this procedure. A separate verified staging release must pass privacy, RLS, functionality, ad/navigation and source-completeness gates.

## F. Fully automatic academic operations

- Learner submits published assessment evidence; server performs authenticated source/policy checks, uniqueness checks, rubrics, idempotent UC settlement, prerequisite evaluation and issue/hold decisions without a person clicking Approve.
- SALIKSIK submission triggers `buklod-academy-research-ai-v2` automatically; a saved `SUBMITTED` or `REVIEWING` record resumes upon Academy reopen or explicit retry, not as a second submission. `REWORK` supplies precise AI feedback and allows revising the same research ID.
- High-stakes capstones invoke **two** separate automated model evaluations over authenticated canonical source excerpts. The lowest score applies, and disagreements return REWORK. This is not human peer-review or third-party plagiarism certification. Any service failure preserves pending work and awards zero UC.
- Admin research oversight screen is read-only. The removed manual review RPC must remain dropped/revoked; do not implement human per-learner points, grade or completion approval.
- Owner controls published policies and academic risk responses; monthly evidence-based management review is not an approval of individual students. When a source or model cannot substantiate a decision, prefer temporary no-credit + learner feedback over fabricated academic certification.
