# BUKLOD Safe Area Audit

**Date:** 2026-08-19  
**Scope:** Global + scoped screens, navigation shells, AdMob, keyboard surfaces

---

## Root architecture

| Item | Status | Notes |
|------|--------|-------|
| `SafeAreaProvider` at app root | **FIXED** | Added to `src/app/_layout.tsx` (was missing — `useSafeAreaInsets()` previously returned 0) |
| Single provider (no nesting) | **ALREADY SAFE** | One root provider only |
| Stack `contentStyle: { flex: 1 }` | **FIXED** | Ensures route content shares space correctly with persistent bottom nav |
| Shared helpers `src/lib/buklodSafeArea.ts` | **FIXED** | Central nav visibility, scroll bottom inset, footer-ad padding |

---

## Shared components

| Component | Top | Bottom | Status |
|-----------|-----|--------|--------|
| `SwipeDashboardHeader` (`(tabs)/_layout.tsx`) | `insets.top` | — | **ALREADY SAFE** (works once provider exists) |
| `BuklodScopedDashboardHeader` | `insets.top` on shell | — | **FIXED** |
| `BuklodPersistentBottomNav` | — | `insets.bottom` on shell | **ALREADY SAFE** |
| `BuklodScreenBottomBanner` | — | Smart padding via `useBuklodFooterAdBottomPadding()` | **FIXED** (no double system inset when nav visible) |
| `useBuklodPresentation().shared.content` | — | Dynamic `useBuklodScrollBottomInset()` | **FIXED** |
| `BuklodConnectThread` | Header `insets.top` | Nav-aware `paddingBottom` | **FIXED** |
| Reels (`reels/index.tsx`) | Controls use `insets.top/bottom` | Immersive video unchanged | **ALREADY SAFE** |
| `BuklodCommunityReactionDetailsSheet` | — | `insets.bottom` on sheet | **ALREADY SAFE** |

---

## Screen classification

### FIXED (this pass)

| Screen / area | Change |
|---------------|--------|
| Root layout | `SafeAreaProvider` + Stack flex |
| Public Home (`home.tsx`) | Via `useBuklodPresentation` scroll inset |
| Community (`buklod.tsx`) | Dynamic list `paddingBottom` |
| Connect inbox (`messages.tsx`) | List + banner + nav inset |
| Notifications (`notifications/index.tsx`) | Top `insets.top` + scroll bottom inset |
| Login (`(auth)/login.tsx`) | Top/bottom inset on scroll content |
| Scoped workspace header | Top inset on org/cluster/MZB header |
| Organization/MZB Home (`BuklodScopeHomeDashboard`) | Scroll bottom inset |
| Cluster Home (`BuklodClusterHomeCommandCenter`) | Scroll bottom inset |
| Scoped Community Wall (`BuklodExclusiveScopeCommunity`) | FlatList bottom inset |
| Legacy scope Home / ScopeConnect (`scope/index.tsx`) | Scroll bottom inset |
| Message threads (`BuklodConnectThread`) | Bottom padding reserves global nav height |

### ALREADY SAFE (verified / relies on existing patterns)

| Screen | Reason |
|--------|--------|
| Tabs with `SwipeDashboardHeader` | Top inset in custom header |
| Reels full-screen | Edge-to-edge video; controls inset-aware |
| `BuklodPersistentBottomNav` | Uses real `insets.bottom` |
| Scoped delete screen (`/scope/delete`) | Separate admin route (not Home) |
| Cluster manage feature delete entry | Protected Manage path only |

### NEEDS REVIEW (device QA recommended)

| Screen | Reason |
|--------|--------|
| All `scope/manage/*` admin forms | Stack screens — verify on small Android + keyboard |
| Organization portal list (`/organizations`) | Not individually patched; may inherit stack safe area only |
| Modals outside reaction sheet | Audit per-modal on device |
| `(auth)/register` | Not patched in this pass (same pattern as login if needed) |
| Profile `/me` | Uses tabs header for top; scroll inset via presentation hook |
| Office / call overlays | Stream video UI — verify on device |

---

## Known overlap risks addressed

| Risk | Mitigation |
|------|------------|
| Double top inset (header + screen) | Scoped header owns top; tab screens use `SwipeDashboardHeader` only |
| Double bottom inset (nav + ad + system) | `useBuklodFooterAdBottomPadding()` skips system inset when nav visible |
| List last row hidden under nav | `useBuklodScrollBottomInset()` includes persistent nav occupied height |
| Composer under Android nav (threads) | `BuklodConnectThread` reserves nav height when nav visible |
| Hardcoded `paddingBottom: 50` | Replaced with inset helpers on Community + Notifications |

---

## AdMob + safe area hierarchy

**Home (tabs):** scroll content → `BuklodScreenBottomBanner` → global bottom nav (with system inset)

**Connect inbox:** list → banner → inbox tabs → global nav

**Open thread:** no inbox banner; composer above nav reservation

---

## Keyboard

| Surface | Status |
|---------|--------|
| Global bottom nav | Hides on `keyboardDidShow` — **ALREADY SAFE** |
| Connect thread | `KeyboardAvoidingView` + nav reservation when keyboard closed |
| Login | `KeyboardAvoidingView` + scroll insets |

---

## Device verification

**PENDING** — Android QA required for 3-button vs gesture navigation, notch/cutout devices, and keyboard open/close on Connect.
