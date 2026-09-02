# BUKLOD v5 — Discipleship & Learning System

## Core idea

BUKLOD v5 adds structured Christian formation on top of devotional life, prayer,
community interaction, and pastoral follow-up.

The learning system is designed around:

- Bible study
- New believer foundations
- Membership preparation
- Discipleship tracks
- Leadership development
- Mentor-guided learning

It intentionally tracks **learning participation and course completion**, not spiritual
worth.

## Member experience

### Learn
Members can browse published tracks and enroll.

Each track can contain:
- reading lessons
- reflection lessons
- quizzes
- mentor-reviewed assignments

Progress is saved per enrollment.

### Quizzes
- multiple-choice
- server-side grading
- 70% passing threshold in the starter
- successful quiz completion marks the lesson complete

### Assignments
- member submits a written response
- assigned mentor is notified
- mentor can accept or return for revision
- accepted assignment marks the lesson complete

### Track completion
When all required lessons are complete:
- enrollment is marked completed
- certificate record is created
- member receives a completion notification

## Mentor system

System administrators can assign mentor ↔ disciple relationships.

Mentors can see:
- active tracks
- completed tracks
- lessons completed
- pending submitted assignments

Mentors can review written assignments and provide feedback.

## Admin learning CMS

System admin can:
- create learning tracks
- categorize tracks
- publish/unpublish tracks
- create ordered lessons
- define reading/reflection/quiz/assignment lesson types
- assign mentors

The starter includes a simple track editor. A more advanced quiz-question editor can be
added in the next iteration.

## Starter curriculum

`08_learning_seed.sql` provides:
- New Believer Foundations
- BUKLOD Membership Course

The New Believer track includes starter lessons on:
1. The Gospel
2. Assurance of Salvation
3. Prayer
4. Bible Reading
5. The Church

These are placeholders/content foundations for the app structure and should be reviewed
and expanded by ministry leadership before public launch.

## Security

- draft learning tracks are system-admin-only
- members can self-enroll only in published tracks
- mentors see only disciples assigned to them / enrollments assigned to them
- quiz grading happens server-side
- role changes remain protected by the v2/v3 admin controls
- certificates are readable by their owner and system admin only in the starter
