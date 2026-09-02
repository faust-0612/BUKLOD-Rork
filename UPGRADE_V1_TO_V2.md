# Upgrade v1 → v2

If you already ran v1 in Supabase:

1. Keep your current database.
2. Run only:
   `supabase/04_onboarding.sql`
3. Replace the app `src/` folder with v2.
4. Rebuild/restart Expo.
5. Create test accounts for:
   - member
   - group leader
   - pastor/local admin
   - system admin
6. Test the full approval workflow in staging.

If starting from scratch, run SQL files 01 → 04 in order.
