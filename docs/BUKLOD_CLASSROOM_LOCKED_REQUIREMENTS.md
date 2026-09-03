# BUKLOD Classroom — Locked Product Requirements

Status: LOCKED
Version: Classroom Academic Engine R2+ baseline
Date locked: 2026-09-04

## Product boundary

BUKLOD Classroom is a distinct learning product/environment connected to BUKLOD Main → Faculty. BUKLOD Main is the institutional/faculty doorway; BUKLOD Classroom is the actual teaching-learning space. A faculty user can own/handle multiple separate classrooms, one per subject/section/term. Students have a dedicated My Classrooms experience.

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

## Integrations

- BUKLOD Main → Faculty: institutional faculty/class management doorway.
- BUKLOD Classroom: authoritative classroom learning environment and final academic grade orchestration.
- BUKLOD Quiz: examination engine; released scores sync into the correct classroom/term/category.
- BUKLOD Attendance: attendance/time engine; data can feed attendance grade components if enabled.

No duplicate manual encoding should be required when a valid integration source exists.

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

## Non-regression rule

Future Classroom changes MUST preserve this adaptive architecture. Do not hardcode the product around a single program, a single grading sheet, nursing-only terminology, or a fixed Prelim/Final structure. The uploaded grading workbook remains the default grading preset, while the engine remains fully configurable for other institutions, programs, subjects, and course types.
