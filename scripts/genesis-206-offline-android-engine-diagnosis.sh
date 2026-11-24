#!/usr/bin/env bash
# Disposable offline emulator only. Never use a physical/user device or MAIN.
set -euo pipefail
pkg=org.mzbministry.buklod.staging
activity="$pkg/expo.modules.buklodgenesisgodot.GenesisGodotActivity"
evidence="$PWD/android-godot-evidence"
mkdir -p "$evidence"
apk="$(find "$PWD/exact-apk" -name '*.apk' -type f -print -quit)"
test -f "$apk"
test "$(adb shell getprop ro.kernel.qemu | tr -d '\r')" = 1
adb root
adb wait-for-device
test "$(adb shell id -u | tr -d '\r')" = 0
adb install "$apk"
adb shell am force-stop "$pkg"
root="/data/user/0/$pkg"
owner="$(adb shell stat -c '%u:%g' "$root" | tr -d '\r')"
uid="$(echo "$owner" | cut -d: -f1)"
[[ "$uid" =~ ^[0-9]+$ ]] && test "$uid" -ge 10000
adb shell iptables -I OUTPUT -m owner --uid-owner "$uid" -j REJECT
adb shell ip6tables -I OUTPUT -m owner --uid-owner "$uid" -j REJECT
adb shell cmd connectivity airplane-mode enable || true
adb shell svc wifi disable || true
adb shell svc data disable || true
sha=4f05186a6ce4eb9955b02847a64cec4d595f39c9cb14700798fce26e22476d38
pack="$PWD/assets/season2/genesis/ota/empire-arena.zip"
echo "$sha  $pack" | sha256sum -c -
approved="$root/files/buklod-genesis-approved-packs/$sha.zip"
adb push "$pack" /data/local/tmp/buklod-verified-ota.zip
adb shell "mkdir -p '$root/files/buklod-genesis-approved-packs'; cp /data/local/tmp/buklod-verified-ota.zip '$approved'; chown '$owner' '$root/files' '$root/files/buklod-genesis-approved-packs' '$approved'; chmod 700 '$root/files' '$root/files/buklod-genesis-approved-packs'; chmod 600 '$approved'; restorecon -RF '$root/files'; rm /data/local/tmp/buklod-verified-ota.zip"
adb shell sha256sum "$approved" | tee "$evidence/staged-pack-sha.txt"
grep -F "$sha" "$evidence/staged-pack-sha.txt"
adb shell dumpsys package "$pkg" > "$evidence/package.txt"
failed=0
probe() {
  local label="$1"; shift
  adb shell am force-stop "$pkg"
  adb logcat -c
  adb shell am start -W -n "$activity" "$@" > "$evidence/$label-start.txt" 2>&1 || true
  sleep 25
  adb logcat -d -v threadtime > "$evidence/$label-logcat.txt"
  adb shell dumpsys activity activities > "$evidence/$label-activities.txt"
  adb shell dumpsys window > "$evidence/$label-window.txt"
  adb shell pidof "$pkg:genesis_godot" > "$evidence/$label-pid.txt" || true
  adb exec-out screencap -p > "$evidence/$label.png"
  timeout 15s adb shell uiautomator dump /data/local/tmp/buklod-ui.xml >/dev/null 2>&1 && adb pull /data/local/tmp/buklod-ui.xml "$evidence/$label-ui.xml" >/dev/null || true
  if grep -Ei 'Error type|Permission Denial|Exception|Status: timeout' "$evidence/$label-start.txt" ||
     grep -Ei 'Unable to setup the Godot engine|Cannot open resource pack|Couldn.t load project data|Failed to load main scene|SCRIPT ERROR|FATAL EXCEPTION|Fatal signal|Unable to start activity' "$evidence/$label-logcat.txt" ||
     test ! -s "$evidence/$label-pid.txt" ||
     ! grep -F "$activity" "$evidence/$label-activities.txt" ||
     { test -f "$evidence/$label-ui.xml" && grep -Ei 'Unable to setup the Godot engine|Aborting|isn.t responding' "$evidence/$label-ui.xml"; }; then
    echo "$label FAIL" | tee -a "$evidence/results.txt"
    failed=1
  else
    echo "$label NO_DETECTED_FATAL_VISUAL_REVIEW_REQUIRED" | tee -a "$evidence/results.txt"
  fi
  grep -Ei 'godot|resource pack|project data|fatal exception|fatal signal' "$evidence/$label-logcat.txt" | tail -65 || true
}
probe embedded_arena --ez buklod_native_arena true
probe ota_arena --es buklod_genesis_approved_pack "$approved" --es buklod_native_world arena
probe ota_kingdom --es buklod_genesis_approved_pack "$approved" --es buklod_native_world kingdom
probe ota_house --es buklod_genesis_approved_pack "$approved" --es buklod_native_world house
probe ota_community --es buklod_genesis_approved_pack "$approved" --es buklod_native_world community
adb shell am force-stop "$pkg"
cat "$evidence/results.txt"
exit "$failed"
