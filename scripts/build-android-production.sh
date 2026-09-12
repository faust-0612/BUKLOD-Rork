#!/usr/bin/env bash
set -euo pipefail

echo "BUKLOD Report — Android Production Release Candidate"
echo "===================================================="

export BUKLOD_APP_TARGET="report"
export EXPO_PUBLIC_APP_ENV="production"
export REPORT_RELEASE_TARGET="android"

node scripts/production-preflight.mjs
node scripts/verify-production-migrations.mjs > release/PRODUCTION_MIGRATION_HASHES.json

# No GitHub Actions are required for this release gate. These checks run in the
# build-capable workspace immediately before the dedicated Report EAS build.
npx tsc --noEmit
npx expo export --platform web --output-dir dist-report-production-qa
npx expo-doctor@latest

echo
echo "Before build, verify:"
echo "  - REPORT_EAS_PROJECT_ID points to the dedicated BUKLOD Report EAS project"
echo "  - REPORT_GOOGLE_SERVICES_FILE is the dedicated org.mzbministry.buklod.report Firebase config"
echo "  - production Supabase Report schema/functions are already deployed"
echo "  - safe-scope Report E2E passed without a real-member notification blast"
echo

read -r -p "Type BUILD-BUKLOD-REPORT to start the standalone production AAB build: " CONFIRM
if [[ "$CONFIRM" != "BUILD-BUKLOD-REPORT" ]]; then
  echo "Confirmation did not match. Aborting."
  exit 3
fi

eas whoami
eas build --platform android --profile production --message "BUKLOD Report standalone Android production release candidate"
