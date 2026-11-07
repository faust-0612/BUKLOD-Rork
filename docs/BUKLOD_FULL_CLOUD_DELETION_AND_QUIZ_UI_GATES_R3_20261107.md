# BUKLOD Full Cloud Recovery + Quiz web UI R3 audit (7 Nov 2026)

**Owner objective:** make every source recoverable without the Windows laptop, then safely remove local copies; simultaneously redesign BUKLOD Quiz as a professional modern web app while preserving exam records, existing views, and functional controls.

**Completion status:** partially complete with explicit blockers; cloud Quiz backup verified, UI SOURCE in DEV changed, production is unchanged; **NO LOCAL DELETE CLEARANCE**.

## Source-of-truth and isolation

- Main: `faust-0612/BUKLOD-Rork` (GitHub **PUBLIC**), DEV `dev/quiz-consolidation-identity-audit-20261107`.
- Standalone Quiz source archive: `faust-0612/BUKLOD-Migrated-Sources` (GitHub **PRIVATE**), archive `migration/quiz-canonical-source-20261107`, commit `9cef155f2378fc77a46e20325259e81136525e45`. Immutable R10 300 files / 65,058,267 B and BUILD 336 files / 75,834,778 B, both with SHA-256 manifests, 636 files total. Remote manifests and critical source were fetched/verified. No independent fresh-clone file-hash verification from the owner's Windows machine yet.
- Standalone Quiz UI DEV: `faust-0612/BUKLOD-Migrated-Sources`, `dev/quiz-r10-main-db-reconciliation-20261107`; modern responsive shell/dashboard and restored UI controls are **DEV-only**, not publicly deployed, source Archive branch unchanged.
- Main Supabase: `yhanxndaqbmuzbdqlblu`. Dedicated Quiz: `cjtehbfspgimyhifnjon`. Do not route existing Quiz to Main until data/Auth/Storage fully reconciled.

## Required 1–6 deletion gates — independent evidence

| # | Gate | Status | Evidence / missing proof |
|---|---|---|---|
| 1 | All BUKLOD projects and local source roots inventoried | **NOT VERIFIED** | Previous scans were bounded and incomplete; no authoritative readout of all unique untracked files, Main/Quiz/Classroom/Faculty/other standalone modules and Windows drive roots. Tool access cannot directly read the user's Windows filesystem. |
| 2 | Every unique project backed up to cloud | **QUIZ PASS, GLOBAL BLOCKED** | R10+BUILD private source archive verified, Main repo in GitHub. No proof all other local-only source variants and modules have matching hashes/private recovery copies. |
| 3 | Assets, configs, migrations, media and unique ignored files preserved | **NOT VERIFIED** | R10/BUILD manifests and lockfiles present but not a whole-PC local/ignored-asset comparison; signing files/secrets need an encrypted vault. Historical asset preservation script at Main commit `68c8a561520ec0d4bf1dfe074316184c58903815` was explicitly fail-closed with `safeToDeleteLocal=false`; no verified successful complete asset-release upload. |
| 4 | Rebuild exclusively from cloud | **NOT VERIFIED** | Quiz and Main root dependency declarations match package-lock v3 (614 and 893 packages respectively). No actual fresh `npm ci`, standalone Quiz `tsc --noEmit`, Expo export/browser test, Android signing or Main v28 runtime build acceptance. Quiz R10 has no `eas.json` in its archive. |
| 5 | Credentials, EAS/Android signing and recovery | **NOT VERIFIED** | Private encrypted recovery of Android keys/certificates, EAS account config, Supabase project secrets, publishing/release credentials and password-manager recovery NOT verified; never place private keys in public Main repo. |
| 6 | Independent backup and complete restore drill | **NOT VERIFIED** | Private archive accessible, but not restored, built and booted from a separate independent environment/backup; previous reported encrypted 7z self-test failed. No completed independent restore evidence. |

**Rule:** Gate 1–6 must all be genuinely independently passed before declaring unrestricted local deletion safe. Clean generated caches may be considered only after proving they can be rebuilt and contain no unique data.

**Caution:** the missing 86 documents from Main Quiz Storage are a separate *database merger/Dedicated retirement* blocker, not necessarily a laptop-source deletion blocker if their authoritative bytes remain safely protected in Dedicated plus independently backed up. Do not confuse these two gates.

## Safe read-only tools committed in MAIN DEV

- `scripts/verify-quiz-cloud-restore-r1.cjs`: clean private clone pinned at `9cef155...`, no CRLF normalization, check both manifests and SHA-256 of all 636 files, abort on change, never touch original source. Pass needed on authenticated Windows/independent worker; **not executed here**.
- `scripts/audit-local-quiz-deletion-readonly-r1.cjs`: compare originals `C:\BUKLODQ_R10_BUILD\project` and `C:\BUKLODQ_BUILD\project` to the clean clone, flag unbacked source, altered bytes, secret/signing artifacts, symlinks and excluded generated dirs; never delete. **not executed here**.
- Standalone downloadable offline audit kit also created with read-only scanner and PowerShell command. Its bundled `audit-cloud-recovery.test.cjs` ran with Node and **passed six static checks**, confirming fail-closed deletion status on missing proofs. The bundled PowerShell wrapper was patched to disable Git automatic CRLF normalization in both disposable clones.
- Normal CLI after downloading scripts from the public DEV repo and confirming the code:
  `node verify-quiz-cloud-restore-r1.cjs --keep`, record the printed isolated restore path, then
  `node audit-local-quiz-deletion-readonly-r1.cjs --archive-root "<isolated-restore-path>"`.
  Scripts should be run in TEMP / independent working directory; no destructive commands are authorized.

## BUKLOD Quiz UX/action functionality

Separate Quiz DEV change report: <https://github.com/faust-0612/BUKLOD-Migrated-Sources/blob/dev/quiz-r10-main-db-reconciliation-20261107/docs/QUIZ_MODERN_WEB_REDESIGN_R3_20261107.md>.

- Implemented: desktop Sidebar + topbar, responsive mobile bottom nav/drawer, professional dashboard, consistent palette/width/typography, 22 recovered routes, 5 legacy faculty navigation controls, live student status filters, shared web confirmation/error modal for ~87 existing Alerts. R10 exam transaction/save RPCs unchanged, data unchanged.
- Source contract tested via mocked file system (20 core routes, critical RPC references and links); readback scan of 20 app screens confirms no unsupported native-only Alert import. Six static cloud audit self-test cases pass on Node; 8/8 config tests previously passed with mocks. **No web browser or real auth end-to-end proof yet.**
- Five missing Dedicated RPCs block genuine publication/unpublication/archive/restore/delete actions. They exist in Main, but cannot simply use Main until live records migrated. Source Dedicated also lacks the Main `buklod_quiz_faculty_actions` table.
- `supabase/pending/quiz_consolidation/20261107_dedicated_management_rpc_compatibility_rc_only.sql`: five secure Dedicated API shims *staged only*, requires isolated RC regression, permissions and rollback checks before any use. Not deployed.
- Dedicated has 16 `LIVE` status sessions, **zero unexpired STARTED attempts** at last read-only check. Do not silently terminate those sessions.

## Historical integrity / no release

- Dedicated 952 attempts, 61,959 responses, 98 private docs.
- Main public live Quiz 0 attempts, 0 responses; Main private staging 952 / 61,959; 19 source table counts match 95,868 staged rows, all 19 casts pass, 24/24 internal FKs pass across 166,253 links.
- Two unresolved source Auth users cause 234 Main user links that cannot be safely reassigned without proof.
- Main private Storage audit 86 missing file paths and 12 metadata-only matches; 0 of 98 have validated content readbacks.
- Current BUKLOD Main Quiz launcher/SSO remains a Dedicated proxy.
- Production Main/Quiz data, hosted web URLs, native OTA and Expo runtime were not modified in this task.

## Actual RC/prod requirement

1. Run cloud clean restore and six local deletion checks on authenticated Windows or separate independent machine. Confirm second backup and signing vault recovery.
2. Run standalone Quiz `npm run verify:cloud-rebuild` in *fresh* clone and capture exact successful npm/typecheck/export evidence.
3. Test browser actions as student and examiner in isolated RC, including destructive/cancel and missing Dedicated exam-management RPCs after protected backend RC stage.
4. Resolve/secure Main ownership and missing docs before Main-only cutover. Keep Dedicated live while current SSO points to it.
5. Only promote tested exact RC, independently verify production runtime, data, feature parity, and rollback; then grant *specific folder-by-folder* deletion clearance.

**Outcome: PARTIALLY COMPLETE WITH EXPLICIT BLOCKERS / BLOCKED BEFORE RELEASE.** Source DEV changes and static audits delivered; six gates not fully satisfied. No blanket local deletion permitted.
