# Upgrade v13 → v14

1. Apply:
   `supabase/17_go_live_command_center.sql`

Canonical migration:
`supabase/migrations/20260810011200_go_live_command_center.sql`

2. Replace/add v14 app files.

3. Restart/rebuild staging.

4. System Admin:
   - Admin → Go-Live Command Center
   - register current Android preview as a Release Candidate
   - open Readiness Checks and attach real evidence
   - log known P0/P1 defects as Pilot Incidents
   - review pilot/support metrics
   - record HOLD / CONTINUE PILOT / READY FOR FINAL SIGNOFF as appropriate

5. Do NOT mark checks PASS merely to make the dashboard green.

6. Read:
   - `qa/PRODUCTION_CUTOVER_CHECKLIST.md`
   - `qa/ROLLBACK_INCIDENT_RUNBOOK.md`

v14 does not automatically authorize production launch. It creates an auditable
operational decision process.
