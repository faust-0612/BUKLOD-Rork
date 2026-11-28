# BUKLOD Empire — Release and reconciliation ledger

## 2026-11-28 — Stage 1 diagnostic evidence (PARTIAL, not RC)

Owner-provided ten screenshots of a Unity Development Build (offline test, not for release) show a Phan lobby, a new-match confirmation, live battlefield at 00:07, 01:43 and 02:31, level/gold/KDA/units changing, and visible Shop, Village, Market, Loadout and Field interfaces. This demonstrates running gameplay and UI availability, not successful individual purchases, economic transactions, animations, or every hero. Different skill icon sets appear in match captures, but selected hero identity is not established for each. Screenshots do not establish zero console errors, actual FPS, all 13 hero starts, or exact installed APK SHA-256. No claim of release approval or premium art.

Expected source baseline from owner's PowerShell HEAD: `be37e5d0bbe3360ca7556869a59dbd7bed5a30aa`. Documentation-only successor: `678862a740826d5518045f61dd7b70e85d31ecb5`. Candidate receipt, installed APK identity and console log still required. Existing candidate script emits `*.apk.candidate.json` with sourceRevision, package, sha256, bytes, artifactSignatureVerified, deviceVerified, editModeVerified and productionApproved. Do not rewrite this original receipt to assert acceptance. Record device evidence separately. Raw owner screenshots remain in conversation; do not publish to public repository without authorization.

Stage 1 pending: all 13 selected heroes (phan, quin, van, christian, lhen, ace, ellusur, jawo, mitch, niel, angel, vhen, trudice) start a fresh match, render and move, basic combat, clean Unity runtime error log covering the tests, exact APK identity, explicit acceptance. Existing RuntimeBattleSmokeTests exercises simulation, not actual BattleView/Animator rendering. No fresh build required to finish the existing APK's device tests. No graphics changes or Stage 2 asset substitutions allowed.

## Read-only ancestry inventory (against 678862a740826d5518045f61dd7b70e85d31ecb5)

| Branch | Inspected head | Ahead / behind | Disposition |
|---|---|---:|---|
| dev/empire-premium-surfaces-20261127 | 678862a740826d5518045f61dd7b70e85d31ecb5 | 0 / 0 | Reconciliation candidate; not yet canonical |
| dev/empire-pregame-presentation-20261127 | baef37e00c5d5a5f0b61b379064fcbf2eb60de77 | 22 / 7 | Divergent; inspect pregame, HUD, match flow, animation and effects; preserve Stage 1 fix in shared files |
| dev/empire-online-ticket-integration-20261127 | 76f75c3460803f9359bfbf7462272070d31bcedf | 1 / 54 | Separate online ticket change; offline isolation and security review required |
| dev/empire-apk-preparation-20261126 | 824cf47ab746b2781d9c48a8ee09db9e029ee0d3 | 0 / 38 | Ancestor; do not reapply |
| dev/empire-unity66-compile-fix-20261125 | 2ec84fb93d7f19c6137d09a93a05a6c0a6ee8055 | 0 / 69 | Ancestor; do not reapply |
| dev/empire-image-to-3d-reconstruction-20261125 | bfac0e691a8830cb8e32db70279d0624e4469e82 | 10 / 193 | Divergent; review Sacred Stones, reconstruction tools; no MAIN/server merge |
| dev/empire-unity-integrated-apk-20261124 | 090ff1efccaaa01a2e78cb2f32abfe6f6d4ed9a7 | 11 / 195 | Divergent; compare actual gameplay/test parity, no whole-branch merge |
| dev/buklod-empire-unity-migration-20261124 | fd34a732a35349a76df1d703fe01172e54d0d59e | 9 / 193 | Divergent; overlapping Sacred Stones work; no MAIN/server merge |

GitHub compare counts are relative to common ancestry, not a count of absent features. Prefab/asset input equivalence, actual per-file content parity, remaining historical branches, unpushed local changes and final integrated DEV head are not yet reconciled. Pregame and current branches share merge base `3209ce997dc686a73063c10401cd3949d0d78ef0`; do not overwrite corrected BattleView, OfflineSessionMenu or ReviewLiveHeroPreview. Keep all branches intact. This ledger is preparatory inspection only; no merges, deployment, build, paid CI, or asset changes authorized by this record.

## Open mandatory gates

- Stage 1 runtime acceptance: PARTIAL.
- Integrated DEV source reconciliation: PARTIAL (selected recent branch ancestry only).
- Stage 2 licensed assets and manifest: NOT DONE.
- Stage 3 rig and animation acceptance: NOT DONE.
- Stage 4 look and measured mobile FPS: NOT DONE.
- Stage 5 remaining ten heroes: LOCKED pending owner approval of Stages 1–4.
- Secure remote content updater: NOT DONE; mandatory for next consolidated post-Stage-1 APK, per AGENTS.md.
- Production / online release: NOT AUTHORIZED.

Follow the nested AGENTS.md contract. Preserve existing diagnostic APK for Stage 1 verification. No native rebuild for this documentation update.


## 2026-11-28 — Owner-reported shared combat regressions

Owner reports attack button responds but heroes do not attack reliably, some skills work, minion/tower targeting is unclear, towers do not visibly attack or take damage. This reopens Stage 1 functional acceptance; the earlier screenshot evidence proves match entry only. Do not ask the owner to manually enumerate or test each hero/feature.

Scoped branch: `fix/empire-stage1-combat-20261128`, based on `6627ce15beb52ba682124e5acf2c818fe187d243`. Changes: relative touch aim from actual contact, bounded one-attack approach/queued cooldown for visible eligible targets, cancellation on movement/pause/skills/death, exact minion/structure filters, explicit protected-core/target/cooldown/skill-rejection messages, invulnerable-target filtering in offline combat, confirmed tower target/attack feedback reusing existing effects. No model, texture, scene or audio asset changes; no damage-stat buff, no range inflation, no server-authoritative rule or BP/QMP changes. Existing pregame branch has some overlapping targeting/projectile work; preserve the Stage 1 fix when later reconciling. Root causes identified in source do not prove every reported failure is resolved.

Automated regression coverage authored: all 13 basic attacks against heroes and towers, approach/cancel, minion-only targeting, protected core, tower damage, touch deadzone, skill rejection; PlayMode test loads the existing real generated review scene, starts each hero through BattleView and checks actual damage, live animation synchronization and unexpected logs, then tower combat. Full Editor/PlayMode suites via `node Tools/run-stage1-combat-qa.mjs <Unity.exe>` (no APK compilation). Fails closed on missing generated scene, source dirtiness, missing/skipped/failed tests. The new tests and Unity compile have NOT been executed in this environment; local device and exact APK identity still pending. Further issues must be batched from QA findings rather than requiring one-off user tests. Do not declare Stage 1 done or advance art work until accepted.

No production release, no paid CI, no current APK update.

## 2026-11-28 — Branch reconciliation and offline presentation source pass

- Authoritative DEV branch: `dev/empire-library-first-20261128`. Verified starting HEAD: `1e24f6a5c134a52bf703b82e5d0f9adbae8ce170`. The revision containing this entry is the source candidate for this pass.
- The latest Stage 1 combat fix, premium surfaces, APK preparation and Unity compile-fix refs are ancestors of the DEV baseline. The independent online ticket ref was already reconciled by prior DEV work. Selected pregame flow, entrance and portrait profiles, confirmed directed skill receipts and collapse logic were forward-ported from `baef37e00c5d5a5f0b61b379064fcbf2eb60de77`; the shared battle and menu files were reconciled in place. Reconstruction, older Unity APK and Unity migration refs still require fix-by-fix disposition. Unpushed Windows work remains outside this audit.
- Source checks passed: Python suites (34 tests), Node skin/envelope fixtures (10 skin, 7 envelope), 13-hero geometry/39-skill smoke, 183 generated review assets and their manifest, 36 tracked GLBs and 33 authored review input files. C# parser checked four define sets and package/assembly JSON parsed. Unity compiler, scene import and Unity fixtures were deferred by owner.
- Intake archive: `BUKLOD_Empire_Library_Intake.zip`; its generated staging manifest matched the existing pinned SHA. Installer `--verify-only` checked 103 assets without importing them. Use the owner’s archive and preparation script to reproduce the staging directory, then run `python Tools/install-library-assets.py <staged-path>` on the build checkout. Held items still require rights and mapping review.
- Isolated review source pins Unity `6000.3.29f1` and the ARM64 IL2CPP diagnostic package `org.mzbministry.buklod.empire.review`. Its generated scene and settings are separate from the production preflight, which blocked on the production-specific editor and six missing project/catalog/scene inputs in this checkout. Build trust is absent as expected until real hosting, public signing trust and Android version are configured. The hosted match service and its durable isolated storage/configuration are also outstanding.
- Status: PARTIAL DEV source. No RC, APK, OTA, online deployment, or MAIN/BP/QMP change.

## 2026-11-28 — Facial motion and basic attack trails

DEV follows `7d9f266131b110af3e909f9314a96883ed95cbcd`. Reused isolated pregame implementations for the 13-hero blink rig and hand-bound basic attack traces. Verified exported full-detail and LOD skin data for both eye joints on every hero. Editor animation import, playback, visual quality, and device impact remain deferred. The existing startup logo remains wired to the offline review startup. No APK, host or live deployment.

## 2026-11-28 — Authored structure destruction

Baseline `37a979979df881a01c1423d62d43047ae1df5905`. Forward-ported the pregame branch fragment partitioner as separately generated review-only collapse prefabs for authored Lux and Tenebra cores and towers. Runtime selects the fragments by exact source prefab, preserves fog and retirement limits, and falls back to root collapse for remote replacements. Static updater component restrictions are preserved. Six changed C# files parsed and 33 authored input checks passed. Unity fragment generation and playback deferred. The production preflight remains blocked on seven production inputs. No build or deployment.

## 2026-11-28 — Update receipt recovery and historical branch inventory

At baseline `2cadc8fa9b08326ffa1ccde2c16f0e59211a63fa`, exact blob matches among project paths changed by each historical branch were ticket 2/3, reconstruction 13/17, integrated APK 15/38, and migration 10/14. The older integrated APK branch's BattleWorldObjects.cs is the only absent path in that comparison. These counts distinguish exact source parity from paths requiring semantic comparison. No historical branch was merged wholesale.

The updater can recover a corrupt same-revision receipt without replacing a valid signed revision. Receipt publication still follows full bundle hash verification. Authoring coverage includes invalid cache recovery, exact retry, conflicting signed revision rejection, and staging file cleanup. Unity test execution remains deferred.
