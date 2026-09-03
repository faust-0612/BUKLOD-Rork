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

Future implementation must preserve group privacy, authoritative grade linkage, group/individual grading distinction, adviser/registrar workflows, archive/audit history, notification escalation, and the separation between BUKLOD Connect communication and BUKLOD Classroom official academic records.
