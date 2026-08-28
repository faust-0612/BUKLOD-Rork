#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <PRODUCTION_SUPABASE_PROJECT_REF>"
  exit 2
fi

PROJECT_REF="$1"

echo "BUKLOD — Link Production Supabase"
echo "================================="
echo
echo "Target project ref: ${PROJECT_REF}"
echo "This helper will LINK and DRY-RUN only. It will not apply migrations."
echo

read -r -p "Type LINK-PRODUCTION to continue: " CONFIRM
if [[ "$CONFIRM" != "LINK-PRODUCTION" ]]; then
  echo "Confirmation did not match. Aborting."
  exit 3
fi

supabase login
supabase link --project-ref "$PROJECT_REF"

echo
echo "Linked project. Running migration dry-run..."
supabase db push --dry-run

echo
echo "STOP HERE and review the output."
echo "Use scripts/production-cutover.sh --apply only after production preflight and human review."
