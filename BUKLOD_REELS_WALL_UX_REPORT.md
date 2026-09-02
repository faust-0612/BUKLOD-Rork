# BUKLOD Reels + Community Wall UX Report

Date: 2026-08-19

## Summary

Implemented Reels immersive navigation, vertical swipe playback, keyboard-safe comments, direct share flow, modern reactions, comment previews, and Community Wall reaction details without adding native dependencies.

## Files changed

| File | Change |
|------|--------|
| `supabase/migrations/20260818300000_reels_wall_ux_previews_reactions.sql` | Batch comment previews RPC, paginated reaction details RPC, `care` on `set_buklod_post_reaction_v4` |
| `src/lib/buklodPostCommentPreviews.ts` | Client helper for batch preview fetch |
| `src/components/BuklodCommunityCommentPreview.tsx` | Shared one-comment preview row |
| `src/components/BuklodCommunityReactionDetailsSheet.tsx` | On-demand reaction details sheet |
| `src/components/BuklodReactionAction.tsx` | `overlay`, `showSummary`, `onSummaryPress` |
| `src/components/BuklodPersistentBottomNav.tsx` | Hide nav on `/reels` |
| `src/app/reels/index.tsx` | Vertical reels, reactions, keyboard, share, preview |
| `src/app/(tabs)/buklod.tsx` | Public wall previews + reaction details |
| `src/components/BuklodExclusiveScopeCommunity.tsx` | Scoped wall previews + reaction details |

## 1. Reels — hide main app nav pane

- Added `/reels` to `shouldHide()` in `BuklodPersistentBottomNav`.
- Uses the existing global shell mechanism; nav restores automatically when leaving the route.
- No duplicate navigation state.

## 2. Reels — vertical swipe navigation

- Reels `FlatList` changed from horizontal paging to **vertical** paging (`pagingEnabled`, full viewport height snap).
- `onMomentumScrollEnd` tracks `contentOffset.y` for active index.
- `removeClippedSubviews` enabled on Android.
- Existing `preparePlayer` window (`activeIndex ± 1`) and `ReelVideo` `active` prop preserved so only the active Reel plays.

## 3. Reels — keyboard / comment composer

- Comments modal wrapped in `KeyboardAvoidingView` (`padding` on iOS, `height` on Android).
- Backdrop tap-to-dismiss preserved; sheet uses `maxHeight` + safe-area padding instead of fixed height.
- Composer and Send stay above the keyboard without fixed pixel offsets.

## 4. Reels — removed redundant share approval UX

- Removed blocking **“Approval Requested”** alert that prevented opening the share flow.
- `request_external_post_share_v2` still runs (authorization + pending-request notification on first attempt).
- If file share is allowed: `Sharing.shareAsync` with downloaded media.
- Otherwise: `Share.share` with text immediately (user gets the OS share sheet directly).
- Backend validation and error alerts on real failures remain.

## 5. Reels — modern reaction control

- Replaced legacy 3-icon reaction rail with `BuklodReactionAction` + canonical 7-reaction set.
- Tap = default/current reaction; long-press = compact picker.
- `overlay` styling for dark Reel UI; `reactingRef` debounce in shared component prevents duplicate rapid taps.
- Optimistic row updates preserved (no full feed reload).

## 6. Reels — one comment preview

- After feed load, one batch `get_buklod_post_comment_previews_v1` call merges previews into rows.
- `BuklodCommunityCommentPreview` shown in bottom info when a preview exists; tap opens comments.
- No empty placeholder when `comment_count` is 0 / no eligible comment.

## 7. Community Wall — reaction details

- `BuklodCommunityReactionDetailsSheet` opens when reaction summary chips are tapped (`onSummaryPress`).
- Loads `get_buklod_post_reactions_v1` on demand with pagination (40/page).
- Optional filter chips by reaction type when multiple types exist.
- Scoped via `can_view_community_post_v2` in RPC (same visibility as post).
- Virtualized `FlatList` for large lists.

## 8. Community Wall — one comment preview

- Public wall (`buklod.tsx`) and scoped wall (`BuklodExclusiveScopeCommunity.tsx`) batch-fetch previews after feed load.
- Preview row below engagement with avatar, name, truncated text, optional timestamp (default variant).
- Tap opens comment thread; full comment count unchanged.

## Data / query changes (N+1 avoidance)

| RPC | Purpose |
|-----|---------|
| `get_buklod_post_comment_previews_v1(uuid[])` | One batch query per feed load |
| `get_buklod_post_reactions_v1` | On-demand paginated reaction users |
| `set_buklod_post_reaction_v4` | Added `care` key parity |

No per-post comment or reaction list prefetch in feed loads.

## Performance safeguards

- Reel list: localized `activeIndex`, `windowSize: 3`, optimistic reaction/comment row patches.
- Scoped community: existing `FLATLIST_TUNING.scopedCommunity` preserved.
- Reaction details sheet is a separate modal — feed rows do not rerender when it opens.
- Comment previews merged in one RPC per load, not per row.

## TypeScript

```
npx tsc --noEmit
```

**Result: PASS** (exit code 0)

## Native dependencies added

**NONE**

## Intentionally deferred

- Embedding preview columns directly into `get_buklod_public_community_feed_v7_page` / `buklod_scope_social_feed_v1` return types (would require large RPC signature migrations); batch preview RPC is equivalent for N+1 avoidance.
- Full video file share for non-approved third-party Reels remains gated by backend; text share opens immediately instead of a blocking approval screen.

## Manual QA checklist

See task spec sections 12 (Reels 1–21, Wall 22–33). Recommended device checks: Android keyboard in Reels comments, vertical swipe after reaction/comment interaction, scoped org/cluster reaction details access.
