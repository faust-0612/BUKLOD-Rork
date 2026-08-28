#!/usr/bin/env bash
set -euo pipefail

APPLY="${1:-}"

echo "BUKLOD Production Database Cutover"
echo "=================================="
echo

node scripts/production-preflight.mjs
node scripts/verify-production-migrations.mjs > release/PRODUCTION_MIGRATION_HASHES.json

echo
echo "Running production migration dry-run..."
supabase db push --dry-run

if [[ "$APPLY" != "--apply" ]]; then
  echo
  echo "DRY RUN COMPLETE."
  echo "No production migration was applied."
  echo "After human review, run:"
  echo "  ./scripts/production-cutover.sh --apply"
  exit 0
fi

echo
read -r -p "Type BUKLOD-PRODUCTION to apply migrations: " CONFIRM
if [[ "$CONFIRM" != "BUKLOD-PRODUCTION" ]]; then
  echo "Confirmation did not match. Aborting."
  exit 3
fi

echo "Applying production migrations WITHOUT staging seed..."
supabase db push

echo
echo "Database migrations applied."
echo "Next: bootstrap/verify first System Admin, apply reviewed production baseline,"
echo "deploy Edge Functions, smoke test, then record Command Center decision."
