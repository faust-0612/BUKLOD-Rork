#!/usr/bin/env bash
set -euo pipefail

# BUKLOD Game Lab direct web deployment.
# Purpose: deploy without GitHub Actions from an authenticated Expo/EAS environment.
# Must be run from branch: feature/buklod-games-web-foundation

EXPECTED_BRANCH="feature/buklod-games-web-foundation"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"

if [ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]; then
  echo "ERROR: expected branch '$EXPECTED_BRANCH', got '${CURRENT_BRANCH:-unknown}'."
  exit 1
fi

if [ -z "${EXPO_TOKEN:-}" ]; then
  echo "ERROR: EXPO_TOKEN is required for non-interactive Expo Hosting deployment."
  exit 1
fi

if [ ! -f package.json ] || [ ! -f app.config.js ] || [ ! -f eas.json ]; then
  echo "ERROR: run this from the BUKLOD project root."
  exit 1
fi

export APP_VARIANT=production
export EXPO_PUBLIC_APP_ENV=production

npm ci --ignore-scripts
npx tsc --noEmit
rm -rf dist
npx expo export --platform web --output-dir dist
npx eas-cli@latest deploy --prod --non-interactive

echo "BUKLOD Game Lab web deployment command completed. Verify: https://buklod.expo.app/games"
