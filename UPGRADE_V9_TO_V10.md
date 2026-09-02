# Upgrade v9 → v10

No new database production migration is required in v10.

1. Keep v9 migrations through `14_production_hardening.sql`.
2. Copy the v10 testing/QA files.
3. Follow `BOOTSTRAP_SDK57.md`.
4. Run:
   - `npm test`
   - `supabase test db`
   - `npx expo-doctor@latest`
5. Build preview binaries.
6. Run the Maestro smoke flows.
7. Execute all P0 rows in `qa/TEST_MATRIX.csv`.
8. Replace the v9 privacy placeholders before any real-member pilot.
9. Start Phase 0/1 in `qa/PILOT_ROLLOUT.md`.

The v10 release gate intentionally blocks launch while privacy placeholders remain.
