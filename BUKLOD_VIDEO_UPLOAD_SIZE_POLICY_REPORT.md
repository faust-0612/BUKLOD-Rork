# BUKLOD Video Upload Size Policy Report

**Date:** 2026-08-19  
**TypeScript:** PASS (`npx tsc --noEmit`)  
**Native dependencies added:** NONE  
**Remote deployment:** PENDING — apply migration `20260819110000_remove_buklod_video_file_size_product_caps.sql`  
**Device verification:** PENDING

---

## Policy

**BUKLOD itself imposes no video file-size limit.** Only unavoidable infrastructure/provider limits may apply at upload time.

Duration rules remain:

| Surface | Max duration |
|---------|----------------|
| Community Wall video | **600 seconds (10 minutes)** |
| Reels | **60 seconds** |

Duration and file size are independent rules.

---

## Application-level video size caps found (removed)

| Location | Former cap | Status |
|----------|------------|--------|
| `src/lib/buklodCommunityWallMedia.ts` | `BUKLOD_WALL_VIDEO_MAX_SIZE_BYTES` = 100 MB | **Removed** |
| `src/lib/buklodCommunityWallMedia.ts` | `BUKLOD_REEL_MAX_SIZE_BYTES` = 50 MB | **Removed** |
| `src/app/(tabs)/buklod.tsx` | Reject > 100 MB | **Removed** |
| `src/components/BuklodExclusiveScopeCommunity.tsx` | Wall 100 MB / Reel 50 MB | **Removed** |
| `src/app/reels/index.tsx` | Reject > 50 MB; require known size | **Removed** |
| `create_buklod_community_post_v2` (RPC) | Wall 100 MB / Reel 50 MB | **Removed** (migration) |
| `buklod_scope_social_create_post_v1` (RPC) | Wall 100 MB / Reel 50 MB | **Removed** (migration) |
| `create_buklod_reel_v1` (RPC) | 50 MB required + max | **Removed** (migration) |
| `community_posts_media_size_check` | `<= 52428800` (50 MB) | **Replaced** with positive-bytes-only check |

### Preserved (not video / unrelated)

| Location | Limit | Reason |
|----------|-------|--------|
| Wall / scope images (RPC) | 10 MB | Image policy unchanged |
| Public Wall photos (`buklod.tsx`) | Photo resize/compress limits | Image only |
| Connect attachments (`buklodConnect.ts`) | 25 MB | Document/photo policy; backend image-only RPC |
| Faculty materials | 25 MB | Document upload |
| Paid advertising video | 30 seconds duration | Separate product surface |

---

## Infrastructure / provider limits discovered

These are **not** BUKLOD product rules:

| Layer | Limit | Notes |
|-------|-------|-------|
| **Supabase Storage `community-media` bucket** | **INFRASTRUCTURE LIMIT: 5 GiB per object** (after migration) | Previously 100 MB product-aligned cap; raised to infrastructure ceiling |
| **Supabase project global upload limit** | **INFRASTRUCTURE LIMIT: varies by plan** | Free/Pro tiers may enforce lower global max; check Supabase project settings |
| **Supabase signed upload URL** | Single PUT request | No client-side resumable/chunked API in current stack |
| **Expo ImagePicker** | `videoMaxDuration` hints only | Picker may trim selection UI; duration re-validated in app |
| **Device memory** | OS-dependent | Mitigated by URI/binary upload path (see below) |

Connect messaging (`connect-files` bucket): **INFRASTRUCTURE LIMIT: 50 MB** per object; RPC currently accepts **images only** (not general video attachments).

---

## Upload method for large video

**Canonical path:** `src/lib/uploadCommunityVideoFile.ts`

1. `createSignedUploadUrl` on `community-media` bucket  
2. `expo-file-system/legacy` `uploadAsync` with `BINARY_CONTENT` from local `file://` URI  
3. No base64 conversion; no full-file `ArrayBuffer` in JavaScript  

Used by:

- Public Wall (`buklod.tsx`)
- Scoped Community (`BuklodExclusiveScopeCommunity.tsx`)
- Reels (`reels/index.tsx`)

### Resumable / chunked upload

**Not present** in the current project. Uploads are single-request signed PUT via Expo FileSystem. Retries are at the screen level (user can re-attempt publish after failure).

### Progress UI

`uploadCommunityVideoFile` does not expose byte progress callbacks today. Screens show busy state during upload; no fake percentage bars.

### Metadata

`readVideoSizeBytes()` records `media_size_bytes` when the platform reports it; **unknown size does not block upload**.

---

## Memory safety

| Pattern | Status |
|---------|--------|
| Base64 video read | **Not used** for community video upload |
| `nativeFile.bytes()` for community video | **Not used** |
| URI → signed URL binary PUT | **In use** |
| Connect `uploadConnectFile` loads `bytes()` | Still used for **images/documents only** (25 MB cap) |

---

## Backend migration

**File:** `supabase/migrations/20260819110000_remove_buklod_video_file_size_product_caps.sql`

- Drops product video size checks from community post + reel RPCs  
- Relaxes `community_posts_media_size_check`  
- Raises `community-media` bucket `file_size_limit` to 5 GiB (infrastructure ceiling)  
- Preserves duration validation and image 10 MB RPC caps  

**Deploy:** Run migration on Supabase before production QA of large uploads.

---

## QA checklist (device)

1. Small Wall video under 10 minutes — uploads  
2. Large-file Wall video under 10 minutes — not rejected for MB/GB on client  
3. High-bitrate Wall video under 10 minutes — same  
4. Video over 10 minutes — rejected for **duration** only  
5. No client alert cites BUKLOD MB/GB video cap  
6. `media_size_bytes` stored when available  
7. Upload path does not base64 the file  
8. Failed upload shows error; user can retry  
9. Reels not rejected for BUKLOD file-size policy (60s duration still enforced)  
10. TypeScript passes  

---

## Summary

BUKLOD no longer rejects valid videos based on `file.size` / `media_size_bytes` product thresholds. Wall video remains capped at **10 minutes**; Reels at **60 seconds**. Large uploads use **signed URL + FileSystem binary PUT**. Apply the Supabase migration to remove matching server-side product caps and raise the storage bucket infrastructure ceiling.
