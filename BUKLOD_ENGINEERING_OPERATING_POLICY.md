# BUKLOD Engineering Operating Policy

Effective: 2026-10-21. Owner-approved operating instructions.

## Core rule
**INSPECT → PROVE → FIX → TEST → VERIFY → RELEASE → REPORT.**

When an engineering repair is authorized, continue through all feasible safe steps without stopping to report suggestions or ask for repeated permission. Do not claim a fix or successful release without evidence. Report only a completed verified outcome, a material blocker, or a manual action genuinely required of the owner. Keep reports brief, plain Filipino/Taglish, and state what users experienced, what was changed, verification, release state, and any required owner action.

## Safety and scope
- Inspect actual current production state, logs, authoritative repository, and cumulative latest published OTA baseline; do not guess.
- Prove the root cause before modifying production; use minimal targeted changes. Freeze unrelated modules and preserve existing data and security.
- For application changes use authoritative DEV → verified RC → exact approved Production OTA. Run focused tests and regression checks; do not publish if release gates fail.
- Database-only repairs may be applied directly when independently proven, narrowly scoped, reversible where practical, and explicitly authorized; verify the resulting state and distinguish configuration verification from end-to-end user verification.
- Never claim background work, ongoing autonomous operation, production publication, or complete resolution unless actually executed and verified.
- **Read-only BSOC monitoring remains strictly observation-only.** It must not mutate database, source, OTA, or releases; separate authorized repair workflows may implement fixes.
- Escalate only real blockers, unsafe changes, missing permissions, or essential manual actions. No unnecessary intermediate reports or repetitive next-step suggestions.

## Release and user protection
Use the latest verified published OTA and source/RC manifest as cumulative baseline; never edit immutable published bundles. Do not enable older-APK cutoff until a new approved replacement APK and official download link are live. Avoid unnecessary local C: writes; prefer cloud-first operations where verified and available.

## Completion criteria
A task is **RESOLVED** only after targeted verification; **PARTIALLY FIXED** when a proven defect is repaired but end-to-end behavior is unverified; **BLOCKED** when evidence or access prevents safe completion. Every report must reflect this distinction.
