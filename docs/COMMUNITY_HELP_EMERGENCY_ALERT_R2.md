# BUKLOD Community Help — Emergency Alert Mode R2

Status: IMPLEMENTED ON FEATURE BRANCH, PRODUCTION CUTOVER HELD WHILE A LIVE R1 EMERGENCY IS ACTIVE.

Base: locked R1 snapshot `baseline/community-help-sos-r1-live-20260914`.

## R2 objective

Make a legitimate nearby Emergency SOS materially harder to miss without pretending BUKLOD is government Cell Broadcast and without silently overriding user/OS safety settings.

## OTA-safe layer

- Dedicated Android notification channel: `buklod-emergency-v1`.
- MAX channel importance.
- Strong vibration pattern.
- Alarm audio usage / sonification attributes.
- Emergency notification category with explicit ACKNOWLEDGE action.
- Emergency pushes use high priority, 10-minute TTL, collapse/tag identity per SOS, and iOS `time-sensitive` interruption level.
- Safe local `TEST THIS PHONE` path never creates an SOS or notifies another user.
- Tapping/acknowledging an Emergency SOS records `ACKNOWLEDGED` without weakening stronger responder states.
- Two bounded reminder opportunities for delivered-but-unacknowledged active emergencies: after about 2 minutes and about 5 minutes. Reminders are idempotent and stop after any response.

## Capability-safe rollout

Android must not receive a push for a notification channel that does not yet exist on that device. R2 therefore uses per-device capability registration instead of switching all tokens at once.

- Existing device-token rows default to `emergency_alert_mode_version = 1`.
- After an R2 client successfully creates the emergency channel/category, it calls the authenticated `mark_device_emergency_alert_mode_r2` RPC for that exact Expo token.
- An Android token is routed to `buklod-emergency-v1` only when its capability is version 2 or newer.
- Older/unopened Android clients continue receiving Emergency SOS through the proven `buklod-activity-v2` channel.
- iOS Emergency SOS uses Time Sensitive delivery even during rollout; notification actions are attached only after R2 category capability is registered.
- All non-emergency BUKLOD notifications remain on the existing activity path.

This fallback is a release invariant: OTA adoption must never create a period where an Emergency SOS disappears because the recipient has not opened the updated app yet.

## Native DND layer

True Android DND bypass requires `android.permission.ACCESS_NOTIFICATION_POLICY` in the installed native binary plus explicit user-granted Notification Policy access.

R2 source prepares production Android versionCode 21 with that manifest permission. Existing build 20 remains eligible for MAX-priority Emergency Alert Mode but the UI must show DND native update pending and must not claim DND bypass.

No EAS/APK/AAB build is automatically triggered by this implementation. The repository-wide NO AUTO EAS CLOUD BUILDING rule remains in force.

## Explicitly not included

- No telecom/government Cell Broadcast.
- No background location.
- No foreground location service.
- No Android full-screen intent takeover.
- No `USE_FULL_SCREEN_INTENT` permission.
- No custom siren asset yet; adding a bundled custom sound is a native-build phase.
- No Apple Critical Alerts entitlement; iOS uses Time Sensitive only.

## R1 invariants retained

R2 does not relax the locked R1 rules for exact-location privacy, opt-in recent presence, authenticated RPCs, RLS, one active emergency, cooldown, max 5 km fan-out, responder proximity checks, idempotent dispatch, or the canonical notification-to-push path.

## Release gates

Both contracts must pass before release:

1. `node scripts/community-help-sos-release-contract.mjs`
2. `node scripts/community-help-emergency-alert-r2-contract.mjs`

Production migration/push deployment must not be switched mid-incident. If a real active SOS exists, hold the cutover until the incident resolves/expires unless a separately reviewed emergency-compatible migration plan is explicitly approved.
