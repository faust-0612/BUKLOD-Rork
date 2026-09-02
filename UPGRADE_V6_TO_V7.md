# Upgrade v6 → v7

1. Run `supabase/11_member_care_directory.sql`.
2. Optionally run `supabase/12_member_care_seed.sql`.
3. Replace/add the v7 `src/` files.
4. Restart Expo.

## Test

Member account:
- Church Life → Church Directory
- Me → Directory Privacy
- hide/show mobile, birthday, household, ministries
- verify another member sees only allowed fields

Pastor/local admin:
- Admin → Member Care
- open a member
- add private pastoral note
- verify ordinary member cannot retrieve it

Visitor workflow:
- Admin → Visitors & New Members
- create visitor
- record consent choice
- advance journey
- assign follow-up
- verify assigned leader sees their notification

If starting from scratch, run SQL 01 → 12 in order.
