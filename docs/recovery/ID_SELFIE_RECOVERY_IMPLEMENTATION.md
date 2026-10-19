# BUKLOD ID + Live Selfie Recovery — gated implementation contract

Status: DESIGN/DEV ONLY. NOT ACTIVE. No automatic password reset may be enabled until the verification provider and end-to-end security tests are complete.

## Goal
Offer account recovery without a PIN, Twilio, or manual administrator approval, while verifying account ownership. Existing PIN recovery remains available.

## User flow
1. Enter username/mobile/email and birth date. Show a generic response regardless of whether an account exists (prevent enumeration).
2. Explain ID/selfie processing, retention and consent; allow cancellation.
3. Capture an ID image and live camera selfie via an approved verification provider with document authenticity, face comparison and active/passive liveness checks. Reject gallery-only selfies.
4. Backend correlates the provider's signed, single-use verification result with a short-lived recovery request and the matched BUKLOD account. Never trust client-reported verification results.
5. Issue a single-use, short-lived recovery token restricted to that verified account; set a new password using server-side privileged action only after token redemption.
6. Revoke outstanding recovery challenges and relevant sessions, log a security event, and notify the account holder through any previously verified contact.

## Required backend safeguards
- Use a vetted IDV provider; do not implement homegrown face matching or OCR-based approval.
- Keep Supabase service role and IDV API keys only in server secrets; validate provider signatures, request IDs, expiry, and replay protection.
- Per-account/device/IP rate limits, abuse detection, cooldowns, and lockouts; generic error messages.
- Store raw IDs/selfies only in private encrypted provider storage where possible, with short retention, deletion policy, explicit consent and restricted access. Never log ID numbers or biometric images.
- Do not infer ownership from matching name + birthday or from possession of an ID photo alone.
- Handle mismatch, fraud, duplicate names, minors, unavailable cameras, failed liveness and unsupported IDs without resetting passwords.
- No change to existing PIN or admin recovery functions until a verified alternative is ready.

## Acceptance gates before release
- Confirm IDV provider and costs/privacy terms; obtain credentials securely.
- Test valid ID + live selfie, spoof/replay, wrong ID, wrong birth date, duplicate account, expired token, provider outage, network retries, rate limits, session revocation and privacy deletion.
- DEV -> reviewed RC -> approved production release; verify actual device recovery.
- Feature flag defaults OFF; no production auth/RLS changes from this document.
