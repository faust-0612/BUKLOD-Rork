# BUKLOD Pilot Monitoring Guide

The v14 Command Center uses first-party BUKLOD data for:
- active pilot participants
- users who recorded a BUKLOD product action in the last 7 days
- checklist coverage
- open feedback
- privacy feedback
- privacy requests
- content reports
- P0–P3 incident counts
- readiness evidence
- release candidate
- latest rollout decision

"Active user" here is not live presence tracking. It means at least one recorded
devotional/community/prayer/learning/checklist/feedback action in the configured period.

## Crash monitoring

v14 does not claim automatic crash telemetry unless an external crash-monitoring
service is actually connected. Crashes can be logged as Pilot Incidents and/or member
feedback.

If Sentry or another crash service is connected later, expose only aggregate operational
counts in BUKLOD Command Center. Do not ingest prayer/reflection/pastoral text into crash
diagnostics.

## Readiness recommendation

HOLD:
- any open P0
- failed required readiness check
- required readiness check not checked
- no approved release candidate

REVIEW BEFORE FINAL SIGNOFF:
- no blocker above, but open P1 or required warning exists

READY FOR FINAL SIGNOFF:
- no automated blocker/warning detected

This recommendation is advisory. BUKLOD deliberately requires a human rollout decision
with written rationale.
