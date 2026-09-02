# BUKLOD Unified Scope Dashboard Audit

**Date:** 2026-08-19  
**Status:** CODE PASS — device verification pending

## Executive summary

Two parallel scoped-workspace implementations existed. The **canonical** engine is `/scope` (generic Organization/Cluster workspace). The **legacy** engine was `/mzb/*` with `MzbEnvironmentShell` (6-tab MZB-only shell). MZB must use the same `/scope` engine as every other Organization.

---

## 1. Legacy MZB Environment (`/mzb/*`)

### Shell & layout

| File | Role |
|------|------|
| `src/app/mzb/_layout.tsx` | Previously wrapped `MzbEnvironmentShell` |
| `src/components/MzbEnvironmentShell.tsx` | 6-tab bottom nav: home, messages, community, prayer, word, learn |
| `src/app/mzb/home.tsx` | MZB-only home widgets (Bayanihan, Daily Bible, wall photo) |
| `src/app/mzb/messages.tsx` | MZB Connect inbox alias |
| `src/app/mzb/community.tsx` | MZB Community alias |
| `src/app/mzb/prayer.tsx` / `word.tsx` / `learn.tsx` | Thin wrappers to global faith tabs |
| `src/app/mzb/admin.tsx` | MZB admin (parallel to org manage) |
| `src/app/mzb/index.tsx` | MZB membership portal / onboarding |
| `src/app/mzb/connect/*` | MZB connect thread aliases |

### Routes (legacy)

- `/mzb`, `/mzb/home`, `/mzb/messages`, `/mzb/community`
- `/mzb/prayer`, `/mzb/word`, `/mzb/learn`
- `/mzb/admin`, `/mzb/connect/personal/[threadId]`, `/mzb/connect/community/[scopeId]`

### MZB-only UI

- `MzbEnvironmentShell` — separate tab navigation engine
- `MzbRandomWallPhoto` — MZB wall preview
- `buklodMzb.ts` / `buklodMzbOrganization.ts` — canonical MZB org lookup (retained)
- MZB home cards: Bayanihan balance, Daily Bible, random ASD verse (removed from route; ported to widgets)

### Navigation stack behavior (broken)

- Profile tile → `router.replace('/mzb/home')` after `selectScope`
- Back from MZB Home could surface Organization List if portal routes remained on stack
- `BuklodScopeBar` OPEN href used `/mzb/*` when `inMzb`
- Notifications routed MZB to `/mzb/messages` and `/mzb/connect/*`

---

## 2. Canonical generic scope workspace (`/scope`)

### Core

| File | Role |
|------|------|
| `src/app/scope/index.tsx` | Workspace shell: Home \| Community \| Connect (+ Manage) |
| `src/components/BuklodScopeHomeDashboard.tsx` | Organization / Sub-org home |
| `src/components/BuklodClusterHomeCommandCenter.tsx` | Cluster home |
| `src/lib/buklodScopeRoute.ts` | `buildScopedWorkspacePath`, `enterScopedWorkspace`, `exitScopedWorkspace` |
| `src/hooks/useResolvedScope.ts` | Route `scopeId` → scope resolution + sync |
| `src/lib/buklodScopeManage.ts` | Manage/members/attendance route builders with `scopeRouteParams` |

### Routes

- `/scope?section=home|community|connect&scopeId={id}`
- `/scope/manage/*`, `/scope/attendance`, `/scope/manage/members`
- Portal manage hubs: `/organizations/scope-manage`, `/clusters/scope-manage`

### Shared components

- `BuklodExclusiveScopeCommunity`, `BuklodConnectThread`, `BuklodScopedDashboardHeader`
- `BuklodScopeBar`, `BuklodCanonicalNavigationGuard`
- `BuklodScopeAttendanceCard`, `BuklodScopeMemberRow`

---

## 3. Duplicated functionality

| Feature | Legacy MZB | Canonical `/scope` | Resolution |
|---------|------------|-------------------|------------|
| Home dashboard | `/mzb/home` | `BuklodScopeHomeDashboard` | **Canonical** + `BuklodMzbHomeWidgets` for MZB |
| Community | `/mzb/community` | `section=community` | **Canonical** |
| Connect / Messages | `/mzb/messages` | `section=connect` | **Canonical** |
| Manage / Members | `/mzb/admin` | `/organizations/scope-manage`, `/scope/manage/members` | **Canonical** |
| Prayer / Word / Learn | MZB shell tabs | Global `/(tabs)/*` | Global tabs (not workspace tabs) |
| Scope bar OPEN | `/mzb/*` | `/scope?section=*&scopeId=` | **Canonical** |

---

## 4. Root causes — “Home refresh” / wrong destinations

| Issue | Root cause |
|-------|------------|
| Buttons reload Home | `ScopeHome` / `ScopeCommunity` used `activeScope` instead of route `workspaceScope` |
| Attendance opens wrong scope | `router.push('/scope/attendance')` without `scopeId` params |
| Manage fallback loop | `scope/manage/index.tsx` → `router.replace('/scope')` without `scopeId` |
| Canonical guard strips scope | Redirect to `/scope?section=*` without `scopeId` |
| Members & Roles confusion | Missing `scopeType` on some manage navigations; guard could intercept sibling routes |
| MZB Back → Org List | `replace('/mzb/home')` + `exitWorkspace` always `dismissAll`; portal on stack |

---

## 5. Canonical decision

**Winner:** `/scope` generic workspace (`src/app/scope/index.tsx` + shared dashboard components)

**MZB retains:** name, logo/branding metadata, org ID, membership helpers, optional `BuklodMzbHomeWidgets` section.

**MZB loses:** `MzbEnvironmentShell` as user-facing workspace; all `/mzb/home|messages|community` entry points redirect to `/scope`.

---

## 6. Entry points updated (this pass)

| Entry | Before | After |
|-------|--------|-------|
| Profile MZB tile | `/mzb/home` | `enterScopedWorkspace(..., { navigation: 'push' })` |
| Legacy `/mzb/home` etc. | MZB shell | `BuklodMzbLegacyRedirect` → `/scope?section=*&scopeId=` |
| Notifications (MZB) | `/mzb/messages` | `buildScopedWorkspacePath('connect', scopeId)` |
| Scope bar OPEN | `/mzb/*` or `/scope` without id | `buildScopedWorkspacePath(section, activeScope.scope_id)` |

---

## 7. Files intentionally kept (not deleted)

- `MzbEnvironmentShell.tsx` — unreferenced from layout; safe to delete after dependency scan
- `mzb/index.tsx` — membership portal
- `buklodMzbOrganization.ts`, `MzbRandomWallPhoto.tsx` — MZB metadata/content helpers

---

## 8. Capability resolver

New: `src/lib/buklodScopeCapabilities.ts` — `getScopeCapabilities()` for feature visibility by scope type and admin status.

---

## 9. Device QA required

See `BUKLOD_UNIFIED_SCOPE_DASHBOARD_REPORT.md` test checklist. **Not verified on Android in this pass.**
