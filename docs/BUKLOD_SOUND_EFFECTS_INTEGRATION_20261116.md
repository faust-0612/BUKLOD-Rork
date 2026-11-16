# BUKLOD Sound Director — source inspection & implementation (DEV)
Date: 2026-11-16. Git baseline: `63ccd4b58ff02ff3c1535a1e05d3097fa8323c61`.

## Source audit — ChatGPT Library `/Sound effects`
| Library MP3 | Duration | Status | Usage |
|---|---:|---|---|
| Amazing Reward — Joel Davis 2026 | 5.88 s | LICENSE_PENDING | Not bundled |
| Best Sound Effects ... — TechKeyFi | 63.576 s | LICENSE_PENDING, montage too long | Not bundled |
| Epic Reward — GCRadix GmbH | 13.608 s | LICENSE_PENDING | Not bundled |
| Epic Reward — duplicate of above | 13.608 s | DUPLICATE | Deduplicate; not bundled |
| success — sound fx effects free | 6.288 s | LICENSE_PENDING | Not bundled |
| UI Reward... Fall Guys Sound | 6.624 s | EXCLUDED: recognizable third-party game sound | Not bundled |

Source file titles, artist fields, and uploads are NOT redistribution rights. Process and relicense any approved audio before shipping. Current DEV integration uses already-pinned offline Kenney CC0 effects.

## Implemented cue targets
| Domain | Trigger | Audio |
|---|---|---|
| BP claim | Confirmed successful claim RPC with awarded points | `kingdom-premium/coins.wav` |
| Circle Rank | Confirmed server rank increase vs per-account last-seen baseline | `kingdom-premium/victory-alt.wav` |
| Character level | Confirmed server selection V2 level increase vs user/character baseline | `kingdom-premium/unlock.wav` |
| Character item | Explicit successful unlock/equip Character Event | `kingdom-premium/collect-crystal.wav` |
| Kingdom & mini-games | Move / collect / impact / success / unlock / failure | `ui-soft` / `collect-crystal` / `impact-wood` / `victory` / `unlock` / `failure` |
| Kingdom regions | Existing 39-game soundtrack/ambience pool | Existing licensed local OGG and focus lifecycle unchanged |

## Invariants
- Audio never grants BP, Character XP, inventory, Circle Rank or Kingdom Shards.
- Character System is authoritative for Character rewards; Kingdom only consumes verified state.
- Active native call, quiet hours, category switches and volume preferences must be respected.
- Existing users who opted out remain opted out; new installs enable achievement sounds by default.
- Gameplay remains usable with failed/missing audio; haptics and current bounded playback stay available.
- Navigation, AdMob, Wall, PTT/calls, user points ledger, SQL and native runtime are untouched.
- No externally sourced Library MP3 is bundled in this DEV branch.

## Release requirements
1. Run dedicated and affected sound regression tests, including existing pinned asset/hash tests.
2. Run exact Expo runtime 1.3.2 TypeScript and Android/web bundle checks on the branch.
3. Test first-ready playback, repeat taps, switch/off, 22:00–07:00 quiet hours, call/PTT coexistence, screen blur, and 3G startup on a compatible staging Android device.
4. Verify no ad/navigation regressions before promoting a frozen RC to production OTA.
No staging or production OTA is part of this DEV patch.
