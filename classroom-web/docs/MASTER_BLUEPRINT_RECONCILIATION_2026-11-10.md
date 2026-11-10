# BUKLOD Classroom — Master Blueprint Reconciliation (2026-11-10)

**Purpose:** Compare every agreed Classroom requirement against the original Main/standalone source, actual Supabase database and RPCs, Gemini Expo web implementation, and available test evidence. This is a working engineering acceptance ledger, **not a claim of completed E2E**.

**Source of truth:** 2026-11-07 Complete Master Specification and previously approved R2/R4 Classroom contract. Latest user instruction: preserve the exact Gemini visual design AND its expected button UX; Main is only the entry door, standalone Classroom owns all academic features. Cloud-authoritative Supabase shared with Main/Quiz/Grade Viewer. Do not merge a stale Classroom branch over newer Main.

**Production baseline:** https://buklod-classroom.expo.app/ · Expo Hosting immutable artifact `0g49qf2xe0` (previously independently verified HTML+JS, signed-out Chrome checks). Existing Main production not changed in this work.  
**Main SSO DEV:** `dev/classroom-main-sso-20261110` (branched from current protected Main, not stale Classroom branch).  
**Classroom completion DEV:** `dev/classroom-completion-20261110` (branched from Gemini production lineage).  
**New SSO service:** `buklod-classroom-sso-entry-v1` active in Supabase, JWT-required.  
**New database migrations applied:** `20261110063350` one-time SSO issuance throttle, `20261110064054` comment scope integrity, `20261110064512` notice acknowledgment isolation.

Statuses: **LIVE** = present in production artifact, **DEV** = implemented but not production-released, **BACKEND** = verified backend schema/RPC exists, **BLOCKED** = not implemented end-to-end, **E2E** = verified with real roles/transactions. A real E2E test needs authorized isolated Faculty and Student fixtures. Code-only and synthetic-browser tests are not real academic writes.

## A. Identity / role / architecture (11 contracts)

| Contract | Evidence and current status | Closure condition |
|---|---|---|
| One BUKLOD account for Main/Classroom/Quiz/Attendance/Grade Viewer | Same Supabase project `yhanxndaqbmuzbdqlblu`, **BACKEND** | Prove identity parity with actual accounts |
| Profile Faculty door directly to Classroom with no second login | Legacy Main sends access+refresh token in query and Classroom strips them; one-time Edge magiclink and fragment OTP exchange implemented in **DEV**, not Main production | Verified Main release + cross-origin real account run |
| Student-only door; ACTIVE enrollment required | `buklod_classroom_launcher_access_v1`, `my_classes_v2('STUDENT')`; Student View protected in **DEV** | Real student-only acceptance test |
| Dual-role Faculty/Student switch without re-login | DEV role selector filters classes and clears privileged UI cache | Real dual-role and revoked-role test |
| Primary Owner / Teacher / Co-Teacher / Assistant / Student | `buklod_education_classroom_faculty`, role/permission RPCs, **BACKEND** | Each role verified per operation; assistant never allowed grade mutation without grant |
| Faculty A cannot access Faculty B data | RLS + server Classroom context RPC; UI regression test only | Real forbidden reads and writes for second faculty |
| Student sees own attendance and released grades only | `buklod_classroom_student_released_grade_items_v2`, enrollment RLS; UI uses student RPC | Real draft-grade and other-student denial checks |
| Main only entry door; standalone owns Classroom | Architecture approved; current Main includes old classroom routes preserved for compatibility | Eliminate dead/duplicated doors only after parity |
| Session revocation, browser sign-out and account isolation | Cached data cleared on SIGNED_OUT, **LIVE** | Multi-tab and revoked-token real session acceptance |
| Cloud is authoritative | All academic writes use Supabase, **PARTIAL** | Offline queue never invents official records |
| No downgrade/branch conflict | Main has advanced hundreds of commits since old Classroom DEV; branches separated here | Controlled RC cherry-pick after source comparison |

## B. Home / academic organization / class lifecycle (10 dashboard blocks)

| Required block | Current implementation | Gap |
|---|---|---|
| My Classrooms | RLS-scoped directory, **LIVE** | AY→Semester→Subject→Section folders absent |
| My Active Classes | Distinct published assignment workload, **LIVE** | Needs due/late and current session signals |
| To Do | Opens first class activities | Aggregate per-user overdue/pending across classes absent |
| Upcoming | Opens first class quiz | Actual consolidated exam/deadline calendar absent |
| Notifications | Opens first class notices | Unified notification inbox, deep-links, push absent |
| Attendance | Opens first class | Consolidated own/verified attendance and faculty exceptions absent |
| My Grades | Student-released or faculty roster RPC | Aggregate released-only student dashboard absent |
| Progress | Clinical/RLE placeholder | Genuine academic completion and competency metrics absent |
| Live Now | Reads real `LIVE` status count | No browser join/start call or participant indicators |
| Continue | Opens first class | Persisted last-opened class/lesson not yet implemented |

**Classroom hierarchy** AY→Semester→Subject→Section is only metadata, not actual navigation folders. **Nine types** (Lecture, Laboratory, RLE, Clinical Duty, OJT, Practicum, Thesis, Capstone, Mixed) exist in the blueprint; web creation/type configuration absent. Backend has `buklod_education_create_classroom_with_owner_v1`, `buklod_classroom_archive_v1` and guarded empty-class delete. Lifecycle Create→Edit→Assign/Reassign→Activate→Close Enrollment→Archive→Restore→Delete Empty is **not fully wired to web**. Historical grades/submissions must force archive instead of delete; preserve exact-name confirmation and audit.

## C. CLASS

| Feature | Status | Missing |
|---|---|---|
| Overview, policies, schedule, pinned class feed | Partial: real posts rendered | Official timetable, pinned moderation and policy editor |
| Announcements | Faculty insert + student read **LIVE**, real comment read/send | Attachment upload, reactions, threaded reply, moderation |
| Long-press/right-click context menus + slide drawers | Gemini UI retained; sanitized class switcher | Real backend per-action permissions, pin/edit/delete |
| Syllabus weekly lesson flow | `buklod_education_syllabus_versions`, module/material table and version/activation RPCs **BACKEND** | Web upload, AI-assisted plan, version activation, release/prerequisite automation |
| PDF/DOC/XLS/PPT/CSV/photo/video learning files | Storage + register material RPC exist | Web authenticated upload/download, progress, signed URLs, offline reading |
| Full navigation state and back behavior | Query params and grouped tabs exist, partial | Restore history/back stack, no dead screens under weak network |

## D. WORK

| Feature | Status | Missing |
|---|---|---|
| Faculty activities with rubrics/category/term/deadline/group/late | RLS table, grade RPC, reader **BACKEND/LIVE read** | Full faculty editor, release policies, return/revise |
| Student submission 8 states: Draft, Pending Upload, Submitted, Late, Under Review, Returned, Graded, Released | Text/HTTPS link submit + faculty grade RPC **PARTIAL** | Secure media/file upload, durable offline drafts, idempotency keys and state transitions |
| BUKLOD Quiz integration | Quiz engine exists separately; classroom lists assessments | Verified attempt→student identity→assessment mapping→faculty release→gradebook, no double scoring |
| Quiz bank count/timer/shuffle/integrity focus/reconnect | Quiz backend/standalone systems exist | Actual secure runner in Gemini web and classroom grade mapping |
| Quick Check pulse | Separate QuickCheck workflow exists | One-tap class launcher and controlled grade mapping |
| RLE, Clinical, OJT, Practicum | `buklod_education_rle_rotations`, `rle_hours`, performance RPCs **BACKEND** | UI rotations, duty groups, clinical instructor, hours/make-up approval, verified attendance→grade |
| Clinical competencies/return demonstration | Native/back-end abstractions exist | Skills checklists, sign-off, individualized assessment |
| Journals / longitudinal portfolio | `buklod_education_journals`, review RPC **BACKEND** | Student journal draft/upload, faculty review, certificates, graded portfolios, offline drafts |
| Group work & presentations | `buklod_education_groups_v2`, members, activity scores | Group formation, group+individual scoring, sharing moderation |

## E. CONNECT

| Feature | Status | Missing |
|---|---|---|
| Live classroom 60 participants / 120-minute target | Native Stream component exists, `buklod-classroom-stream-access` Edge; web currently reads session state only | Real web Stream join/start/end with network/performance verification; free-tier hard-stop |
| Seven modes: Lecture, Reporting, Recitation, Discussion, Focus, Gallery Check, Presentation | Native authority state machine exists | Web control-room mode transitions and permissions |
| Toolbar: Start, Mute All, Random/Next, Attention, Reporting, Grade, Attendance, Quiz, Screen Share, Breakout, End | Some RPCs and native SDK exist | Web controls and end-to-end Stream session |
| Recitation 0–5 points, audit/Undo | `buklod_classroom_record_performance_v1`, interaction tables **BACKEND** | Live controls, idempotent grade event audit, undo |
| Student camera/mic privacy | Native logic, camera OFF by default expected | Web opt-in gating and visible Mute Now / Camera Off; 25% normal camera / 50% burst / 30% average budget unverified |
| Reconnect and fair attention deductions | Native automation and proposals, attendance review RPCs **BACKEND** | Real 3G session evidence, Apply/Dismiss/More, no automatic penalty for weak signal |
| General/group/consultation messaging | Class threads/messages tables **BACKEND** | Gemini web inbox, reply/attachment, enrolment-scoped subscriptions |
| Discussions/posts/comments/reactions | Posts/comments **LIVE**; reaction RPC **BACKEND** | Reaction long-press/menu, moderation and notifications |
| Formal warning/intervention/attendance/commendation | Notices DB **BACKEND**; DEV official publish and student I ACKNOWLEDGE writes | True faculty/student acceptance; targeting and read receipts |
| Personal concerns / intervention / adviser followups | Concern/adviser RPCs **BACKEND** | Student submit, faculty follow-up and escalation UI |

## F. MORE

| Feature | Status | Missing |
|---|---|---|
| Official Student ID + BUKLOD Account ID | `buklod_education_roster_members`, roster RPC **BACKEND** | Authorized 8-step UI and conflict workflow |
| Eight-step XLS/XLSX/CSV/DOCX/PDF roster import | Existing Edge parser/matcher and `roster_commit_official_v2` **BACKEND** | Safe preview must never auto-enroll before faculty confirmation; current legacy Edge parser can auto-enroll high-confidence matches, so cannot be presented as review-first until revised |
| Enrollment statuses Pending, Active, Rejected, Withdrawn, Dropped, Completed, Archived | Backend roster/enrollment statuses | UI cohort history, corrections and audit |
| Face/QR/Manual/Biometric/Live attendance + cutoff | Attendance sessions/log, native attendance; **BACKEND** | Web faculty open/close, live event-only check-in, verification, 08:00 policy per class |
| 4 periods Prelim/Midterm/Semifinals/Finals | Grades/terms/grading schemes tables and RPCs **BACKEND** | True per-class policy editor, schedule and weighted calculations in web |
| Configurable weights = 100% | Generic 10/10/20/10/10/40 and class-specific 40/40/20 | UI validation by term/subject; do not force one grading template globally |
| Transmutation `50+(score/max)*50`, 75 passing, Philippine equivalents | Backend grade functions | Student release parity and edge cases |
| Six-stage Draft→Review→Term Release→Compute Final→Final Release→Lock | Backend compute/release/lock RPCs | Faculty review, bulk confirmations, secure lifecycle and audit |
| Nine grade exceptions | Backend statuses/grade adjustments | Distinguish not encoded / not submitted / 0 / excused / INC / dropped / review / released / locked; never blanket auto-zero |
| Immutable grade integrity audit | `buklod_education_grade_audit`, `final_grade_audit` **BACKEND** | Show correction reason, actor/timestamp and export on web |
| Grade Excel diff importer/exporter | Grade scan/import RPCs and utilities exist | XLS/XLSX diff preview, duplicate/unmatched detection, confirmed application, official export |
| Registrar, class officers, permissions, interventions | Roles, officer assignment, registrar/adviser RPCs **BACKEND** | Web authorized work queues; officers coordinate but cannot grade |
| Class analytics and quota/profit guard | Partial backend metrics | Aggregate analytics; no ads during exams, grade writes, attendance verification or live teaching |

## G. Offline / reliability / UX / security

- **Gemini UI**: Preserve canonical cyan 3D-ribbon B, header, 10 dashboard tiles, drawer/long-press patterns, compact cards, CLASS/WORK/CONNECT/MORE groups, responsive mobile/desktop.
- **Real web sign-in**: Current LIVE has separate login; new Main→Classroom one-time magiclink flow is implemented on independent Main/Client DEV branches and server Edge. It uses a URL **fragment** only for single-use OTP hash, scrubs the fragment before network work, checks exact Auth user UUID and calls launcher role RPC again. No access/refresh token in URL. Main OTA not yet issued.
- **Student-only**: Current backend checks ACTIVE enrollment; DEV has independent Student View filtering and student-only released grade RPC; synthetic E2E required before promotion.
- **Dual role**: DEV switcher clears cached faculty data before student view; no login loop.
- **Offline/weak network**: User agreed cache for reading and drafts with Pending→Syncing→Synced state, bounded retry and idempotent submission. Web currently disables offline writes to protect data; this is not the full blueprint.
- **No fake success**: Remove old hardcoded student/grade fixtures and mock-save buttons; disabled operations explain why unavailable rather than claiming saved.
- **Supabase integrity**: Applied RLS-protected one-time SSO throttle, comment cross-class/locked-thread guard, student-targeted notice acknowledgment policy. Do not duplicate migrations or loosen role isolation.
- **Privacy**: Teacher grading and official records are role-scoped; student must only access released results; do not expose service-role key in client.
- **Native/Expo**: The standalone Classroom project remains `14100ed1-7f25-4551-9627-09d280498241`. Main Android runtime/OTA must not be overwritten by Classroom web export. Native Stream implementation can be reused deliberately, not copied blindly as HTML.
- **Usage limits**: 60-person / 120-minute session, weak network fallback, mobile click performance, and storage quotas require real stress/device acceptance. Existing passing synthetic browser tests do not establish these metrics.

## H. Evidence gates and next acceptance test priorities

1. **Main source compile + live Edge negative-auth:** GitHub Actions `42771138202`, 5/5 checks PASS, Main TypeScript PASS, unauthed Edge HTTP 401. Edge function `buklod-classroom-sso-entry-v1` version 1 active, no Main OTA.
2. **Classroom source and Expo Preview:** GitHub Actions `42771499107`, 37/37 tests and immutable Preview `sxd3jh9n3b`; Faculty 13-module synthetic browser PASS. One student/dual-role browser assertion initially failed because uppercase CSS text did not match case-sensitive test expression, not because Faculty role was bypassed. Corrected test stored in DEV, rerun without extra Expo deployment.
3. **Blocked true E2E:** Requires isolated authorized Faculty/Student/Dual accounts with no real student record changes, then verify cross-role RLS, actual sign-in, post/notice/grade writes, offline idempotency/retries, and actual Stream video.
4. **Release discipline:** DEV → immutable tested Classroom Preview → exact-id Expo production promotion → independent HTML+JS hash verification. Main Profile release is separate and needs exact runtime/RC/OTA acceptance; never call a DEV-only patch live.
5. **Remaining product gaps** in sections B–F are **not** complete merely because a database table, RPC, or old native component exists.

**Current honest completion:** Supabase SSO service and database integrity protections ACTIVE; Main launcher and Classroom consumer in DEV/Preview; entire Classroom blueprint and real-role E2E **PARTIALLY COMPLETE**.
