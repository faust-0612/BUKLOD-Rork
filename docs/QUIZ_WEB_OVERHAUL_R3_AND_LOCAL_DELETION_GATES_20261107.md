# BUKLOD Quiz R3 — DEV web-overhaul acceptance and local-deletion gates (2026-11-07)

## Verified outcome

**DEV UI implemented; cloud-only Quiz web build PASS; live business-function restoration NOT deployed; blanket local-file deletion NOT authorized.** This document records the final known verifications without conflating source backup, DEV CI, RC and production.

### Authoritative locations

- Quiz source **immutable archive**: `faust-0612/BUKLOD-Migrated-Sources`, `migration/quiz-canonical-source-20261107` at `9cef155f2378fc77a46e20325259e81136525e45`.
- Quiz provisional R10 working **DEV**: `faust-0612/BUKLOD-Migrated-Sources`, `dev/quiz-r10-main-db-reconciliation-20261107`, source root `systems/quiz/BUKLOD_Quiz_Standalone_CANDIDATES/BUKLODQ_R10_BUILD_project_3d5647803088_04e596c8cfeb/`.
- Main BUKLOD **DEV**: `faust-0612/BUKLOD-Rork`, `dev/quiz-consolidation-identity-audit-20261107`. Issue #391.
- Current Quiz live still uses Dedicated Supabase `cjtehbfspgimyhifnjon`; Main Quiz remains `yhanxndaqbmuzbdqlblu` with no live attempt/response rows.

### Visual and navigation change set

- Existing responsive workspace shell retained; desktop sidebar redesigned in dark navy/teal, established theme colors harmonized across faculty and student Quiz pages.
- Contextual Back control added to workspace topbar with browser/deep-link-safe Home fallback.
- Two-column polished responsive Login page added to web without changing sign-in candidate/auth-session logic.
- Exam management Delete action now explains no-op conditions and refuses deletion of any populated, archived or live-linked exam; secure backend guard is intentionally more restrictive than earlier Main RPC. Existing review, score, submission and Auth logic preserved.
- Existing web modal `QuizDialogHost` maintained for confirmations; no regression to native-only Alert.
- All changes strictly in Quiz source DEV branch; original source archive untouched. No live web deployment / Main or Dedicated database mutation.

### Actual independent cloud CI acceptance

**Final GitHub Actions run:** https://github.com/faust-0612/BUKLOD-Migrated-Sources/actions/runs/42353198033

Exact trigger SHA `ddef5e6e084edf947d9d0656af89d40fbd4e827e`, `completed/success`.
From a clean Linux checkout with Node 22: `npm ci` PASS, `npm run check:quiz-target` 8/8 PASS, `npm run check:quiz-routes` PASS, `npx tsc --noEmit` PASS, `npx expo export --platform web` PASS, static exported `index.html` PASS. This is a build/contract test, not an authenticated functional click test or deployed runtime test.

Latest static route test: **22 TSX route screens**, **20 explicitly required**, **41 navigation references**, **122 Pressable controls**, **0 possibly unwired Pressables**, **0 missing routes/host issues**. Static scan detects five missing backend functions. A wired button can still fail at runtime due to RPC authorization/network/business state; do not claim 122/122 real-user success.

### Confirmed five legacy button regressions / RC-only fix

The current Dedicated project lacks these RPCs, but Main has all five: `buklod_quiz_publish_exam_v1`, `buklod_quiz_unpublish_exam_v1`, `buklod_quiz_archive_exam_v1`, `buklod_quiz_restore_exam_v1`, `buklod_quiz_delete_exam_v1`. The R10 Manage Exams and Exam Editor call these names. All other function/table names examined in three groups across 24 screen/lib files were present on Dedicated.

**Fix staged, NOT applied:** `supabase/pending/quiz_consolidation/20261107_dedicated_exam_management_five_rpc_rc_only.sql` (Main DEV). Uses Dedicated-compatible table schema and `buklod_quiz_audit_write_v1` instead of missing Main-only faculty-actions table; examiner/owner checks, audit records, explicit revoked `PUBLIC/anon` grants, safe state guards; Delete refuses any related data and avoids ON DELETE CASCADE loss. Needs isolated RC execution, realistic authenticated negative/positive scenarios and exact database verification before deployment. Cannot switch frontend to Main to fake button success because Main still has zero live attempt/response rows.

### Source-data safety

Dedicated has 952 historical attempts, 61,959 responses, 98 private documents. Main private stage mirrors 952 attempts + 61,959 responses; Main live public Quiz still 0/0. Earlier 19 tables/95,868 historical rows, 24 internal FKs/166,253 links passed. Exactly 2 source UUID ownership exceptions remain (234 Auth-FK refs); 86 private docs missing on Main and 0/98 content-hash verified in audited table. SSO gate timestamps changing confirms Dedicated remains active. No source DB retired or local folder deleted.

## Six separate requirements for deleting local BUKLOD sources

| Gate | Required proof | Status |
| --- | --- | --- |
| 1. Full local inventory | Enumerate and classify **all** original Windows project, unique build/config, signing and media paths; compare exact local manifests | **BLOCKED:** no full direct PC inventory access. |
| 2. Backup of each project | Independent private Git repo path + SHA-256 manifest for every authoritative source and revisions | **PARTIAL:** two standalone Quiz candidates verified, Main cloud source partly audited. |
| 3. All nonregenerable assets/config | Source artwork, custom assets, old builds, migration scripts, required config, confidential secrets in secure vault | **BLOCKED:** earlier source recovery counted 43,049 excluded entries (including 33,049 not itemized and 2,049 assets/noncode awaiting review). Many may be regenerable; don't label all unique/missing. |
| 4. Clean cloud-only restore/build | For every relevant BUKLOD app, clone, install from pinned lock, export/compile, restore/operate and exercise key behaviors | **PARTIAL:** Quiz R10 web CI verified on cloud; Main app, Classroom, Attendance, KL, BSOC, IGPAT and native build not fully certified. |
| 5. Signing secrets/credential recovery | Encrypted, access-controlled and separately backed-up Android signing/EAS/Expo, Google/Vercel/Supabase/GitHub recovery; test *access* without revealing secrets | **NOT VERIFIED** |
| 6. Independent backup and restore drill | Second independently accessible backup and a clean restoration drill, local-to-cloud SHA/source parity, deletion quarantine, then controlled purge | **NOT VERIFIED** |

**Evidence:** older cloud-only recovery preflight GitHub run 42344793806 completed success in separate essentials archive. It audited 42,515 tracked files in cloud, nine manifest-bearing project roots, 683 additional recovered code/assets, and reported 43,049 excluded prior entries (7,903 regenerable/toolchain, 2,049 asset/noncode review, 33,049 not itemized). Its own logged conclusion: `CLOUD SOURCES PRESENT — NOT YET FULLY BUILD CERTIFIED; DO NOT DELETE ORIGINAL FILES.`

**Read-only safety audit helper** prepared as a separate bundle for the user's Windows machine; it can create SHA/inventory reports, compare local candidate sources against immutable archive, and run an opt-in temporary web build. It has no local deletion commands. The remote GitHub-only CI does not prove the uninspected Windows directories are fully backed up.

**Release outcome: PARTIALLY COMPLETE WITH EXPLICIT BLOCKERS / BLOCKED BEFORE RELEASE**. No release claim, no blanket local deletion, no Dedicated retirement.
