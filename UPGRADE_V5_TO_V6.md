# Upgrade v5 → v6

1. Run `supabase/09_church_life.sql`.
2. Optionally run `supabase/10_church_life_seed.sql`.
3. Replace/add the v6 `src/` files.
4. Restart Expo.
5. Test with separate accounts:
   - member
   - group leader
   - pastor/local admin
   - system admin

## Test sequence

1. Admin → Church Life → Create Event
2. Member → Home → Church Life → open event
3. Member RSVP
4. Event manager → Attendance → enable self check-in
5. Member enters check-in code
6. Event manager verifies attendance
7. Admin creates ministry
8. Add ministry membership / serving assignments using database/admin workflow
9. Member → Church Life → My Ministries
10. Create church announcement and verify member can mark it read

If starting from scratch, run SQL 01 → 10 in order.
