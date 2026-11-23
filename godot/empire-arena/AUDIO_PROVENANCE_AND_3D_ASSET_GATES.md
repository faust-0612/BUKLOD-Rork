# BUKLOD Genesis 2.0.6 – premium content intake

The 70 Arena sound identities are now **70 deterministic, distinct, recorded-source PCM designs**, replacing the old 70 synthesized sine-wave placeholders. This does **not** imply 70 individually studio-recorded performances.

## Audited audio

The sound design uses nine existing Kenney Interface Sounds CC0 recordings (provenance and original source URLs: `assets/sounds/kingdom-premium/LICENSES.md`) plus eight estate audio WAVs already supplied and used inside the signed BUKLOD staging source. All 17 source files are SHA-256-recorded into `data/audio_manifest.json`. The exact 70 output WAVs each have a unique SHA-256 and are decoded by Godot 4.7.2 headless. No third-party network fetch, API, or synthetic oscillator is used.

Arena audio plays on gameplay events with a bounded player pool/cooldown. Kingdom/House ambience is **OFF by default** so radio/PTT is not interrupted automatically.

## Third-party Library imports

Provided archives (Free RPG Pack, Mocap Pack, Monster01 Unity, Fantasy Sound Pack, magic-spells-lite) and GLB models (t1-sentinel, azure-champion, hooded-blade, desert-watchtower) are **not approved for staging release** based solely on file names or 'free' labels. Before shipping each asset, verify its license for commercial app distribution, inspect ZIP paths/file types and zip bombs, import GLB/FBX to Godot 4.7.2, validate rig/skeleton compatibility and animation retargeting, collision/physics, runtime GPU footprint and originality, and record source SHA-256. The Library uploads are reference inputs, not validated distributable binaries. Their source bytes were not imported into this update.

## Visual quality

Current Arena/Kingdom/House are stronger **2D Godot** experiences with owner artwork. They remain substantially below a full 3D premium MOBA. A true 3D feature requires the inspected rigged assets, material system, environment scenes, animation controller and measured Android performance.

## Release

This is a DEV-only same-engine ZIP for **Genesis 2.0.6** staging channel `season2-genesis-library-206-preview`. Do not publish to MAIN/production or assert device compatibility from headless checks alone. Do not bypass the existing AdMob, navigation, performance or server-authority release gates.
