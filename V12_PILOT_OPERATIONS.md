# BUKLOD v12 — Pilot Operations

v12 adds the controls needed to operate an actual staged pilot without rebuilding the
app every time access or rollout needs to change.

## Runtime controls

System Admin can control the active app environment:

- Maintenance Mode
- maintenance message
- minimum supported app version
- recommended app version
- update message
- pilot-access requirement
- release title
- release notes

System Admin has a deliberate bypass so an accidental maintenance/pilot lock can be
recovered from inside the app.

## Controlled pilot access

In staging, `supabase/seed.sql` now enables:

`pilot_access_required = true`

and creates:

`Leadership Pilot`

Before ordinary testers can enter the app, add them to an active pilot cohort.

The first System Admin remains the recovery/admin bypass account.

## Feature flags

System-wide MVP flags:

- community
- learning
- church_life
- directory
- reports
- visitors

The database already supports future church/group-specific overrides. The v12 Admin UI
starts with the safer system-wide controls.

Use feature flags for staged rollout, not as authorization. RLS remains the security
boundary.

## Pilot feedback

Members can submit:

- Bug
- Usability concern
- Content concern
- Privacy concern
- Feature request
- Other

Attached diagnostics are deliberately limited to:
- app version
- app environment
- online/offline state
- role
- whether a church is assigned

Do not automatically attach reflection text, prayer-request text, pastoral notes,
passwords, JWTs, or Supabase credentials.

## Release control workflow

Suggested pilot pattern:

1. Keep staging in pilot-access mode.
2. Activate only the current cohort.
3. Enable core features gradually.
4. Publish release notes for each preview build.
5. Collect pilot feedback.
6. Resolve P0/P1 defects.
7. Raise `minimum_supported_version` only after the replacement build is available.
8. Use maintenance mode only for genuine maintenance/security needs.
9. Never use feature flags as a substitute for RLS.

## Emergency controls

### Privacy/security incident
- enable maintenance mode if continuing use increases risk
- preserve logs/audit evidence
- identify affected scope
- fix/test RLS or application issue
- publish a replacement build if required
- do not re-open until P0 retest passes

### Bad preview build
- keep previous approved preview installed where possible
- raise minimum version only when a good replacement build exists
- use release notes/update message to tell testers what to install

### Pilot user should lose access
- mark pilot participant `removed`
- membership/account status remains separate from pilot eligibility
