# BUKLOD v15 — Production Cutover Package

v15 packages the existing BUKLOD 1.0 system for controlled production deployment.

It intentionally does not claim that:
- production Supabase has already been created
- EAS production credentials have already been configured
- privacy placeholders have been verified
- app-store review has been completed
- production has already gone live

## Main production safety change

Staging and production seeds are now explicitly separated.

`supabase/seed.staging.sql`
contains local/pilot content.

`supabase/seed.production.sql`
contains only a minimal production runtime baseline and leaves Maintenance Mode ON.

## Recommended final sequence

1. Finish privacy/legal/controller details.
2. Pass v14 Command Center gates.
3. Create/link production Supabase.
4. Configure production EAS variables.
5. Run production preflight.
6. Review migration hashes.
7. Run migration dry-run.
8. Apply production migrations without staging seed.
9. Bootstrap first production System Admin.
10. Add verified live churches.
11. Apply reviewed production baseline.
12. Deploy Edge Functions/webhook.
13. Smoke test under Maintenance Mode.
14. Build/register exact production Release Candidate.
15. Complete store/privacy checklists.
16. Record GO LIVE with written rationale.
17. Disable Maintenance Mode.
18. Monitor first 24 hours.

The authoritative operational guide is:
`production/PRODUCTION_CUTOVER_RUNBOOK.md`.
