# BUKLOD Message Composer & Call Fix Report

Date: 2026-08-19

## Summary

Modernized the Connect message composer for wider typing space and compact action icons. Fixed the misleading `Calling is not configured in this app build` dead-end by resolving the Stream Video API key at runtime from the `stream-token` edge function (not only from `EXPO_PUBLIC_STREAM_API_KEY`). Personal and scoped calls now use deterministic call room IDs.

**Native dependencies added: NONE**

---

## Files changed

| File | Change |
|------|--------|
| `src/components/connect/ConnectComposer.tsx` | Wider input layout; compact 34px icons; attach/photo/smile/send row |
| `src/components/BuklodConnectThread.tsx` | Composer wiring, keyboard avoidance, emoji insert, send guard, call IDs/errors |
| `src/lib/buklodConnect.ts` | `optimizeConnectImageFile` via `expo-image-manipulator` |
| `src/lib/buklodStreamCall.ts` | **New** — deterministic call IDs + user-facing error formatting |
| `src/lib/buklodStreamVideoClient.ts` | On-demand client; API key from env or `stream-token` |
| `supabase/functions/stream-token/index.ts` | Returns `api_key` with token |
| `src/providers/StreamVideoProvider.tsx` | Removed build-time API key gate; always attempts client init |
| `src/components/BuklodScopeCallLauncher.tsx` | Deterministic scope call IDs; formatted errors |
| `src/app/(tabs)/messages.tsx` | Deterministic personal call IDs when thread known; formatted errors |

---

## Composer layout changes

**Layout:** `[Attach] [Photo] [Smile] [Message input — flex] [Send]`

- Icon hit areas reduced from ~48px to **34px** circles so the `TextInput` keeps more horizontal space.
- Input uses `flex: 1`, `minWidth: 0`, `maxHeight: 108`, multiline, `textAlignVertical: 'center'` for single-line centering.
- Photo/file previews remain above the bar (compact thumbnails / filename row) with remove/cancel.
- Safe-area bottom padding preserved on the thread container.

---

## Attachment implementation

- **Attach (paperclip):** `onAttachPress` → `chooseFile()` → existing `pickConnectFile()` (`expo-document-picker`).
- Supported types, 25 MB limit, storage path, authorization, and upload validation remain in `uploadConnectFile` / `buklodConnect.ts`.
- No insecure placeholder; generic attachments reuse the existing Connect file pipeline.

---

## Photo implementation

- **Photo (image icon):** `onChoosePhoto` → `choosePhoto()` → existing `pickConnectPhotos()` (`expo-image-picker`, multi-select up to 12).
- Permissions, preview strip, album send, and optimistic upload behavior unchanged.
- Does not duplicate Wall media pipeline.

---

## Compression behavior

**Where:** `src/lib/buklodConnect.ts` — `optimizeConnectImageFile()`

**Dependency:** `expo-image-manipulator` (already installed; no new package)

| Media | Compressed? | Details |
|-------|-------------|---------|
| JPEG photos | Yes | Resize max width 1920px; JPEG quality 0.82 |
| PNG photos | Yes | Resize max width 1920px; PNG format preserved |
| GIF | No | Skipped intentionally |
| Video | No | No transcoding; existing limits only |
| Non-image files | No | Documents unchanged |

**When:**

1. After photo library pick (`pickConnectPhotos`)
2. Again in `uploadConnectFile` before storage upload (may re-optimize already-compressed picks; safe but redundant for library picks)

GIF picker (`pickConnectGif`) does not compress.

---

## Emoji / smile implementation

- Smile icon toggles quick emoji tray (existing `QUICK_SEND_EMOJIS`).
- Long-press opens full `ConnectComposerPicker` emoji tab.
- Selected emoji **inserts into draft** via `insertDraftEmoji` / `onInsertEmoji` (does not auto-send).
- Full picker emoji tab also inserts into draft.
- Avatar/GIF tabs in picker still send immediately (existing reaction behavior).
- No native emoji keyboard package added.

---

## Keyboard handling

- Thread message list + composer wrapped in `KeyboardAvoidingView` (`padding` on iOS; default on Android).
- `FlatList` given `flex: 1`; `keyboardShouldPersistTaps="always"`.
- Composer stays above keyboard; Send and action icons remain visible.
- No arbitrary fixed keyboard offsets added.

---

## Send state

- `sendInFlightRef` blocks rapid duplicate Send taps.
- Text sends: 450ms guard window + existing per-message `inflightTextSendsRef` optimistic flow.
- File/album sends: guard cleared in `finally` after upload attempt.
- Optimistic messages preserved.

---

## `Calling is not configured in this app build` — source & root cause

### Original source (pre-fix)

File: `src/lib/buklodStreamVideoClient.ts` (archived copies in `BUKLOD_PLAYSTORE_ARCHIVE_CHECK/`)

**Condition:** `EXPO_PUBLIC_STREAM_API_KEY` was empty at runtime when `ensureBuklodStreamVideoClient()` ran.

**Message thrown:** `Calling is not configured in this app build.`

### Contributing factors

1. **`eas.json`** does not inject `EXPO_PUBLIC_STREAM_API_KEY` in build profiles; key may exist only in local `.env` or EAS secrets — production APKs often had an empty public key at runtime.
2. **`StreamVideoProvider`** previously skipped client initialization when the build env key was missing, so `RingingCalls` never mounted even after a successful on-demand init elsewhere.
3. **Not** missing native SDK — `@stream-io/video-react-native-sdk` is installed in `package.json`.

### Classification

**C + D:** Configuration/env detection failed **and** provider/client had not initialized — **not** a genuinely unsupported native build.

---

## Stream configuration discovered

| Item | Location |
|------|----------|
| RN SDK | `@stream-io/video-react-native-sdk` ^1.43.0 |
| Filters package | `@stream-io/video-filters-react-native` ^0.15.0 |
| Client singleton | `buklodStreamVideoClient.ts` — `StreamVideoClient.getOrCreateInstance` |
| Token | `supabase/functions/stream-token` — `STREAM_API_KEY` + `STREAM_API_SECRET` server env |
| Public API key | Build: `EXPO_PUBLIC_STREAM_API_KEY` **or** runtime from `stream-token` response `api_key` |
| User mapping | Supabase auth `user.id` as Stream user id |
| Call UI | `RingingCalls` in `StreamVideoProvider` |
| Web | `buklodStreamVideoClient.web.ts` — throws `BUKLOD browser calling is not enabled yet.` |

---

## Call initialization fix

1. **`stream-token`** now returns `{ token, user_id, api_key }`.
2. **`ensureBuklodStreamVideoClient()`** fetches token payload on demand, caches resolved API key, coalesces parallel first-tap requests.
3. **`StreamVideoProvider`** initializes for all signed-in users (no build-time key requirement).
4. **`formatBuklodCallStartError()`** maps config/token failures to actionable messages instead of the old build message.

**First-tap flow:** tap call → loading state → `ensureBuklodStreamVideoClient()` → token + key → `call.getOrCreate({ ring: true })` → `RingingCalls` UI.

---

## Personal call behavior

- Call ID: `buildBuklodPersonalCallId(threadId)` → `buklod-personal-{sanitizedThreadId}`
- Used in `BuklodConnectThread.startDirectCall` for header audio/video buttons.
- Messages inbox search call uses same ID when `thread_id` is known; falls back to user-scoped ID when no thread.
- Members: current user + `otherUserId`.
- Audio: `video: false`, no camera default-on override.
- Video: `video: true`, `camera_default_on: true`.

---

## Scoped / MZB / org / sub-org / cluster call behavior

- Call ID: `buildBuklodScopeCallId(scopeId)` → `buklod-scope-{sanitizedScopeId}` (deterministic per scope).
- `BuklodScopeCallLauncher` receives explicit `scopeId` prop from thread header / cluster UI — no stale global scope.
- Roster from `buklod_connect_scope_call_members` RPC; membership refreshed before ring.
- Audio: camera off by default. Large group video (≥9): video call type but cameras start off.
- Custom metadata: `buklod_scope_id`, `buklod_scope_type`, `buklod_call_mode`, etc.

---

## Native build requirement

| Question | Answer |
|----------|--------|
| Installed APK contains Stream Video native code? | **Yes** — SDK is in dependencies and existing production builds |
| New native build required for this fix? | **No** for API-key/token path (OTA-compatible JS + edge function) |
| New native build required if SDK were absent? | Would be required — not the case here |
| Server requirement | Supabase secrets `STREAM_API_KEY` and `STREAM_API_SECRET` must be set for `stream-token` |

---

## TypeScript

```bash
npx tsc --noEmit
```

**Result:** PASS (exit 0)

---

## QA checklist (manual verification recommended)

### Composer
1. Message input has visibly more usable width — **implemented**
2. One-line message looks clean — **implemented**
3. Multiline expands correctly — **implemented**
4. Max height controlled (108px) — **implemented**
5. Attachment icon → file picker — **implemented**
6. Photo icon → image picker — **implemented**
7. Smile inserts emoji into draft — **implemented**
8. Photo/file preview — **existing + preserved**
9. Preview removable — **existing**
10. Keyboard does not cover composer — **KeyboardAvoidingView added**
11. Send visible with keyboard — **implemented**
12. Rapid Send guarded — **sendInFlightRef**
13. Message history intact — **no data migration**
14. Compression on message photos — **implemented**

### Calls
15–27. First-tap init, deterministic IDs, scoped calls, accurate errors — **implemented**; verify on device with valid `stream-token` secrets.

---

## Native dependencies added

**NONE**
