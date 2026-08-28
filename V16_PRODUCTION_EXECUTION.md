# BUKLOD v16 — Production Deployment Execution Pack

v16 does not add another ministry feature. It turns the v15 production-cutover package
into an operator-ready execution sequence, with Android as the first release target.

## What v16 adds

- current EAS `production` environment setup scripts
- production Supabase link + dry-run scripts
- Android production AAB build scripts
- Google Play draft submission profile
- optional Google Play internal-testing submission profile
- production Supabase platform-settings checklist
- first Android release runbook
- Android production smoke-test protocol
- Google Play first-upload execution sheet
- external action-state JSON
- production action log CSV

## Exact execution order

### 1 — Verified privacy/org details
Complete:
- `production/PRIVACY_FINALIZATION_WORKSHEET.md`
- final `src/lib/legal.ts`
- support/privacy public URLs

`production-preflight.mjs` should pass only after this.

### 2 — Production Supabase
Create the real production project.

Then:

```bash
./scripts/link-production-supabase.sh YOUR_PROJECT_REF
```

This links and dry-runs only.

Complete:
`production/execution/SUPABASE_PRODUCTION_SETUP.md`

### 3 — Production EAS environment
Run:

```bash
./scripts/configure-production-eas.sh
```

Current EAS environment variables are stored under the `production` environment and the
production build profile is already configured to use it.

### 4 — Apply production migrations
Dry run first:

```bash
./scripts/production-cutover.sh
```

After explicit human approval:

```bash
./scripts/production-cutover.sh --apply
```

Never apply staging seed data.

### 5 — Bootstrap production
- first System Admin
- verified live churches
- production-safe baseline
- Edge Functions
- notification webhook

Keep Production Maintenance Mode ON.

### 6 — Android production AAB

```bash
./scripts/build-android-production.sh
```

Under the hood, the actual store build command remains:

```bash
eas build --platform android --profile production
```

### 7 — Register exact build
Admin → Go-Live Command Center → Release Candidates.

### 8 — Upload to Google Play as draft

```bash
./scripts/submit-google-play-draft.sh
```

The submission profile uses `releaseStatus: draft`.

### 9 — Android production smoke test
Use:
`qa/ANDROID_PRODUCTION_SMOKE_TEST.md`

### 10 — Optional Play internal testing
After tester/store setup:

```bash
./scripts/submit-google-play-internal.sh
```

This explicitly uses:
- track `internal`
- releaseStatus `completed`

### 11 — Final GO LIVE
Complete remaining store/privacy/readiness checks.

Record the exact human rollout decision in Command Center.

Only after an authorized GO LIVE decision should ordinary member access be opened.

## What v16 cannot execute without you

These require the actual external accounts/credentials:
- creation of Supabase production project
- creation of Expo/EAS production project linkage
- Google Play Developer Console app
- Google Play service account credential
- EAS build itself
- store submission
- actual Go-Live decision

The execution-state manifest intentionally keeps every external action false until it is
really completed.
