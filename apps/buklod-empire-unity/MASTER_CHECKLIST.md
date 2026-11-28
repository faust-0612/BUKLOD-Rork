# Empire source completion checklist
Baseline: 902f6e441570a0ae8b3f64d1a027a33b4a76681c. Pregame source: baef37e00c5d5a5f0b61b379064fcbf2eb60de77. Owner defers external engine/device verification, not source completeness. MAIN untouched.
- [x] Inventory current Git tree (407 Empire blobs) and compare five branch trees by path and blob SHA.
- [x] Inspect online ticket branch deltas: current DEV retains ticket integration, adds final retention, input suspension and URP dependencies. Do not overwrite.
- [x] Forward-port isolated skill lab and button response into existing hero detail menu; retain canonical combat and preview lifecycle.
- [ ] Reconcile remaining pregame wizard, portrait choreography, showcase, palette UI, projectile and reward receipts/effects, fortress collapse, weapon trails, facial motion, and supporting tests/tools. Do not wholesale replace shared files.
- [ ] Compare remaining historical branches and local-only changes; record dispositions.
- [ ] Audit all C# and scripts for unresolved symbols, TODO/FIXME, and missing integrations.
- [ ] Complete adaptive AI and hero combo sequencing; RTS balance and hazard safety audit.
- [ ] Reconcile authenticated online lobby/host/settlement and presentation without touching MAIN or live services.
- [ ] Reconcile rights-cleared asset inventory, all hero rigs, environment, audio, and generated scene bindings.
- [ ] Complete signed static content update source integration and configuration preflight.
- [ ] Execute available static checks and focused regressions; fix failures.
- [ ] Reconcile build scripts, asset prerequisites, source ledger and clean committed candidate.
- [ ] Declare source complete only after all source tasks are closed. External Unity/APK/device verification separately deferred.

- [x] Wire preview-only costume palette into existing hero showcase; restore original material through property blocks; regression fixture added (not run).
- [x] Correct learned pursuit attribution to require the same observer and actual player displacement, not observer movement.

- [x] Forward-port bounded confirmed ranged-basic projectile tracers and visible hero HP/shield/level/damage overlays; bind to current BattleView, pause/reset lifecycle and fog checks. Regression fixtures authored, not run. Skill projectile receipts and reward feed remain open.

- [x] Confirmed local combat, assist, shop, pickup and relic reward receipts integrated into existing HUD; no new currency grants. Regression fixtures authored; execution deferred. Neutral camp receipts and full multi-event presentation remain open.

- [x] Neutral camp and shared boss reward receipts, including capped actual gold changes; fixture authored, execution deferred.

## DEV source completion pass

- [x] Reconciled staged offline match entry with the current menu and battle lifecycle. Startup, mode, difficulty, team formation, hero, loadout, lock-in and loading are wired. Existing costume, trial and resume flows retained. Loading can be cancelled before synchronous initialization.
- [x] Bound the owner’s animated startup branding and reused each hero’s existing controller clips for a lock-in entrance. Added hero-specific portrait camera framing.
- [x] Added ordered presentation of retained reward receipts, visible confirmed directed-skill tracers and bounded structure-root collapse with result reveal timing. Existing hit and reward rules retained.
- [x] Verified the 103 pinned CC0 intake files against the owner’s matching archive and the installer’s checksum and license contract. Verified 36 tracked authored GLB source hashes and 33 additional authored review input files.
- [x] Ran geometry source preflight, 34 Python tests, Node fixtures and generated review asset manifest validation for 183 files at 256 px hero and 1024 px shared texture resolution. Parsed C# sources in editor, review Android, production Android and server define configurations. These checks do not resolve Unity types, serialize an imported scene or execute C# fixtures.
- [ ] Finish reconciliation of unported branches, including source-level parity for RTS and Sacred Stone behavior. Unpushed Windows-only changes remain uninspected.
- [ ] Complete facial rig motion, combat weapon trails, detached structure fragments, remaining asset rights/bindings, full authored roster/faction assets and dialogue/audio coverage.
- [ ] Complete adaptive combat and strategic AI regressions, all-hero gameplay and progression coverage, durable online host and settlement composition, online lobby/HUD, and full secure updater slot and publishing coverage.
- [ ] Provide isolated hosting and pinned updater trust for the intended Android version code. Install the 103 verified Library inputs on the build workstation. Generate the review scene, catalog, NavMesh and Android settings through the documented isolated path.
- [ ] Full Unity C# compilation, EditMode/PlayMode, Android/APK and hosted multiplayer verification are deferred. Production-only catalog and scene readiness remains blocked. Source-complete and build-ready verdict remains open.

- [x] Forward-ported two weighted eye joints per hero, the idle blink and head/chest curves, and the reset curves for authored motion overrides. Full-detail and LOD eye weights verified across all 13 generated rigs. Facial expression and lip-sync coverage remain open.
- [x] Forward-ported hand-bound weapon traces for confirmed basic attacks. Traces are limited to visible review heroes, clear on pause/cull, and are purely visual. Unity execution deferred.

- [x] Wired built-in core and tower collapse fragments to their exact authored source prefab. Sidecar prefabs keep the static updater allowlist intact. Missing, unreadable or updated art uses the existing root-collapse presentation. Source checks passed. Unity import and fixture execution deferred.

- [x] Fixed signed updater retry when the destination contains a corrupt receipt. An exact signed retry is idempotent and a different valid signed receipt for the same revision is rejected. Unity regression fixture authored, execution deferred.
- [x] Compared branch-changed project paths by exact Git blob for the ticket, reconstruction, older integrated APK and migration branches. Nonidentical-path semantic reconciliation remains open.

- [x] Wired reserved Unity room composition through the durable lease/start coordinator. The room exposes an owner-thread pump and requires an injected store and host lease identity. Added denied-renewal regression coverage. A concrete isolated store, trusted settlement and ingress remain required.

- [x] Authored and wired the missing Demon and Snake controller clips on the original pinned rigs. Both GLBs passed exact checksum and unique skin-joint binding checks. Hit and Death states are available without changing invulnerable hazard gameplay. Unity import and playback deferred.

- [x] Added an isolated offline motion preflight for the original Jungle Demon and Snake prefabs. The Unity gate verifies the movement blend, typed parameters, action transitions and rig curves before packaging. Its execution remains deferred until Unity import.

## Consolidated Empire release inclusion (owner directive, 2026-11-28)

- [ ] Reconcile all post-baseline improvements, including the blueprint-derived physical Rift terrain, bridges, jungle/fog/minimap, complete actual 13-hero roster and attack/skill animation choreography into the same cumulative candidate.
- [ ] Resolve rights/canonical mapping for private candidates; never package the private editor-only scene.
- [ ] Classify changes by native runtime versus supported signed content ABI; map/rig/controller/C#/shader updates require compatible native support, not the existing v2 OTA alone.
- [ ] Finish verification and release gates from RELEASE_LEDGER.md before a single consolidated Empire rollout. No MAIN changes and no premature publication.
