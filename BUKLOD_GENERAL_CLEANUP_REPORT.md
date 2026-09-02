# BUKLOD General Cleanup Report

**Date:** 2026-08-19  
**Type:** Low-risk hygiene pass (pre-Android update push)

---

## 1. Files changed

| File | Change summary |
|------|----------------|
| `src/app/(tabs)/buklod.tsx` | Dead imports, helpers, state, legacy photo/share paths removed |
| `src/app/(auth)/login.tsx` | Dev `console.log` on login removed |
| `src/lib/buklodCommunityReactions.ts` | Unused `isBuklodCommunityReactionKey` removed |
| `src/components/BuklodExclusiveScopeCommunity.tsx` | Unused imports cleaned |
| `src/app/post/[id].tsx` | Unused import + legacy reaction styles removed |
| `BUKLOD_GENERAL_CLEANUP_AUDIT.md` | **New** — audit classification |
| `BUKLOD_GENERAL_CLEANUP_REPORT.md` | **New** — this report |

**Not modified:** `supabase/`, routes, performance libs, Wall/reaction components logic, `package.json`.

---

## 2. Unused imports removed

- `buklod.tsx`: `expo-image` (`ExpoImage`), `BuklodSponsorSlot`, `Share`, `StyleSheet`
- `BuklodExclusiveScopeCommunity.tsx`: `expo-image-manipulator`, default `React` namespace
- `post/[id].tsx`: `Image` from `react-native`

---

## 3. Dead code removed

- `buklod.tsx`: `HELP`, `RX`, `reactionLabel`, `commentReactionTotal`, `takeCommunityPhoto`, `chooseCommunityPhoto`, `shareOutside`
- `buklod.tsx`: unused state (`feedLimit`, `feedMode`, `composerHeight`, legacy `activeScope` destructure)
- `buklodCommunityReactions.ts`: `isBuklodCommunityReactionKey`
- `post/[id].tsx`: unused StyleSheet keys `rx`, `rxBtn`, `rxText`

---

## 4. Debug logs removed

| File | Removed |
|------|---------|
| `src/app/(auth)/login.tsx` | `console.log('[BUKLOD LOGIN] CLICK/ENTER', …)` |

**Kept:** All `console.warn` error handlers, `performanceInstrumentation.ts` `console.debug`, and legitimate catch-path logging.

---

## 5. Duplicate helpers / constants consolidated

- **None merged in this pass** (deferred to avoid regression).
- Public wall `category` / `audience` setters removed where unused; values still passed to RPCs as before.

---

## 6. Styles cleaned

- `post/[id].tsx`: removed unused legacy reaction button styles (`rx`, `rxBtn`, `rxText`).

---

## 7. Components simplified

- No component API or layout changes.
- `BuklodExclusiveScopeCommunity.tsx`: import-only cleanup.

---

## 8. Files deliberately NOT touched (risk)

- All `src/app/**` route files (except non-route `buklod.tsx` screen logic cleanup)
- `BuklodScopeProvider`, `performanceInstrumentation.ts`, `notifications/index.tsx`, `scope/index.tsx`
- `BuklodExclusiveScopeCommunity.tsx` wall/reaction/comment behavior
- `BuklodReactionAction`, `BuklodCommunityCommentBubble`
- Auth, billing, reports, attendance, moderation RPC callers
- Entire `supabase/` tree

---

## 9. Suspicious unused dependencies (documented only)

See audit § Package.json. **No packages removed.**

---

## 10. Suspicious assets (documented only)

- `BUKLOD_PLAYSTORE_ARCHIVE_CHECK/`, `.buklod-backups/`, `*.social-backup` — not deleted.

---

## 11. Route safety findings

- No routes renamed or deleted.
- `Redirect` for non-PUBLIC community scopes preserved.
- Deep links and moderation report path unchanged.

---

## 12. Backend items deferred

- Migrations, RPCs, RLS, storage policies, Edge Functions — **no changes**.

---

## 13. Performance behavior preserved

- Optimistic scope selection, notification navigation order, scope search behavior, `FLATLIST_TUNING`, feed instrumentation — **unchanged**.

---

## 14. Wall update preserved

- 600s wall video rules, Reels separation, reaction tap/long-press, comment long-press menu, comment reactions — **unchanged**.

---

## 15. TypeScript result

```text
npx tsc --noEmit
```

**Result:** Pass (exit code 0).

---

## 16. Lint / test result

- **Lint:** No ESLint config in repo; not run.
- **Tests:** `npm test` failed — `jest` not available on local PATH (pre-existing env issue). No test files modified.

---

## 17. Native dependencies added

**NONE**

---

## 18. Packages added

**NONE**

---

## 19. Remaining medium/high-risk cleanup opportunities

1. External share UI vs orphaned `shareOutside` / `request_external_post_share_v2`.
2. Archive / backup folder policy outside production tree.
3. Optional FlashList rollout with measurement.
4. Consolidate duplicate photo-prep helpers after behavioral diff review.
5. Category/audience composer UI vs fixed RPC defaults on public wall.

---

## Behavior confirmation

This pass removed **dead code and diagnostics only**. Public wall posting, reactions, comments, scoped community, performance optimizations, and Wall video rules behave the same as before cleanup.
