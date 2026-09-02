# BUKLOD Unified Scope Dashboard Report

**Date:** 2026-08-19  
**TypeScript:** PASS (`npx tsc --noEmit`)  
**Backend:** PASS (no migrations; RLS/RPC unchanged)  
**Native dependencies added:** NONE  
**Device verification:** PENDING

---

## Summary

Unified MZB and all Organizations onto **one canonical scoped workspace** at `/scope`. The legacy `/mzb/*` dashboard shell is no longer a user-facing workspace; legacy routes redirect into `/scope` with explicit `scopeId`.

---

## Two implementations discovered

### A. Legacy MZB Environment
- `MzbEnvironmentShell` + `/mzb/home|messages|community|prayer|word|learn`
- Separate 6-tab navigation, MZB-only home widgets
- Profile entry used `router.replace('/mzb/home')`

### B. Canonical generic workspace
- `src/app/scope/index.tsx` — Home | Community | Connect
- `BuklodScopeHomeDashboard` / `BuklodClusterHomeCommandCenter`
- `buklodScopeRoute.ts` contract with `scopeId` on all workspace URLs

**Canonical winner:** B (`/scope`)

---

## Changes implemented

### MZB → normal Organization workspace
- `BuklodProfileMembershipNav.tsx` — MZB tile uses `enterScopedWorkspace(..., { navigation: 'push' })`
- `BuklodMzbLegacyRedirect.tsx` — redirects `/mzb/home|messages|community` → `/scope?section=*&scopeId=`
- `mzb/_layout.tsx` — removed `MzbEnvironmentShell` wrapper
- `mzb/prayer|word|learn` → global `/(tabs)/*`
- `mzb/admin` → `/organizations/scope-manage`
- `mzb/connect/*` → `/connect/*`
- `buklodScopeRoute.ts` — MZB notifications use canonical `/scope` paths
- `BuklodMzbHomeWidgets.tsx` — MZB branding/content inside canonical home dashboard

### Navigation / Home refresh fixes
- `scope/index.tsx` — `ScopeHome`, `ScopeCommunity`, `ScopeConnect`, `OrganizationCommunityConnect` now receive **route-resolved `workspaceScope`** (not stale `activeScope`)
- `exitWorkspace` — prefers `router.canGoBack()` before `exitScopedWorkspace` (Profile → MZB → Back returns via stack)
- `BuklodCanonicalNavigationGuard` — scoped redirects include `scopeId`; exempt `/scope/manage/*`
- `BuklodScopeBar` — OPEN uses `buildScopedWorkspacePath` with `activeScope.scope_id`
- `BuklodScopeHomeDashboard` — Attendance uses `scopeRouteParams(scopeId)`
- `BuklodScopeAttendanceCard` — accepts `scopeId` + `scopeType`; passes params to attendance route
- `scope/manage/index.tsx` — fallback uses `buildScopedWorkspacePath('home', scopeId)` not bare `/scope`
- `organizations/scope-manage.tsx` — passes `scopeType: 'ORGANIZATION'` to manage child routes
- `(tabs)/messages.tsx` — removed `/mzb/connect` thread base fork

### Capability matrix
- `src/lib/buklodScopeCapabilities.ts` — `getScopeCapabilities(scope, permissions)`

---

## Members and Roles

- Route: `/scope/manage/members` with `scopeRouteParams(scopeId)` (+ `scopeType` from portal manage)
- Screen: `src/app/scope/manage/members.tsx` with `OrganizationManageGate` / `ClusterManageGate`
- Entry: Organization Manage → “Members & Roles (Unified)”

**Prior failure mode:** missing `scopeId` on sibling routes + `activeScope` drift caused workspace remount appearing as Home refresh.

---

## Buttons that previously reloaded Home

| Control | Cause | Fix |
|---------|-------|-----|
| Attendance quick link | `/scope/attendance` without `scopeId` | `scopeRouteParams` |
| Attendance card | same | `BuklodScopeAttendanceCard` params |
| Manage redirect fallback | `replace('/scope')` | `buildScopedWorkspacePath` |
| Community/Connect tabs | `activeScope` ≠ route scope | pass `workspaceScope` prop |
| Scope bar OPEN (MZB) | `/mzb/home` or `/scope` without id | canonical path with id |
| Canonical guard | `/scope?section=*` without id | include `scopeId` |

---

## Back-stack fix (MZB)

**Before:** Profile → MZB Home → Back → Organization List  
**After:** MZB entry uses `push` into `/scope?scopeId=...`; workspace exit uses `router.canGoBack()` first.

Organization portal remains separate (`enterScopedWorkspace` with `fromPortal: true` still `dismissAll`).

---

## Organization portal separation

Unchanged from prior fix: portal (`/organizations/*`) is not parent of workspace back stack. Workspace exit only `dismissAll` when history is empty.

---

## Sub-org / Cluster impact

Same `/scope` engine for Organization, Sub-organization (`parent_scope_id`), and Cluster. Cluster home still uses `BuklodClusterHomeCommandCenter`; structural top nav unchanged.

---

## Old MZB dashboard status

| Item | Status |
|------|--------|
| `/mzb/home|messages|community` | Redirect to `/scope` |
| `MzbEnvironmentShell` in layout | **Removed** |
| `MzbEnvironmentShell.tsx` source | Retained (unreferenced — delete after scan) |
| MZB helpers (`buklodMzbOrganization`, wall photo) | **Retained** |

---

## TypeScript

```
npx tsc --noEmit  →  PASS
```

Updated test: `__tests__/buklodScopeRoute.test.ts` — MZB notifications expect `/scope?section=connect&scopeId=...`

---

## Device verification checklist (PENDING)

### MZB entry
1. Profile → MZB Organization → shared `/scope` dashboard
2. Confirm old MZB 6-tab shell is gone
3. Back → returns to Profile (not Organization List)

### MZB dashboard buttons
4. Members / Members & Roles / Add Admin / Events / Attendance / Community / Connect / Settings — each opens real screen, not Home refresh

### Generic Organization
5. Same structural dashboard as MZB
6. Members/Roles, Events, Attendance, Community, Connect work

### Cross-scope
7. Organization B does not show Organization A data

### Sub-org / Cluster
8. Child scopes use same engine with working internal actions

### Navigation
9. Child → Back → previous scoped screen
10. No unexpected portal injection
11. No Home refresh loop
12. Global bottom nav still exits globally when intended

---

## Final architecture

```
GLOBAL BUKLOD
├── Organizations Portal (/organizations/*)
└── Enter scope → /scope?section=*&scopeId={id}
    ├── MZB Organization (same engine + MzbHomeWidgets)
    ├── Organization / Sub-org
    └── Cluster
        ├── Home
        ├── Community
        ├── Connect
        └── Manage → Members, Attendance, …
```

**No parallel MZB dashboard engine.**
