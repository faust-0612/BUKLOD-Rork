# BUKLOD Organization Layout & Video Upload Repair Report

**Date:** 2026-08-19  
**Project:** BUKLOD Main Expo/React Native + Supabase

---

## Executive status

| Gate | Status |
|------|--------|
| CODE PASS | **YES** (`npx tsc --noEmit`) |
| BACKEND PASS | **PENDING DEPLOYMENT** |
| STORAGE CONFIG PASS | **PENDING DEPLOYMENT** |
| REMOTE DEPLOYED | **NO** — apply migration on production Supabase (see §14) |
| DEVICE VERIFIED | **PENDING DEVICE VERIFICATION** |

**Not complete** until production Supabase accepts eligible videos without `The object exceeded the maximum size`, and Android layout is verified on device.

---

## 1. Safe-area root cause (scoped dashboards)

**Problem:** Scoped workspace scroll padding still reserved space for the **global** bottom nav. Global nav remained visible inside `/scope` workspaces. Portal screens used fixed `paddingTop` / `paddingBottom` instead of real insets.

**Fix:**
- `isBuklodScopedWorkspacePath()` in `src/lib/buklodSafeArea.ts` — `/scope` and `/scope/*`
- `isBuklodPersistentNavHidden()` includes scoped workspace paths
- `useBuklodScrollBottomInset()` defaults `includePersistentNav: false` inside scoped workspaces (system inset only, no global nav gap)
- Scoped section content wrapped in `flex: 1` in `src/app/scope/index.tsx`

---

## 2. Dashboard screens fixed

| Screen | Change |
|--------|--------|
| Scoped workspace shell (`scope/index.tsx`) | Flex layout; home/community/connect fill height |
| `BuklodScopeHomeDashboard` | Scoped scroll inset (no global nav reservation) |
| `BuklodClusterHomeCommandCenter` | Same |
| `BuklodExclusiveScopeCommunity` | Same |
| `BuklodScopedDashboardHeader` | Real `insets.top`; encouragement bar hidden on Connect |

MZB routes (`/mzb/*`) were already in `isBuklodPersistentNavHidden()` from prior work.

---

## 3. Portal / door screens fixed

**Shared component:** `src/components/BuklodPortalScrollView.tsx`  
Uses `useBuklodPortalContentInsets()` — real top status-bar inset + bottom inset (global nav + system).

### Organization portal screens

| Screen | File |
|--------|------|
| Organization portal | `organizations/index.tsx` |
| List of Organizations | `organizations/manage.tsx` |
| Join Organization | `organizations/join.tsx` |
| Create Organization | `organizations/create.tsx` |
| Scope manage hub | `organizations/scope-manage.tsx` |
| Sub-organizations | `organizations/suborganizations.tsx` |
| Manage feature | `organizations/manage-feature.tsx` |
| Settings | `organizations/settings.tsx` |
| Events / Attendance | `organizations/events-attendance.tsx` |
| Members | `organizations/members.tsx` |
| Members requests | `organizations/members-requests.tsx` |
| Join requests | `organizations/join-requests.tsx` |
| Admins | `organizations/admins.tsx` |
| Admin module | `organizations/admin-module.tsx` |

### Scoped child screens (`/scope/*`)

New: `BuklodScopedWorkspaceScrollView` + `useBuklodScopedWorkspaceContentInsets()`  
Uses real top/bottom insets **without** global nav reservation.

| Screen | File |
|--------|------|
| Manage members | `scope/manage/members.tsx` |
| Functional roles | `scope/manage/functional-roles.tsx` |
| Attendance hub | `scope/attendance/index.tsx` |
| Attendance report | `scope/attendance/report.tsx` |
| Bulletin editor | `scope/bulletin-editor.tsx` |
| Delete scope | `scope/delete.tsx` |

Path normalization: `normalizeBuklodPathname()` handles `/scope/index` variants for nav hiding.

Portal screens: removed duplicate large `paddingBottom` (40–54px) now that `BuklodPortalScrollView` owns bottom inset.

### Cluster portal screens

| Screen | File |
|--------|------|
| Cluster portal | `clusters/index.tsx` |
| Cluster detail | `clusters/[id].tsx` |
| Manage | `clusters/manage.tsx` |
| Create | `clusters/create.tsx` |
| Scope manage | `clusters/scope-manage.tsx` |
| Manage feature | `clusters/manage-feature.tsx` |
| Settings | `clusters/settings.tsx` |
| Members | `clusters/members.tsx` |
| Members requests | `clusters/members-requests.tsx` |
| Join requests | `clusters/join-requests.tsx` |
| Invitations | `clusters/invitations.tsx` |
| Lifecycle | `clusters/lifecycle.tsx` |
| Admins | `clusters/admins.tsx` |

---

## 4. Global bottom nav hiding

**Implementation:**
- `isBuklodPersistentNavHidden()` with `normalizeBuklodPathname()` for `/scope`, `/scope/*`, `/mzb/*`
- `BuklodPersistentBottomNav` — `inScopedWorkspace` fallback when `activeScope` is ORGANIZATION/CLUSTER on workspace routes

| State | Global bottom nav |
|-------|-------------------|
| Global Home / Connect / Community tabs | Visible |
| Enter `/scope?...` workspace | **Hidden** |
| Exit workspace to global routes | Restored |

`BuklodPersistentBottomNav.tsx` returns `null` when hidden.

---

## 5. Empty nav-space fix

When global nav is hidden inside `/scope`:
- `useBuklodPersistentNavOccupiedHeight()` returns `0`
- `useBuklodScrollBottomInset()` uses system inset only (no reserved global nav height)
- Connect thread bottom padding uses `insets.bottom` only in embedded workspace mode

---

## 6. Organization Connect spacing — root cause & fix

**Root cause (stacked spacing):**
1. `BuklodScopedDashboardHeader` — top safe area + encouragement bar
2. Workspace Home / Community / Connect tabs row
3. `ConnectThreadHeader` — duplicate `insets.top` + duplicate back/title row

**Fix:**
- Hide encouragement bar when `section === 'connect'`
- Embedded workspace Connect uses `compactEmbedded` header (action icons only, `paddingTop: 6`)
- Removed duplicate safe-area top on embedded thread header
- Connect thread bottom uses system inset only inside workspace

**Files:** `BuklodScopedDashboardHeader.tsx`, `ConnectThreadHeader.tsx`, `BuklodConnectThread.tsx`, `scope/index.tsx`

---

## 7. Video policy — old vs new

| Rule | Old (production likely) | New |
|------|---------------------------|-----|
| Max file size | Storage bucket **100 MB** (`104857600`) | **1 GB** (`1,073,741,824` bytes) |
| Wall duration | 600 s (10 min) | **1800 s (30 min)** |
| Reels duration | 60 s | **60 s** (unchanged — intentional short-form) |

---

## 8. Source of `The object exceeded the maximum size`

**Runtime path:**
1. `uploadCommunityVideoFile()` → `createSignedUploadUrl` → `FileSystem.uploadAsync` / `createUploadTask` (binary PUT, no base64)
2. **Supabase Storage** `community-media` bucket enforces `file_size_limit` on PUT

**Production limit before deploy:**
- `20260818280000_wall_video_10min_foundation.sql` set `file_size_limit = 104857600` (100 MB)
- Error text matches Supabase Storage rejection, not client JS

**Not the source:** Client memory cap (upload uses signed URL + native binary PUT).

---

## 9. New validation

### Client (`src/lib/buklodCommunityWallMedia.ts`)
- `BUKLOD_VIDEO_MAX_SIZE_BYTES = 1_073_741_824`
- `BUKLOD_WALL_VIDEO_MAX_DURATION_SECONDS = 1800`
- `BUKLOD_REEL_MAX_DURATION_SECONDS = 60`
- `validateCommunityVideoUpload()` in public + scoped Wall composers
- Pre-upload size check in `uploadCommunityVideoFile.ts`
- Server “maximum size” errors mapped to user-friendly 1 GB message

### Backend (`supabase/migrations/20260819120000_buklod_video_1gb_30min_policy.sql`)
- `storage.buckets.file_size_limit = 1073741824` for `community-media`
- `community_posts_media_duration_check` → 1800s for non-reel video
- `create_buklod_community_post_v2` — size ≤ 1 GB, wall ≤ 1800s, reel ≤ 60s
- `buklod_scope_social_create_post_v1` — same rules
- `create_buklod_community_post_v3` delegates to v2 (inherits validation)

---

## 10. Upload transport & memory safety

**Method:**
- Signed upload URL
- `expo-file-system/legacy` `BINARY_CONTENT` PUT
- `createUploadTask` with real `onProgress` when callback provided

**No:** base64 conversion, full-file ArrayBuffer, duplicated buffers, or new native dependencies.

---

## 11. Upload progress UI

Real progress wired (not faked):

| Surface | Progress display |
|---------|------------------|
| Public Wall (`buklod.tsx`) | `Uploading video… N%` on POST button |
| Scoped Community (`BuklodExclusiveScopeCommunity.tsx`) | Same on publish button |
| Reels (`reels/index.tsx`) | Same on PUBLISH REEL button |

---

## 12. TypeScript

```
npx tsc --noEmit
```

**PASS**

---

## 13. Native dependencies added

**NONE**

---

## 14. Required deployment steps (BLOCKING for video)

**Migration file:** `supabase/migrations/20260819120000_buklod_video_1gb_30min_policy.sql`

1. Open **Supabase Dashboard → SQL Editor** on production project
2. Run the migration SQL (or `npx supabase db push` if CLI is linked)
3. Verify:
   ```sql
   SELECT id, file_size_limit FROM storage.buckets WHERE id = 'community-media';
   -- Expected: 1073741824
   ```
4. Android device QA per §15 checklist

Until step 3 returns `1073741824`, video uploads above ~100 MB will continue failing with `The object exceeded the maximum size`.

---

## 15. Android device verification checklist

### Safe Area / Dashboard
1. Organizations portal — top below status bar, bottom above nav
2. Enter MZB / Organization / Sub-org / Cluster dashboards
3. No hidden content, no giant extra padding
4. Scroll bottom items fully tappable

### Global Nav
5. Global Home — bottom nav visible
6. Enter Organization — global nav hidden, scoped nav visible
7. No empty gap where global nav was
8. Exit workspace — global nav returns

### Connect
9. Organization → Connect — no large gap below scoped header
10. Action icons compact below scoped nav
11. Keyboard does not cover composer

### Video
12. Small video uploads
13. 20-minute video under 1 GB uploads
14. ≤30 min and ≤1 GB accepted
15. >30 min rejected with clear message
16. >1 GB rejected with `Maximum video size is 1 GB.`
17. No `object exceeded the maximum size` for eligible files after storage deploy
18. Large upload does not crash app
19. Progress shown during upload
20. Published video appears in Wall/feed

**Status:** PENDING DEVICE VERIFICATION

---

## 16. Files changed (summary)

| Area | Files |
|------|-------|
| Safe area / nav | `src/lib/buklodSafeArea.ts`, `src/components/BuklodPersistentBottomNav.tsx` |
| Portal | `src/components/BuklodPortalScrollView.tsx`, all `organizations/*.tsx` portal screens, all `clusters/*.tsx` portal screens |
| Scoped workspace | `src/app/scope/index.tsx`, `BuklodScopedDashboardHeader.tsx` |
| Connect | `ConnectThreadHeader.tsx`, `BuklodConnectThread.tsx` |
| Video policy | `buklodCommunityWallMedia.ts`, `uploadCommunityVideoFile.ts`, `buklod.tsx`, `BuklodExclusiveScopeCommunity.tsx`, `reels/index.tsx` |
| Supabase | `supabase/migrations/20260819120000_buklod_video_1gb_30min_policy.sql` |
