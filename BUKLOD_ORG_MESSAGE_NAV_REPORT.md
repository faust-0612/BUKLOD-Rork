# BUKLOD Organization / MZB Message Navigation Report

Date: 2026-08-19

## Executive summary

Confirmed navigation defects centered on a **broken legacy `/connect/[id]` shim** that dropped thread IDs and sent users to the global `/messages` inbox. Notifications, push deep links, and scoped people-search taps all hit this path. Scoped workspace Connect (Organization / Sub-organization / Cluster top-tab CONNECT) was already implemented correctly as an inline scoped thread; the main leakage was through legacy global routes and stale scope context when entering MZB.

## Bugs found and fixed

### Bug 1 — Legacy `/connect/[id]` discarded thread identity (Critical)

- **Symptom**: Tapping a DM notification or legacy link opened global Connect inbox instead of the thread.
- **Root cause**: `src/app/connect/[id].tsx` redirected to `/messages` without using `id`.
- **Fix**: Redirect to `/connect/personal/[threadId]` with `threadId=id`; support `mode=user` for legacy user-id links.

### Bug 2 — Notification deep links used dead route (Critical)

- **Symptom**: `direct_message` notifications navigated to `/connect/{conversation_id}` → `/messages`.
- **Files**: `src/app/notifications/index.tsx`, `src/providers/NotificationProvider.tsx`
- **Fix**: Shared `buklodNotificationPath()` → `/connect/personal/{conversation_id}`.

### Bug 3 — Scoped people search used dead route (High)

- **Symptom**: `ScopeConnect` member taps opened `/connect/{user_id}` → global inbox.
- **File**: `src/app/scope/index.tsx`
- **Fix**: Navigate to `/connect/personal/[threadId]` with `threadId=new` + `targetUserId` (global personal DM per PATCH_172E).

### Bug 4 — Scope bar OPEN ignored Connect inbox (Medium)

- **Symptom**: On `/messages`, OPEN workspace went to `/scope?section=home` instead of connect.
- **File**: `src/components/BuklodScopeBar.tsx`
- **Fix**: Map `/messages` to `section=connect`.

### Bug 5 — Scope bar OPEN from MZB sent users to wrong workspace (High)

- **Symptom**: On `/mzb/messages`, OPEN could route to `/scope?section=home` with stale `activeScope`.
- **File**: `src/components/BuklodScopeBar.tsx`
- **Fix**: MZB routes map OPEN to `/mzb/messages`, `/mzb/community`, or `/mzb/home`.

### Bug 6 — MZB profile entry did not align active scope (High)

- **Symptom**: Entering MZB from profile left `activeScope` on previous Organization; scope bar / OPEN workspace could target wrong org.
- **File**: `src/components/BuklodProfileMembershipNav.tsx`
- **Fix**: `selectScope(mzbScope.scope_id)` before `router.push('/mzb/home')`.

## Global vs scoped Connect separation (preserved)

| Entry | Behavior | Status |
|-------|----------|--------|
| Bottom nav Connect | `selectScope(PUBLIC)` + `/messages` | Intentional global exit |
| Org/Cluster top CONNECT tab | `/scope?section=connect` inline scoped thread | Unchanged, correct |
| MZB Messages tab | `/mzb/messages` + `forcedScopeId` | Unchanged, correct |
| Scoped people DM | Global personal thread route | By design (PATCH_172E) |

## MZB-specific

- MZB inbox continues to use `forcedScopeId` from `findActiveMzbMemberScope`.
- Thread subroutes remain under `/mzb/connect/*`.
- Profile entry now sets `activeScope` to MZB org for consistent scope bar / workspace OPEN behavior.

## Thread back navigation

- Inline scoped Connect: `onBackOverride` returns to scope home section (unchanged).
- Stack routes (`/connect/personal/*`, `/mzb/connect/*`): `router.back()` returns to prior inbox (unchanged).
- No new `replace` loops introduced.

## Notification routing

- `direct_message` → personal thread route (fixed).
- `scope_id` in payload → `/scope?section=connect` (helper ready; no current backend kind found for scope message push).
- Post/community kinds unchanged.

## Share-to-Connect

- `BuklodPostInternalShare` uses RPC only; no navigation change required.
- Explicit destination selection unchanged.

## Stale state / race conditions

- No navigation delays reintroduced.
- MZB profile now aligns `activeScope` immediately (same pattern as other scope tiles).
- `BuklodScopeProvider.selectScope` still updates in-memory state before persistence (performance pass preserved).

## Files changed

| File | Change |
|------|--------|
| `src/lib/buklodNotificationNavigation.ts` | **New** — shared notification path builder |
| `src/app/connect/[id].tsx` | Redirect to personal thread route |
| `src/app/notifications/index.tsx` | Use shared notification paths |
| `src/providers/NotificationProvider.tsx` | Use shared notification paths |
| `src/app/scope/index.tsx` | Fix ScopeConnect personal DM navigation |
| `src/components/BuklodScopeBar.tsx` | Fix OPEN workspace for `/messages` and MZB |
| `src/components/BuklodProfileMembershipNav.tsx` | Select MZB scope on profile entry |
| `BUKLOD_ORG_MESSAGE_NAV_AUDIT.md` | Audit documentation |
| `BUKLOD_ORG_MESSAGE_NAV_REPORT.md` | This report |

## TypeScript

```
npx tsc --noEmit
```

**Result: PASS**

## Native dependencies added

**NONE**

## Deferred / not changed

- Scoped ORG/CLUSTER Connect remains inline (no inbox route split) — working as designed.
- No backend notification kinds for scope Connect messages were found; scope_id fallback added in helper for future payloads.
- Universal Share does not navigate after share — no routing fix needed.
- `BuklodCanonicalNavigationGuard` unchanged; `/messages` intentionally not forced to `/scope` for non-PUBLIC users using global inbox.

## QA matrix (manual)

Run the 26 cases in the task spec after deploying:

1. MZB Connect tab + thread back + tab switching
2. Organization A/B Connect isolation
3. Sub-org and Cluster scoped Connect
4. Global bottom Connect intentional exit
5. Notification DM opens correct thread
6. Share destinations (RPC-only, unchanged)
