# BUKLOD General Cleanup Audit

**Date:** 2026-08-19  
**Scope:** `src/` production app (Expo/React Native)  
**Context:** Post-performance pass + Wall/reactions update; pre-Android push hygiene.

---

## Summary

| Category | Count |
|----------|-------|
| SAFE TO REMOVE (implemented) | 18 |
| SAFE TO CONSOLIDATE (deferred) | 6 |
| NEEDS REVIEW | 14 |
| DO NOT TOUCH | 12 |

---

## SAFE TO REMOVE — implemented (LOW)

| File | Issue | Reason unused | Action | Risk |
|------|-------|---------------|--------|------|
| `src/app/(tabs)/buklod.tsx` | `ExpoImage`, `BuklodSponsorSlot` imports | Never referenced in JSX | Removed imports | LOW |
| `src/app/(tabs)/buklod.tsx` | `Share`, `StyleSheet` imports | Only used by removed `shareOutside` / unused StyleSheet | Removed imports | LOW |
| `src/app/(tabs)/buklod.tsx` | `HELP` constant | Audience help copy never shown | Removed | LOW |
| `src/app/(tabs)/buklod.tsx` | `RX` alias | Only used by removed `reactionLabel` | Removed | LOW |
| `src/app/(tabs)/buklod.tsx` | `reactionLabel`, `commentReactionTotal` | Superseded by `BuklodReactionAction` | Removed functions | LOW |
| `src/app/(tabs)/buklod.tsx` | `takeCommunityPhoto`, `chooseCommunityPhoto` | Composer uses `pickPhoto` + editor | Removed functions | LOW |
| `src/app/(tabs)/buklod.tsx` | `shareOutside` | No UI wired to external share helper | Removed function | LOW |
| `src/app/(tabs)/buklod.tsx` | `feedLimit` / `setFeedLimit` state | `setFeedLimit` never called; not read in `load` | Removed state + dep | LOW |
| `src/app/(tabs)/buklod.tsx` | `feedMode` state | Hardcoded `p_mode:'for_you'` in RPC | Removed state | LOW |
| `src/app/(tabs)/buklod.tsx` | `composerHeight` state | Value never read; only reset on publish | Removed state + reset | LOW |
| `src/app/(tabs)/buklod.tsx` | `activeScope` in `LegacyPublicBuklodScreen` | Destructured but unused (PUBLIC-only screen) | Removed destructure | LOW |
| `src/app/(auth)/login.tsx` | `console.log` on login click | Dev diagnostic; logs identifier | Removed | LOW |
| `src/lib/buklodCommunityReactions.ts` | `isBuklodCommunityReactionKey` | No imports in project | Removed export | LOW |
| `src/components/BuklodExclusiveScopeCommunity.tsx` | `expo-image-manipulator` import | Photo flow uses `BuklodPhotoEditor` | Removed import | LOW |
| `src/components/BuklodExclusiveScopeCommunity.tsx` | Default `React` import | JSX transform; no `React.` usage | Named hooks import only | LOW |
| `src/app/post/[id].tsx` | `Image` from `react-native` | Media uses `ExpoImage` | Removed import | LOW |
| `src/app/post/[id].tsx` | `rx`, `rxBtn`, `rxText` styles | Legacy reaction buttons removed | Removed style keys | LOW |

---

## SAFE TO CONSOLIDATE — deferred (LOW–MEDIUM)

| File | Issue | Proposed action | Risk |
|------|-------|-----------------|------|
| `src/app/(tabs)/buklod.tsx` | `setCategory` / `setAudience` unused setters | Use `const [category]` / `const [audience]` only | LOW — **partially done** |
| Multiple feeds | Inline FlatList props vs `FLATLIST_TUNING` | Import shared tuning where not already | MEDIUM |
| `src/lib/clusterLabels.ts` + screens | Repeated cluster label formatting | Single helper already exists; audit callers | MEDIUM |
| `src/components/BuklodReactionAction.tsx` | Reaction option list | Already centralized in `BUKLOD_COMMUNITY_REACTION_OPTIONS` | LOW — done |
| `src/app/(tabs)/buklod.tsx` | `prepareCommunityPhoto` vs scoped photo prep | Share helper only if identical | MEDIUM |
| `src/lib/buklodCommunityWallMedia.ts` + reactions | Duration/size constants | Keep separate domains (Wall vs Reels) | MEDIUM — do not merge rules |

---

## NEEDS REVIEW — not changed

| Item | Issue | Reason | Risk |
|------|-------|--------|------|
| `BUKLOD_PLAYSTORE_ARCHIVE_CHECK/` | Full duplicate tree | Archive / Play Store snapshot | HIGH if deleted |
| `.buklod-backups/` | Timestamped backups | Local recovery copies | HIGH |
| `*.social-backup` files | Old community UI snapshots | May be reference-only | MEDIUM |
| `PATCH_*` / `PERF*` comment markers | Historical patch labels | Some document compatibility | LOW–MEDIUM |
| `console.warn` across app | Error-path logging | Legitimate diagnostics | DO NOT remove blindly |
| `src/lib/performanceInstrumentation.ts` | `console.debug` in dev marks | Intentional perf instrumentation | KEEP |
| Route files under `src/app/` | Possibly low-traffic screens | Deep links, notifications, admin | HIGH |
| `src/app/admin/dev-role-lab.native.tsx` | Dev-only native screen | May be build-gated | MEDIUM |
| Asset duplicates in `assets/` | Multiple icon/guide variants | Splash/native config refs | MEDIUM |
| `@shopify/flash-list` | Installed but limited direct imports | May be future perf path | LOW |
| `celebrate` reaction key in Connect | Different product surface | Not Wall reactions | MEDIUM |
| External share RPC `request_external_post_share_v2` | RPC still in DB; UI removed from public wall | Product may re-enable share UI | MEDIUM |
| `category` UI removed from public composer | State still drives RPC `p_category` | Behavior unchanged at `'reflection'` | LOW |

---

## DO NOT TOUCH

| Area | Reason |
|------|--------|
| `supabase/migrations/`, RPCs, RLS | Database cleanup out of scope |
| Auth, Recovery PIN, admin gates | Security / business logic |
| `BuklodScopeProvider` optimistic `selectScope` | Performance pass |
| `notifications/index.tsx` navigate-before-read | Performance pass |
| `scope/index.tsx` search debounce behavior | Performance pass |
| `FLATLIST_TUNING`, `performanceInstrumentation.ts` | Performance pass |
| Wall video 600s / Reels 60s rules | Wall update |
| `BuklodReactionAction` tap/long-press behavior | Wall/reactions update |
| `BuklodCommunityCommentBubble` long-press menu | Wall/reactions update |
| Expo Router route paths / `_layout.tsx` stacks | Navigation semantics |
| Stream Video / Connect / Giving webhooks | Production integrations |

---

## Route safety

- **No route files deleted or renamed.**
- Public Community redirects non-PUBLIC scopes via `Redirect` to `/scope?section=community` — preserved.
- Notification paths (`/post/[id]`, `/connect/...`) unchanged.
- Moderation report route `/moderation/report` unchanged.

---

## Package.json — suspicious / undocumented (no uninstall)

| Package | Note |
|---------|------|
| `@shopify/flash-list` | In deps; sparse direct imports — may be intentional for upcoming list work |
| `@expo/ui` | Plugin/UI kit — verify expo config usage before removal |
| Multiple `@stream-io/*` | Required for calls; heavy but active |
| `jest` / `jest-expo` | In devDeps; `npm test` failed locally (jest not on PATH) — env issue, not unused |

**No packages removed.**

---

## Assets — documented only

- `assets/buklod-guide/*` — guide avatar poses; used by `BuklodGuideAvatar`
- Duplicate trees under archive folders — not part of active `src` build
- No automatic asset deletion performed

---

## Backend — deferred

All `supabase/` migrations, Edge Functions, and SQL remain untouched.

---

## Next medium/high opportunities (future passes)

1. Re-enable or formally remove external share UI + `request_external_post_share_v2` wiring.
2. Archive folder policy (move `BUKLOD_PLAYSTORE_ARCHIVE_CHECK` outside repo or `.gitignore`).
3. Broad `console.warn` → structured logging (Sentry) without losing diagnostics.
4. FlashList adoption audit for longest feeds (if measured win).
5. Category/audience picker UI vs fixed `'public'`/`'reflection'` on public wall composer.
