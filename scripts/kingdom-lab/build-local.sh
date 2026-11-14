#!/usr/bin/env bash
# Never runs in current BUKLOD staging/prod; requires isolated creds/branch.
set -euo pipefail
cd "$(dirname "$0")/../.."
export BUKLOD_APP_TARGET=kingdom-native-lab
export APP_VARIANT=staging
export EXPO_PUBLIC_APP_ENV=staging
export EXPO_PUBLIC_KINGDOM_NATIVE_LAB=1
export KINGDOM_LAB_GOOGLE_SERVICES_FILE=./google-services.kingdomlab.offline.json
node scripts/kingdom-lab/make-offline-firebase.cjs
node scripts/kingdom-lab/preflight.cjs --build
test -d node_modules || { echo "Install this repo's locked dependencies locally first."; exit 12; }
command -v java >/dev/null || { echo "Java SDK not found."; exit 13; }
test -n "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" || { echo "Android SDK path missing."; exit 14; }
# Prefer Gradle's normal dependency cache. No EAS or GitHub cloud builds.
npx expo prebuild --platform android --clean --no-install
cd android
./gradlew --no-daemon :app:assembleDebug
apk="app/build/outputs/apk/debug/app-debug.apk"
test -s "$apk"
echo "EXPERIMENTAL APK: $(pwd)/$apk"
echo "Exact package: org.mzbministry.buklod.kingdomlab"
echo "Do not install this as staging-user or Play production."
