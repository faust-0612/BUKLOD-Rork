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
5. **Private raw coordinates** — exact coordinates are for server-side proximity matching; nearby users receive approximate distance, not raw coordinates.
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
