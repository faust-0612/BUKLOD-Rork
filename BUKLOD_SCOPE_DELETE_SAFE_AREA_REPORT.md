# BUKLOD Scope Delete Removal & Safe Area Report

**Date:** 2026-08-19  
**Project:** BUKLOD Main Expo/React Native

---

## 1. `DELETE THIS SCOPE` — locations found

| Location | UI text | Context |
|----------|---------|---------|
| `src/app/scope/index.tsx` | `DELETE THIS SCOPE` | Organization scoped workspace Home (below header, above section tabs) |
| `src/app/clusters/manage-feature.tsx` | `Delete Managed Scope` | **Retained** — Cluster Manage → More Admin Controls (protected) |
| `src/app/scope/delete.tsx` | `Delete Scope` | **Retained** — dedicated admin delete screen (RPC-backed) |

No other Home/dashboard surfaces (MZB, Cluster command center, sub-org) exposed a prominent delete button on Home.

---

## 2. Locations removed

| File | Removed |
|------|---------|
| `src/app/scope/index.tsx` | Entire `DELETE THIS SCOPE` `Pressable` block (`PATCH_174B_R2_DELETE_MANAGED_SCOPE_ENTRY`) from scoped workspace Home |

**Not removed (intentional):**

- `src/app/scope/delete.tsx` — full delete flow with authorization, preview, confirmation
- `src/app/clusters/manage-feature.tsx` — link from Cluster Manage admin area only
- Backend RPC `buklod_delete_managed_scope_v1`, SQL, RLS — unchanged

---

## 3. Protected delete capability retained

Administrative scope deletion remains available only outside normal Home:

- **Route:** `/scope/delete`
- **Cluster entry:** Manage → More Admin Controls → Delete Managed Scope
- **Guards:** Existing screen authorization + confirmation flow in `scope/delete.tsx`

Ordinary Organization / MZB / Cluster Home dashboards no longer surface destructive delete actions.

---

## 4. Root safe-area architecture

| Item | Implementation |
|------|----------------|
| Provider | `SafeAreaProvider` wrapping app in `src/app/_layout.tsx` |
| Helpers | `src/lib/buklodSafeArea.ts` |
| Nav visibility | `isBuklodPersistentNavHidden()` shared with `BuklodPersistentBottomNav` |
| Scroll padding | `useBuklodScrollBottomInset()` |
| Footer ads | `useBuklodFooterAdBottomPadding()` |
| Presentation hook | `useBuklodPresentation()` merges scroll bottom into `shared.content` |

**Critical fix:** The project had **no** `SafeAreaProvider` before this pass; components calling `useSafeAreaInsets()` received zero insets.

---

## 5. Shared components changed

| File | Change |
|------|--------|
| `src/app/_layout.tsx` | `SafeAreaProvider`; Stack `contentStyle: { flex: 1 }` |
| `src/lib/buklodSafeArea.ts` | **New** shared safe-area helpers |
| `src/components/BuklodPersistentBottomNav.tsx` | Uses shared `isBuklodPersistentNavHidden` |
| `src/components/BuklodScopedDashboardHeader.tsx` | `paddingTop: insets.top` |
| `src/components/BuklodScreenBottomBanner.tsx` | Smart footer padding (no double system inset) |
| `src/hooks/useBuklodPresentation.ts` | Dynamic `shared.content` bottom padding |
| `src/components/BuklodConnectThread.tsx` | Nav-aware bottom padding for composer |

---

## 6. Screens fixed — top inset

| Screen | Fix |
|--------|-----|
| Scoped org/cluster/MZB header | `BuklodScopedDashboardHeader` |
| Notifications | `paddingTop: insets.top` |
| Login | Scroll `paddingTop: insets.top` |
| Public tabs (Home, Community, Connect, Prayer) | Existing `SwipeDashboardHeader` (now effective with provider) |

---

## 7. Screens fixed — bottom inset

| Screen | Fix |
|--------|-----|
| Public Home | `useBuklodPresentation` |
| Community Wall | `buklod.tsx` list `paddingBottom` |
| Connect inbox | `messages.tsx` list padding |
| Notifications | `useBuklodScrollBottomInset` |
| Organization/MZB Home | `BuklodScopeHomeDashboard` |
| Cluster Home | `BuklodClusterHomeCommandCenter` |
| Scoped Community Wall | `BuklodExclusiveScopeCommunity` FlatList |
| Legacy scope Home / ScopeConnect | `scope/index.tsx` |
| Message threads | `BuklodConnectThread` nav reservation |

---

## 8. Bottom navigation

- `BuklodPersistentBottomNav` unchanged behavior; now shares nav-hide rules via `buklodSafeArea.ts`
- Still uses real `insets.bottom` on the nav shell
- Hides when keyboard is open

---

## 9. AdMob + safe area

- `BuklodScreenBottomBanner` uses `useBuklodFooterAdBottomPadding()` so ads do not sit under the system gesture area when global nav is visible
- Home order: content → banner → global nav (with system inset)

---

## 10. Keyboard handling

- Connect threads: existing `KeyboardAvoidingView`; bottom padding switches between nav reservation (keyboard closed) and system inset (keyboard open / nav hidden)
- Login: `KeyboardAvoidingView` + safe scroll padding
- Global nav auto-hides on keyboard — unchanged

---

## 11. Double-inset issues fixed

| Issue | Resolution |
|-------|------------|
| Zero insets everywhere | Added root `SafeAreaProvider` |
| Footer ad + nav + system triple padding | `useBuklodFooterAdBottomPadding()` |
| Hardcoded Community `paddingBottom: 50` | Replaced with dynamic inset |
| Thread composer under global nav | Nav occupied height padding |

---

## 12. TypeScript

```
npx tsc --noEmit
```

**PASS** (exit code 0)

---

## 13. Native dependencies added

**NONE**

---

## 14. Device verification status

**PENDING DEVICE VERIFICATION**

Code complete; Android device QA required per checklist (status bar, gesture bar, 3-button nav, keyboard on Connect, Home scroll-to-bottom with banner, scoped headers).

See also: `BUKLOD_SAFE_AREA_AUDIT.md`
