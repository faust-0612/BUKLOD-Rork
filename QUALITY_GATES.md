# BUKLOD Quality Gates

## Local database

Use a separate local/staging Supabase project.

```bash
supabase start
# Apply/import the BUKLOD migrations in your chosen local workflow.
supabase test db
```

Supabase's current testing documentation uses `supabase test db` for pgTAP database
tests and recommends isolated application-level tests rather than assuming a pristine
shared test database.

## Expo / React Native unit tests

```bash
npm test
```

Expo currently documents `jest-expo` for Expo unit tests and
`expo-router/testing-library` for Router integration tests.

## Expo health

```bash
npx expo-doctor@latest
```

## E2E

Local Maestro, after installing a compatible app on an emulator/simulator:

```bash
maestro test .maestro/00_launch_login.yml
maestro test .maestro/01_registration_navigation.yml
maestro test .maestro/02_privacy_notice.yml
```

EAS Workflows:

```bash
eas workflow:run .eas/workflows/e2e-test-android.yml
eas workflow:run .eas/workflows/e2e-test-ios.yml
```

## Release blocker check

```bash
node scripts/release-gate.mjs
```

This currently fails while the privacy notice still contains verified-information
placeholders. That is intentional.

## Preview distribution

The existing `preview` EAS profile uses internal distribution. Expo's internal
distribution builds produce directly installable Android APKs and iOS ad hoc builds,
which are appropriate for the staged pilot process.

For a brand-new store release, keep store submission separated from the pilot gate.
