# BUKLOD Empire Arena: isolated playable Genesis practice
**Status:** DEV-only offline playable HTML, **NOT** online ranked PvP, Android RC, Google Play, OTA, or live economy activation.
- Start: `experiments/empire-arena/PLAY_BUKLOD_EMPIRE_ARENA_OFFLINE.html` directly in a compatible browser (embedded resources, network not needed).
- Source: `experiments/empire-arena/practice-engine.mjs` (deterministic, no account/finance writes). No existing game route or native runtime modified.
- 1v1, 3v3 and 5v5; 13 hero identities with prototype combat archetypes, 3 maps, joystick/keyboard, objective capture, 50ms practice simulation, AI bots, SFX and Genesis theme.
- **Media used from user Library:** `/Sound and voice effects/Animation/rogue-hero-128-assets.zip` licensed game-use frames; `/Sound and voice effects/magic-spells-sfx-lite-v21-rate-r2.zip` licensed game-use audio by Willosuna; `/Buklod V2/KayKit_Furniture_Bits_1.0_FREE.zip` CC0 props (Kay Lousberg). Rogue and Willosuna prohibit redistributing as standalone media packs; all incorporated only into the playable HTML.
- Unverified-license archives, third-party songs, full Godot rigs and unknown-rights assets excluded.
- Emulated browser and pure Node tests executed in an isolated workspace; GitHub CI/Android not inferred from those checks.
- To release actual PvP: build a secure game server, signed joins/rosters, anti-cheat and disconnect policies, transactional Diamonds settlement + canonical BP evaluator, 13 rigged heroes, Android runtime + team voice, ad/nav QA and owner-approved RC.
**No direct changes to app launcher, authentication, backend, RLS, BP/QMP, Diamond balance, production APK, or OTA.**
