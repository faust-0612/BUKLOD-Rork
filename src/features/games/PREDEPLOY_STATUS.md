# BUKLOD Game Lab — PRE-DEPLOY FREEZE

Status: **NOT DEPLOYED**

Branch: `feature/buklod-games-web-foundation`

## Current standalone character games

1. Jawo — Forest Trail V2
2. Trudice — Wonder Path V2
3. Ace — Rescue Grid V1
4. Mitch — Restore the Mural V1
5. Niel — Mission Trail V1
6. Angel — Kingdom Treasury V1
7. Vhen — Farm to Market V1
8. ELESUR — Village Builder V1
9. Phan — Enterprise Builder V1
10. Van — City Dispatch V1
11. Christian — Leadership Council V1
12. Lhen — Rhythm Journey V1
13. Quin — Discovery Expedition V1

## Architecture freeze

- All games are isolated under `src/app/games/**` and `src/features/games/**`.
- No game writes to Supabase, Circle Rank, Character XP, Kingdom XP persistence, collectibles, or map unlocks yet.
- No Kingdom Map integration yet.
- Final character art/animation remains intentionally decoupled from gameplay logic.
- Web renderer and native renderer are platform-separated where needed.
- Native game foundation uses dependencies already present in BUKLOD: Skia, Reanimated/Worklets, Gesture Handler, Rive-ready runtime, Expo Audio and Haptics.
- Old Jawo and Trudice low-fidelity prototype components were removed after V2 replacement.

## Gameplay hardening completed

- Van dispatch cannot spend less team capacity than route distance requires.
- Lhen rhythm scoring uses refs as authoritative timing state to avoid stale React state at song completion.
- Quin fog-of-war reveals from the destination tile and uses a mobile-safe responsive grid.
- Mitch drag engine avoids private Animated internals.
- Angel has a genuine failed-quarter state for unsustainable stewardship.
- Jawo native forest path construction uses the current immutable Skia `PathBuilder` API.

## Before web deployment

The next execution stage must be:

1. Obtain a runnable checkout with dependencies.
2. Run `npx tsc --noEmit`.
3. Run the relevant tests without relying on unavailable GitHub Actions.
4. Run an Expo web export/build.
5. Open `/games` and manually play all 13 routes on desktop and mobile viewport.
6. Fix any runtime/rendering issues found.
7. Only after those checks pass, deploy the web build.

Do not merge into `main`, connect progression writes, or deploy from this freeze without completing the pre-deploy runtime gate.
