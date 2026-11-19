# Genesis Android Native Foundation — GIF keyboard + private Drawer backup (DEV only)

Source parent 3844e4685cfed827d7f34e03f0d63fb72b1278b1; confined to isolated Genesis preview. No production/staging-user or signed Android APK release.

- Reused the held Android 2026-11-15 keyboard GIF implementation, trimmed Godot + Google OAuth dependencies; local Expo module named BuklodGenesisIme accepts Android IME commitContent only when the signed Genesis preview runtime is active. The GIF magic header and 25 MB cap are checked before private cache staging; user still taps Send.
- Optional Android DocumentsProvider button in Community/Cluster comment composer. Google Drive is only available as a user-selected Android file provider when installed; it is not Google Drive API authorization or synchronization.
- Encrypted manual private Drawer backups via expo-crypto AES-GCM + recovery key; 20 MB bounded, account binding, skip existing notes on restore, no backend uploads or token persistence. Explicit recovery key required and cannot be recovered by BUKLOD.
- Reused existing Skia, Reanimated, Rive, Lottie, expo-audio, SQLite and splash runtime foundations; not claiming approved rig or soundtrack assets.
- Held Godot engine, native OAuth, background Media3 compression, Play Core updates remain separate decisions pending binary/device QA and owner credentials; no new premium binaries, new permissions, backend or ad behavior introduced here.

Required release gates: run focused test and exact-source TypeScript, Hermes/Expo prebuild, Android Gradle native compile, app install and GIF keyboard/manual send, Drawer backup/restore, AdMob first-view, instant tabs, no ad audio overlap, native binary/runtime SHA confirmation. No APK or OTA is authorized based on this code alone.

CI reconciliation: TypeScript native-input callbacks explicitly typed. Restored note IDs are deterministic per authenticated user, so encrypted archives cannot replace another local account's primary-key row; original-row IDs are checked to skip duplicates.
