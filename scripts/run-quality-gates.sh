#!/usr/bin/env bash
set -euo pipefail

echo "== BUKLOD Quality Gates =="
npx expo-doctor@latest
npm test
supabase test db
node scripts/release-gate.mjs
echo "All configured quality gates passed."
