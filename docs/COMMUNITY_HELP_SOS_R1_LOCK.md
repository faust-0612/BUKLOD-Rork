# BUKLOD Community Help / Emergency SOS — R1 LOCKED BASELINE

Status: **LOCKED**

Production baseline source: `08c3dba634280152c2b65970c1f0045f23c235c0`

Recovery snapshot branch: `baseline/community-help-sos-r1-live-20260914`

Web production release: `https://buklod.expo.app`

Android production OTA baseline:
- Runtime: `1.3.0`
- Update group: `01473c16-acf2-4cb4-a5c2-2a30e0fc15e0`
- Android update: `01a09d58-cdf2-7b7e-b332-3456d1d19793`

## Locked R1 invariants

The following behavior is the minimum protected baseline and must not be removed or weakened by future feature work:

1. **Public Community placement** — BUKLOD HELP remains available from the Public Community Wall and is not organization-gated.
2. **Two surfaces** — ordinary `Need Help` and protected `Emergency SOS` remain distinct.
3. **Foreground-only location** — no background location or foreground-location service is enabled by this feature.
4. **Explicit nearby-alert opt-in** — users can enable nearby safety alerts and can turn them off; disabling removes the stored presence row.
5. **Private raw coordinates / reviewed R3 exception** — nearby feed and push recipients receive approximate distance, not raw coordinates. On an explicit SOS send, the sender is told that authenticated, fresh-nearby responders who choose ON MY WAY may request the rescue destination through a narrowly scoped server RPC. Location sharing ends when the emergency expires or resolves. This approved exception does not provide a general public location API.
6. **Canonical RPC write/read path** — presence, request creation, nearby listing, responses and resolution continue through the `buklod_help_*` RPC family.
7. **Anti-abuse baseline** — one active emergency per creator, send cooldown, bounded expiry and bounded radius remain enforced server-side.
8. **Responder proximity check** — responders require recent opted-in presence and must be within the request radius.
9. **RLS and anonymous denial** — raw safety tables remain RLS-protected; anonymous users may not execute the safety RPCs.
10. **Emergency fan-out protection** — the Edge Function accepts only an authenticated owner of an active emergency, uses recent opted-in presence, caps fan-out at 5 km, selects the smallest useful 1/3/5 km radius, and keeps dispatch idempotent.
11. **Canonical notification pipeline** — Emergency SOS creates canonical `notifications` rows with `kind: community_emergency`; the SOS function does not independently double-send Expo push.
12. **Notification routing** — emergency notification data retains `help_request_id` and opens the BUKLOD Community route.
13. **No points/reward gate** — Emergency SOS is safety functionality and must not require points, rank, organization membership or a paid entitlement.
14. **No claim of government Cell Broadcast** — this remains BUKLOD app/push nearby alerting, not NDRRMC/telecom Cell Broadcast.
15. **Official-services warning remains** — BUKLOD SOS does not replace official emergency services.

## R3 emergency sound and responder navigation contract (DEV; not yet production)

- The sender must grant foreground location permission and have phone Location Services enabled before SOS creation. GPS position is captured in the foreground; no background tracking is enabled.
- The receiving member's **in-app** emergency Modal covers the current BUKLOD route. Background/killed-app delivery uses the OS push notification; the app does not take over the operating system.
- On Android native builds that package `assets/sounds/buklod_alert.wav`, capability-gated `buklod-emergency-v2` provides a distinct alert tone and vibration. Earlier APKs retain `buklod-activity-v2` fallback; Android sound policy, DND, notification permissions and user-controlled channel settings remain authoritative.
- To navigate to the sender, a recipient must have a canonical notice, current nearby opt-in, a live emergency, and an accepted ON MY WAY response. A separate authenticated RPC returns the coordinates only on deliberate navigation. Opening Maps requires a user confirmation.
- Direct authenticated writes to raw SOS request/response/presence tables are revoked; privileged audited RPC paths remain. Foreground presence refresh never creates or re-enables a disabled opt-in.
- This extension requires a new native APK, matching backend migration and push Edge Function, reviewed RC, and controlled production activation. GitHub source alone does not verify OTA delivery, push sound, or live navigation.

## Change rule

Future work may add features around this baseline, but must not silently delete or weaken these invariants. The automated source contract is:

`scripts/community-help-sos-release-contract.mjs`

Protected Web release runs this contract before deployment. Any intentional change to a locked invariant must be treated as an explicit product/safety baseline revision, reviewed separately, and accompanied by an updated recovery baseline rather than bypassing the contract.

## Known R1 non-goals / future improvements

These are **not** falsely locked as completed:
- exact incident auto-focus/highlight after tapping a notification;
- timed 1→3→5 km escalation;
- dedicated safety moderation dashboard;
- verified official-responder role;
- direct official emergency-service integration;
- true Cell Broadcast;
- background location;
- confirmed physical push receipt accounting.
