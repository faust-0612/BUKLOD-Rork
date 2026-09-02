# BUKLOD Touch Sensitivity Normalization

Touch handling now uses one shared layer so taps feel immediate, long-press stays distinct from tap, and scrolling does not accidentally open rows.

## Shared thresholds (`src/lib/buklodTouch.ts`)

| Constant | Value | Role |
|---|---|---|
| `BUKLOD_LONG_PRESS_MS` | 420 | Long-press (profile, reactions, messages) |
| `BUKLOD_HIT_SLOP` | 8 | Compact icon / close controls |
| `BUKLOD_HIT_SLOP_TIGHT` | 4 | Dense chips, names, header icons |
| `BUKLOD_HIT_SLOP_AVATAR` | 0 | Visible avatar circle only |
| `BUKLOD_PRESS_MOVE_CANCEL_PX` | 10 | Cancel tap if the finger slides |
| `BUKLOD_PAN_MIN_DISTANCE_PX` | 16 | Reposition / pan start |
| `BUKLOD_SWIPE_AXIS_THRESHOLD_PX` | 18 | Deliberate swipe distance |
| `BUKLOD_SWIPE_AXIS_DOMINANCE` | 1.35 | Primary axis must clearly win |
| `BUKLOD_PRESS_RETENTION` | 6px | Slide-off still counts as press |
| `BUKLOD_MIN_TARGET_PX` | 44 | Accessibility size via layout, not giant slop |
| `BUKLOD_FEED_ACTION_PRESS_DELAY_MS` | 0 | No artificial delay; movement cancel replaces it |

Helpers: `stopBuklodNestedPress`, `buklodMovementExceeded`, `buklodDominantSwipe`, `buklodHitSlop`.

`BuklodPressable` now:

- fires ordinary buttons on press-up (no delay)
- cancels the press if the finger moves more than 10px (scroll / swipe)
- never fires both tap and long-press
- ignores `instant` when `onLongPress` is set
- uses `nested` to stop parent card/row handlers
- uses `compact` for standard icon hitSlop only

## Gesture conflicts fixed

- **Connect list rows** no longer fire on finger-down (`ConnectPressable` default `instant={false}`), so scrolling the inbox does not open a chat.
- **Home cards** (`HomePressable`) wait for press-up, so a slow scroll that starts on a card does not navigate.
- **Profile rows** use `BuklodPressable` instead of a raw `Pressable`.
- **Avatars** use press-up + circular hit testing. Tap opens profile where configured; long-press opens the visit sheet. Hit area is the visible circle.
- **Nested feed actions** (comments, report, reactions, Reels overlay buttons) use `nested` so they do not also trigger a parent row.
- **Guide avatar drag** starts only after long-press and a 16px move. Short taps still open Profile / Home.
- **Zoomable photos** pan only when already zoomed and after a 10px move, so a tiny nudge is not a drag.
- **Reels paging** uses `directionalLockEnabled` and `disableIntervalMomentum` so a tiny off-axis nudge is less likely to change page.

## Controls intentionally left custom

- **Bottom navigation** — `instant` press-in for snappy tab switching (isolated chrome, not a list).
- **Primary `Button`**, **Connect FAB**, **Connect inbox tabs**, **Send** — `instant` because they are explicit actions, not scrollable rows.
- **Guide avatar `hitSlop={0}`** — must stay on the visible 50px disc.
- **Reaction picker options** — still select on press-in inside the open picker.
- **Photo zoom / pinch / double-tap** — specialized RNGH gestures, thresholds only tightened.
- **Reels vertical pager** — still the native paging `FlatList`; not replaced with a new gesture library.
- **Scanner / camera shutter controls** — behavior unchanged aside from standard close-icon hitSlop.
- **Text inputs** — no parent press wrapper added; existing `keyboardShouldPersistTaps` kept.

## Screens covered by this pass

Inspected and updated through shared wrappers or direct edits:

Community wall (public + scoped), Reels overlay + pager, Connect inbox / composer / tabs / FAB / avatars, Home cards, Profile rows, bottom nav, Guide avatar, zoomable photos, reactions, comment previews, Marites, login close/icon controls, faculty roster/attendance/scanner icon buttons, report/overflow sheets.

Not exercised on a physical device in this session. TypeScript (`tsc --noEmit`) passed. Shared helper checks passed.

## Files changed

**Shared**
- `src/lib/buklodTouch.ts`
- `src/components/BuklodPressable.tsx`
- `src/components/connect/ConnectPressable.tsx`
- `src/components/HomeMotion.tsx`
- `src/components/BuklodProfileMotion.tsx`
- `src/components/UI.tsx` (unchanged Button `instant` on purpose)
- `__tests__/buklodTouch.test.ts`

**Avatars / people**
- `src/components/BuklodTappableAvatar.tsx`
- `src/components/connect/ConnectTappableAvatar.tsx`
- `src/components/BuklodTappablePersonName.tsx`
- `src/components/BuklodGuideAvatar.tsx`

**Feeds / Reels / Connect**
- `src/app/(tabs)/buklod.tsx`
- `src/components/BuklodExclusiveScopeCommunity.tsx`
- `src/app/reels/index.tsx`
- `src/components/BuklodCommunityPostEngagement.tsx`
- `src/components/BuklodCommunityCommentPreview.tsx`
- `src/components/BuklodReactionAction.tsx`
- `src/components/BuklodZoomablePhoto.tsx`
- `src/components/connect/ConnectNewMessageFab.tsx`
- `src/components/connect/ConnectInboxTabs.tsx`
- `src/components/connect/ConnectComposer.tsx`
- `src/components/BuklodCommunityCommentBubble.tsx`
- `src/components/BuklodMaritesBoard.tsx`

**HitSlop normalized to constants**
- `src/app/(auth)/login.tsx`
- `src/app/(tabs)/me.tsx`
- `src/app/profile/buklod-faculty-attendance.tsx`
- `src/app/profile/buklod-faculty-grade-scanner.tsx`
- `src/app/profile/buklod-faculty-roster.tsx`
- `src/app/scope/delete.tsx`
- `src/components/BuklodContentOverflowMenu.tsx`
- `src/components/BuklodContentReportSheet.tsx`
- `src/components/BuklodDashboardCustomizer.tsx`
- `src/components/BuklodFaithPaymentModal.tsx`
- `src/components/BuklodPostInternalShare.tsx`
- `src/components/BuklodProfileStatusBubble.tsx`
- `src/components/BuklodScopedDashboardHeader.tsx`
- `src/components/OwnProfileNoteMusicOverlay.tsx`
- `src/components/points/BuklodCharacterCustomizeSheet.tsx`
- `src/components/points/BuklodCharacterDialogue.tsx`
- `src/components/points/BuklodCharacterTappablePreview.tsx`

## QA

- TypeScript: pass
- Helper invariants: small move is a tap; 30px slide cancels; vertical swipe needs clear axis intent
- Device follow-up still recommended: single tap, rapid tap, long-press vs tap on avatars, scroll starting on a card, Reels swipe, nested comments on a post, modal close, bottom tabs, keyboard next to composer icons
