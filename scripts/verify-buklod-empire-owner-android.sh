#!/usr/bin/env bash
# Fresh disposable emulator. Never clear a member's app data.
set -euo pipefail
PKG=org.mzbministry.buklod.empire
APK=apps/buklod-empire/app/build/outputs/apk/release/app-release.apk
OUT=build/buklod-empire/remote-ota-qa
mkdir -p "$OUT"
adb install -r "$APK"
adb shell am force-stop com.android.launcher3 || true
adb shell am force-stop "$PKG"
adb logcat -c
adb shell am start -W -n "$PKG/.EmpireActivity"
wait_marker(){
 local marker="$1" log="$2"
 for i in $(seq 1 45); do
  adb logcat -d > "$OUT/$log.log"
  if grep -E 'FATAL EXCEPTION|SCRIPT ERROR|Parser Error|Program linking failed|Unable to setup the Godot engine' "$OUT/$log.log"; then return 1; fi
  if grep -F "$marker" "$OUT/$log.log"; then return 0; fi
  sleep 2
 done
 return 1
}
wait_marker 'BUKLOD_EMPIRE_OTA_STAGED 1' downloaded
if grep -F 'BUKLOD_EMPIRE_OTA_READY 1' "$OUT/downloaded.log"; then echo 'Premature hot activation'; exit 1; fi
adb shell am force-stop "$PKG"
adb logcat -c
adb shell am start -W -n "$PKG/.EmpireActivity"
wait_marker 'BUKLOD_EMPIRE_OTA_READY 1' active
grep -F 'BUKLOD_EMPIRE_OTA_MOUNTED 1' "$OUT/active.log"
adb exec-out screencap -p > "$OUT/active.png"
python3 scripts/verify-buklod-empire-frame.py "$OUT/active.png"
echo 'BUKLOD_EMPIRE_ANDROID_REMOTE_OTA_CANARY_PASS'
adb shell am force-stop "$PKG"
bash scripts/verify-buklod-empire-android.sh
