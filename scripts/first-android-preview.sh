#!/usr/bin/env bash
set -euo pipefail

echo "BUKLOD Android staging/preview build"
echo "===================================="
echo "Prerequisites:"
echo "  1. eas login"
echo "  2. eas init"
echo "  3. Preview EAS environment contains:"
echo "     EXPO_PUBLIC_SUPABASE_URL"
echo "     EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
echo "     EAS_PROJECT_ID (if not embedded by EAS linking)"
echo

eas whoami
node scripts/staging-gate.mjs
eas build --platform android --profile preview --message "BUKLOD staging pilot preview"
