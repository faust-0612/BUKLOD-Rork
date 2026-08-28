#!/usr/bin/env bash
set -euo pipefail

echo "Deploying BUKLOD Edge Functions to the linked Supabase project..."
supabase functions deploy push
supabase functions deploy delete-account

echo
echo "Optional: if Expo enhanced push security is enabled, set EXPO_ACCESS_TOKEN:"
echo "  supabase secrets set EXPO_ACCESS_TOKEN=YOUR_VALUE"
echo
echo "Then configure the notifications INSERT database webhook to call the push function."
