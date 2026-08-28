#!/usr/bin/env bash
set -euo pipefail

echo "BUKLOD — Configure EAS Production Environment"
echo "=============================================="
echo
echo "This script stores client-safe production values in EAS."
echo "It will NOT ask for or store a Supabase secret/service-role key."
echo

read -r -p "Production Supabase URL (https://...supabase.co): " SUPABASE_URL
read -r -p "Production Supabase publishable key (sb_publishable_...): " PUBLISHABLE_KEY
read -r -p "EAS Project ID (UUID): " EAS_PROJECT_ID_VALUE

if [[ ! "$SUPABASE_URL" =~ ^https://[a-zA-Z0-9-]+\.supabase\.co$ ]]; then
  echo "Invalid hosted Supabase URL."
  exit 2
fi

if [[ ! "$PUBLISHABLE_KEY" =~ ^sb_publishable_ ]]; then
  echo "Expected an sb_publishable_ key."
  exit 2
fi

if [[ "$PUBLISHABLE_KEY" =~ sb_secret_|service_role ]]; then
  echo "Refusing to store a secret/service-role key in the Expo client."
  exit 3
fi

eas whoami

eas env:set \
  --name EXPO_PUBLIC_SUPABASE_URL \
  --value "$SUPABASE_URL" \
  --environment production \
  --visibility plaintext

eas env:set \
  --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
  --value "$PUBLISHABLE_KEY" \
  --environment production \
  --visibility sensitive

eas env:set \
  --name EAS_PROJECT_ID \
  --value "$EAS_PROJECT_ID_VALUE" \
  --environment production \
  --visibility plaintext

echo
echo "Production EAS variables were created/updated."
echo "Verify them in the EAS project dashboard before building."
