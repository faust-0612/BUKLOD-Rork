# BUKLOD AdMob & Community Navigation Update Report

**Date:** 2026-08-19  
**Project:** BUKLOD Main Expo/React Native (`BUKLOD_Production_Starter_v16`)

---

## 1. Community → Profile swipe removed

**Root cause:** Material Top Tab Navigator (`SwipeTabs`) in `src/app/(tabs)/_layout.tsx` had global `swipeEnabled: true`. Swiping right from Community (`buklod`) could advance to Profile (`me`).

**Fix:** Set `swipeEnabled: false` on the `buklod` tab screen options (same pattern already used for `me`). Community horizontal pager gestures no longer navigate to Profile. Profile remains reachable via bottom tab / intended navigation. Reels vertical swipe inside Community is unchanged.

---

## 2. Files changed

| File | Change |
|------|--------|
| `src/app/(tabs)/_layout.tsx` | Removed full-width top `DashboardSponsorPlacementSlot` / `BuklodTabAdStrip`; disabled Community tab pager swipe; moved `warmBuklodInterstitial()` to layout `useEffect` |
| `src/components/BuklodScopedDashboardHeader.tsx` | Removed `BuklodScopedHeaderBanner` from org/cluster scoped headers |
| `src/lib/buklodAdPlacements.ts` | **New** — `COMMUNITY_AD_INTERVAL`, `REELS_AD_INTERVAL`, `buildCommunityFeedWithInlineAds()` |
| `src/components/BuklodScreenBottomBanner.tsx` | **New** — shared full-width footer banner wrapper |
| `src/components/BuklodScreenBottomBanner.web.tsx` | **New** — web no-op stub |
| `src/app/(tabs)/buklod.tsx` | Public Community Wall: shared inline-ad helper (interval 6); removed legacy `buildBuklodCommunityFeedRows186K` |
| `src/components/BuklodExclusiveScopeCommunity.tsx` | Scoped Community Wall: inline ads via shared helper (Reels mode unchanged) |
| `src/app/(tabs)/home.tsx` | Public Home bottom banner |
| `src/components/BuklodScopeHomeDashboard.tsx` | Organization / MZB Home bottom banner |
| `src/components/BuklodClusterHomeCommandCenter.tsx` | Cluster / sub-cluster Home bottom banner |
| `src/app/scope/index.tsx` | Legacy scope Home bottom banner; scoped `ScopeConnect` member-list bottom banner |
| `src/app/(tabs)/messages.tsx` | Global Connect inbox list bottom banner (above inbox tabs, not in thread view) |

**Not removed (intentionally):** `BuklodTabAdStrip.tsx`, `BuklodScopedHeaderBanner.tsx` — dead from production paths but kept for reference; compact `BuklodHeaderSponsor` in tab header bar remains (not full-width top strip).

---

## 3. Old top banner placements removed

| Location | Component | Status |
|----------|-----------|--------|
| Global tabs layout below encouragement bar | `DashboardSponsorPlacementSlot` → `BuklodTabAdStrip` | **Removed** |
| Scoped org/cluster dashboard header | `BuklodScopedHeaderBanner` in `BuklodScopedDashboardHeader` | **Removed** |

Compact header sponsor ads (`BuklodHeaderSponsor` in tab title bar) were **not** removed — they are not full-width top strips.

---

## 4. Community inline-ad interval

- **Constant:** `COMMUNITY_AD_INTERVAL = 6` in `src/lib/buklodAdPlacements.ts`
- **Helper:** `buildCommunityFeedWithInlineAds()` inserts one ad marker after every 6 eligible posts
- **Short feeds:** No ad if fewer than 6 posts
- **No back-to-back:** Ads only follow post intervals; markers are distinct list rows with stable keys (`__buklod_inline_ad_*`)
- **Component:** `BuklodCommunityInlineAd` (existing `INLINE_ADAPTIVE_BANNER`)
- **Public Wall:** `src/app/(tabs)/buklod.tsx` (video posts still excluded from Wall list as before)
- **Scoped Wall:** `src/components/BuklodExclusiveScopeCommunity.tsx` (Wall mode only; Reels feed untouched)

---

## 5. Reels ad capability

**Audited:** `react-native-google-mobile-ads` integration in `src/lib/buklodAds.ts`

| Format | Present | Suitable for inline Reels feed |
|--------|---------|-------------------------------|
| Banner | Yes | No (not full-screen reel-like) |
| Interstitial | Yes | No (interrupts every swipe; not inline) |
| Native / rewarded interstitial / reel-style video | **No** | N/A |

**Decision:** Reels inline/video ads **DEFERRED**. No fake video ads, no banner-as-reel hack. `REELS_AD_INTERVAL = 8` reserved in `buklodAdPlacements.ts` for future native support.

---

## 6. Bottom Home banner placements

| Screen | File | Placement key |
|--------|------|---------------|
| Public Home | `src/app/(tabs)/home.tsx` | `home` |
| Organization / MZB Home | `src/components/BuklodScopeHomeDashboard.tsx` | `home` |
| Cluster / sub-cluster Home | `src/components/BuklodClusterHomeCommandCenter.tsx` | `home` |
| Legacy scope Home (CHURCH/LOCAL/etc.) | `src/app/scope/index.tsx` (`LegacyScopeHome`) | `home` |
| Scoped member Connect list (`ScopeConnect`) | `src/app/scope/index.tsx` | `messages` |

Banners sit at the end of scroll content (inside `ScrollView`), not over bottom navigation.

---

## 7. Bottom Connect banner placements

| Screen | File | Placement key |
|--------|------|---------------|
| Global personal + community inbox lists | `src/app/(tabs)/messages.tsx` | `messages` |
| Scoped member search list (CHURCH/LOCAL `ScopeConnect`) | `src/app/scope/index.tsx` | `messages` |

**Conservative exclusions (no banner):**

- Active message threads (`/connect/personal/[threadId]`, scoped `BuklodConnectThread`)
- Organization/cluster scoped Connect thread (`OrganizationCommunityConnect` in `scope/index.tsx`) — thread/composer surface; avoids keyboard overlap

---

## 8. AdMob components reused

- `BuklodAdMobBanner` — footer banners (`compact` mode collapses on failure)
- `BuklodCommunityInlineAd` — Wall inline rows
- `getBuklodBannerUnitId()` / `BuklodAdPlacement` from `src/lib/buklodAdUnits.ts`
- `initializeBuklodAds()` / `warmBuklodInterstitial()` from `src/lib/buklodAds.ts`
- **New wrapper:** `BuklodScreenBottomBanner` centralizes footer placement + safe-area padding

No new hardcoded production ad unit IDs were added.

---

## 9. Performance safeguards

- Inline ads are normal virtualized `FlatList` rows with stable keys; `useMemo` for feed row building
- `BuklodCommunityInlineAd` does not reload on pull-to-refresh (existing behavior preserved)
- Footer banners use `compact` mode — zero height when load fails (no giant placeholders)
- `warmBuklodInterstitial()` still runs once at tabs mount (non-blocking)
- Reels: no extra ad instances mounted

---

## 10. Ad load failure handling

- `BuklodAdMobBanner` `compact` mode: collapses container when SDK not ready or ad fails
- `BuklodCommunityInlineAd`: collapses on failure (existing)
- Screens remain fully usable; no navigation errors from ad init

---

## 11. TypeScript result

```
npx tsc --noEmit
```

**PASS** (exit code 0)

---

## 12. Native dependencies added

**NONE**

---

## 13. Device verification status

**PENDING** — code complete; manual QA recommended per checklist:

### Navigation
- [ ] Public Community swipe does NOT go to Profile
- [ ] Scoped Community swipe does NOT go to Profile
- [ ] Profile still reachable via tab/navigation
- [ ] Reels vertical swipe still works

### Top banner removal
- [ ] No full-width top banner on public tabs
- [ ] No full-width top banner on MZB/org scoped header
- [ ] No blank header gap

### Community ads
- [ ] Public + scoped Wall show inline ads ~every 6 posts
- [ ] No back-to-back ads
- [ ] Reactions/comments/pagination work

### Reels
- [ ] Vertical swipe works
- [ ] No fake reel ads (deferred)

### Home / Connect
- [ ] Bottom banners on Home variants
- [ ] Bottom banner on Connect inbox (not thread)
- [ ] No overlap with bottom nav / keyboard

### Failure handling
- [ ] Failed ads collapse without breaking layout
