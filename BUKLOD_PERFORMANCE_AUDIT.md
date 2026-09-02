# BUKLOD Performance Audit

**Date:** 2026-08-19  
**Scope:** Expo/React Native production app (`src/`)  
**Constraint:** No new native dependencies; preserve security and UX.

---

## Executive summary

The codebase already includes several performance passes (`PERF1`/`PERF2` community feed tuning, broadcast-based community realtime, foundation snapshot cache, `performanceBoot` prod console silencing). Remaining bottlenecks cluster around **deep provider stacks at boot**, **large monolithic screens**, **un-tuned long lists**, **navigation blocked on non-critical awaits**, and **inline list renderers** causing broad rerenders.

---

## 1. App startup

| ID | Severity | Issue | Files | Expected impact | Proposed fix | Risk |
|----|----------|-------|-------|-----------------|--------------|------|
| S1 | HIGH | Deep provider nesting: Auth → Theme → Character → Scope → Foundation → Network → Compliance → Runtime → Ads → Notifications → StreamVideo before first screen | `src/app/_layout.tsx` | Whole tree mounts before tabs; Stream prewarm on login | Defer Stream prewarm (already partial); keep foundation cache; document cascade | LOW |
| S2 | MEDIUM | `BuklodScopeProvider.refresh` chains: scopes RPC + hierarchy query + MZB resolve on every user refresh | `src/providers/BuklodScopeProvider.tsx` | Extra latency on login/reopen | MZB already cached; hierarchy required for UX — parallel already used | LOW |
| S3 | MEDIUM | Root `index.tsx` blocks redirect until `selectScope(PUBLIC)` completes (network) | `src/app/index.tsx` | Delayed reopen to Connect | Optimistic `selectScope` (local state first, persist async) | LOW |
| S4 | LOW | `StreamVideoProvider` prewarm on every authenticated session | `src/providers/StreamVideoProvider.tsx` | Background CPU/network at boot | Keep (calls required for calls); optional lazy prewarm | MEDIUM |

---

## 2. Navigation and tap response

| ID | Severity | Issue | Files | Expected impact | Proposed fix | Risk |
|----|----------|-------|-------|-----------------|--------------|------|
| N1 | HIGH | Notification tap awaits mark-read + `refreshUnread` before `router.push` | `src/app/notifications/index.tsx` | Tap feels stuck | Navigate immediately; mark read async | LOW |
| N2 | MEDIUM | `openWorkspace` awaits full `selectScope` (includes network persist) before `router.replace` | `src/app/organizations/join.tsx` | Slow org workspace open | Optimistic scope selection in provider | LOW |
| N3 | LOW | `organizations/members` search debounce 180ms | `src/app/organizations/members.tsx` | Typing only — acceptable | No change (not navigation) | — |

---

## 3. Re-renders

| ID | Severity | Issue | Files | Expected impact | Proposed fix | Risk |
|----|----------|-------|-------|-----------------|--------------|------|
| R1 | HIGH | `buklod.tsx` inline `renderItem` for community FlatList (~large closure) | `src/app/(tabs)/buklod.tsx` | Feed rerenders all rows on parent state change | Stabilize row component / callback (Phase C) | MEDIUM |
| R2 | HIGH | `BuklodExclusiveScopeCommunity` `renderPost` recreated; large component tree | `src/components/BuklodExclusiveScopeCommunity.tsx` | Scoped feed jank | List tuning + memo row (Phase C) | MEDIUM |
| R3 | LOW | `BuklodScopeProvider` context value already `useMemo` | `src/providers/BuklodScopeProvider.tsx` | — | No change | — |
| R4 | LOW | `BuklodFoundationProvider` snapshot cache + background refresh | `src/providers/BuklodFoundationProvider.tsx` | — | Already optimized | — |

---

## 4. List performance

| ID | Severity | Issue | Files | Expected impact | Proposed fix | Risk |
|----|----------|-------|-------|-----------------|--------------|------|
| L1 | HIGH | `BuklodExclusiveScopeCommunity` FlatList: no `initialNumToRender` / `windowSize` | `src/components/BuklodExclusiveScopeCommunity.tsx` | Heavy first paint on org walls | Add sensible FlatList props + Android `removeClippedSubviews` | LOW |
| L2 | MEDIUM | `messages.tsx` personal/community FlatLists untuned | `src/app/(tabs)/messages.tsx` | Inbox scroll cost | Same FlatList tuning | LOW |
| L3 | MEDIUM | `buklod.tsx` community already tuned (`initialNumToRender=4`, pagination) | `src/app/(tabs)/buklod.tsx` | — | Keep; consider FlashList later (variable row height) | MEDIUM |
| L4 | MEDIUM | `ScopeConnect` uses `ScrollView` + `.map` for members (max 60) | `src/app/scope/index.tsx` | OK at 60; debounce delays empty load 250ms | Immediate load when query empty | LOW |
| L5 | LOW | `@shopify/flash-list` installed but unused | `package.json` | Potential future win | Defer — variable-height feed rows | MEDIUM |

---

## 5. Image performance

| ID | Severity | Issue | Files | Expected impact | Proposed fix | Risk |
|----|----------|-------|-------|-----------------|--------------|------|
| I1 | LOW | Most feeds use `expo-image` | Connect, home, profile | Good caching | Continue pattern | LOW |
| I2 | LOW | Some `ImageBackground` (dashboard, connect bg) | `scope/index.tsx`, `ConnectThreadBackground.tsx` | Decode cost on large assets | Keep UX; ensure compressed assets | LOW |

---

## 6. Animation performance

| ID | Severity | Issue | Files | Expected impact | Proposed fix | Risk |
|----|----------|-------|-------|-----------------|--------------|------|
| A1 | LOW | Character/guide timers use Reanimated where present | `BuklodGuideAvatar`, character stack | Isolated | No change this pass | — |

---

## 7. Supabase / network

| ID | Severity | Issue | Files | Expected impact | Proposed fix | Risk |
|----|----------|-------|-------|-----------------|--------------|------|
| Q1 | MEDIUM | `useBuklodConnectUnread` postgres_changes per thread/scope chunk + 60s poll fallback | `src/hooks/useBuklodConnectUnread.ts` | Necessary for unread; bounded chunks | Keep; already chunked | — |
| Q2 | LOW | Community broadcast reload debounced 900ms | `src/app/(tabs)/buklod.tsx` | Prevents storm | Keep | — |
| Q3 | LOW | Mention search 220ms debounce | `src/app/(tabs)/buklod.tsx` | Reduces RPC spam | Keep (typing, not taps) | — |
| Q4 | LOW | Notifications `select` limited columns + limit 150 | `src/app/notifications/index.tsx` | OK | No change | — |

---

## 8. Context / providers

| ID | Severity | Issue | Files | Expected impact | Proposed fix | Risk |
|----|----------|-------|-------|-----------------|--------------|------|
| C1 | MEDIUM | 10+ nested providers rerender children on auth/scope changes | `_layout.tsx` | Broad subtree updates | Optimistic scope; avoid widening context | LOW |

---

## 9. Heavy screens (hotspots)

| File | Lines (approx) | Risk |
|------|----------------|------|
| `src/app/(tabs)/buklod.tsx` | ~3900 | Community feed, composer, realtime |
| `src/components/BuklodExclusiveScopeCommunity.tsx` | ~4500 | Scoped wall/reels |
| `src/components/BuklodConnectThread.tsx` | ~3600 | Messages realtime, FlatList |
| `src/app/reels/index.tsx` | ~2900 | Video list |
| `src/app/scope/index.tsx` | ~1500 | Dashboard tabs |

Phase C: extract feed rows and thread message rows without behavior change.

---

## 10. Memory and cleanup

| ID | Severity | Issue | Files | Expected impact | Proposed fix | Risk |
|----|----------|-------|-------|-----------------|--------------|------|
| M1 | LOW | Community/notifications channels removed on unmount | Multiple | Good | Verify on edits | LOW |
| M2 | LOW | `buklod.tsx` clears reload timer on unmount | `buklod.tsx` | Good | No change | — |

---

## 11. Implementation priority (this pass)

### Phase B — applied in code

1. Optimistic `selectScope` (local state before persist)
2. Notification navigation without await-before-push
3. FlatList tuning: `BuklodExclusiveScopeCommunity`, `messages.tsx`
4. `ScopeConnect` immediate load when search empty
5. Dev-only `performanceInstrumentation.ts`

### Phase C — deferred (documented)

1. Memoized community/scoped feed row components
2. FlashList for public community (needs stable `estimatedItemSize` strategy)
3. Split `BuklodConnectThread` message row
4. Lazy Stream prewarm until Connect tab focus

---

## Native dependencies added

**None** (this pass).
