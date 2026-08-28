#!/usr/bin/env bash
set -euo pipefail

echo "BUKLOD 1.0 — Android Production Release Candidate"
echo "================================================="

node scripts/production-preflight.mjs
node scripts/verify-production-migrations.mjs > release/PRODUCTION_MIGRATION_HASHES.json

npx expo-doctor@latest
npm test

echo
echo "Before build, verify:"
echo "  - production Supabase schema is deployed"
echo "  - Maintenance Mode is ON"
echo "  - production EAS variables are correct"
echo

read -r -p "Type BUILD-ANDROID-1.0 to start the production AAB build: " CONFIRM
if [[ "$CONFIRM" != "BUILD-ANDROID-1.0" ]]; then
  echo "Confirmation did not match. Aborting."
  exit 3
fi

eas whoami
eas build --platform android --profile production --message "BUKLOD 1.0 Android production release candidate"
