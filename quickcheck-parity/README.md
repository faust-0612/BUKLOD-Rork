# QuickCheck Vercel parity staging

This folder is a staging copy of the last verified AppDeploy QuickCheck frontend, adapted to the canonical Supabase backend.

Purpose:
- restore the AppDeploy UI/UX and workflow exactly before BUKLOD Main web cutover;
- retain newer Supabase question-set unity and hard student-identity protections;
- keep source papers local-first and transient;
- keep teacher review, grade override, approval and release behavior.

Restored from AppDeploy:
- continuous camera scanner and stable-page auto-capture;
- local PDF/DOCX/image/folder import;
- failed/retry queue;
- optional teacher rubric;
- End-to-End Batch Report;
- clickable Report Inspector;
- Scan & Quality / Sorting & Identity / Grade & Record cards;
- clickable end-to-end status steps;
- review-flags-only workflow;
- per-student paper review;
- teacher grade editing;
- approval/release safety;
- saved Batch Records and reprocess.

Supabase additions retained:
- question-set identity is based on unity of questions/instructions/numbering, not title;
- explicit student name/ID is a hard identity boundary;
- canonical question sets persist across batches;
- secure Profile accessory handoff works without classroom binding.
