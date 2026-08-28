#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <SUPABASE_STAGING_PROJECT_REF>"
  exit 2
fi

PROJECT_REF="$1"

echo "Logging into Supabase CLI..."
supabase login

echo "Linking this repository to staging project: ${PROJECT_REF}"
supabase link --project-ref "${PROJECT_REF}"

echo "Remote migration preview:"
supabase db push --dry-run

echo
echo "Review the dry-run output above."
echo "To apply the fresh staging schema + safe starter seed, run:"
echo "  supabase db push --include-seed"
