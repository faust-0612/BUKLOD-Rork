# Genesis Native Foundation + Smart Drawer bridge — DEV (20 November 2026)

- Canonical theme **Genesis: Let There Be Light** / Galactic Creation. Current source already contains Smart Drawer R1's private SQLite, Camera/Scan, Quick Note, gallery and local reminders. This does not wholesale merge obsolete PR #195.
- Added opt-in Android SAF document/file-provider picking (PDF and images; user may select a Google Drive provider if available), copied to per-user local storage with approved extensions, 15 MB limit when file size is accessible, PDF preview/share, no automatic sync or OAuth.
- Added exact preview runtime cosmetic feedback guard for `org.mzbministry.buklod.staging`, runtime `2.0.0-genesis-preview`; on-demand expo-haptics on Kingdom selections and successful Drawer Quick Note save, honoring foreground and Reduce Motion.
- Reuses current native dependencies; no app.config.js, SDK, permissions, Firebase, ads, rewards, Supabase, production or staging OTA changes.
- Held native work NOT represented as complete: keyboard IME direct GIF commitContent (old #814), Drive OAuth/portable backup, Android Media3 compression, Play Core update, Godot AAR, original 13 Rive rigs and mastered soundtrack. Each requires independent binary/credential/device acceptance.
- Run `node --test tests/season2-genesis-native-drawer-20261120.test.mjs`, TypeScript, protected feature gate, Android export and real signed Genesis APK/device validation before release.
- Dev source only. No verified native APK, no staging OTA, no production. Dec 6 remains earliest authorized Season 2 date, never automatic.
