#!/usr/bin/env bash
set -euo pipefail

echo "BUKLOD — Release Android Build to Google Play INTERNAL TESTING"
echo "============================================================="
echo
echo "This profile uses track=internal and releaseStatus=completed."
echo "Only continue when the internal tester list and Play Console setup are ready."
echo

read -r -p "Type PLAY-INTERNAL-RELEASE to continue: " CONFIRM
if [[ "$CONFIRM" != "PLAY-INTERNAL-RELEASE" ]]; then
  echo "Confirmation did not match. Aborting."
  exit 3
fi

eas submit --platform android --profile google-play-internal
