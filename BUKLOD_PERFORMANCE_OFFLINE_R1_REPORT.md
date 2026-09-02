# BUKLOD Performance + Offline Foundation R1

Generated: 2026-08-22 21:31:17

## Build decision

R1 installs the shared offline/performance foundation using packages already present in the BUKLOD project. No new native dependency was added.

## Current source inventory

- FlatList occurrences: 54
- FlashList occurrences: 1
- Supabase channel occurrences: 22
- subscribe occurrences: 22
- Supabase from occurrences: 478
- AsyncStorage occurrences: 130
- NetInfo occurrences: 5
- Heavy media references: 103
- React useEffect occurrences: 423
- Offline queue-related occurrences: 39

## R1 installed

- Shared persistent cache: src/lib/offlineCache.ts
- Shared controlled sync queue: src/lib/offlineSyncQueue.ts
- Backward-compatible upgraded NetworkProvider
- Global Offline / Syncing / Pending banner
- Request coalescer + shared FlatList defaults
- Local performance timing utility
- Explicit online-only policy for high-impact operations
- Automatic queue drain on reconnect/app foreground
- Queue concurrency limited to 2 by default, hard-capped at 3
- Queue replay requires explicit per-feature handlers

## Safety rules

Do not persist passwords, auth tokens, recovery PINs, payment secrets, face embeddings, or cryptographic material in the shared cache/queue.

Do not offline-replay role/admin changes, grade releases, locked-grade changes, billing, account-security changes, or other high-impact server-authoritative mutations.

## Next integration targets before production APK

1. Public Home / MZB Home cached reads
2. Community wall cached first page + low-risk draft queue
3. Personal Connect cached recent threads/messages + send-state handling
4. My BUKLOD/profile cached authorized read model
5. Classroom/Faculty cached rosters/assessment summaries/gradebook read views
6. Reports: offline draft only; submission remains server-authoritative
7. Attendance: preserve its existing working queue, then expose its pending count to the shared status layer
8. Realtime subscription dedupe/cleanup audit
9. Media lazy-load/pagination verification
10. Production offline/slow-network test matrix

R1 intentionally does not blindly convert every screen to offline writes in one patch.