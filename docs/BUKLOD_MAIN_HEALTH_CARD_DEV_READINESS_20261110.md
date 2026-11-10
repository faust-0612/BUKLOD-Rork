# BUKLOD Main Home Health Center — DEV readiness, 2026-11-10

## Scope and authority
- Work branch: `dev/health-scope-giving-20261110`.
- Health Center is an expandable card on Main Home/Hub, not a new app or a replacement for standalone Health Center.
- Patient and practitioner flows use BUKLOD authenticated session, server-controlled roles, and the `private` schema. Only system admins review identities and licenses.
- No native changes required. Owner explicitly waived **physical-device verification only**.
- **NO OTA, NO production database migration, NO production web deployment** authorized for this workstream.

## Shipped to DEV source
1. Filipino/English switch on card, non-emergency screening and emergency referral to 911.
2. Free patient consultation intake, adult-only eligibility, explicit consent, and independent identity-review requirement.
3. Voluntary practitioner registration with PRC profession, license number, expiry, and pending verification. Duplicate profession/license registrations rejected at schema level.
4. PRC verification via https://verification.prc.gov.ph/; independent system-admin approval with audit reference and prevention of self-approval. An entered license number is NEVER proof of authorization.
5. Explicit separation: `PHYSICIAN_CONSULT` requires a verified physician. `HEALTH_ADVICE` is for qualified, verified professionals within professional scope; `OTHER` cannot claim cases without a separately approved pathway.
6. Assigned consultation record, categorized professional advice/care plan/follow-up/referral, immutable notes, individual patient/provider access, and case closure.
7. Foreground-only updates while the case is open (20-second bounded interval); last verified records remain visible when a network refresh fails.
8. Idempotent intake and note requests; unique retry identifiers prevent duplicated records if a response is interrupted. Clinical note insert and close/referral serialize through a row lock.
9. Historical clinical notes remain readable to assigned participants after referral or closure. No ads inside case records.

## Verification completed
- Static source/security checks for client authorization, identity status, PRC expiry, physician-only mode, private/RLS table permissions, role-controlled functions, case history, and idempotency.
- Private schema, profiles table, and system-admin guard exist in connected production as **read-only prerequisites check**.
- Exactly 9 protected health RPC definitions and 9 explicit EXECUTE grant/revoke pairs in the pending migration.
- No stored patient data created by this DEV work.

## Release gates not yet satisfied
- **Compilation & runtime test:** dependency-installed TypeScript/Expo build on a controlled CI runner or dev machine; no physical device required.
- **Isolated Supabase DB validation:** apply the DEV migration on a nonproduction database only, execute pgTAP/integration tests for unauthorized actor, duplicate PRC, expired PRC, self-claim/self-approval, duplicate note retry, concurrent case claim/closure, and private record disclosure.
- **Clinical governance:** privacy notice specific to telehealth; data-controller/DPO review; safe identity-verification procedure; PRC reviewer protocol; response-time and volunteer escalation; referral/incident management; medical record retention/access/deletion policy. No recording or ID-image collection in clinical chat.
- **Patient/professional acceptance:** real authorized test clients and reviewer accounts, simulated non-sensitive data, end-to-end report of status and no information leakage. Physical-device validation deliberately waived by owner, not other checks.
- **RC and release:** compare baseline with existing consolidated RC and protect unrelated changes. Never publish this DEV branch directly or deploy without all mandatory gates.

## Production status
The health card code and SQL migration are **DEV-only**. Interactive human consultation is NOT available to real users until database migration, verification workflows, privacy/clinical controls, and release gates complete. Do not claim live free doctor availability or guaranteed response times.
