# BUKLOD Classroom — Locked Product Requirements

Status: LOCKED
Version: Classroom Academic Engine R2+ baseline
Date locked: 2026-09-04

## Product boundary

BUKLOD Classroom is a distinct learning product/environment connected to BUKLOD Main → Faculty. BUKLOD Main is the institutional/faculty doorway; BUKLOD Classroom is the actual teaching-learning space. A faculty user can own/handle multiple separate classrooms, one per subject/section/term. Students have a dedicated My Classrooms experience.

BUKLOD Connect remains a separate communication/social product, but Classroom may create contextual links/threads into BUKLOD Connect for subject-related communication, consultation, reminders, and follow-up. Classroom remains the authoritative academic record; Connect must not become the authoritative grade store.

## Adaptive architecture

Classroom behavior MUST NOT be hardcoded for nursing or for one school/course format. Each classroom is composed from three layers:

1. Program Profile — e.g. BS Nursing, BS Education, BSIT/CS, Engineering, Business, Hospitality/Tourism, Criminology, Theology/Ministry, vocational/TVET, senior high, graduate studies, etc.
2. Subject Type — Lecture, Laboratory, Skills, RLE/Clinical, OJT/Internship/Practicum, Research/Thesis/Capstone, Seminar, Project Studio, Fieldwork, or Custom.
3. Classroom Template — reusable faculty/institution template defining modules, requirements, terminology, grade structure, rubrics, completion gates, release rules, and integrations.

Faculty may select a preset, combine multiple subject types in one course, or start from Custom. Presets are defaults only and remain editable.

## Canonical grading pattern

The uploaded grading workbook is the default canonical academic grading preset:

- PRELIM 25%
- MIDTERM 25%
- SEMIFINALS 25%
- FINALS 25%

Default period components:
- Attendance 10%
- Class Participation / Recitation 10%
- Quizzes 20%
- Activity / Seatworks 10%
- Attitude 10%
- Major Exam 40%
- Total 100%

The system must support editable term names, term counts, term weights, component names, component weights, passing grade, rounding, transmutation/equivalent grade tables, late rules, make-up rules, dropped-lowest rules, bonus rules, and completion gates. A grading configuration cannot activate unless required totals equal 100%.

Student Grade Viewer only exposes RELEASED grades. Draft/internal grades stay private to authorized faculty.

## Multi-component final grade engine

A final subject grade may combine multiple engines with faculty-defined percentages, for example:
- Theory 60% + RLE 40%
- Theory 70% + Laboratory 10% + Clinical 20%
- Academic 50% + OJT 50%
- Lecture 50% + Laboratory 25% + Project 25%

Each engine can contain its own rubric/categories and completion gates. The final course grade is computed only from configured components and release/eligibility rules.

## Student enrollment / roster import

Each classroom has its own roster. Faculty can upload XLSX, XLS, CSV, registrar exports, or roster-style files. The importer should detect and map common fields such as student number, full name, first/middle/last name, email, mobile, section, status, and BUKLOD identifier. It must show Matched / Possible Match / Unmatched / Duplicate preview before commit. Unmatched students may remain Pending and later bind to a BUKLOD account through invite/link/QR without re-encoding the roster.

## Student profile, photo roster, and individual progress record

Each enrolled student must have a Classroom Student Profile linked to the enrollment, not duplicated independently per screen.

The profile may include:
- student profile photo/avatar uploaded by the student or sourced from an authorized BUKLOD profile;
- full name / preferred display name where supported;
- student number and section/course identifiers;
- class officer/assigned role badges;
- enrollment status;
- current academic standing for the specific classroom;
- attendance snapshot;
- released grade snapshot;
- missing / late requirements;
- completion progress;
- RLE/OJT hours and competency progress where applicable;
- recent teacher feedback/interventions;
- awards/commendations where appropriate;
- privacy-controlled contact/communication actions.

Faculty should have a visual Photo Roster / Student Cards view so the teacher can recognize students and quickly open an individual progress dashboard. Profile photos should be privacy-aware and access-controlled; the academic engine must not require public exposure of student photos.

The individual student dashboard should show a chronological academic progress timeline: enrollment → module activity → attendance → submissions → quiz/exam releases → rubric results → interventions → consultations → term releases → finalization. Authorized users should be able to distinguish system-generated events, student actions, faculty actions, and imported records.

## Syllabus-driven automatic course flow

Faculty can upload a syllabus/course outline/module guide. Classroom should extract or allow mapping of weeks/modules, topics, learning outcomes, lecture materials, readings, activities, quizzes, assignments, projects, requirements, deadlines, and assessments. Faculty reviews the generated course flow before activation.

Release modes:
- Manual
- Scheduled
- Sequential
- Requirement-based
- Class-progress based
- Attendance-based
- Continuous Course Mode

Continuous Course Mode may automatically progress Lecture Material → Activity → Quiz → Requirement → Next Module according to configured rules while faculty retains override authority.

Faculty may upload the entire semester's syllabus, lecture materials, readings, activities, quizzes, requirements, rubrics, and deadlines in advance. Once reviewed and activated, the Classroom may automatically release the correct content and requirements according to the configured course flow so the teacher can focus on actual teaching and supervision rather than repetitive manual posting.

## Materials and media

Each classroom supports files, PDFs, Office files, photos, videos, links, recordings, slides, and other learning resources. Faculty may upload materials in advance and attach them to syllabus/module release rules. Student submissions are private to the submitting student and authorized faculty unless explicitly configured as group/public work.

## Activities / assessment types

The engine must support, at minimum:
- Assignment
- Essay
- Worksheet
- Seatwork
- Case Study
- Reflection
- Discussion
- Recitation
- Presentation
- Group Activity
- Photo evidence
- Video submission
- Practical / Return Demonstration
- Checklist
- Peer evaluation
- Quiz
- Exam
- Attendance-based participation
- Project
- Portfolio
- Journal
- Research milestone
- Custom activity

## Rubrics and grading

Reusable rubric library with weighted criteria and selectable rating scales. Objective assessments may auto-grade. Subjective/AI-assisted grading defaults to suggestion + faculty/preceptor review. AI suggestions must never silently become final released grades. The system records suggested score, final approved score, approver, timestamp, and change/audit history.

## Automatic Grade Consultation / Student Grade Health

Students should not need to repeatedly ask faculty what their current standing is. Each classroom should provide an automatic Grade Consultation / Grade Health view based on the student's RELEASED grades, configured grading policy, completed requirements, and known remaining requirements.

It may show:
- current released term grade;
- current weighted course standing;
- component-by-component contribution;
- missing / late / zero-score items;
- completion gates still blocking release;
- current attendance contribution;
- RLE/OJT/clinical contribution where applicable;
- remaining percentage/points still available;
- scenarios such as minimum performance needed on remaining known requirements to reach the configured passing threshold;
- projected outcomes under clearly labeled assumptions;
- equivalent/transmuted grade according to the active grading configuration;
- PASSED / AT RISK / CRITICAL / INCOMPLETE / NOT YET COMPUTABLE indicators according to configurable rules.

A projection must be clearly labeled as a projection, never as a guaranteed final grade. Unreleased faculty scores must remain private and must not be leaked through reverse calculation. The engine should use only data the student is authorized to see plus published grading rules.

Faculty should be able to configure automated consultation triggers, for example:
- student falls below passing threshold;
- two or more missing requirements;
- repeated absences/tardiness;
- deficient RLE/OJT hours;
- incomplete mandatory competency;
- large drop in grade trend;
- approaching term/final release with unresolved requirements.

The student should receive a plain-language explanation of what is affecting the grade and what remaining actions are available under the published course rules.

## RLE / Clinical / OJT / Practicum engine

RLE/OJT is a first-class subject engine, not a generic assignment type. It supports:
- rotations / departments / clinical areas / companies
- required duty/OJT hours
- time in/out and attendance integration
- supervisor / clinical instructor / preceptor roles
- competency and skills checklists
- observed / assisted / supervised / independent / competent stages
- journal / reflection entries
- case requirements
- case presentations
- return demonstrations / practicals
- clinical or workplace performance rubrics
- supervisor/preceptor evaluations
- make-up duty
- narrative evaluations
- portfolio/e-portfolio
- completion gates
- final RLE/OJT grade contribution to the subject final grade

Journal workflow: Student submits → optional AI rubric suggestion → Faculty/CI/Preceptor review → Approve / Modify / Return for Revision → official score only after approval when approval is required.

## Program-adaptive presets

Examples of adaptive presets:

### Nursing / Allied Health
Clinical rotations, duty hours, nursing care plans, drug studies, FDAR/SOAP/SOAPIE, case studies, return demonstrations, competency checklists, journals, preceptor/CI evaluation, RLE grading.

### Education
Lesson plans, observation hours, demo teaching, classroom management rubric, teaching portfolio, cooperating-teacher evaluation, practicum journal.

### IT / Computer Science
Programming labs, code/project submissions or repository links, practical exams, sprint/project milestones, documentation, peer review, capstone.

### Engineering / Architecture
Laboratory reports, calculations, design plates/drawings, safety checklist, prototype/project milestones, practical performance, capstone/design review.

### Business / Entrepreneurship
Case analysis, business plan, simulation, pitch/presentation, feasibility study, internship/OJT, portfolio.

### Hospitality / Tourism
Practical service competencies, laboratory/skills checks, event/project work, OJT hours, supervisor evaluation, portfolio.

### Criminology / Public Safety
Practical drills, fieldwork, case documentation, physical/practical competency, internship/OJT, conduct/professionalism rubric.

### Theology / Ministry
Bible/theology coursework, sermon/preaching practicum, ministry hours, discipleship/fieldwork, reflection journal, ministry supervisor evaluation, portfolio.

### Research / Thesis / Capstone
Proposal, ethics/approval milestones, adviser feedback, data collection milestones, manuscript chapters, defense rubrics, revisions, final repository/archive.

### Vocational / TVET
Competency-based checklists, practical demonstrations, workplace/OJT hours, evidence portfolio, assessor validation.

### Custom
Faculty/institution defines terminology, modules, requirements, rubrics, grade components, release rules, and completion gates from scratch.

## Classroom interaction

Each classroom includes synchronous and asynchronous interaction:
- discussion/feed
- announcements
- classroom messaging
- class/group threads
- files/materials
- submissions
- comments/feedback
- live classroom
- participation monitoring
- asynchronous engagement monitoring

FREE live class maximum: 120 minutes per session. Premium capability is supported by architecture but pricing is not locked here.

## Class officers, governance, and delegated classroom roles

Faculty may designate student officers or special classroom roles for each specific classroom. Roles may differ by program/subject and must be configurable rather than globally hardcoded.

Examples:
- President
- Vice President
- Secretary
- Treasurer
- Auditor
- PIO / Information Officer
- Class Monitor
- Attendance Coordinator
- Materials Coordinator
- Activity Coordinator
- Laboratory Representative
- Clinical/RLE Representative
- OJT Representative
- Research/Thesis Representative
- Group Leader
- Peer Tutor / Skills Mentor / Project Lead
- Custom Role

Each designation may have a start date, end date, appointing faculty, assignment description, and specific permissions. Faculty may appoint officers directly or optionally run a classroom election/poll when appropriate.

Officer capabilities may include only explicitly granted functions such as:
- posting approved class reminders/updates;
- coordinating class concerns;
- creating non-academic polls;
- maintaining meeting minutes;
- assisting with calendar reminders;
- monitoring published deadlines and unresolved class tasks;
- organizing group/project coordination;
- maintaining a class task board;
- escalating concerns to faculty;
- helping moderate subject-related discussion within configured limits;
- submitting weekly class/officer summaries;
- tracking assigned class-wide coordination tasks.

Officers MUST NOT automatically receive access to private grades, private journals/submissions of classmates, confidential interventions, sensitive incident details, final attendance authority, exam release controls, grade adjustments, deductions, bonus-point authority, or final-grade controls.

Class officers help coordinate the classroom; they do not become mini-faculty unless a separate authorized academic role is explicitly granted.

Officer handover must preserve historical announcements, minutes, decisions, task assignments, and audit records while transferring permissions prospectively.

## Class community, concern tracking, and organized subject communication

Classroom should serve as the primary organized space for subject-related matters instead of relying on unstructured external group chats.

Supported spaces may include:
- General Discussion
- Help / Questions
- Faculty Announcements
- Activities / Requirements
- Quiz / Exam Concerns
- RLE / OJT / Clinical
- Group Work
- Class Officers
- Faculty Consultation / Office Hours
- Custom channels/threads

Faculty may mark an answer as Official Answer, pin important posts, lock a resolved thread, and maintain subject-related polls and meeting minutes.

A structured Class Concern system should support categories such as:
- missing material;
- schedule conflict;
- grade concern;
- attendance concern;
- activity clarification;
- technical issue;
- RLE/OJT concern;
- other.

Suggested status flow: Open → Officer/Coordinator Reviewing → Faculty Reviewing → Resolved / Closed. All status changes are auditable.

## Faculty / student / supervisor roles

Role capabilities are scoped per classroom. Suggested roles:
- Course Faculty / Owner
- Co-Faculty
- Clinical Instructor
- Preceptor / OJT Supervisor
- Coordinator
- Teaching Assistant
- Student

Non-owner roles receive only explicitly granted permissions. A preceptor/supervisor must not automatically gain authority to alter theory grades or final course configuration.

## BUKLOD Connect contextual bridge

BUKLOD Connect is a separate app/product but should be functionally related to Classroom.

Classroom may create or link contextual Connect conversations for:
- faculty-to-class communication;
- faculty-to-student consultation;
- officer coordination;
- group/project coordination;
- follow-up on missing requirements;
- approved RLE/OJT/clinical coordination;
- consultation scheduling;
- reminders and resolution follow-up.

Where technically supported, a Classroom-originated Connect thread should retain a non-sensitive context link such as classroom, activity, concern, intervention, or consultation ID. This allows the user to return to the authoritative Classroom record.

Privacy boundaries are mandatory:
- private grades remain in Classroom;
- confidential incident/health/accommodation details must not be copied into general Connect threads;
- Connect read receipts/messages do not by themselves change grades or attendance;
- classroom academic decisions must be recorded back into the authoritative Classroom record when they affect grades, requirements, attendance, interventions, or finalization.

## Documented student follow-up / intervention record

Classroom must support structured faculty follow-up for students who need academic, attendance, RLE/OJT, behavioral, or completion intervention.

A Follow-up / Intervention record may include:
- student;
- classroom / term / rotation context;
- trigger/reason;
- objective facts and supporting records;
- date/time opened;
- faculty/authorized initiator;
- communication method (Classroom, BUKLOD Connect, in-person, email/other authorized channel);
- message/advice issued;
- action plan or required corrective action;
- deadline / next review date;
- student response;
- acknowledgment / delivery / read status when technically available;
- attachments/evidence;
- referral/escalation when applicable;
- follow-up attempts;
- outcome / resolution;
- authorized notes with visibility controls;
- audit history.

Examples:
- warning about failing standing;
- missing activity reminder;
- repeated absence follow-up;
- RLE/OJT deficient hours;
- incomplete competency;
- pending journal/case requirement;
- consultation after poor exam performance;
- academic integrity/behavior follow-up;
- approved remedial plan;
- INC completion plan.

The system should support automatic intervention suggestions/triggers but faculty decides the actual intervention unless institution policy defines otherwise.

Students should have an accessible Consultation / Follow-up inbox showing student-visible notices, required actions, deadlines, and their responses. Faculty should see unresolved follow-ups on the dashboard.

## Evidence-ready academic communication and due-process record

Classroom should create reliable, exportable institutional records that can help demonstrate what academic information, notices, opportunities, interventions, and decisions were provided to a student. This is an evidence-ready administrative record, not a guarantee that any record is automatically legally conclusive.

For important grade/attendance/completion notices, the system should preserve when applicable:
- author/actor identity;
- timestamp;
- content/version sent;
- referenced published policy/rubric/syllabus rule;
- delivery channel;
- delivery/read/acknowledgment state when technically available;
- student response or dispute;
- attachments;
- subsequent edits or superseding notices;
- resolution;
- immutable/append-only audit events for material changes.

The system should support export of a controlled Student Academic Record Packet for authorized institutional use, potentially containing selected:
- enrollment record;
- grading policy/version;
- syllabus/version;
- released grade history;
- attendance summary;
- requirement/submission history;
- consultation/follow-up history;
- student acknowledgments/responses;
- approved interventions/remedial plans;
- conduct/incident records where authorized;
- grade adjustment audit trail;
- finalization/release history.

Exports must respect applicable institutional policy, privacy rules, access authorization, and data-retention requirements. Private faculty notes that are not designated as official student records must remain separately permissioned and must not silently become student-visible or public.

## Monitoring / early warning

Faculty dashboard should surface student and class-level indicators such as:
- missing requirements
- late submissions
- deficient duty/OJT hours
- repeated absences/tardiness
- low grade trends
- low engagement
- unviewed modules/materials
- incomplete competencies
- pending journals/evaluations
- students at risk of failing or not being eligible for final release
- unresolved consultations/follow-ups
- unacknowledged critical notices
- repeated intervention triggers

Faculty should be able to open a student from the Photo Roster directly into this progress/early-warning dashboard.

## Behavior, conduct, violations, commendations and grade-impact governance

BUKLOD Classroom must support structured recording of specific student behaviors, conduct incidents, violations, commendations, professionalism events, safety events, and exceptional performance when these are relevant to the course, laboratory, clinical area, RLE, OJT, practicum, fieldwork, or institutional policy.

A behavior/conduct record may contain:
- student
- classroom / rotation / duty / activity context
- date/time
- category and policy/rubric reference
- severity or level when configured
- factual description
- reporter
- witnesses when applicable
- supporting evidence/attachment when appropriate
- student acknowledgment/comment when applicable
- faculty/CI/preceptor action
- resolution / appeal status
- whether it affects grade, completion eligibility, attendance, professionalism, safety clearance, or no academic score at all
- audit timestamps and all later edits

Examples include:
- attendance/tardiness events
- classroom conduct
- professionalism
- laboratory safety
- clinical/OJT safety or policy violations
- academic integrity incidents
- missed required procedure or duty
- commendation / exemplary behavior
- leadership / initiative
- approved extracurricular or institutional contribution

### Grade-deduction safeguards

Conduct records MUST NOT automatically deduct academic points unless the grading policy, published rubric, syllabus, or authorized institutional rule explicitly defines that impact.

If a violation may affect a grade:
- the applicable rule/rubric must be identified;
- the deduction formula or maximum deduction must be configured in advance when reasonably possible;
- the system must prevent accidental double counting, such as penalizing the same absence under both Attendance and Conduct unless policy explicitly allows both;
- deduction must show original score, adjustment, resulting score, reason code, rule/rubric reference, actor, date/time, and approval history;
- large or exceptional manual deductions may require a second authorized reviewer according to institution/class settings;
- sensitive incident narrative can remain permission-restricted even when the student can see the released academic effect and reason category;
- students must have an acknowledgment/dispute/appeal route when enabled by policy.

Clinical/RLE/OJT safety or professionalism events may also be configured as completion/clearance gates instead of numerical deductions when that better matches the program policy.

### Additional points, extra credit and exceptions

The system must support positive adjustments such as:
- approved extra credit
- bonus activity
- remedial/recovery points
- competition/academic representation
- extracurricular contribution
- leadership/service credit
- exceptional performance
- authorized make-up or alternate requirement
- individual accommodation or documented exception

However, these adjustments must be governed to reduce bias and favoritism.

Default safeguards:
- No hidden manual points.
- Every grade-impacting positive adjustment requires a reason code and audit record.
- Faculty should normally define the opportunity, eligibility, point value/weight, deadline, and maximum cap before awarding it.
- When an opportunity is intended for the whole class, the same published criteria must be available to all eligible students.
- If an extracurricular opportunity is not equally accessible, faculty should provide an equivalent alternative path when appropriate rather than rewarding access alone.
- Individual exceptions must identify why the exception exists (e.g. documented accommodation, excused event, approved make-up, institutional representation, verified special circumstance) and who approved it.
- Course/institution settings may require second approval above a configured manual-adjustment threshold.
- The system may cap bonus/extra-credit contribution by term, component, or whole course so manual bonuses cannot silently dominate the official grading model.
- Adjustments cannot bypass mandatory completion gates unless the exception explicitly authorizes that gate override.
- Released student grade details should show the existence, amount, and non-sensitive reason/category of grade adjustments.

### Anti-bias / anti-favoritism controls

BUKLOD Classroom should actively make inconsistent grading visible without replacing faculty judgment.

Controls may include:
- rubric-first scoring for subjective work;
- optional anonymous/blind grading where the activity permits it;
- standard reason codes for deductions, bonus points, overrides, and exceptions;
- side-by-side rubric criteria during grading;
- audit history for every manual score change;
- detection/flagging of unusually large manual adjustments or repeated exceptions for review;
- class-level adjustment summaries showing how many students received deductions/bonuses/exceptions and under which categories;
- configurable second-review requirement for major grade changes, conduct penalties, final-grade overrides, or exceptional bonuses;
- no ability to delete a finalized adjustment without leaving an audit event;
- role-based permissions so supervisors/preceptors can only adjust the components they are authorized to assess;
- final grade lock and controlled reopen with a mandatory reason.

The system must not assume that equal treatment always means identical treatment: documented accommodations, excused absences, make-up work, disability/access accommodations, approved institutional duties, and other legitimate exceptions may require individualized handling. The requirement is that individualized decisions are rule-based, documented, reviewable, and not secret favoritism.

## Smart classroom assistant / operational automation

Optional automation should reduce repetitive faculty/class officer work without making undisclosed academic decisions.

Useful functions include:
- automatic daily/weekly classroom brief;
- summary of long discussion threads;
- pending-action list;
- faculty To Review queue;
- student To Do list prioritized by deadline/risk;
- automatic reminders for released requirements;
- officer task reminders;
- syllabus/calendar synchronization;
- early-warning summaries;
- grade consultation explanations;
- suggested follow-up messages that faculty approves before sending when the message has material academic consequences.

Automation must not fabricate grades, attendance, incidents, acknowledgments, or communication history.

## Finalization and audit

Support:
- Compute
- Faculty Review
- Release
- Final Grade Lock
- Controlled Reopen with reason
- Grade change audit trail
- INC / incomplete
- Dropped / Withdrawn
- make-up/remedial rules
- export/print grade sheet and reports
- student acknowledgment when configured
- semester/classroom archive
- conduct/violation/commendation history with permission controls
- manual adjustment / bonus / deduction / exception audit trail
- appeal/dispute status where institution policy enables it
- consultation/follow-up/intervention audit trail
- authoritative version history for syllabus, grading policy, rubrics, and material academic notices

## Non-regression rule

Future Classroom changes MUST preserve this adaptive architecture and ALL requirements locked in this document. Do not hardcode the product around a single program, a single grading sheet, nursing-only terminology, a fixed Prelim/Final structure, unrestricted faculty point adjustments, or a single communication surface. The uploaded grading workbook remains the default grading preset, while the engine remains fully configurable for other institutions, programs, subjects, and course types. Behavior/violation deductions, bonus points, extracurricular credit, exceptions, student consultations, and interventions must remain transparent, rule-based, auditable, and protected against hidden favoritism. Student profiles/photos, individual progress tracking, automatic grade consultation, class officers/governance, evidence-ready follow-up records, and the privacy-safe BUKLOD Connect contextual bridge are locked core requirements.