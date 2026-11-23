# BUKLOD Academy of Higher Learning — minimum educational quality system (DEV)

**Owner organization:** MZB Ministry Inc.  
**Document set version:** BAHL-EOMS-PILOT-1, drafted 2026-11-24  
**Status:** DRAFT / source reconciliation / legal and human governance approval pending. **Not ISO-certified and not a degree-granting accreditation claim.**

## Single-source-of-truth hierarchy

1. Official published source content and server-confirmed learning completions: Daily Reading, Word, Bible Reading, Children's Story, Kingdom Library, ABaKa, Formation 101–107 and independently verified SALIKSIK.
2. Academic progression, UC thresholds and 53 credentials: `src/data/university/buklodUniversityCatalog.json` (`BU-ACADEMY-5-DEV`). This controls numeric thresholds and prerequisites; **do not fork it into a second point wallet**.
3. Proposed curriculum-to-outcome mapping and 16 competencies: `src/data/academy/bahlQualityCurriculumFramework.json`; drafts do not establish competence by themselves.
4. Governance and audit instructions in this directory; records are created from real events and approvals, never manufactured during setup.

## Documents

- `QUALITY_MANUAL_v1.md` — scope, quality policy, interested parties, responsibilities, process map, resources, objectives and improvement.
- `CURRICULUM_MASTER_v1.md` — activity-to-competency crosswalk, three pilot syllabi, 53-pathway catalogue policy and source evidence gates.
- `ACADEMIC_ASSESSMENT_SOP_v1.md` — control of approvals, assessments, UC, credentials, research, complaints and accessibility.
- `RECORDS_FORMS_AND_AUDIT_v1.md` — compact forms for feedback, internal audit, nonconformities, corrective action and management review.
- `ISO21001_GAP_AND_RELEASE_GATE_v1.md` — truthful gap register and staged release criteria.

## Operating boundaries

- Academy academic credit (UC) is nonmonetary, automatic only upon independently verifiable source completion. Existing BUKLOD Points remain manually claimed individually; no claim-all and no ads-to-UC conversion.
- Do not create new mandatory lessons; do not award for views, taps, ads, points balances, streaks, unreviewed writing or unverifiable activity.
- Individual achievements do **not** get a diploma; completion documents are for verified academic program completions only, with authorized member transcript access.
- Production Supabase, production OTA, external accreditation and actual credentials are outside this documentation work. Keep existing academy `enabled=false` and require reconciliation, privacy, security, test and Android release gates before staging/production rollout.

## Zero-manual-approval operating policy

The Academy Founder/Director is the human facilitator, operator, standards author and institution-wide quality controller. All routine student evaluation and credentials are automatic based on real published, versioned source evidence, automated rubrics and audit logs. The admin research screen is a read-only monitor and **must not** call the retired `buklod_academy_review_research_v1` manual approval RPC. Failure returns actionable REWORK or retryable pending; no fabricated UC. This policy does not eliminate evidence-based independent auditing or management reviews for any future ISO conformity claim.

## Source safety corrections (24 November 2026)

- Learner REWORK drafts are resumed from the member-owned row and reuse the original research key, preserving feedback and enabling genuine correction without an admin approval queue.
- Concurrent first PDF requests and interrupted post-upload receipts can recover the existing immutable private PDF, validating its format and recording that object's SHA-256, not the losing request's digest.
- These are **DEV source corrections only**, not proof of deployed RLS, plagiarism screening, staging APK, or ISO conformity.
