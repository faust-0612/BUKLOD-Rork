#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
# Failed attempts have no APK to verify. Preserve the runner's existing failure.
case "${BUILD_RESULT:-}" in
  FAILURE|FAILED|failure|failed|ABORTED|aborted|CANCELLED|cancelled) echo "No artifact verification: upstream build failed"; exit 0;;
esac
echo "BUKLOD REVIEW POSTBUILD START"
test "${BUKLOD_EMPIRE_CLOUD_REVIEW:-}" = 1
test -n "${UNITY_PLAYER_PATH:-}"
test -n "${ANDROID_HOME:-}"
test -n "${PYTHON:-}"
player="$UNITY_PLAYER_PATH"
sdk="$ANDROID_HOME"
if [[ "${BUILDER_OS:-}" == WINDOWS ]]; then
  player="$(cygpath -am "$player")"
  sdk="$(cygpath -am "$sdk")"
fi
"$PYTHON" Tools/verify-cloud-review.py "$player" "$sdk"
echo "BUKLOD REVIEW POSTBUILD COMPLETE"
