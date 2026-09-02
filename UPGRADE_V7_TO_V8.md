# Upgrade v7 → v8

1. Run `supabase/13_reporting_analytics.sql`.
2. Replace/add the v8 `src/` files.
3. Install native export packages:

   `npx expo install expo-file-system expo-sharing`

4. Restart Expo.

## Test

Group leader:
- Me → Reports & Analytics
- select assigned BUKLOD group
- verify group report loads
- verify another unmanaged group is denied by the database

Pastor/local admin:
- Church report
- Compare BUKLOD Groups
- export member engagement and attendance

System admin:
- System report
- Compare Churches
- Admin → Monthly Reports
- generate current-month snapshot

Privacy:
- verify report exports contain counts/participation, not private reflection text,
  prayer-request text, or pastoral-care note text.
