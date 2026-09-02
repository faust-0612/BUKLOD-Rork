# BUKLOD Wall Video (10 min) — Implementation Report

> **2026-08-19 update:** BUKLOD product-level **video file-size caps were removed**. See [`BUKLOD_VIDEO_UPLOAD_SIZE_POLICY_REPORT.md`](./BUKLOD_VIDEO_UPLOAD_SIZE_POLICY_REPORT.md). Duration rules below remain valid (Wall ≤600s, Reels ≤60s).

## Summary

Normal Wall posts now support video up to **10 minutes (600 seconds)** via separate **Add Video** in the Wall composer. Reels remain a dedicated experience capped at **60 seconds**. No artificial per-user or daily Wall post-count limits were found or removed. Server-side validation, storage limits, and `is_reel` separation were added in a backward-compatible migration.

## Files changed

| File | Change |
|------|--------|
| `src/lib/buklodCommunityWallMedia.ts` | **New** — shared Wall/Reel duration and size constants, helpers |
| `supabase/migrations/20260818280000_wall_video_10min_foundation.sql` | **New** — `is_reel`, duration constraint, RPC updates, bucket limit |
| `src/app/(tabs)/buklod.tsx` | Public Wall: 600s validation, `p_is_reel: false`, RPC duration param |
| `src/components/BuklodExclusiveScopeCommunity.tsx` | Scoped walls: Wall vs Reel composers, feed filters, display badges |
| `src/lib/uploadCommunityVideoFile.ts` | Generic upload error strings (not Reel-only) |
| `src/lib/buklodCommunityReactions.ts` | **New** — canonical reaction keys |
| `src/components/BuklodCommunityCommentBubble.tsx` | **New** — long-press comment menu + reactions |
| `supabase/migrations/20260818290000_wall_reactions_comment_actions.sql` | **New** — `care` reaction, edit/delete comment RPCs |

## Posting limits audit

**Found:** No product-level daily post limits, per-user post-count caps, client counters, or cooldowns that block legitimate Wall posting volume were identified in the app client or posting RPCs audited for this task.

**Not removed (intentionally):** Authentication, scope/audience RLS, duplicate-submit guards (`busy` disables Publish during in-flight submission), MIME/path validation, file-size ceilings, and Reel-specific 60s rules.

**Removed / changed:** The effective **60-second Wall video cap** (client `videoMaxDuration`, validation messages, and DB `community_posts_media_duration_check` treating all videos as ≤60s).

## Wall composer changes

### Public Community (`buklod.tsx`)

- Text/caption, **Add Photos**, **Add Video**, preview, remove, Publish (unchanged layout).
- Wall video: up to 600s duration validation after selection (no BUKLOD file-size cap).
- `videoMaxDuration` = 600 for library picker.
- Upload path pattern: `{userId}/post-video-*` (not `reel-*`).
- RPC `create_buklod_community_post_v3` receives `p_media_duration_seconds` and `p_is_reel: false`.
- Removed redundant “BUKLOD REEL” placeholder overlay on all feed videos; inline `CommunityVideo` renders Wall video in feed.

### Scoped Community (`BuklodExclusiveScopeCommunity.tsx`)

- **WALL mode:** Photo + **Add Video** (wall video picker). Removed Record/Choose that incorrectly used Reel flow on Wall.
- **REELS mode:** Choose Video + Record (60s Reel rules unchanged).
- Separate state: `wallVideo` vs `reel`.
- Wall feed shows text/photo/wall video; Reels tab filters `is_reel` / legacy `reel-*` paths.
- Feed badge: **VIDEO** for Wall video, **REEL** for Reels.

## Video duration validation

| Layer | Wall video | Reels |
|-------|------------|-------|
| Client (after picker) | `buklodCommunityWallMedia.ts` — reject > 600s | 60s in Reel pickers / `acceptVideo` |
| Public RPC | `create_buklod_community_post_v2` when `p_is_reel = false` | `p_is_reel = true` → 60s |
| Scoped RPC | `buklod_scope_social_create_post_v1` same split | same |
| Database | `community_posts_media_duration_check` — reel ≤60s, non-reel ≤600s | reel ≤60s |

User message for Wall overrun: **“Wall videos can be up to 10 minutes long.”**

## Backend / server-side validation

Migration `20260818280000_wall_video_10min_foundation.sql`:

- `community_posts.is_reel boolean NOT NULL DEFAULT false`
- Backfill `is_reel = true` for legacy paths matching `%/reel-%` or `%/reel.%`
- Replaced duration CHECK (reel vs wall)
- `create_buklod_community_post_v2` / `v3`: `p_is_reel`, duration/size rules per type
- `buklod_scope_social_create_post_v1`: `p_is_reel`, wall 600s / reel 60s
- `buklod_scope_social_feed_v1`: returns `is_reel`

## Storage limits discovered

Superseded by [`BUKLOD_VIDEO_UPLOAD_SIZE_POLICY_REPORT.md`](./BUKLOD_VIDEO_UPLOAD_SIZE_POLICY_REPORT.md).

| Rule | Limit |
|------|-------|
| `community-media` bucket `file_size_limit` | **INFRASTRUCTURE LIMIT: 5 GiB** (migration `20260819110000`) |
| Wall / Reel video (BUKLOD product) | **No file-size cap** |
| Wall image RPC max size | **10 MB** (unchanged) |

Upload flow: signed URL + `FileSystem.uploadAsync` binary upload (no base64). Failed post creation removes uploaded storage path on client error path (existing scoped behavior preserved).

## Database changes / migrations

**Apply after prior Phase 1 / billing / report migrations:**

`supabase/migrations/20260818280000_wall_video_10min_foundation.sql`

Additive and backward compatible: existing text/image posts and Reels preserved; legacy Reel paths backfilled to `is_reel = true`.

After apply: reload PostgREST schema cache.

## Public and scoped coverage

| Surface | Wall video | Scope isolation |
|---------|------------|-----------------|
| Public Community Wall | Yes | Public audience rules unchanged |
| Organization Wall | Yes | Exact scope via `buklod_scope_social_*` |
| Sub-organization Wall | Yes | Same exclusive scope RPCs |
| Cluster Wall | Yes | Same exclusive scope RPCs |

Scoped posts use `audience = 'scope'` and `scope_id`; no cross-scope feed mixing.

## Reels behavior preserved

- Dedicated Reels composer/feed tab in scoped Community.
- Public Reels entry (`src/app/reels/index.tsx`) unchanged (60s / 50 MB).
- Reel upload paths remain `reel-*`; `p_is_reel: true` on publish.
- Wall videos are **not** classified as Reels (`is_reel = false`, `post-video-*` paths).

## Double submission

Publish handlers guard on `busy` (and scoped `wallVideoBusy` during picker prep). Publish disabled while submission in progress; no artificial navigation delays added.

## Performance

- Feed uses existing `CommunityVideo` per visible post; no preload of all videos.
- Scoped feed FlatList tuning from prior performance pass retained.
- Reel preview / autoplay toggle only in Reels composer mode.

## TypeScript QA

```text
npx tsc --noEmit
```

**Result:** Pass (exit code 0).

## Native dependencies added

**NONE**

## Manual QA checklist (device / staging with migration applied)

1. Public Wall text post  
2. Public Wall photo post  
3. Public Wall video under 10 minutes  
4. Wall video ~10 minutes (accept if ≤600s and ≤100 MB)  
5. Wall video >10 minutes rejected with message  
6. Organization Wall video  
7. Sub-organization Wall video  
8. Cluster Wall video  
9. Wall video remains Wall post (`is_reel = false`, not in Reels tab)  
10. Reels still 60s and behave normally  
11. Reactions / comments / shares on Wall video  
12. No duplicate post from repeated Publish taps  
13. Existing image posts render  
14. Existing text posts render  
15. Scope isolation unchanged  

---

## 13. Wall post reaction UX

`BuklodReactionAction` (existing component, upgraded):

- **Tap** applies the default reaction (`preferredKey`: last-used reaction, else first option — **Like** / `with_you`).
- **Long press** opens a compact horizontal emoji picker (no permanent multi-button row on posts).
- **Tap again** with the same active reaction toggles off (parent RPC toggle semantics).
- **Long-press picker** can change reaction or remove by selecting the current reaction again.
- **450ms in-flight guard** prevents duplicate reaction RPCs from rapid taps.
- Selected reaction shows on the main button; count chips reflect totals per type.

Applied on Public Wall and scoped Organization / Sub-organization / Cluster walls (text, photo, and wall video posts). Reels use the same shared component where present; dedicated Reels surfaces were not redesigned.

## Supported reaction types

| UI label | Backend key | Notes |
|----------|-------------|--------|
| Like | `with_you` | Default when no prior preference |
| Love | `love` | |
| Care | `care` | **New** — additive migration |
| Haha | `haha` | |
| Wow | `amen` | Legacy key preserved |
| Sad | `sad` | |
| Pray | `praying` | |

Removed from Wall UI: `celebrate` (was client-only; never in post `reactions` CHECK). Legacy counts for other keys still display if present in `reaction_counts`.

Public and scoped walls now share the same seven-option set (`BUKLOD_COMMUNITY_REACTION_OPTIONS`).

## 14. Comment / reply long-press actions

`BuklodCommunityCommentBubble` — used in Public Community drawer and scoped Community modal:

| Action | Availability |
|--------|----------------|
| Reply | All viewers (normal tap on Reply link also works) |
| Copy Text | All viewers (`expo-clipboard`, existing dep) |
| React | Opens compact reaction picker modal |
| Edit | Comment author only (`is_owner` / `user_id` match) |
| Delete | Author or scope `can_manage` (scoped); author only on Public (RPC) — **confirmation required** |
| Report | Non-authors → `/moderation/report` (`entityType=comment`) |
| View Details | Author name, timestamp, comment ID |

**Normal tap** on comment body does not open the menu (long press only). Reply remains a separate tap target. Permanent trash icons removed from scoped comments.

## Ownership / moderation permission checks

| Action | Public Wall | Scoped Wall |
|--------|-------------|---------------|
| Edit | `update_buklod_post_comment_v1` — author only | `buklod_scope_social_update_comment_v1` — author only |
| Delete | `delete_buklod_post_comment_v1` — author or system admin | `buklod_scope_social_delete_comment_v1` — author or `buklod_scope_social_can_manage` |
| Report | `submit_content_report` via report screen | Same |
| React | `set_buklod_comment_reaction_v1` + `can_view_community_post_v2` | Same RPCs (post visibility / scope membership) |

UI gates mirror server rules; RLS and SECURITY DEFINER RPCs remain authoritative.

## 15. Comment reactions

- Same `BuklodReactionAction` under each comment (tap + long press).
- Data: existing `comment_reactions` table (one reaction per user per comment).
- Load: `get_buklod_comment_reactions_v1` merged in Public and scoped comment loads.
- Set: `set_buklod_comment_reaction_v1` with optimistic per-comment state updates (no full feed rerender).
- In-flight guard on comment reaction handler.

## 16. Additional manual QA (reactions + comments)

16. Normal tap on a comment still behaves normally (Reply link; no menu).  
17. Long press opens contextual comment menu.  
18. Comment author can Edit/Delete where allowed.  
19. Other users cannot Edit/Delete someone else's comment.  
20. Authorized scope moderator/admin sees Delete (scoped); not Edit unless author.  
21. Delete requires confirmation.  
22. Copy Text works without modifying the comment.  
23. Report navigates to existing moderation/report workflow.  
24. Reaction picker opens from long press (menu → React) and from reaction button long press.  
25. Reaction can be changed or removed.  
26. Comment/reply reaction counts stay correct.  
27. Rapid taps do not create duplicate reactions.  
28. Long press does not open post details or duplicate tap actions.  
29. Public and scoped walls preserve exact-scope permissions.  
30. Existing comments/replies remain compatible.

## TypeScript QA (updated)

```text
npx tsc --noEmit
```

**Result:** Pass (exit code 0).

## Native dependencies added (updated)

**NONE** (uses existing `expo-clipboard`, `expo-router`, `expo-image-picker`, etc.)
