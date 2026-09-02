# BUKLOD Performance Pass Report

**Date:** 2026-08-19  
**Pass type:** Safe app-wide optimization (Phase A–B + partial instrumentation)  
**Native dependencies added:** **NONE**

---

## 1. Changes made

- Completed repository audit (`BUKLOD_PERFORMANCE_AUDIT.md`).
- Applied high-impact, low-risk optimizations to navigation, scope selection, list tuning, and search debouncing.
- Added development-only performance helpers (`src/lib/performanceInstrumentation.ts`).
- Consolidated duplicate FlatList tuning on scoped community feed.

---

## 2. Files changed

| File | Change |
|------|--------|
| `BUKLOD_PERFORMANCE_AUDIT.md` | New — bottleneck audit |
| `BUKLOD_PERFORMANCE_REPORT.md` | New — this report |
| `src/lib/performanceInstrumentation.ts` | New — `__DEV__` timing + shared FlatList tuning constants |
| `src/providers/BuklodScopeProvider.tsx` | Optimistic `selectScope` (local state before async persist) |
| `src/app/notifications/index.tsx` | Navigate on tap before mark-read network work |
| `src/app/scope/index.tsx` | `ScopeConnect` loads immediately when search query empty |
| `src/app/(tabs)/messages.tsx` | FlatList tuning + Android `removeClippedSubviews` |
| `src/components/BuklodExclusiveScopeCommunity.tsx` | Unified FlatList tuning; removed duplicate props |

---

## 3. Performance problems fixed

| Area | Fix |
|------|-----|
| Navigation | Notification taps no longer block on Supabase update + unread refresh |
| Scope switching | Active scope updates synchronously; persistence runs in background |
| Scoped Connect search | No artificial 250ms wait on initial empty search |
| List scroll | Inbox + scoped community lists render fewer cells per batch |

---

## 4. Queries reduced/combined

- No new queries removed this pass (existing community broadcast debounce and foundation cache retained).
- Avoided duplicate scoped-community FlatList prop conflict (was applying tuning twice conceptually).

---

## 5. Rerenders reduced

- **Indirect:** Faster scope transitions reduce time spent on loading gates (`index.tsx` public Connect ready should resolve sooner when `activeScope` updates synchronously).
- **Deferred:** Inline `renderItem` in `buklod.tsx` and `BuklodExclusiveScopeCommunity` (Phase C).

---

## 6. Lists optimized

| Screen | Tuning |
|--------|--------|
| Messages — personal | `initialNumToRender: 12`, `windowSize: 7`, batch 8 |
| Messages — community rooms | Same inbox tuning |
| Scoped community (`BuklodExclusiveScopeCommunity`) | `initialNumToRender: 5`, `windowSize: 5`, batch 4, Android clip |

Public community (`buklod.tsx`) already had `PERF1_FLATLIST_COMMUNITY` — unchanged.

---

## 7. Images optimized

- No image pipeline changes this pass (`expo-image` usage already widespread).

---

## 8. Startup improvements

- Optimistic scope selection reduces blocking on reopen (`index.tsx` waits on `selectScope` promise, which now completes after local state update rather than network persist).
- Existing: `performanceBoot` silences prod console noise; foundation snapshot cache.

---

## 9. Navigation / tap improvements

1. **Notifications:** `router.push` runs immediately; mark-read is async.
2. **Organization workspace:** `selectScope` no longer awaits server persist before updating React state (navigation follows faster).
3. **Scope Connect member list:** Initial load without debounce when query is empty.

**Preserved:** Auth gates, compliance redirects, scope validation errors before state update.

---

## 10. Cleanup / memory fixes

- No new leaks introduced; existing channel/timer cleanup patterns unchanged.

---

## 11. Existing native capabilities used

- React Native `FlatList` tuning
- `Platform.OS` for Android `removeClippedSubviews`
- Existing `@shopify/flash-list` in `package.json` — **not adopted** this pass (variable-height feed rows; needs row height strategy)

---

## 12. Native dependencies added

**NONE**

---

## 13. TypeScript / test results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | **PASS** (clean after fix for duplicate FlatList attrs) |
| Introduced errors | None |
| Pre-existing errors | None observed in this pass |

`npm test` not run (not required for this pass; Jest config excludes `src/app/`).

---

## 14. Remaining performance opportunities (Phase C+)

| Priority | Item | Risk |
|----------|------|------|
| HIGH | Memoize / extract community feed row in `buklod.tsx` | MEDIUM |
| HIGH | Memoize scoped feed row in `BuklodExclusiveScopeCommunity` | MEDIUM |
| MEDIUM | FlashList for public community with estimated item sizes | MEDIUM |
| MEDIUM | Extract `BuklodConnectThread` message row + stable `renderItem` | MEDIUM |
| MEDIUM | Defer Stream video prewarm until Connect/messages focus | MEDIUM |
| LOW | Lazy import heavy screens (reels, bible) on first navigation | LOW |

**Not changed (documented only):** Provider tree depth, `BuklodConnectThread` realtime volume, reels video pipeline.

---

## 15. New native build required

**NONE** — JavaScript/TypeScript-only changes.

---

## Verification suggestions (manual)

1. Tap notifications → target screen opens immediately; read state updates shortly after.
2. Join organization → workspace opens without waiting on scope persist network.
3. Scope Connect tab → member list loads immediately with empty search.
4. Scroll Messages inbox and org wall on Android — smoother long lists.
5. Confirm scope still persists across app restart (background `setBuklodActiveScope`).

---

## Audit reference

Full bottleneck catalog: `BUKLOD_PERFORMANCE_AUDIT.md`
