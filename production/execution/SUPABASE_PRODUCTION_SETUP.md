# Production Supabase Platform Setup

Complete these settings in the actual production Supabase project before opening
BUKLOD to members.

## Project identity
- [ ] Production project is separate from staging.
- [ ] Project reference recorded in final sign-off.
- [ ] Region/compute plan reviewed for expected use.
- [ ] Production URL copied to EAS `production` environment.
- [ ] Expo app uses only the production publishable key.

## Authentication
- [ ] Email confirmation policy decided and tested.
- [ ] Redirect URLs match production BUKLOD scheme.
- [ ] Password/security settings reviewed.
- [ ] Auth rate limits reviewed for expected rollout size.
- [ ] CAPTCHA/bot protection decision documented.
- [ ] If CAPTCHA is enabled, client registration flow is implemented/tested before launch.

## Transactional email
- [ ] Production custom SMTP configured if email signup/recovery is used.
- [ ] Sender name/address verified.
- [ ] Signup confirmation tested.
- [ ] Password reset tested.
- [ ] Email rate limit reviewed against expected onboarding volume.

## Database security
- [ ] RLS exists on all client-exposed sensitive tables.
- [ ] Supabase Security Advisor reviewed.
- [ ] SSL enforcement reviewed/enabled.
- [ ] Network restrictions reviewed for privileged/database access.
- [ ] No service/secret key stored in Expo/EAS public client variables.

## Backups/recovery
- [ ] Backup plan verified for the chosen Supabase plan.
- [ ] Recovery owner named.
- [ ] Restore procedure rehearsed in staging.
- [ ] PITR decision documented where lower RPO is required.

## Edge Functions
- [ ] `push` deployed.
- [ ] `delete-account` deployed.
- [ ] Function secrets configured in Supabase project secrets.
- [ ] Notification INSERT webhook configured and tested.
- [ ] No server secret copied into mobile app source.

## Monitoring
- [ ] Auth logs reviewed during smoke test.
- [ ] Database logs reviewed during smoke test.
- [ ] Edge Function logs reviewed.
- [ ] Incident owner knows how to enable BUKLOD Maintenance Mode.

## Important
Production deployment should use:

`supabase db push`

after a reviewed dry run.

Do not run the staging seed on the production project.
