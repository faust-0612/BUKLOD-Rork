# BUKLOD Classroom — Live E2E Audit
**Date:** 2026-11-09 Asia/Manila  
**Production:** https://buklod-classroom.expo.app/  
**Exact deployed Expo Hosting artifact:** `0g49qf2xe0` (standalone Classroom project `14100ed1-7f25-4551-9627-09d280498241`)  
**Authoritative source branch:** `dev/classroom-live-e2e-fixes-20261109` in `faust-0612/BUKLOD-Rork`  
**Main BUKLOD OTA / Classroom Android binary:** unchanged.

## Evidence, test limits, and independent proof

| Scope | Evidence | Outcome |
|---|---|---|
| Production HTML and client JS artifact parity | https://github.com/faust-0612/BUKLOD-Rork/actions/runs/42504839005 | PASS; exact HTML SHA256 and JS asset match the immutable Preview |
| Actual production Chrome, desktop/mobile, signed-out login, protected academic routes | https://github.com/faust-0612/BUKLOD-Rork/actions/runs/42504904513 | PASS; 19/19 browser assertions, no uncaught JS errors |
| Regression/build | https://github.com/faust-0612/BUKLOD-Rork/actions/runs/42504325334 | PASS; 31/31 tests and Vite export |
| Signed-in browser navigation and actions using synthetic role, mocked Supabase, no real data writes | https://github.com/faust-0612/BUKLOD-Rork/actions/runs/42504461348 | PASS; all 13 tabs, class directory, active worklist, comments, switcher XSS guard, grade form, sign-out |
| Real faculty/student/administrator transactions, Stream audio/video, file and grade commits | No approved test credentials or safe isolated academic fixture | NOT VERIFIED; browser integration mock is not a production data transaction |

Production browser tested only unauthenticated gates. The authenticated UI test intercepted **all** Supabase HTTP requests and supplied synthetic data; `MOCKED_WRITES=1`, not a live production write. Do not infer full academic E2E success from these tests.

## Function inventory by portal module

| Group / module | Actual implementation | E2E coverage | Status |
|---|---|---|---|
| Portal / My Classrooms | `buklod_classroom_my_classes_v2(p_view)` RLS-scoped class directory; open assigned class | Synthetic auth + live signed-out protections | WIRE-UP PRESENT; real account needed |
| Portal / My Active Classes | Dedicated published-assignment workload view; no longer repeats directory cards | Synthetic Chrome PASS | WIRED; real data query not signed-in verified |
| Portal / Live Now | Reads official `buklod_education_classroom_live_sessions` with status LIVE, avoids fabricated zero | Static test + synthetic browser | WIRED READ; no active call verified |
| CLASS / Overview | Official posts query, new faculty announcement, comments list + insertion | Synthetic read/post form; DB policies inspected | WIRED; real write unverified |
| CLASS / Syllabus | Official modules and materials via authenticated RLS queries | Synthetic Chrome PASS | READ ONLY; authoring/approvals not integrated |
| WORK / Activities | Official assignment list, student text/link submission, faculty submission grading via `buklod_classroom_grade_submission_v2` | Synthetic Chrome grade form PASS | WIRED; no live role-based write confirmation |
| WORK / Quiz | Official assessment listing | Synthetic Chrome PASS | READ ONLY; exam runner, shuffle, secure attempts, grade sync remain external/not wired |
| WORK / Clinical & RLE | Verified-access placeholder with overview read | Synthetic Chrome PASS | INCOMPLETE: duty hours, skills, approvals and grade sync |
| WORK / Portfolio/Journals | Protected placeholder with overview read | Synthetic Chrome PASS | INCOMPLETE: upload, save, journal grading, offline queue |
| CONNECT / Live | Official session status reader | Synthetic Chrome PASS | INCOMPLETE: actual join/start/end Stream call, media, recitation, network presence, attendance review |
| CONNECT / Discussions | Official posts and comments; drawer renders existing comments and submits new ones | Synthetic Chrome PASS | WIRED; actual account write unverified |
| CONNECT / Notices | Official notices and visibility filters | Synthetic Chrome PASS | READ ONLY; acknowledgment/administrative mutation not wired |
| MORE / Grades | Faculty roster gradebook RPC, released student-grade RPC | Synthetic Chrome PASS | READ WIRED; grade lifecycle, transmutation/release transaction not exercised live |
| MORE / Attendance | Class sessions and student attendance RPC | Synthetic Chrome PASS | READ ONLY; live event check-in, verification, exception control not integrated |
| MORE / Masterlist | Faculty-only official roster RPC | Synthetic Chrome PASS | READ ONLY; 8-step import & member updates are blocked |
| MORE / Settings | Verified class metadata | Synthetic Chrome PASS | READ ONLY; archive/delete/permission management blocked |

## Verified frontend fixes in this release

1. **Dashboard click blocker:** Removed pre-opened `drawerBackdrop.open` and `universalSlideDrawer.open` and synthetic drawer contents. Before fix, browser click was intercepted by backdrop for 30 seconds; after fix synthetic Chrome navigated all 13 tabs.
2. **Authorization:** Faculty privileged display now requires `buklod_classroom_context_v1` to confirm `role='FACULTY'` and `is_faculty=true`, not just an assigned-class list flag.
3. **Comments:** Fetch and display actual RLS-visible comments, including counts and drawer history, not just a textbox that silently omits existing replies.
4. **Save state:** Database-write errors no longer get conflated with post-write UI refresh failures; grade RPC warnings are surfaced instead of blanket success.
5. **Active work:** My Active Classes shows a distinct published assignment workload list.
6. **Live Now:** Displays actual RLS-scoped LIVE status/count when loaded, not a fabricated placeholder count.
7. **Privacy:** Class-switch drawer escapes dynamic names; local and cross-tab sign-out clears cached academic records.
8. **Fake fixtures:** Removed static demo class cards, exam scores, and mock drawer from initial HTML. Retained Gemini visual design and grouped interaction layout.

## Original prototype functions not approved as real production mutations

The following actions are deliberately blocked with visible unavailable feedback until their backend E2E contract has been secured:

`acknowledgeFormalNotice`, `addAnnouncementComment`, `addMakeupDutyHours`, `advanceGradeLifecycle`, `archiveCurrentClass`, `attemptDeleteCurrentClass`, `autoGenerateSyllabusWeek`, `callRandomLiveStudent`, `changeGradingScheme`, `confirmCreateClassroom`, `confirmRosterImportCommit`, `copyFullHtmlToClipboard`, `downloadFullHtmlFile`, `exportGradebookCSV`, `launchInteractiveQuizDrawer`, `markAllAttendancePresent`, `openSpeedGraderDrawer`, `openVercelDeployDrawer`, `postClassChatMessage`, `pushDirectlyToGitHub`, `recordLiveRecitationScore`, `runEightStepRosterWizard`, `saveJournalEntry`, `saveQuickAddItem`, `saveSpeedGraderScore`, `sendCallAttentionAlert`, `setLiveTeachingMode`, `setStudentAttendance`, `submitInteractiveQuizAttempt`, `submitQuickAdd`, `syncLiveAttendanceToClass`, `syncQuizToGradebook`, `testIdempotentSubmission`, `toggleRleSkillCompetency`, `triggerQuickCheckPulse`, `undoLastRecitationScore`, `updateStudentException`, `updateStudentScore`.

The UI also explicitly disables client-side persona impersonation and fake offline save queues. Several HTML prototype function bodies still exist for design compatibility but are overridden; they are not evidence of production backend implementation.

## Security and functional blockers before claiming complete academic E2E

1. **Real role acceptance absent:** Must test a dedicated active Faculty account, enrolled Student, dual-role account, unauthorized faculty, suspended account, and no-session state. Test with isolated official fixture records and verify actual committed state, grade-release boundaries, duplicate requests, and rollback behavior.
2. **BUKLOD Main handoff:** Current Main launcher still passes access and refresh tokens in URL query parameters; Classroom sanitizes those and requires its own sign-in. A secure single-use handoff is required for true no-second-login SSO. Do not reinstate URL bearer-token login.
3. **Classroom Stream:** No actual call/media session verified. Browser currently shows official status but does not implement Stream provider join/leave, live recitation, attendance reconciliation, or recording workflow.
4. **Roster import / lifecycle:** Import, archive, term grade calculation/transmutation, Quiz score sync, clinical duty and portfolio are not complete in this web client.
5. **Discussion data integrity:** Read-only SQL policy audit found comments INSERT checks author and membership but does **not** itself assert that the referenced post belongs to the same classroom or is unlocked; separate foreign keys do not enforce this composite relationship. Needs targeted DB constraint/RLS migration with compatibility tests; not patched in this UI release.
6. **No destructive tests:** No real student grade, enrollment, attendance, classroom, or live-call record was created/modified/deleted during this audit.

**Completion judgment:**
- **UI/web release:** VERIFIED COMPLETE for immutable Expo artifact `0g49qf2xe0`.
- **Signed-out production browser security:** VERIFIED.
- **Mocked signed-in navigation:** VERIFIED at browser/UI level.
- **Entire Classroom blueprint + true logged-in backend E2E:** PARTIALLY COMPLETE; blockers above remain.
