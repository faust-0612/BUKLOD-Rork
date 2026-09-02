# BUKLOD v10 — QA, Security Test Matrix & Pilot Release Package

v10 is a testing/release-governance layer on top of v9. It does not add a large new
member feature. Its goal is to prove that existing features behave correctly across
roles and privacy boundaries before real-world expansion.

## Automated layers

### 1. Jest / Expo unit tests
Files in `__tests__/`.

The setup follows Expo's current guidance:
- Jest
- `jest-expo`
- React Native Testing Library
- Expo Router testing utilities

Tests are kept outside `src/app/` because Expo Router treats files under the app
directory as routes.

Current starter tests cover:
- CSV escaping/export foundation
- policy-copy invariants
- Expo Router test harness smoke test

### 2. PostgreSQL / RLS tests
Files in `supabase/tests/`.

Run:
```bash
supabase test db
```

Supabase currently documents pgTAP as the database-unit-testing approach for schema,
functions, data integrity, and RLS policies.

Included suites:
- schema/RPC smoke
- security/column-privilege surface
- reflection/prayer privacy RLS
- privilege escalation / role boundaries

### 3. Maestro E2E smoke tests
Files in `.maestro/`.

Current flows:
- launch/login surface
- registration navigation
- privacy notice navigation

An `e2e-test` EAS build profile is included, plus Android/iOS EAS Workflow definitions.
Expo currently supports Maestro jobs in EAS Workflows against emulator/simulator builds.

## Manual/UAT matrix

`qa/TEST_MATRIX.csv` contains P0/P1 scenarios covering:
- authentication
- onboarding
- roles
- reflections
- prayer privacy
- pastoral notes
- directory
- data rights / deletion
- community moderation
- learning
- church life
- visitors
- reports
- notifications
- offline use
- builds
- backup/restore
- pilot gates

## Priority definition

P0 — launch/pilot blocker:
privacy leak, cross-scope access, privilege escalation, data loss/corruption, broken
account deletion, core login failure, or severe crash.

P1 — major defect:
core workflow substantially impaired or creates high risk/confusion, but does not meet
P0.

P2 — normal defect:
important but workaround exists.

P3 — polish:
minor visual/content issue.

## Quality-gate commands

Linux/macOS:
```bash
./scripts/run-quality-gates.sh
```

Windows PowerShell:
```powershell
./scripts/run-quality-gates.ps1
```

The release gate is intentionally expected to FAIL until the v9 privacy placeholders
are replaced with verified MZB information.

## Pilot package

- `qa/PILOT_ROLLOUT.md`
- `qa/TEST_MATRIX.csv`
- `qa/DEFECT_LOG_TEMPLATE.csv`
- `qa/TEST_ACCOUNTS_TEMPLATE.csv`
- `qa/UAT_SIGNOFF.md`

## Release rule

Do not interpret "all automated tests pass" as sufficient permission to launch.
BUKLOD handles prayer, church membership, pastoral follow-up, visitor records, and
participation data. Human UAT, privacy review, and staged pilot testing remain required.
