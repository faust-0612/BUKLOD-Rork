# BUKLOD verified-root-cause prevention lock (R1)

Status: **APPROVED POLICY / NOT YET IMPLEMENTED AS A GLOBAL RELEASE GATE**.

## Authority and scope
- The approved functional baseline is the **verified currently live production APK + cumulative OTA and live web deployment**, not historical R31/R40 hashes or GitHub main by assumption.
- Isolate every change to its confirmed failure domain. Keep unrelated live behavior frozen.
- Correlate simultaneous failures in Character, photos, storage, ads, accounts, and other features across PostgREST, Auth, Storage, database and client logs before creating separate patches.

## Mandatory incident workflow
1. **Detect:** collect timestamp (UTC), affected user/session state (redacted), request/response status, module, network state, backend project and release fingerprint; never log tokens or private payloads.
2. **Correlate:** check whether multiple modules failed in the same interval and share session, JWT, PostgREST, storage, RLS or connectivity dependencies.
3. **Verify root cause:** distinguish confirmed evidence from hypotheses. Do not grant anon access or weaken RLS to suppress permission errors.
4. **Fix:** make the smallest change against the verified live cumulative baseline in isolated DEV. Implement bounded recovery for transient errors; do not endlessly retry permission errors.
5. **Prevent recurrence:** add a reproducible regression test and a CI gate for the specific confirmed root cause, plus safe telemetry/alerting. Document the test's failure-before/fix-after evidence.
6. **Release:** inspect diff; run focused tests and mandatory production safety gates; freeze exact verified RC; publish only that RC via approved DEV → RC → Production OTA. No automatic publish if blockers remain.
7. **Confirm:** verify affected behavior on real installed runtime and backend after release. Declare FIXED AND LOCKED only after all checks pass.

## Incident 2026-10-22 UTC: Character + cross-feature permission failures
- Postgres logs show clustered `permission denied` across Character RPC, claims, addresses, themes, health events, recovery commands and ads operations around 18:37–18:38 UTC.
- Character RPC has EXECUTE for authenticated and not anon. Its exact failure trigger is **not yet confirmed**. Photo restoration timing is a user observation, not proof of the same cause.
- Character session guard DEV PR #278 is a candidate mitigation, **not** a verified global fix.
- Do not alter production grants or claim permanent prevention until client request auth context, corresponding backend logs, and regression tests confirm the cause.

## Release gate record
For each incident record: root-cause evidence; baseline release IDs; scoped diff; regression test; CI result; RC fingerprint; OTA publication ID; device verification; rollback strategy. Missing evidence = HOLD.
