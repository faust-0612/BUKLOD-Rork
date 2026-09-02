# BUKLOD v8 — Reporting & Analytics

BUKLOD v8 adds leadership reporting without turning member activity into a public
spiritual ranking.

## Analytics scopes

### System
System administrator only.

### Church
Pastor, local admin, and system administrator within the correct church scope.

### BUKLOD Group
Assigned group leader and higher-authorized leaders.

The actual scope authorization is enforced in PostgreSQL functions, not merely hidden
in the user interface.

## Overview metrics

### Members
- active profiles in scope

### Devotional
- members with devotional activity
- completion count
- average devotional days per member
- participation rate

### Community
- posts
- comments

### Prayer
- prayer requests
- answered prayers

### Learning
- active track enrollments
- completed tracks
- completed lessons

### Church life
- events
- present / late / excused / absent
- active ministry participants

### Visitors
Church/system scopes:
- new visitors
- follow-ups created
- current membership-interest/onboarding/member pipeline count

### Care
- open pastoral follow-ups

## Comparison reports

System admin:
- church comparison

Church leadership:
- BUKLOD group comparison

These comparisons are explicitly intended for resource allocation, encouragement,
follow-up, and planning. Do not publish leaderboards implying that a church/group is
more spiritual because its digital participation percentage is higher.

## Export

v8 includes CSV export foundations for:
- member engagement
- event attendance

Native mobile sharing uses:
- `expo-file-system`
- `expo-sharing`

Web uses a browser-generated CSV download.

## Monthly snapshots

`report_snapshots` stores a generated JSON summary for a month and scope.

System admin screen can create/refresh a monthly system snapshot. The SQL RPC also
supports church/group snapshots for future UI extension.

Suggested uses:
- BOT / leadership monthly review
- trend comparison
- planning
- follow-up accountability
- ministry evaluation support

## Privacy / interpretation guardrails

Reports should answer:
- Are members engaging?
- Where is follow-up needed?
- Which programs are being used?
- Where are visitors in the journey?
- What support does a church/group need?

Reports should not claim:
- spiritual maturity based solely on app activity
- holiness scores
- salvation status
- pastoral conclusions that are not supported by actual human conversation

Prayer request content and private pastoral-care note text are deliberately excluded
from analytics exports. Only counts/operational status are aggregated.
