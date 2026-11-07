# BUKLOD Kingdom Unified Games R1 — Release Hold

Status: FEATURE BRANCH ONLY. No OTA, APK, Supabase migration execution or production deployment.
Base main commit: e0a28b08786ebe32ebd09af613ddf1a674234138 (Oct 6).
Canonical Windows V26 DEV may be newer; reconcile before merging anything.

## Implemented
- All 13 Kingdom station IDs and routes preserved.
- Four new playable games: Mitch Block Forge, Christian Bible Quest, Van Mind Challenge, Quin Guessing Quest.
- Previous game code is retained for rollback.
- Existing active BUKLOD character art/motion reused in Kingdom map and game runtime.
- /games routes require authenticated BUKLOD users but no Points, Circle Rank, purchase or Organization.
- Local preview progress is user-specific. Anonymous legacy results require explicit owner confirmation before import; original record remains untouched.
- New mini-games award no BUKLOD XP or Points.
- Updated registry and bilingual help for four replacements. Actual quiz question content is English-only at this stage.
- SQL migration for account-owned cloud game progress has been committed but NOT APPLIED.

## Not yet done
- TypeScript, real Expo web/native playthroughs, memory, offline, sounds and Android QA are NOT VERIFIED.
- Godot Empire Kingdom native bridge is NOT built and the connected BUKLOD Main source does not contain the Godot project.
- Cloud saves are not connected, despite staged RLS migration. Cross-device sync pending.
- Existing R14 Serious Visuals remains the approved graphics baseline; do not use toy rebuilds.
- Gameplay / security tests and complete V26 integration remain pending.

## Required release discipline
Reconcile actual authoritative V26 DEV first. Run static regression, TypeScript and web export, then actual Android APK QA. Complete native Godot integration only through a new approved APK/AAB, not OTA. Freeze exact DEV to RC, publish only after approval. Maintain V25 hold.
