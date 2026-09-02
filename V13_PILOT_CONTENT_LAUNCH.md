# BUKLOD v13 — Pilot Content & Launch Package

v13 fills the staging pilot with actual launch-ready test content and gives members a
clear first-week experience.

## In-app additions

- polished Home quick actions
- staging Pilot Guide card
- Pilot Welcome screen
- role-aware Pilot Checklist
- checklist progress tracking
- BUKLOD Support Center
- searchable help articles
- member feedback/support links
- Admin pilot checklist progress
- Admin launch-content review

## Seeded first-week content

Seven-day devotional:
`BUKLOD Pilot Week: Sama-sama sa Paglago`

The seed uses `current_date` through `current_date + 6`, so a fresh staging database
starts its first-week devotional schedule on the day the seed is applied.

## Learning content

New Believer Foundations now includes starter lessons 6–7:
- Baptism and Obedience
- Sharing Your Faith

BUKLOD Membership Course now has five starter lessons:
- Why Church Membership Matters
- Belonging and Accountability
- Worship, Fellowship, and Service
- Stewardship and Mission
- Commitment and Next Steps

These are ministry-content starters and should be reviewed before production.

## Support Center

Seeded help includes:
- Getting Started
- reflection privacy
- prayer privacy
- pilot feedback
- offline use
- notifications
- account deletion/data rights
- leader follow-up

## Announcement templates

Admin-only reusable templates:
- Pilot Welcome
- Daily Devotional
- Pilot Feedback Request
- Event Reminder
- Maintenance Notice

They are templates only; they do not automatically send messages.

## Pilot checklist

Checklist completion means:
"I intentionally tested this experience."

It does NOT mean:
- spiritual maturity
- good-member score
- ministry performance rating

System Admin can see checklist progress only for active pilot participants to help
identify untested product areas.

## Launch documentation

See:
- `qa/PILOT_TESTER_GUIDE.md`
- `qa/LEADER_PILOT_GUIDE.md`
- `qa/SUPPORT_TRIAGE_GUIDE.md`
- `qa/FIRST_WEEK_CONTENT_PLAN.md`
- `qa/PILOT_LAUNCH_DAY_CHECKLIST.md`
