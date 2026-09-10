# BUKLOD Minigame Quality Standard

This is a mandatory product rule for every BUKLOD minigame.

## Quality First

- No cheap-looking, placeholder-feeling, or visually unfinished minigames may ship.
- Graphics quality comes first: polished environments, readable art direction, deliberate composition, depth, lighting/shading where appropriate, and consistent character/world styling.
- Sound is part of the game experience, not an optional extra. Each minigame must include suitable sound effects and, where appropriate, music/ambient audio with user-safe volume behavior.
- Animation is required. Character motion, feedback, transitions, rewards, failures, impacts, object movement, and environmental responses should feel intentional and responsive.
- Gameplay feedback must be immediate and satisfying: visual, motion, audio, haptic where supported, and score/progression feedback as appropriate.

## Native Dependency Rule

- Prefer the existing Expo/React Native stack when it can deliver the target quality.
- Native libraries or native-capability changes may be introduced when they materially improve graphics, animation, audio, physics, rendering performance, input quality, or overall game feel.
- Do not add native dependencies merely for novelty. Every native addition must justify its quality/performance benefit and be checked for Android/web impact, build compatibility, bundle cost, and regression risk.
- When a high-quality experience cannot be achieved web-only, quality takes priority over avoiding native work.

## Release Gate

A minigame is not complete because the logic works. Before release it must pass all of the following:

- visually polished enough to feel like a real game, not a demo;
- smooth animation and responsive input;
- working sound/audio behavior;
- stable frame pacing on representative Android hardware;
- no broken scaling, clipping, or unreadable UI on supported screen sizes;
- no obvious placeholder assets unless explicitly marked as development-only;
- progression/reward integration works without duplicate rewards;
- failure/retry/re-entry states are stable;
- memory use and asset loading are bounded;
- web/native behavior is verified for the platforms on which the game is enabled.

## Standing Principle

**QUALITY FIRST. GRAPHICS FIRST. SOUND + ANIMATION REQUIRED. IMPORT NATIVE ONLY AS NEEDED, BUT DO NOT LOWER GAME QUALITY JUST TO AVOID NATIVE WORK.**
