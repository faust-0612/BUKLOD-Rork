# Reuse-first interaction and authored presentation blueprint — 2026-11-26
Preserve current Unity URP, 13 heroes, simulation, camera benchmark, fog-safe HUD and skill commands. No engine replacement. No paid downloads. Retain production guard and review-only imported art boundary.

## Reusable upstream foundations
- Kenney Mobile Controls (900 files, CC0): https://kenney.nl/assets/mobile-controls
- Kenney Adventure UI (130 files, CC0): https://kenney.nl/assets/ui-pack-adventure
- Kenney RPG UI (CC0): https://kenney.nl/assets/ui-pack-rpg-expansion
- Kenney Game Icons (CC0): https://kenney.nl/assets/game-icons
- Kenney Interface Sounds (100 files, CC0): https://kenney.nl/assets/interface-sounds
- Quaternius Medieval Village MegaKit Standard (CC0): https://quaternius.com/packs/medievalvillagemegakit.html; pinned mirror already recorded in THIRD_PARTY_ASSET_LOCK.json. Actual door meshes Door_1_Round and DoorFrame_Round_Brick, corresponding BIN and six PNG dependencies, are present upstream.
- Unity Input System mobile controls: https://learn.unity.com/tutorial/mobile-controls-and-touch-input; EnhancedOnScreenStick MIT reference: https://github.com/AnnulusGames/EnhancedOnScreenStick. Keep existing EnhancedTouch ownership rather than run two independent input providers.
- Unity Chop Chop reference: https://github.com/UnityTechnologies/open-project-1; PrimeTween reference: https://github.com/KyryloKuzyk/PrimeTween. Keep existing simple transition implementation until a full tween package is necessary; no source copied.
- Keep Quaternius as the primary art family. Use free UI packs for consistent nine-slice panels, readable skill symbols, button feedback and audio. Do not mix incompatible character rigs or apply assets without provenance.

## Integration order
1. Control geometry: safe-area shared layout, floating joystick, radial deadzone, nearest overlapping action, separate movement and aim fingers, drag-out cancellation, reset on focus/area changes. HUD uses same hitbox geometry and visually indicates active skill.
2. Menu safe area and real loading/reveal: initialize first, keep battle paused through entrance fade, unlock after reveal, do not fake loading or rewards. Existing menu, cooldowns, inventory and simulation preserved.
3. Import Kenney authored UI art/sounds from the pinned source download links; inspect licenses and file structure, map exact sprites/audio to existing controls. Avoid redundant generated icons where a suitable authored asset exists.
4. Authored door and frame sample: use original mesh files and textures, not primitives. Align hinge and frame at world scale, animate opening/closing, maintain collision/NavMesh authority and avoid accidental entry into opponent bases. Decorative entrance doors do not alter canonical combat or victory conditions. Expand only after gameplay review.
5. Authored hero/animation, village, props, wildlife and environment intake continues from prior manifest; same benchmark before applying to full roster.
6. Verify compilation, multi-touch, safe area across 16:9 and tall phones, pause/resume, entrance recovery, skill cancel, no stuck movement, and real rendered quality. Actual gameplay/device evidence may be deferred but cannot be claimed passed. No production deployment.

Current source changes implement steps 1–2. Upstream asset files for steps 3–4 are identified but not downloaded/imported in this commit. No Unity or APK verification.
