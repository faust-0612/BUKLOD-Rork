# BUKLOD Organization / MZB Message Navigation Audit

Date: 2026-08-19

## Architecture summary

| Layer | Global / personal Connect | Scoped workspace Connect | MZB Connect |
|-------|---------------------------|--------------------------|-------------|
| Inbox route | `/messages` | `/scope?section=connect` (in-place tab) | `/mzb/messages` |
| Personal thread | `/connect/personal/[threadId]` | Same (global personal DMs only) | `/mzb/connect/personal/[threadId]` |
| Scope/community thread | `/connect/community/[scopeId]` | Inline `BuklodConnectThread` (ORG/CLUSTER) | `/mzb/connect/community/[scopeId]` |
| Bottom nav Connect | `selectScope(PUBLIC)` + `replace('/messages')` | N/A (scoped tabs use top bar) | Bottom nav hidden on `/mzb/*` |

Scoped ORG/Sub-org/Cluster Connect is **inline** `BuklodConnectThread mode="scope"` with `containerId={activeScope.scope_id}` — not a separate inbox route.

---

## Entry point audit

### 1. Global bottom navigation → Connect

| Field | Value |
|-------|-------|
| **Source** | `src/components/BuklodPersistentBottomNav.tsx` (~254–295, 364) |
| **Trigger** | Tap Connect tab |
| **Destination** | `router.replace('/messages')` after `selectScope(PUBLIC)` if active scope is ORG/CLUSTER |
| **Params** | None |
| **Expected scope** | PUBLIC (intentional exit from scoped workspace) |
| **Actual behavior** | Correct by design |
| **Issue** | None |
| **Risk** | Low |

### 2. Organization / Sub-org top tab → Connect

| Field | Value |
|-------|-------|
| **Source** | `src/app/scope/index.tsx` (~460, 525–548) |
| **Trigger** | Tap CONNECT tab |
| **Destination** | `router.setParams({ section: 'connect' })` — stays on `/scope` |
| **Params** | `section=connect` |
| **Expected scope** | `activeScope` (ORG/CLUSTER inline thread) |
| **Actual behavior** | `OrganizationCommunityConnect` uses `activeScope.scope_id` |
| **Issue** | None when `activeScope` matches selected workspace |
| **Risk** | Medium if `activeScope` stale (see MZB profile entry) |

### 3. Cluster top tab → Connect

| Field | Value |
|-------|-------|
| **Source** | Same as #2 |
| **Trigger** | CONNECT tab |
| **Destination** | Inline scoped thread |
| **Expected scope** | Cluster `scope_id` |
| **Actual behavior** | Same component path as Organization |
| **Issue** | None |
| **Risk** | Low |

### 4. MZB shell → Messages

| Field | Value |
|-------|-------|
| **Source** | `src/components/MzbEnvironmentShell.tsx` (route `/mzb/messages`) |
| **Trigger** | MZB nav swipe/tap |
| **Destination** | `router.replace('/mzb/messages')` |
| **Params** | None |
| **Expected scope** | MZB organization via `forcedScopeId` |
| **Actual behavior** | `findActiveMzbMemberScope(scopes)` — does not use `activeScope` alone |
| **Issue** | **Profile → MZB did not `selectScope(MZB)`** — stale `activeScope` for scope bar / OPEN workspace |
| **Risk** | High (fixed: profile now selects MZB scope) |

### 5. MZB messages inbox → threads

| Field | Value |
|-------|-------|
| **Source** | `src/app/mzb/messages.tsx`, `src/app/(tabs)/messages.tsx` |
| **Trigger** | Row tap |
| **Destination** | `/mzb/connect/personal/[threadId]` or `/mzb/connect/community/[scopeId]` |
| **Params** | `threadId`, `targetUserId`, `scopeId`, names |
| **Expected scope** | MZB org only (`forcedScopeId` filters rooms) |
| **Actual behavior** | Correct |
| **Issue** | None |
| **Risk** | Low |

### 6. Global messages inbox → threads

| Field | Value |
|-------|-------|
| **Source** | `src/app/(tabs)/messages.tsx` (~784–826) |
| **Trigger** | Personal / community row tap |
| **Destination** | `/connect/personal/[threadId]` or `/connect/community/[scopeId]` |
| **Params** | Standard thread params |
| **Expected scope** | Global inbox (personal + all accessible rooms) |
| **Actual behavior** | Correct |
| **Issue** | None |
| **Risk** | Low |

### 7. Scoped people search (non-ORG/CLUSTER)

| Field | Value |
|-------|-------|
| **Source** | `src/app/scope/index.tsx` `ScopeConnect` (~1175–1186) |
| **Trigger** | Tap member in scoped people list |
| **Destination** | **Was** `/connect/${user_id}` |
| **Expected scope** | Global personal DM (by design per PATCH_172E) |
| **Actual behavior** | **Broken** — legacy route redirected to `/messages` |
| **Issue** | **Confirmed bug** |
| **Risk** | High (fixed: `/connect/personal/new` + `targetUserId`) |

### 8. Legacy `/connect/[id]` route

| Field | Value |
|-------|-------|
| **Source** | `src/app/connect/[id].tsx` |
| **Trigger** | Any navigation to `/connect/{id}` |
| **Destination** | **Was** unconditional redirect to `/messages` |
| **Expected scope** | Personal thread for `conversation_id` |
| **Actual behavior** | **Broken** — dropped ID |
| **Issue** | **Confirmed bug** |
| **Risk** | Critical (fixed: redirect to `/connect/personal/[threadId]`) |

### 9. Notification center — direct message

| Field | Value |
|-------|-------|
| **Source** | `src/app/notifications/index.tsx` `pathFor` |
| **Trigger** | Tap notification |
| **Destination** | **Was** `/connect/${conversation_id}` |
| **Expected scope** | Personal thread |
| **Actual behavior** | **Broken** → `/messages` |
| **Issue** | **Confirmed bug** |
| **Risk** | Critical (fixed: `/connect/personal/{conversation_id}`) |

### 10. Push notification cold start

| Field | Value |
|-------|-------|
| **Source** | `src/providers/NotificationProvider.tsx` `pathFor` |
| **Trigger** | Tap push notification |
| **Destination** | Same legacy `/connect/{id}` pattern |
| **Issue** | **Confirmed bug** (fixed via shared helper) |
| **Risk** | Critical |

### 11. Canonical navigation guard

| Field | Value |
|-------|-------|
| **Source** | `src/components/BuklodCanonicalNavigationGuard.tsx` |
| **Trigger** | Non-PUBLIC `activeScope` on `/home`, `/buklod`, `/connect` |
| **Destination** | `/scope?section=*` |
| **Issue** | None for messaging; `/messages` not redirected (global inbox allowed) |
| **Risk** | Low |

### 12. Scope bar OPEN workspace

| Field | Value |
|-------|-------|
| **Source** | `src/components/BuklodScopeBar.tsx` |
| **Trigger** | OPEN button while on `/messages` |
| **Destination** | **Was** `/scope?section=home` (ignored `/messages`) |
| **Expected** | `/scope?section=connect` when on Connect inbox |
| **Issue** | **Confirmed bug** |
| **Risk** | Medium (fixed) |

### 13. Scope bar OPEN from MZB routes

| Field | Value |
|-------|-------|
| **Source** | `BuklodScopeBar.tsx` |
| **Trigger** | OPEN while on `/mzb/messages` |
| **Destination** | **Was** `/scope?section=home` with wrong `activeScope` |
| **Expected** | `/mzb/messages` or `/mzb/home` |
| **Issue** | **Confirmed bug** |
| **Risk** | High (fixed: MZB workspace href mapping) |

### 14. Org manage feature → Connect

| Field | Value |
|-------|-------|
| **Source** | `src/app/organizations/manage-feature.tsx` |
| **Trigger** | Menu item |
| **Destination** | `selectScope` + `/scope?section=connect` |
| **Issue** | None |
| **Risk** | Low |

### 15. Share to Connect (internal)

| Field | Value |
|-------|-------|
| **Source** | `src/components/BuklodPostInternalShare.tsx` |
| **Trigger** | Share sheet RPC |
| **Destination** | No navigation (RPC only) |
| **Issue** | None |
| **Risk** | Low |

### 16. Thread back navigation

| Field | Value |
|-------|-------|
| **Source** | `src/components/BuklodConnectThread.tsx` (~2991–2997) |
| **Trigger** | Header back |
| **Destination** | `onBackOverride()` or `router.back()` |
| **Scoped inline** | `onBackOverride` → `openSection('home')` on `/scope` |
| **Stack threads** | `router.back()` → prior inbox route |
| **Issue** | None after inbox/thread route fixes |
| **Risk** | Low |

---

## Parameter naming map

| Concept | Route / prop names used |
|---------|-------------------------|
| Scope identity | `scopeId` (community routes), `containerId` (thread), `forcedScopeId` (MZB inbox), `activeScope.scope_id` (inline) |
| Personal thread | `threadId`, `targetUserId`, `otherUserId`, `otherUserName` |
| Notifications | `conversation_id` (maps to `threadId`) |
| Legacy (removed) | `/connect/{id}` flat path |

No change to public route file names. Legacy `/connect/[id]` preserved as compatibility shim.

---

## Root cause summary

The primary defect cluster was **legacy `/connect/{id}` routing**:

1. `connect/[id].tsx` always redirected to `/messages`, discarding the ID.
2. Notifications and push handlers still targeted `/connect/{conversation_id}`.
3. `ScopeConnect` targeted `/connect/{user_id}` for new personal DMs.

Secondary defects:

4. Scope bar OPEN ignored `/messages` and MZB routes.
5. MZB profile entry did not align `activeScope` with MZB organization.

Scoped workspace Connect (ORG/CLUSTER inline thread) was already correctly isolated from global `/messages` when using top-tab CONNECT.
