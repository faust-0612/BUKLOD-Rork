# BUKLOD Full Navigation Runtime Repair Report

Date: 2026-08-19  
Status: **NOT FULLY COMPLETE** — requires device verification and remote backend confirmation

---

## Root causes found

### 1. Missing canonical scope route contract (Critical)

Screens independently chose between `activeScope`, `findActiveMzbMemberScope`, and route params. After the performance change (immediate `activeScope` + async persistence), dependent screens could render with **stale or mismatched scope identity**.

**Fix:** `src/lib/buklodScopeRoute.ts` + `useResolvedScope` hook with priority: route params → activeScope → scoped lookup.

### 2. MZB treated as parallel navigation island (Critical)

MZB Community and Messages used `findActiveMzbMemberScope` for content but did not consistently align `activeScope` on shell entry, notification open, or deep link. Active members could see **"MZB Community unavailable"** during scope list refresh or when `is_mzb_organization` enrichment lagged behind membership merge.

**Fix:**
- `MzbEnvironmentShell` mounts `useResolvedScope({ mzbOnly: true })`
- MZB screens use resolved scope + distinct loading/unauthorized states
- `findActiveMzbMemberScope` now matches canonical MZB `scope_id` directly

### 3. False unavailable / blank fallback states (High)

- `/scope` showed "Community unavailable" for any missing `activeScope`, including transient loading
- Connect thread routes returned `null` (blank screen) on bad deep links
- MZB community showed unauthorized while scopes were still loading

**Fix:** `BuklodScopeRouteState` component with explicit `loading | authorized | unauthorized | not_found | error`.

### 4. Notification routing without scope sync (High)

Scoped notifications navigated to `/scope?section=connect` without `scopeId` and without `selectScope`, so inbox/community could open under wrong Organization.

**Fix:** `buklodNotificationTarget()` returns path + `scopeId`; `NotificationProvider` and notification center call `syncScopeSelection` before `router.push`. MZB routes to `/mzb/messages` or `/mzb/connect/community/[scopeId]`.

---

## Scope contract

```
PUBLIC            → scope_type PUBLIC
ORGANIZATION      → scope_type ORGANIZATION, no parent_scope_id (includes MZB)
SUB_ORGANIZATION  → scope_type ORGANIZATION + parent_scope_id
CLUSTER           → scope_type CLUSTER
```

MZB is **ORGANIZATION** — identified by canonical slug `mzb-ministry-inc`, metadata flags, or `buklod_my_mzb` RPC id. No separate MZB data model.

---

## Route contracts fixed

| Contract | Before | After |
|----------|--------|-------|
| Scoped workspace | `/scope?section=*` only | `/scope?section=*&scopeId={id}` supported |
| MZB Messages | `findActiveMzbMemberScope` only | `useResolvedScope({ mzbOnly: true })` + real `ConnectScreen` |
| MZB Community | False unavailable during load | Loading vs unauthorized separated |
| Scoped notification | `/scope?section=connect` | Explicit `scopeId` + scope sync; MZB → `/mzb/*` |
| Connect thread deep link | `null` fallback | `BuklodScopeRouteState` not_found UI |
| MZB shell entry | No scope sync | `useResolvedScope` in shell layout |

---

## MZB fixes

- Community → `BuklodExclusiveScopeCommunity` with resolved MZB org scope (not placeholder)
- Messages → `ConnectScreen` with `forcedScopeId` + `threadBase="/mzb/connect"`
- Shell → aligns `activeScope` to MZB on any `/mzb/*` route
- Notifications → MZB-scoped payloads route to MZB Connect paths
- Canonical ID fallback in `findActiveMzbMemberScope`

---

## Organization / Sub-org / Cluster fixes

- `/scope` accepts `scopeId` route param; explicit ID wins over stale `activeScope`
- `useLayoutEffect` scope sync preserves immediate navigation performance
- Workspace header/tabs use `workspaceScope` resolved from contract
- Section changes preserve `scopeId` in route params

---

## Global / scoped separation (preserved)

- Bottom nav still calls `selectScope(PUBLIC)` before global routes
- `/messages` remains exempt from canonical guard (intentional global inbox)
- Scoped top nav (HOME / COMMUNITY / CONNECT) stays inside `/scope` or `/mzb/*`
- Profile / My BUKLOD remains personal

---

## Back behavior (preserved)

- No new `replace` loops introduced
- Thread stack routes still use `router.back()`
- Inline scoped Connect still uses `onBackOverride` to scope home section

---

## Notifications

- `buklodNotificationTarget(kind, data, { scopes, mzbCanonicalScopeId })`
- Scope sync via non-blocking `syncScopeSelection`
- Post notifications with `scope_id` open scoped community (MZB or `/scope`)

---

## Share routing

- No change — Universal Share remains RPC-driven; explicit destination not overridden by `activeScope`

---

## Call routing

- No change — Stream architecture preserved; scope call launcher unchanged

---

## Backend dependencies checked

| Function | Status |
|----------|--------|
| `buklod_my_scopes` | CODE PASS — **REMOTE: PENDING DEPLOYMENT VERIFICATION** |
| `buklod_set_active_scope` | CODE PASS — **REMOTE: PENDING DEPLOYMENT VERIFICATION** |
| `buklod_my_mzb` | CODE PASS — **REMOTE: PENDING DEPLOYMENT VERIFICATION** |
| `create_buklod_community_post_v3` | CODE PASS — **REMOTE: PENDING DEPLOYMENT VERIFICATION** |
| `buklod_connect_personal_threads` | CODE PASS — **REMOTE: PENDING DEPLOYMENT VERIFICATION** |
| `buklod_connect_community_rooms` | CODE PASS — **REMOTE: PENDING DEPLOYMENT VERIFICATION** |

**Migrations created:** NONE (client-side repair only)

---

## Static QA

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | **CODE PASS** |
| `jest buklodScopeRoute` | Not run — jest not installed in environment |
| New `@ts-ignore` / suppressions | NONE |

---

## Runtime QA matrix

| # | Flow | Status |
|---|------|--------|
| 1–4 | PUBLIC flows | **PENDING DEVICE VERIFICATION** |
| 5–12 | MZB flows | **PENDING DEVICE VERIFICATION** |
| 13–17 | Org A flows | **PENDING DEVICE VERIFICATION** |
| 18 | Org B isolation | **PENDING DEVICE VERIFICATION** |
| 20–23 | Sub-org flows | **PENDING DEVICE VERIFICATION** |
| 24–27 | Cluster flows | **PENDING DEVICE VERIFICATION** |
| 28–30 | Global exit | **PENDING DEVICE VERIFICATION** |
| 31–33 | Notification routing | **PENDING DEVICE VERIFICATION** |
| 34–38 | Share destinations | **PENDING DEVICE VERIFICATION** (RPC-only) |
| 39–43 | Back navigation | **PENDING DEVICE VERIFICATION** |
| 44–46 | Error state accuracy | **PENDING DEVICE VERIFICATION** |

---

## Unresolved items

1. **DEVICE VERIFIED** — none of the 46 runtime QA cases executed on Android hardware in this session
2. **DEPLOYED** — production Supabase RPC availability not verified from this environment
3. Org/Cluster Connect member DMs still route to global personal threads by design (PATCH_172E) — not a bug
4. `jest` not available locally to run new unit tests (test file added)

---

## Native dependencies added

**NONE**

---

## Completion labels

| Label | Status |
|-------|--------|
| CODE PASS | Yes |
| BACKEND PASS | Pending remote verification |
| DEPLOYED | Pending remote verification |
| DEVICE VERIFIED | No |

**Do not mark FULLY COMPLETE until Android device QA and production RPC verification are done.**

---

## Wall / Reels / performance preservation

- No changes to `BuklodExclusiveScopeCommunity` feed logic, Wall/Reels separation, reactions, or comment previews
- `selectScope` immediate update + background persistence preserved
- No artificial navigation delays added
