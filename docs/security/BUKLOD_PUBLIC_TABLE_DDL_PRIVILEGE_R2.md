# BUKLOD Security R2 — public table privileges (12 Nov 2026)

## Verified production problem
All 542 existing public tables have RLS, but RLS does not apply to TRUNCATE. 368 tables granted TRUNCATE to anon; 380 to authenticated; TRIGGER and REFERENCES grants were similarly overbroad. This is **attack surface** rather than verified exploitation. Direct PostgREST table HTTP methods do not expose SQL TRUNCATE.

## Scoped fix
Remove only TRUNCATE, TRIGGER and REFERENCES from PUBLIC, anon and authenticated on public ordinary and partitioned tables, without touching normal read/write grants, role checks, RLS, table rows, financial flags, storage or server service privileges. Clean the postgres default ACL. Update the existing 15-minute private Security Operations scanner to flag future unsafe DDL-grade app role grants.

Provider-owned supabase_admin per-schema default privileges also grant DDL-grade rights and **cannot be safely modified using this postgres database identity** (not a member). Future tables created under that role may regain unsafe rights; existing scanner reports any reintroduction, and a provider-authorized admin must correct the default ACL. This limitation must remain a visible open item in the overall threat assessment.

## Verification evidence
Ran exact migration inside BEGIN/ROLLBACK on current production Supabase. The in-transaction assertions verified zero unsafe public DDL grants; retained authenticated notification UPDATE and member withdrawal SELECT plus service-role TRUNCATE. A second check after ROLLBACK showed original 368/380 grants restored. No deletion, TRUNCATE statement, app runtime change or production release occurred in this validation.

## Release
Source changes on DEV branch only until Engineering Accountability, QA, controlled PR merge and production migration activation; postdeploy SQL gate must pass. This SQL-only change does not require an Android OTA or Web deployment and should not trigger Vercel Classroom builds. Existing Security R1 DB operations and Finance V3 money switches remain unaffected.

## Recovery
If a legitimate server routine unexpectedly relies on one of these privileges as invoker, identify exact function/role, restore only the needed scoped privilege after security review, and update the invariant gate. Do **not** globally GRANT ALL or disable RLS to fix a single permission error. Never restore/delete real finance data to diagnose role grants.
