#!/usr/bin/env bash
# No publishing. Requires full parity, real approved assets and owner signing credentials.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
command -v node >/dev/null || { echo 'Node missing' >&2; exit 3; }
command -v godot >/dev/null || { echo 'Local Godot binary missing' >&2; exit 3; }
[ -n "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ] || { echo 'Local Android SDK missing' >&2; exit 3; }
[ -f native-genesis/android/gradle/wrapper/gradle-wrapper.jar ] || { echo 'Gradle wrapper JAR missing; generate with trusted local Gradle distribution' >&2; exit 3; }
[ -x native-genesis/android/gradlew ] || { echo 'gradlew missing' >&2; exit 3; }
[ -f native-genesis/android/app/src/main/assets/godot/empire-arena.zip ] || { echo 'Approved Godot pack missing' >&2; exit 3; }
[ -f native-genesis/android/app/src/main/assets/godot/empire-arena.sha256 ] || { echo 'Godot pack hash missing' >&2; exit 3; }
for variable in GENESIS_NATIVE_KEYSTORE_PATH GENESIS_NATIVE_KEYSTORE_PASSWORD GENESIS_NATIVE_KEY_ALIAS GENESIS_NATIVE_KEY_PASSWORD GENESIS_NATIVE_SIGNING_CERT_SHA256; do
  [ -n "${!variable:-}" ] || { echo "Local owner-signing variable missing: $variable" >&2; exit 3; }
done
node scripts/genesis-native-local-only-gate.mjs
(
 cd native-genesis/android
 ./gradlew --no-daemon :app:assembleRelease
)
node scripts/genesis-native-local-only-gate.mjs --apk="$(pwd)/native-genesis/android/app/build/outputs/apk/release/app-release.apk"
