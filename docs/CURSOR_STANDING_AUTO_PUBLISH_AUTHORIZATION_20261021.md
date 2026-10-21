# CURSOR — STANDING AUTHORIZATION FOR AUTOMATIC ANDROID PRODUCTION OTA

Owner directive (2026-10-21): **“bkt d nalang ipaderetso ng OTA kapag natapos na”**. The owner authorizes automatic Android Production OTA publication **after** all mandatory technical release gates have passed, without a repeated final approval request. This supersedes the prior requirement for an additional final publish permission for this coordinated P0/R5 scope. This document itself is not an OTA and does not assert that the gates passed.

## Execution — do not pause for routine permission
1. Inspect actual latest production OTA group, runtime, channel, installed APK compatibility, and cumulative source/RC manifest; verify V28 reality. Do not assume runtime 1.3.4 has an OTA.
2. Collect and fix all **verified** P0 issues, prioritize emergency stability, weak-network loading and referral Create Account Not Found, preserve all unrelated features. Stage on isolated cloud DEV with scoped diff and regression tests.
3. Integrate R5 only if complete: exact approved manuscripts, rights-cleared and owner-reviewed illustrations/audio, admin/RLS, points, full cloud Android low-end test, and V28 runtime compatibility. If not complete, exclude R5 from release or keep it fully disabled; do not block ready P0.
4. Cloud-only tests: TypeScript, contract, Jest, isolated DB/RLS and reward idempotency, weak network and Android low-end device/emulator. No PC C:/D: writes or local fallback.
5. Freeze exact passing RC; verify no native changes or runtime mismatch, ensure safe production migration authorization/rollback if required, and no cutoff of older clients until approved replacement build/link is live.
6. **Automatically publish the exact frozen RC to Android Production OTA when and only when every gate is PASS**. No extra final approval request for this scope. Verify server update group and on-device receipt; capture runtime, channel, manifest and source SHA. If any gate fails or credentials/cloud runner are missing, **do not publish**; report exact blocker only.
7. Never use old 1.3.3 release script blindly, never invent publication success, never modify immutable published OTA bundles, no unrelated changes, no APK/AAB/native build unless separately authorized.

Owner prefers a single verified consolidated OTA; P0-only OTA is permitted when R5 media/QA blocks consolidation. Continue autonomously through publication if genuinely safe.
