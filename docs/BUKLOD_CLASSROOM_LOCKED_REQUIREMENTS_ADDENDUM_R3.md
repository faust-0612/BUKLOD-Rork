# BUKLOD Classroom — Locked Requirements Addendum R3

Status: LOCKED
Date locked: 2026-09-04
This addendum is part of the canonical BUKLOD Classroom requirements and must be preserved together with `docs/BUKLOD_CLASSROOM_LOCKED_REQUIREMENTS.md`.

## Group Workspaces / Groupings

Faculty may create any number of classroom groups for projects, clinical teams, duty groups, research teams, presentation groups, laboratory teams, OJT cohorts, thesis teams, discussion groups, peer-learning circles, or custom purposes.

Each group may have:
- group name and description;
- assigned students;
- group leader and optional officer roles;
- private group messaging/thread;
- private file/media storage;
- group announcements/tasks/calendar;
- group activity/submission area;
- group rubric and grading rules;
- individual contribution/peer-evaluation component;
- faculty/co-faculty visibility and moderation;
- optional supervisor/preceptor access where applicable.

Group privacy modes:
- PRIVATE GROUP: content is visible only to assigned group members and authorized faculty/supervisors.
- FACULTY-ONLY SUBMISSION: group members may collaborate privately, but the final submission is visible only to the group and authorized faculty.
- CLASS-VISIBLE AFTER RELEASE: submission remains private while being prepared/graded, then faculty may publish the approved final output to the whole class.
- PUBLIC CLASSROOM SHOWCASE: approved outputs may be visible to the entire classroom for peer learning, presentation, portfolio, or gallery use.

Public visibility must never expose private rubric notes, unreleased scores, private peer-evaluation data, disciplinary notes, or restricted student information.

## Public / Showcase requirements linked to grades

Faculty may configure a requirement, activity, project, presentation, case output, poster, video, portfolio item, research output, or other submission as a public/class-visible academic artifact.

The artifact must remain linked to the authoritative grade record so that:
- the student/group submission identity is preserved;
- the correct classroom, term, grading category, activity, and rubric remain linked;
- the released public output can display a non-sensitive score/result if faculty enables it;
- detailed rubric comments and private grade notes remain permission-controlled;
- later grade corrections retain audit history without silently replacing the originally released record;
- a student cannot substitute another public file to alter the graded submission after the deadline/finalization unless a revision workflow is explicitly opened.

Faculty may enable peer comments, peer rating, or peer evaluation separately. Peer reactions/likes must not automatically become academic points unless the published grading policy explicitly defines a controlled peer-assessment component.

## Individual contribution in group grades

Group activities may compute a final student score using configurable layers, for example:
- Group Output Score 70%
- Individual Presentation/Defense 15%
- Peer Contribution 10%
- Faculty Individual Adjustment 5%

or any other valid configured combination.

Anti-bias safeguards apply to individual group adjustments. Every individualized deviation from the base group score requires a rubric/result/reason and audit record. Faculty may choose confidential peer evaluation to reduce social pressure.

## Video recitation / video performance requirements

Video Recitation is a first-class activity type, not merely a generic file upload.

Faculty may configure:
- recitation/prompt/question/instructions;
- individual or group response;
- maximum/minimum duration;
- due date and allowed submission window;
- number of attempts/retakes;
- whether the latest, highest, or faculty-selected attempt is graded;
- required orientation/format when relevant;
- attached reference material;
- rubric/criteria and grade category;
- whether the approved video may later be class-visible/showcase or remains private;
- whether late submission or revision is allowed.

Student workflow:
Prompt/Instruction → Record or Upload Video → Preview → Submit → Timestamp/Version Lock → optional transcript/analysis → AI Rubric Suggestion → Faculty Review → Approve / Modify / Return for Revision → Released Grade.

The authoritative record should retain submission timestamp, version, file identity, rubric, AI suggestion if used, faculty-approved score, feedback, and revision history.

AI may assist with transcript-based or content/rubric-based review, for example completeness, identified concepts, structure, coverage of required points, time limit, or other explicitly defined rubric criteria. It must not silently issue the official subjective grade. Faculty approval remains required unless the activity is objectively scoreable by a rule the faculty explicitly enabled.

The system must not use unsupported personality, emotion, attractiveness, disability, or other sensitive inferences from a student's face/voice as grading criteria. Video grading must remain tied to published academic/performance criteria.

The same engine can adapt for:
- oral recitation;
- language speaking task;
- preaching/sermon practicum;
- teaching demonstration;
- return demonstration;
- clinical/OJT demonstration where video is appropriate and permitted;
- project pitch;
- presentation/defense practice;
- skills demonstration;
- reflection/video journal;
- custom performance evidence.

## Teacher preparation automation / lesson-package generator

BUKLOD Classroom should reduce repetitive faculty preparation work.

Faculty may provide one or more of:
- syllabus/course outline;
- official textbook/reference excerpts that the faculty is authorized to use;
- uploaded lecture notes/materials;
- learning outcomes/competencies;
- existing PowerPoint/PDF/handout;
- module/course guide;
- previous faculty-authored materials;
- institution template.

Classroom may generate a DRAFT lesson package for faculty review containing, as applicable:
- lecture outline;
- slide/deck structure or presentation draft;
- concise student handout;
- discussion questions;
- examples/cases;
- activity/seatwork;
- quiz draft routed to BUKLOD Quiz when appropriate;
- assignment/requirement;
- rubric;
- remediation material;
- summary/review material;
- module release sequence.

Generated content must be clearly reviewable/editable before faculty publishes it. Faculty may approve the entire package or individual pieces. The purpose is to let the teacher spend more time teaching, mentoring, demonstrating, consulting, and supervising rather than repeatedly rebuilding routine materials.

Once a faculty-approved package is attached to the syllabus/course flow, Classroom can schedule/release its lecture materials, activity, quiz, requirements, reminders, and follow-up automatically according to the configured release rules.

## Controlled in-class materials / Stay-in-Classroom mode

Faculty may mark a live class, lecture material, recitation, practical, review session, or other learning session as `IN_CLASS_FOCUS` / `STAY_IN_CLASSROOM` when there is a legitimate instructional reason to keep students inside the active BUKLOD Classroom experience during the session.

Examples:
- slides/materials are available only during the scheduled class window;
- faculty presents the deck inside Classroom rather than sending it externally;
- a controlled reading/case is opened inside the active class;
- a live recitation or participation task requires remaining in the class room;
- in-class worksheet/material closes when the session ends;
- download may be disabled when the faculty/institution has a legitimate policy reason, while recognizing that software cannot absolutely prevent screenshots or external capture on all devices.

Faculty may optionally make the same material available again after class, release a student copy/handout, or keep it session-only according to policy.

## Classroom Focus / Presence / Integrity detector

The Classroom may reuse appropriate integrity concepts already used by BUKLOD Quiz, but ordinary teaching must be less punitive than a formal examination.

During a clearly identified active focus session, Classroom may record transparent session signals such as:
- joined/left live classroom;
- app/screen moved to background when technically detectable;
- return to foreground;
- repeated leaving/rejoining;
- network disconnect/reconnect;
- screen/session inactivity when technically meaningful;
- material opened/completed;
- active-session duration;
- live-room participation duration;
- required in-class task submission;
- explicit raise-hand/response/participation events.

These are engagement/integrity signals, not proof of misconduct by themselves. Network failure, phone calls, accessibility needs, device limitations, crashes, emergency interruptions, or legitimate multitasking can create false positives.

Therefore:
- students must be told when Focus/Integrity Mode is active and what is being recorded;
- no hidden continuous device surveillance;
- no automatic conduct deduction solely because an app went to background unless an explicit authorized academic rule applies and due-process safeguards are followed;
- faculty sees flagged events in a review queue rather than being forced to watch every student continuously;
- students may provide an explanation where appropriate;
- repeated/serious events can be escalated to the documented intervention/conduct workflow;
- formal BUKLOD Quiz examinations may retain stricter examination-specific integrity rules separate from ordinary Classroom focus monitoring.

The system should show useful summaries such as:
- present for 92% of live session;
- left session 2 times;
- material not opened;
- reconnected after network loss;
- in-class activity completed;
- participation response missing.

## Automation-first faculty experience

The number of features must not turn Classroom into additional clerical work.

The default faculty experience should reduce daily work to a small number of surfaces:

### TODAY
Shows only what matters now:
- today's classes/live sessions;
- material about to release;
- activities/quizzes due;
- attendance/focus exceptions;
- students needing attention;
- urgent announcements/concerns.

### TEACH
One-tap classroom teaching mode:
- start live room / in-person session;
- open/present today's materials;
- attendance/presence tracking;
- recitation/participation queue;
- quick rubric/participation marks;
- class messaging/questions;
- release next activity/quiz automatically when configured.

### REVIEW EXCEPTIONS
The teacher should not need to inspect every normal event. Classroom surfaces only items that need human judgment, for example:
- subjective submissions awaiting approval;
- AI-suggested grades needing review;
- unusual rubric result;
- late/missing work;
- suspected integrity/focus issue;
- requested revision;
- student dispute/explanation;
- behavior/exception/bonus request;
- at-risk student intervention.

### APPROVE / RELEASE
Faculty can batch-review and approve where policy allows:
- activity scores;
- journal/video-recitation suggestions;
- quiz score sync;
- attendance exceptions;
- module release;
- term grade release.

Automation handles routine actions while faculty remains responsible for academic judgment.

## Continuous monitoring and student-support automation

Classroom should continuously aggregate authorized academic signals so the teacher sees meaningful student progress without manually checking every page.

Per-student monitoring may combine:
- material/module completion;
- attendance/presence;
- activity/submission status;
- released quiz/exam results;
- rubric results;
- video recitation/performance status;
- participation/recitation history;
- RLE/OJT hours/competencies;
- journals/requirements;
- grade trend;
- follow-up/intervention history.

The system should produce simple teacher-facing statuses such as:
- ON TRACK
- NEEDS FOLLOW-UP
- MISSING REQUIREMENTS
- LOW ENGAGEMENT
- GRADE AT RISK
- ATTENDANCE RISK
- RLE/OJT DEFICIENCY
- WAITING FOR FACULTY REVIEW
- COMPLETION GATE BLOCKED

Automatic follow-up may include reminders, student Grade Consultation updates, remediation release, officer/group reminders, adviser escalation, or a proposed intervention case according to faculty/institution rules.

The teacher should be able to open one student and immediately understand: who the student is, current grade/standing, what has been completed, what is missing, recent attendance/engagement, interventions already sent, student responses, and the next recommended faculty action.

## Student Adviser / Program Progress Dashboard

Authorized advisers/coordinators may view a cross-subject summary for assigned students, subject to institution/privacy permissions. This dashboard may include:
- enrolled classrooms;
- released standing per subject;
- attendance risk;
- missing requirements;
- INC/deficiency status;
- RLE/OJT hours and completion gates;
- academic warning/intervention history;
- adviser follow-up tasks;
- graduation/program-completion risks where data is available.

The adviser view must not silently expose unreleased faculty grades or private classroom notes outside the adviser’s authorized scope.

## Registrar / Academic Office final-grade workflow

Where an institution enables it, the Classroom finalization engine should support:
Faculty Compute → Faculty Review → Release to Student (optional ordering) → Submit to Academic Office/Registrar → Validation/Return for Correction → Official Acceptance → Lock/Archive.

The system should support:
- final grade submission batches;
- term/section completion status;
- incomplete/INC, dropped, withdrawn and special statuses;
- grade correction requests with reason;
- final approval timestamps;
- official export in institution-required formats;
- separation between classroom-released grade and institution-official grade where needed.

## Faculty Load / Teaching Schedule Planner

Faculty should have a consolidated dashboard across all handled classrooms showing:
- subject/section/term;
- class schedules;
- live-class schedules;
- examination schedules;
- deadlines and releases;
- RLE/OJT/clinical schedules;
- pending submissions to grade;
- pending student consultations/interventions;
- final-grade deadlines;
- overlapping/conflicting commitments;
- teaching load summary.

This is a coordination layer; each classroom keeps its own authoritative academic data.

## Archive, backup, and evidence retention

Closed classrooms must support controlled archive rather than deletion of academic history. Archive may preserve:
- syllabus and versions;
- grading configuration and versions;
- roster/enrollment history;
- materials and release history where retention rules allow;
- submissions and timestamps;
- released grades and rubrics;
- attendance/RLE/OJT records;
- interventions/consultations/acknowledgments;
- grade changes, exceptions, violations and audit trails;
- class announcements/minutes relevant to academic decisions;
- final official grade state.

Institution settings should define retention periods, privacy restrictions, legal holds where applicable, and eventual deletion/anonymization rules. Classroom should make records audit-ready but must not represent stored data as automatically conclusive legal evidence.

## Notification escalation rules

Notifications should have semantic levels, for example:
- INFO / Reminder
- Action Needed
- Academic Warning
- Formal Notice
- Critical / Completion Risk

Faculty/institution may configure escalation rules such as:
- upcoming deadline;
- missed requirement;
- repeated missing requirements;
- low-grade threshold;
- repeated absence/tardiness;
- RLE/OJT deficient hours;
- unapproved journal/competency;
- unresolved conduct/safety issue;
- upcoming INC/finalization deadline.

Formal academic notices should record delivery status, timestamp, and student acknowledgment when configured. A messaging failure should not be treated as acknowledgment.

## Classroom Follow-up / Intervention case file

A student may have a classroom-specific intervention record containing:
- reason/trigger;
- current released academic standing;
- missing requirements/deficiencies;
- faculty/adviser action;
- student response;
- agreed plan/deadline;
- attachments/evidence where appropriate;
- reminders/follow-ups;
- acknowledgment status;
- resolution/outcome;
- audit history.

This supports due process and defensible academic documentation. It is not a substitute for official institutional procedures, CHED rules, privacy law, or legal advice.

## BUKLOD Connect contextual bridge

BUKLOD Connect remains a separate app/product but may provide contextual communication surfaces for a Classroom.

Examples:
- open a classroom-linked faculty-student consultation thread;
- group discussion thread;
- officer coordination thread;
- reminder/follow-up conversation;
- consultation request;
- class concern conversation.

Every academic action that affects grades, attendance, requirements, conduct outcomes, completion gates, or official follow-up must be written back to the authoritative Classroom record rather than existing only in chat. Classroom should show the link/context to the relevant Connect thread where permitted.

## Non-regression

Future implementation must preserve group privacy, authoritative grade linkage, group/individual grading distinction, video recitation/performance workflows, teacher-preparation automation, controlled in-class materials, transparent Classroom Focus/Presence monitoring, automation-first faculty UX, adviser/registrar workflows, archive/audit history, notification escalation, and the separation between BUKLOD Connect communication and BUKLOD Classroom official academic records.
