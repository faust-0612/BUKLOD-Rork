#!/usr/bin/env bash
set -euo pipefail

echo "BUKLOD 1.0 Production Build"
echo "==========================="

node scripts/production-preflight.mjs
npx expo-doctor@latest
npm test

echo
echo "Verify database tests separately against the approved schema:"
echo "  supabase test db"
echo

eas whoami
eas build --platform all --profile production --message "BUKLOD 1.0 production release candidate"
