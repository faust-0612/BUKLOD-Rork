# BUKLOD Game Runtime

Quality-first runtime for BUKLOD Kingdom mini-games.

## Architecture

Game rules and progression stay renderer-independent. Platform-specific rendering and feedback are resolved with `.web` and `.native` modules.

- Web: lightweight premium 2D stage for fast browser iteration.
- Native: Skia-backed stage with native haptics and room for richer effects.
- Shared: game rules, scoring, rewards, station metadata, and future persistence hooks.

## Non-negotiable experience rules

1. Target a stable 60 FPS on supported devices.
2. Input must feel immediate; gameplay must never wait for network writes.
3. Character actions need readable anticipation, action, impact, and recovery states.
4. Every game needs environmental motion, layered audio, meaningful feedback, and a clear visual objective.
5. Avoid quiz-card presentation unless the game mechanic specifically calls for it.
6. Rewards must visibly affect the world, character, station, or collection.
7. Failure is recoverable and encouraging; no punitive dead-end loops.
8. Maps and stations remain expandable; no region is treated as the final endpoint.
9. Supabase is persistence/source-of-truth, not the frame-by-frame game loop.
10. AI may generate bounded content, but deterministic rules decide scoring, win/loss, and rewards.

## Planned native layers

- React Native Skia: environment, particles, masks, lighting, special effects.
- Reanimated/Worklets: camera movement, gesture response, animation timelines.
- Gesture Handler: swipe, drag, hold, steering, object interaction.
- Rive: character state machines when final character animation assets are available.
- Expo Audio: music, ambience, SFX and UI sound layers.
- Expo Haptics: movement, impact, collection, success and unlock feedback.
