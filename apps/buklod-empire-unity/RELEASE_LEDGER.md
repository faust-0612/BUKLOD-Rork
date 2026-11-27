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
