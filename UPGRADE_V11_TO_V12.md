# Upgrade v11 → v12

1. Apply:
   `supabase/15_pilot_operations.sql`

For the canonical CLI layout this is already added as:

`supabase/migrations/20260810011000_pilot_operations.sql`

2. For a fresh staging database, the updated `supabase/seed.sql`:
   - creates the `Leadership Pilot` cohort
   - requires active pilot access in staging

3. Replace/add the v12 `src/` files.

4. Restart/rebuild the staging app.

5. System Admin:
   - Admin → Pilot Operations
   - add current QA users to Leadership Pilot
   - verify runtime controls
   - verify feature flags
   - review feedback queue

6. Member:
   - Me → Send Feedback
   - Me → My Pilot Feedback
   - Me → What's New

## Important

If upgrading an already-running v11 staging database, the schema migration itself does
NOT automatically switch staging into pilot-only mode. That strict staging setting is in
the staging seed. Enable `Pilot Access Required` from Admin → Pilot Operations when your
current test cohort has been added.
