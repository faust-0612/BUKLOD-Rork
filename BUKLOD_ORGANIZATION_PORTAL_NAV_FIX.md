# BUKLOD Organization Portal Navigation Fix

Date: 2026-08-19  
Status: **NOT FULLY COMPLETE** — requires Android device verification

---

## Portal/workspace coupling found

### Root cause

The Organizations **portal** (`/organizations`, `/organizations/manage`, `/organizations/join`, admin child routes) was being left on the navigation stack when entering the scoped workspace (`/scope`). Scoped workspace exit used **`router.back()`** for Organizations, which popped back through the portal instead of exiting to a global destination.

**Example bad stack:**

```
Profile → Organizations → Manage → Join → replace(/scope)
                                              ↑ workspace
Back from /scope → Manage → Organizations → Profile   ❌ portal treated as internal parent
```

Clusters already exited via `selectScope(PUBLIC)` + `router.replace('/home')`. Organizations did not — they fell through to `router.back()`.

### Secondary coupling

| Issue | Location | Effect |
|-------|----------|--------|
| Portal entry used `replace('/scope')` without `scopeId` | `join.tsx`, `suborganizations.tsx`, `create.tsx` | Workspace relied on stale `activeScope`; stack not collapsed |
| Admin "Open live workspace" used `router.push('/scope?...')` | `manage-feature.tsx` | Pushed workspace atop deep admin stack |
| Profile tiles used `router.push('/scope')` | `BuklodProfileMembershipNav.tsx`, `me.tsx` | Extra stack entries (acceptable for profile entry, but missing explicit `scopeId`) |
| ScopeBar OPEN used `router.push` | `BuklodScopeBar.tsx` | Could stack workspace atop global routes |
| MZB profile entry used `router.push` | `BuklodProfileMembershipNav.tsx` | Could stack MZB atop profile unnecessarily |

---

## Route contract (after fix)

### GLOBAL (portal / management)

```
/(tabs)/me → /organizations → /organizations/manage → /organizations/join
                         → /organizations/scope-manage → admin child routes
```

Portal screens are **entry/management only**. They are not workspace tabs.

### SCOPED (workspace)

```
/scope?section=home|community|connect&scopeId={exactScopeId}
```

Internal tabs: **Home ↔ Community ↔ Connect** (query param `section`, no portal routes).

### MZB (organization workspace, separate shell)

```
/mzb/home | /mzb/community | /mzb/messages | …
```

Does not route through `/organizations/*`.

---

## New navigation helpers

**File:** `src/lib/buklodScopeRoute.ts`

| Helper | Purpose |
|--------|---------|
| `enterScopedWorkspace(selectScope, scopeId, options)` | Select scope + navigate with explicit `scopeId` in URL |
| `exitScopedWorkspace(selectScope, scopes, destination)` | Reset to PUBLIC + `dismissAll()` + `replace` global destination |
| `parseScopedWorkspaceSection(route)` | Parse `section` from `/scope?...` admin links |

**Portal entry** uses `{ fromPortal: true }` → `router.dismissAll()` then `router.replace(...)` with scoped path.

**Profile/direct entry** uses `{ navigation: 'push' }` → back returns to Profile (not portal).

---

## Entry behavior (fixed)

| Source | Before | After |
|--------|--------|-------|
| Join / open active org | `selectScope` + `replace('/scope')` | `enterScopedWorkspace(..., { fromPortal: true })` |
| Sub-org child open | `selectScope` + `replace('/scope')` | `enterScopedWorkspace(..., { fromPortal: true })` |
| Create org → Open workspace | `replace('/scope')` | `enterScopedWorkspace(..., { fromPortal: true })` |
| Admin manage-feature → live workspace | `push('/scope?section=…')` | `enterScopedWorkspace(..., { fromPortal: true, section })` |
| Profile MY COMMUNITIES tile | `push('/scope')` | `enterScopedWorkspace(..., { navigation: 'push' })` with `scopeId` |
| Profile My Cluster | `push('/scope')` | `enterScopedWorkspace(..., { navigation: 'push' })` with `scopeId` |
| MZB profile tile | `push('/mzb/home')` | `replace('/mzb/home')` after `selectScope` |
| ScopeBar OPEN | `push(workspaceHref)` | `replace(workspaceHref)` |

Portal stack is collapsed on workspace entry. No duplicate portal → wrapper → portal chain.

---

## Internal Back behavior (fixed)

| Context | Behavior |
|---------|----------|
| Workspace Home → Community → header back | Returns to **workspace Home** section |
| Community / Connect → Android hardware back | Returns to **workspace Home** section (not portal) |
| Workspace Home → header back | `exitScopedWorkspace` → global `/home` (PUBLIC scope) |
| Connect inline thread → back | `openSection('home')` (unchanged) |
| Stack thread routes | `router.back()` to inbox (unchanged) |

**File:** `src/app/scope/index.tsx`
- `exitWorkspace` for `ORGANIZATION` and `CLUSTER` → `exitScopedWorkspace(..., '/home')`
- Android `BackHandler`: non-home sections → Home tab; home section → exit workspace
- Error state back → `exitWorkspace()` (not raw `router.back()`)

Ordinary internal navigation **never** returns to Organizations portal.

---

## Explicit exit behavior (preserved)

| Exit path | Behavior |
|-----------|----------|
| Global bottom nav | `selectScope(PUBLIC)` + `replace(globalTab)` — unchanged |
| Workspace header back (root Home) | `exitScopedWorkspace` → `/home` |
| Profile → Organizations | Intentional portal access — unchanged (`router.push('/organizations')`) |

Scope is **not** cleared during internal section changes. PUBLIC reset only on intentional global exit.

---

## MZB / Sub-org / Cluster impact

| Scope type | Entry | Exit | Portal coupling |
|------------|-------|------|-----------------|
| Organization | `enterScopedWorkspace` from portal; push from profile | `exitScopedWorkspace` | **Fixed** |
| Sub-organization | Same as org (child `scopeId`) | Same | **Fixed** |
| Cluster | Profile push with `scopeId` | `exitScopedWorkspace` (was already replace home) | **Improved** — dismissAll added |
| MZB | `replace('/mzb/home')` | MZB shell account → profile | No org portal involvement |

---

## Files changed

| File | Change |
|------|--------|
| `src/lib/buklodScopeRoute.ts` | `enterScopedWorkspace`, `exitScopedWorkspace`, `parseScopedWorkspaceSection` |
| `src/app/scope/index.tsx` | Org/cluster exit; Android back; error back |
| `src/app/organizations/join.tsx` | Portal entry helper |
| `src/app/organizations/suborganizations.tsx` | Sub-org workspace entry |
| `src/app/organizations/create.tsx` | Post-create workspace entry |
| `src/app/organizations/manage-feature.tsx` | Admin → live workspace entry |
| `src/components/BuklodProfileMembershipNav.tsx` | Profile tiles + MZB replace |
| `src/components/BuklodScopeBar.tsx` | OPEN → replace |
| `src/app/(tabs)/me.tsx` | Cluster entry helper |
| `__tests__/buklodScopeRoute.test.ts` | Section parser test |

---

## TypeScript

```
npx tsc --noEmit
```

**Result: PASS**

---

## Runtime verification

| # | Case | Status |
|---|------|--------|
| 1–5 | Portal → Org A → internal tabs → back | **PENDING DEVICE VERIFICATION** |
| 6–8 | Connect thread back | **PENDING DEVICE VERIFICATION** |
| 9 | Global bottom Home exit | **PENDING DEVICE VERIFICATION** |
| 10 | Profile → Organizations portal | **PENDING DEVICE VERIFICATION** |
| 11–12 | Re-enter / Org A→B switch | **PENDING DEVICE VERIFICATION** |
| 13–15 | MZB / Sub-org / Cluster isolation | **PENDING DEVICE VERIFICATION** |
| 16 | Android hardware Back | **PENDING DEVICE VERIFICATION** |

---

## Native dependencies added

**NONE**

---

## Completion labels

| Label | Status |
|-------|--------|
| CODE PASS | Yes |
| DEVICE VERIFIED | No |

Do not mark FULLY COMPLETE until Android confirms the Organizations portal is **only** a global entry/management screen and never appears during internal Organization workspace navigation.
