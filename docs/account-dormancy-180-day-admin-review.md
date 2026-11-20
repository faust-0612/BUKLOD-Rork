# BUKLOD Main dormant-account deletion review — 19 November 2026

## Status / release boundary
**DEV source only — monitoring and destructive deletion both OFF by default.**
This change is not a Season 2 reward feature and must not modify the approved Season 1/Season 2 economy.
The existing voluntary Delete Account button and Google Play deletion request pathway remain unchanged.

## Approved product decision
1. Once per month, inspect candidate accounts with **180+ days without a recorded sign-in**, but veto candidacy when recent server-verified client activity or recent authored posts exist. Do not interpret zero points, zero participation, low rank, or the absence of daily readings as proof of abandonment.
2. Contact the owner with an appropriate action. Ordinary cases receive recovery/confirmation instructions. A government ID and live selfie are relevant only for a separate **risk-based identity/recovery verification**, not a blanket requirement. ID and selfie must use the protected identity-verification workflow; never attach them to public notifications or store them in the candidate table.
3. The **second 180-day period** is a response deadline, measured from **verified external notification delivery**, not case discovery, account age, or an undelivered in-app push.
4. Monthly admin report, including newly flagged, pending, held, not externally notified, and completed. Admin's only routine intervention is **HOLD — DO NOT AUTO DELETE** or **RELEASE HOLD**; all actions are audited. Sign-in, confirmed recovery, or member acknowledgement automatically cancels a case.
5. At the deadline, deletion should be automatic only when all non-negotiable safety gates pass. A pending BSOC/account-recovery case, legal hold, financial balance/withdrawal or QMP liability, unresolved identity risk, account with no verified contact, or unverified media deletion must block destructive erasure. Never merge identities or transfer balances automatically.

## Implemented in this DEV branch
- Additive RLS-protected private case, audit, policy, and monthly-report tables.
- Privileged, idempotent monthly candidate scan and in-app notices to the candidate and System Admin. Postgres Cron registered if installed, but monitoring remains OFF.
- System-Admin-only list RPC, hold/release RPC with mandatory reason and audit.
- Member-only active-case lookup and acknowledgement RPC. Visible on Account Security; admin review visible under Privacy & Moderation.
- No background permanent deletion job, no email/SMS sender, no photo capture, no production migration, no OTA.

## Mandatory production activation checklist
- [x] Read-only verified the Main production-configured Supabase project yhanxndaqbmuzbdqlblu via web release workflow, Auth triggers, and live schema; no production DDL writes.
- [ ] Verify the real backend delete-account service, all FK constraints, storage object ownership, cascades/retention and backup controls; do not simply call auth.admin.deleteUser and assume associated media is gone.
- [ ] Connect a valid external notification provider for verified email/SMS delivery, bounce handling, idempotent retries, timestamps and expiry. Explicit consent/privacy notice must explain the inactivity policy.
- [ ] Define record-specific legal and financial preservation, payout holds, offline account recovery, BSOC holds, and rechecks immediately before each deletion.
- [ ] Add a dedicated idempotent, auditable server deletion worker; recheck signed-in activity, proof of delivered notice, 180 days, admin hold, and legal/financial/media clearances before destructive steps. Build crash-resume and partial-failure recovery.
- [ ] Validate on production-equivalent staging with consent, undelivered notice, false inactivity, duplicate account, multiple devices, active financial history, admin hold/release, and partial deletion failure tests.
- [ ] Update BUKLOD public privacy and account deletion disclosures *before enabling monitoring*. Existing users must get fair advance notice of new inactivity terms.
- [ ] Approve release separately, with exact DEV → RC → Production OTA/server changes and verifiable result. Do not deploy unrelated Season 2 changes.

**No account can be auto deleted by this DEV change.** This is intentional until safeguards and the available-but-production-only BUKLOD Main backend are reconciled. No separate approved staging database exists.


## 19 November 2026 addendum — mobile/email-only login and legacy migration

DEV source only, not applied to BUKLOD Main production or OTA.

- New signup: mobile or email. Registration selector omits username; a prepared auth.users BEFORE INSERT trigger rejects username signup on old builds too. Display usernames/referral codes remain intact.
- Existing username-only members: temporary Legacy Username Recovery with existing password, then Account Security prompts a verified email or mobile. Migration requires current password and a fresh 6-digit OTP. Email uses Resend if configured, SMS OTP uses Twilio Verify if configured. Codes expire after 10 minutes; requests are rate-limited. Auth UID, posts, points, and referrals stay unchanged. Interrupted verified changes can resume. Saved old username/password bubbles are cleaned after success.
- Notification surfaces: Settings action banner, Account Security instructions, opt-in monthly in-app notices, admin summary of remaining username accounts. There is no automatic external notification without provider and contact checks.
- Trello is not an email/SMS provider. Email requires a configured Resend sender or alternative SMTP/API provider. SMS requires a messaging gateway such as Twilio Messaging; Twilio Verify handles only OTP. SMS may cost money; do not activate it without approved funding.
- External message worker and delivery queue exist behind OFF switches, with per-batch cap, audited provider acceptance and no false delivery proof. Accepted sends never start the 180-day account-deletion clock.

Required before activation: use verified BUKLOD Main yhanxndaqbmuzbdqlblu only after production-equivalent RC verification, reconcile new unrelated production church-role RPC security fixes, confirm sender credentials, verify true email/SMS delivery, test legacy signup rejection and migration on production-equivalent staging, validate idempotency/collisions/partial failure, preserve account recovery, and explicitly enable the policies. No real messages or account changes occurred in this source-only update.

## Live BUKLOD Main read-only audit (November 19, 2026)
- Project yhanxndaqbmuzbdqlblu, which is named BUKLOD Connect in the provider dashboard, is the expected Main backend in production_web_deploy.yml; shared public.profiles and authentication tables confirmed.
- 588 profiles: 31 username, 315 email, 240 mobile, 2 null login_method.
- Of 31 username profiles, 10 have profile mobile, 0 have a verified Auth phone number, and 0 have a real Auth email. Do not claim that SMS or email outreach is presently possible to all 31.
- Existing live Auth trigger buklod_invalidate_email_verification_on_auth_email_change_v1 and profile trigger buklod_queue_email_verification_profile_v1 must be reconciled. Email ownership proof is distinct from BUKLOD membership/ID verification.
- Live pg_cron/pg_net are installed. New migration/dormancy tables do not exist yet; there have been no live messages, account changes or auto deletions from this DEV branch.
- Latest main contains unrelated privileged church-role/local-membership RPC ACL fixes. Preserve them during RC reconciliation.
