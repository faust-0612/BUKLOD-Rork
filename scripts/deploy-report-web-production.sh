#!/usr/bin/env bash
set -euo pipefail

echo "BUKLOD Report — Web Production Release"
echo "======================================"

export BUKLOD_APP_TARGET="report"
export EXPO_PUBLIC_APP_ENV="production"
export REPORT_RELEASE_TARGET="web"

node scripts/production-preflight.mjs
node scripts/verify-production-migrations.mjs > release/PRODUCTION_MIGRATION_HASHES.json

# Compile and export first. Deployment is allowed only from this exact output.
npx tsc --noEmit
rm -rf dist-report-production
npx expo export --platform web --output-dir dist-report-production

echo
echo "Static export passed. EAS Hosting will use the dedicated BUKLOD Report project."
echo "No BUKLOD Main deployment or route is touched by this script."
echo

read -r -p "Type DEPLOY-BUKLOD-REPORT-WEB to publish the standalone Report web app: " CONFIRM
if [[ "$CONFIRM" != "DEPLOY-BUKLOD-REPORT-WEB" ]]; then
  echo "Confirmation did not match. Aborting before deployment."
  exit 3
fi

eas whoami
eas deploy --prod --environment production --export-dir dist-report-production
