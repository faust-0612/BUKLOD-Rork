BUKLOD Daily Bible Reading Module

Files included:
- supabase/migrations/20260810014100_daily_bible_weekly_ui_support.sql
- src/app/bible/index.tsx
- src/app/admin/bible/index.tsx
- src/app/admin/bible/monitor.tsx
- apply_patch.ps1

From the BUKLOD project root:
1. Extract this ZIP into the project root, preserving folders.
2. Run:
   powershell -ExecutionPolicy Bypass -File .\apply_patch.ps1
3. Verify TypeScript:
   npx tsc --noEmit
4. Dry-run migration:
   npx supabase db push --dry-run
5. Push migration:
   npx supabase db push
6. Restart Metro if needed:
   npx expo start --dev-client --port 8082 -c

The current BUKLOD Points rules already map approved Bible Reading to daily_bible points.
The weekly UI uses date filtering; old weeks remain in history and are not deleted.
