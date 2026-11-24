# Integrated feature reconciliation — 2026-11-24
Integrated DEV baseline: eae3c55cb634f77196b13a3b264396c616a0a4a9
Parallel sources inspected: 090ff1efccaaa01a2e78cb2f32abfe6f6d4ed9a7 (gameplay/progression) and fd34a732a35349a76df1d703fe01172e54d0d59e (Sacred Stones/Kingdom). Neither branch had advanced from the previously reconciled heads. The core stones SQL was byte-identical to the source branch; progression SQL was identical before narrowing completed settlement to explicit casual/ranked. Recovered missing ArenaProgressionTests.cs from the gameplay branch. This is targeted reconciliation, not proof of exhaustive parity with every repo file or all MAIN changes.
| Area | Integrated evidence | Remaining acceptance |
|---|---|---|
| 13 heroes, 39 skills, hybrid RTS, waves, total elimination, wildlife, farming, mining, capture, villagers, paid recruitment, market and loot | OfflineBattle, catalogs, prior asset pipeline | Unity compile/play, full asset generation and art acceptance |
| Offline practice | Existing separate simulation path; no persistent BP/XP | Offline regression execution |
| Sacred Stones | Core 100 BP exchange, gift/trade, recipes, wishlist, requests, verified discovery/expedition/Kingdom hooks retained | Canonical account and BP verification, disposable SQL tests; actual online paid counter action not yet wired |
| Full online battle | AuthoritativeMatch, transport, tickets, lobby, snapshot decoder, connection and actor adapter | Live listener, authenticated control plane, actual 10-client play, complete scene/HUD including non-actor visuals |
| Progression | Existing graded XP/BP rules and separate Arena BP, canonical character checkpoint adapter | Role evidence/event normalization, Official exclusion audit, collusion/AFK adjudication, receipts UI, MMR |
| Match money/state | New private reserve/start/finish/abort online wrappers with one canonical match result | Durable host lease, reservation worker, replay verifier, transactional integration, actual SQL concurrency/rollback tests |
| APK | Separate offline test package configuration and artifact validator | Licensed Unity editor, complete assets, build modules, actual Android test and full online RC |
Existing MAIN Kingdom-facing React components are not copied into the standalone Unity app or reintroduced to MAIN; their hooks are retained as private candidates. No changes to MAIN production, live database, existing staging, OTA or APK.
The test_online_match_settlement.sql fixture uses mocked canonical dependencies only, not real Supabase authorization or Character System behavior. It is unexecuted. Use a disposable local database; do not execute on any live or shared backend. PostgreSQL, Unity and C# compilers were absent from the execution environment.
