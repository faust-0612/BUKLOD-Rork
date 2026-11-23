# BAHL-ISO-TRACE-001 — ISO 21001:2025 Educational Quality Control Matrix

**Status: DOCUMENTED ALIGNMENT DRAFT — NOT A CLAIM OF ISO CERTIFICATION OR VERIFIED CONFORMITY.**  
**Authority:** MZB Ministry Inc. (human executive and independent academic approvals pending).  
**Scope:** Non-formal BUKLOD Academy of Higher Learning programs using existing BUKLOD app learning systems.  
**Standard:** ISO 21001:2025, published July 2025; the standard must be obtained and reviewed clause-by-clause before a formal conformity decision.  
**Audit support:** ISO/PAS 25171:2026 may be consulted for audit methodology.

## ISO quality is a behavior to demonstrate, not a logo to display

A curriculum, test suite and quality manual are a **design**. The EOMS is only working when authentic learners complete approved modules, teachers/reviewers apply consistent assessments, source evidence and documents remain controlled, complaints and appeals are decided fairly, audit findings are corrected, and MZB leadership reviews real results. This pack intentionally prevents claiming 'ISO-quality guaranteed' while those controls are unproven.

## Clause-family traceability

| Area | Locally defined BUKLOD control IDs | Technical/operating evidence | Missing proof today |
|---|---|---|---|
| 4: Organization and context | CTX-01 to CTX-04 | Academy scope, stakeholder needs, risk and source-to-award process map | Signed scope, user consultation, risk baseline |
| 5: Leadership | LDR-01 to LDR-04 | MZB executive, competent independent academic review, accessibility ownership | Formal appointments and approved policy |
| 6: Planning | PLN-01 to PLN-03 | Measurable objectives, risk register, safe curriculum change approvals | KPI results, planned risk action results |
| 7: Support | SUP-01 to SUP-06 | BUKLOD shared infrastructure, staff competence, rubric QA, accessible communication, controlled files | Quality/reviewer training, measured resource sufficiency |
| 8: Educational operations | OPS-01 to OPS-12 | 53 pathways, 14 learning families, 16 competencies, UC source integrity, privacy, research and awards | Complete source validator tests, published/approved syllabi, sampled real awards |
| 9: Performance evaluation | EVAL-01 to EVAL-05 | Feedback, satisfaction, complaints, internal audit and management review | Real pilot learner data, independent audit and signed MZB review |
| 10: Improvement | IMP-01 to IMP-02 | CAPA register, reviewed fixes, rerun of relevant tests and effectiveness checks | Completed corrections and effectiveness evidence |

This is **an internal alignment matrix**, not a verbatim reproduction or certified interpretation of ISO's normative clauses. Each control row in `src/data/academy/bahlIso21001ControlRegister.json` defines an accountable role, expected objective evidence and verification fields. Detailed subclauses and applicability decisions are deliberately held for authorized review of the licensed standard; no requirements are silently declared exempt.

## Baseline reconciliation (24 November 2026)

- Current source catalog: 53 independent completion pathways, with exact threshold, prerequisite and source gate. No extra source lessons introduced.
- 14 module families: Daily Reading, Word, Bible Reading, Children's Story, Kingdom Library, four ABaKa tiers, four Formation levels and SALIKSIK. Only the first source bridge subset has DEV work; 'DEV_VERIFIED' in a source registry means developer-side checks, **not external ISO verification or production availability**.
- Learning competencies: 16 traceable domains; status remains planning/partial until exact published lesson and rubric/assessment evidence are verified.
- First learner cohort recommendation: C-S01, C-D01 and C-F01 with human curriculum approval, published source version, verified learner evidence and learner feedback.
- Existing Academy database migrations are feature OFF and not on live MAIN. No real audit or management review records were asserted.

## Required proof chain

`source lesson approved -> current rubric/pass criteria -> authenticated published content -> actual verified learner output -> unique audited UC -> independent academic prerequisite evaluation -> protected issuer receipt -> learner access and appeals -> objective KPIs -> impartial internal audit -> signed management review -> corrective action effectiveness`.

For **each required control**, mark `VERIFIED` only after adding an accepted evidence record with URI, SHA-256 digest, reviewer, approval date, publication/source version and privacy classification. No personal data in public GitHub. Evidence can live in protected BUKLOD storage or a restricted authorized register; reference only non-sensitive opaque IDs/URIs in the code. Never mark a control verified because a document template exists.

## Least-cost execution (without registration)

1. **Design (complete as draft):** keep this register, curriculum crosswalk, quality manual, assessment SOP and standard naming disclaimers under version control; test structure for drift.
2. **Govern:** formally assign MZB Academic Quality Lead, reviewer/auditor, learner-support and privacy roles. Approve quality policy and EOMS scope.
3. **Prove three pilots:** compare actual approved lesson IDs and grading rules; run identical competency checks, dup/forgery negative tests, accessibility reviews and confidential appeals.
4. **Measure actual outcomes:** track only protected aggregate/authorized learner evidence; reject absent or unverifiable sample results. Record real complaints and completed corrective actions.
5. **Independent internal audit and executive review:** impartial audit of actual operating evidence and sign management review with dated actions.
6. **Formal clause check:** compare with actual ISO 21001:2025 edition and decide scope applicability; if every applicable requirement has valid evidence, a certification body can later audit. **No certification application is required to operate the EOMS.**

## Automated gate behavior

`node scripts/academy/iso21001-readiness-check.mjs` validates the **structure** and prints explicit blockers without failing due only to missing operational proofs.  
`node scripts/academy/iso21001-readiness-check.mjs --strict` **fails closed** until every applicable control has authentic, approved, current objective evidence, executive designations, a performed internal audit and management review. The strict gate is a readiness aid, **not proof of conformity or a certification decision**.

**Never** deploy academic backend migrations to live MAIN simply to make the register green. Production boundaries and existing AdMob/navigation regression gates remain independently mandatory.

## Official reference pages

- ISO 21001:2025 standard information: https://www.iso.org/standard/21001
- ISO/PAS 25171:2026 guidance for audits: https://www.iso.org/standard/89230.html

## Owner-controlled automation amendment (24 November 2026)

Owner is the actual Academy human oversight/facilitator, educational designer, controller and author of rubrics, **not** the person who must approve each learner. Source validation, grading, research review, UC accounting, credential eligibility, feedback and safe retries are automatic. Academy admin only monitors status and controls versions/policy. Audit-log entries demonstrate genuine events; no AI or owner self-audit may be passed off as an independent ISO audit. Genuine management review remains institutional accountability and does not create a student approval queue.
