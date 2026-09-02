# BUKLOD Navigation Runtime Audit

Date: 2026-08-19  
Scope: `BUKLOD_Production_Starter_v16` production app

## Executive summary

Navigation failures traced to **three shared architectural gaps**:

1. **No canonical scope route contract** — screens mixed `activeScope`, `findActiveMzbMemberScope`, and route params with no priority order.
2. **MZB scope desync** — MZB routes resolved content via `forcedScopeId` / `findActiveMzbMemberScope` while `activeScope` could still point at another Organization, breaking scope bar, notifications, and deep links.
3. **Loading conflated with unauthorized** — scoped screens showed "Community unavailable" / placeholder states while scopes were still loading or before MZB canonical ID enrichment finished.

---

## Canonical scope contract (established)

| Kind | `scope_type` | Canonical ID | Notes |
|------|-------------|--------------|-------|
| `PUBLIC` | `PUBLIC` | public scope row id | Global bottom nav destinations |
| `ORGANIZATION` | `ORGANIZATION` (no parent) | `scope_id` | Includes MZB — no separate model |
| `SUB_ORGANIZATION` | `ORGANIZATION` + `parent_scope_id` | child `scope_id` | Exact child scope only |
| `CLUSTER` | `CLUSTER` | `scope_id` | Exact cluster scope only |

**Resolution priority** (`src/lib/buklodScopeRoute.ts`):

1. Explicit route params (`scopeId`, `scope_id`, `organization`, aliases)
2. In-memory `activeScope` (when scoped and valid)
3. Scoped lookup from provider list — never override valid route params with stale persistence

**Hook:** `src/hooks/useResolvedScope.ts` — syncs `activeScope` via `useLayoutEffect` without blocking navigation.

---

## Route families

### GLOBAL (PUBLIC)

| Source | Destination | Params | Expected scope | Resolver | Fallback | Failure | Severity | Fix |
|--------|-------------|--------|----------------|----------|----------|---------|----------|-----|
| Bottom nav Home | `/(tabs)/home` | — | PUBLIC | `BuklodPersistentBottomNav` → `selectScope(PUBLIC)` | Connect reopen | Stale org scope | Medium | Preserved — working |
| Bottom nav Connect | `/(tabs)/messages` | — | PUBLIC | Bottom nav resets scope | Global inbox | Scoped inbox bleed | Low | Intentional global exit (PATCH_172E) |
| Bottom nav Community | `/(tabs)/buklod` | — | PUBLIC | Public wall component | Redirect if non-PUBLIC | Wrong feed | Medium | `BuklodCanonicalNavigationGuard` |
| Profile / My BUKLOD | `/(tabs)/me` | — | PUBLIC/personal | No scope chips on profile | — | Scoped UI bleed | Low | Profile route exempt from scope bar |
| Notifications | `/notifications` | — | — | List only | — | — | — | — |
| Prayer / Word / Progress | respective tabs | — | PUBLIC | Tab routes | — | — | Low | — |

### SCOPED WORKSPACE (`/scope`)

| Source | Destination | Params | Expected scope | Resolver | Fallback | Failure | Severity | Fix |
|--------|-------------|--------|----------------|----------|----------|---------|----------|-----|
| Profile org tile | `/scope` | `section` optional | Selected org/cluster | `selectScope` + navigate | — | Wrong org | High | Profile tile calls `selectScope` first |
| Scope bar OPEN | `/scope?section=*` | `section`, `scopeId` | `activeScope` | `BuklodScopeBar` | MZB hrefs when in `/mzb/*` | Wrong section | Medium | Fixed in PATCH org nav |
| Notification (scoped) | `/scope?section=connect&scopeId=` | `scopeId` | Exact notification scope | `buklodNotificationTarget` | — | Stale activeScope | **Critical** | **Fixed** — explicit `scopeId` + sync |
| Canonical guard | `/scope?section=*` | — | non-PUBLIC activeScope | `BuklodCanonicalNavigationGuard` | Public routes | Loop | Medium | Preserved |
| Org Home tab | `/scope?section=home` | `scopeId` optional | active/route scope | `useResolvedScope` | Loading UI | False unavailable | **Critical** | **Fixed** |
| Org Community | `/scope?section=community` | `scopeId` optional | exact scope | `BuklodExclusiveScopeCommunity` | Error state | False unavailable | High | **Fixed** |
| Org Connect | `/scope?section=connect` | `scopeId` optional | exact scope | Inline `BuklodConnectThread` | — | Global connect leak | Medium | Preserved inline pattern |

### MZB (`/mzb/*`)

| Source | Destination | Params | Expected scope | Resolver | Fallback | Failure | Severity | Fix |
|--------|-------------|--------|----------------|----------|----------|---------|----------|-----|
| Profile MZB tile | `/mzb/home` | — | MZB org `scope_id` | `selectScope` + navigate | — | Stale activeScope | High | Prior fix + shell sync |
| MZB shell tabs | `/mzb/messages`, `/mzb/community`, etc. | — | MZB org | `MzbEnvironmentShell` + `useResolvedScope` | Unavailable UI | Placeholder / false deny | **Critical** | **Fixed** |
| MZB Messages | `/mzb/messages` | `scopeId` optional | MZB org | `ConnectScreen forcedScopeId` | Unavailable state | Placeholder inbox | **Critical** | **Fixed** — real Connect |
| MZB Community | `/mzb/community` | `scopeId` optional | MZB org | `BuklodExclusiveScopeCommunity` | Loading vs unauthorized | False unavailable | **Critical** | **Fixed** |
| MZB threads | `/mzb/connect/*` | `threadId` / `scopeId` | MZB org | Stack routes | `null` screen | Blank fallback | High | **Fixed** — error UI |
| Notification MZB | `/mzb/messages` or `/mzb/connect/community/[id]` | `scope_id` | MZB org | `buklodNotificationTarget` | — | Landed in `/scope` | High | **Fixed** |

### CONNECT THREADS

| Source | Destination | Params | Scope | Failure | Fix |
|--------|-------------|--------|-------|---------|-----|
| Global inbox | `/connect/personal/[threadId]` | threadId | PUBLIC/personal | `null` on bad link | Error UI |
| Global scope room | `/connect/community/[scopeId]` | scopeId | explicit | `null` | Error UI |
| MZB inbox | `/mzb/connect/personal/[threadId]` | threadId | MZB | `null` | Error UI |
| MZB scope room | `/mzb/connect/community/[scopeId]` | scopeId | MZB | `null` | Error UI |
| Legacy shim | `/connect/[id]` | id | personal | Dropped thread id | Fixed prior patch |

### NOTIFICATIONS

| Kind | Data required | Destination | Scope sync | Status |
|------|---------------|-------------|------------|--------|
| `direct_message` | `conversation_id` | `/connect/personal/{id}` | — | Fixed |
| Community post | `post_id`, optional `scope_id` | `/post/{id}` or scoped community | Yes if scoped | **Fixed** |
| Scoped message | `scope_id`, optional `conversation_id` | MZB or `/scope` or `/connect/community` | Yes | **Fixed** |

### SHARE

| Destination | Behavior | Status |
|-------------|----------|--------|
| Public / Org / MZB / personal Connect | RPC-only via `BuklodPostInternalShare` | No nav change needed |
| Explicit destination | Must not be overridden by `activeScope` | Preserved |

### BACK NAVIGATION

| Flow | Expected | Risk | Status |
|------|----------|------|--------|
| MZB Messages → thread → back | MZB Messages | `replace` misuse | Preserved `router.back()` |
| Org Connect inline → back | Scope home section | Jump to public | Preserved `onBackOverride` |
| Scope post → back | Same scoped community | Stale scope | Route `scopeId` param helps |

---

## Error state inventory

| Location | Message | Root cause class | Action |
|----------|---------|------------------|--------|
| `_layout.tsx` ErrorBoundary | Something went wrong | Runtime exception (A) | Retry UI — correct |
| `scope/index.tsx` | Community unavailable | Missing scope / loading (C/H) | **Replaced** with `BuklodScopeRouteState` |
| `mzb/community.tsx` | MZB Community unavailable | Membership unresolved during load (E/G) | **Fixed** — loading vs unauthorized |
| `mzb/messages.tsx` | MZB Messages unavailable text | Same | **Fixed** |
| `connect/personal/[threadId]` | `null` | Missing param (B) | **Fixed** — not_found UI |
| `post/[id].tsx` | Post unavailable | Access / audience (F) | Correct — no change |

---

## Backend dependencies

| Dependency | Used by | Local | Remote |
|------------|---------|-------|--------|
| `buklod_my_scopes` | Scope provider | RPC in codebase | **PENDING BACKEND DEPLOYMENT** — verify production |
| `buklod_set_active_scope` | Scope persistence | RPC in codebase | **PENDING BACKEND DEPLOYMENT** |
| `buklod_my_mzb` | MZB canonical ID | `buklodMzbOrganization.ts` | **PENDING BACKEND DEPLOYMENT** |
| `create_buklod_community_post_v3` | Public/scoped wall | Referenced in `buklod.tsx` | **PENDING BACKEND DEPLOYMENT** — local migration ≠ production |
| `buklod_connect_personal_threads` | Connect inbox | messages.tsx | **PENDING BACKEND DEPLOYMENT** |
| `buklod_connect_community_rooms` | Connect inbox | messages.tsx | **PENDING BACKEND DEPLOYMENT** |

No new migrations created in this repair — client-side scope contract only.

---

## Files changed in this repair

- `src/lib/buklodScopeRoute.ts` (new)
- `src/hooks/useResolvedScope.ts` (new)
- `src/components/BuklodScopeRouteState.tsx` (new)
- `src/lib/buklodNotificationNavigation.ts` (re-export)
- `src/lib/buklodMzbOrganization.ts`
- `src/app/scope/index.tsx`
- `src/app/mzb/messages.tsx`
- `src/app/mzb/community.tsx`
- `src/components/MzbEnvironmentShell.tsx`
- `src/providers/NotificationProvider.tsx`
- `src/app/notifications/index.tsx`
- `src/app/connect/personal/[threadId].tsx`
- `src/app/connect/community/[scopeId].tsx`
- `src/app/mzb/connect/personal/[threadId].tsx`
- `src/app/mzb/connect/community/[scopeId].tsx`
- `src/app/_layout.tsx`
- `__tests__/buklodScopeRoute.test.ts` (new)
