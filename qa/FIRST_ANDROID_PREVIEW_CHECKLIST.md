# First Android Preview Build — BUKLOD Staging

## Before build
- [ ] Dedicated staging Supabase project exists.
- [ ] Migrations dry-run reviewed.
- [ ] Staging migrations applied.
- [ ] Starter seed applied only to staging.
- [ ] `push` Edge Function deployed.
- [ ] `delete-account` Edge Function deployed.
- [ ] notifications INSERT webhook configured.
- [ ] First staging System Admin bootstrapped.
- [ ] EAS project initialized.
- [ ] Preview EAS environment has the staging Supabase URL.
- [ ] Preview EAS environment has the staging publishable key.
- [ ] No `sb_secret_` or legacy service-role secret exists in Expo client config.
- [ ] `node scripts/staging-gate.mjs` passes.
- [ ] `npm test` passes.
- [ ] `supabase test db` passes.
- [ ] Privacy notice is clearly treated as staging/test if organization-specific details remain unfinished.

## Build
```bash
eas build --platform android --profile preview
```

## Device install test
- [ ] App label says `BUKLOD Staging`.
- [ ] Staging badge says TEST DATA ONLY.
- [ ] Package can coexist with production identifier.
- [ ] Login screen appears.
- [ ] Registration church selector loads.
- [ ] Policy acknowledgement gate works after login.
- [ ] Notification permission denial does not block app.
- [ ] App can reconnect after airplane mode.
- [ ] Logout works.

## Multi-account privacy test
- [ ] Member A private reflection invisible to Member B.
- [ ] Member A private reflection invisible to Leader.
- [ ] Group reflection visible only within correct group/scope.
- [ ] Private prayer invisible outside owner.
- [ ] Moderated prayer hidden from ordinary members.
- [ ] Different-church member cannot browse protected church/group content.
- [ ] Pastoral notes denied to ordinary Leader.
- [ ] System Admin moderation/admin functions work.

## Exit
- [ ] Zero open P0 defects.
- [ ] Defect log updated.
- [ ] Build URL recorded in pilot notes.
- [ ] UAT sign-off started.
