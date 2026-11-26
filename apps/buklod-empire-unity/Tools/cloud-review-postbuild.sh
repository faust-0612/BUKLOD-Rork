#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
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
