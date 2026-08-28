#!/usr/bin/env bash
set -euo pipefail

echo "BUKLOD — Submit Android Build to Google Play as DRAFT"
echo "===================================================="
echo
echo "This does not intentionally promote the build to public production."
echo "Select the exact approved/tested production build when EAS prompts you."
echo

read -r -p "Type PLAY-DRAFT to continue: " CONFIRM
if [[ "$CONFIRM" != "PLAY-DRAFT" ]]; then
  echo "Confirmation did not match. Aborting."
  exit 3
fi

eas submit --platform android --profile google-play-draft
