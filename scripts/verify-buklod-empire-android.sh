#!/usr/bin/env bash
set -euo pipefail
PKG=org.mzbministry.buklod.empire
APK=apps/buklod-empire/app/build/outputs/apk/release/app-release.apk
OUT=build/buklod-empire/android-qa
mkdir -p "$OUT"
adb install -r "$APK"
adb shell input keyevent 82 || true
adb logcat -c
adb shell am start -W -n "$PKG/.EmpireActivity"
wait_marker() {
 local marker="$1" file="$2"
 for i in $(seq 1 30); do
  adb logcat -d > "$OUT/$file.log"
  if grep -E 'Unable to setup the Godot engine|Unable to complete engine setup|FATAL EXCEPTION|SCRIPT ERROR|Parser Error|Program linking failed|Fragment shader active uniforms exceed|shader failed to compile|EMPIRE_SCENE_LOAD_FAILED|EMPIRE_WORLD_VISUAL_FAILED' "$OUT/$file.log"; then return 1; fi
  if grep -F "$marker" "$OUT/$file.log"; then
   # Engine receipts alone can be green while the display is entirely gray.
   for render_attempt in $(seq 1 6); do
    adb exec-out screencap -p > "$OUT/$file.png"
    if python3 scripts/verify-buklod-empire-frame.py "$OUT/$file.png"; then
     adb logcat -d > "$OUT/$file.log"
     if grep -E 'Program linking failed|Fragment shader active uniforms exceed|shader failed to compile|SCRIPT ERROR|FATAL EXCEPTION' "$OUT/$file.log"; then return 1; fi
     return 0
    fi
    sleep 1
   done
   return 1
  fi
  sleep 2
 done
 adb exec-out screencap -p > "$OUT/$file.png"
 return 1
}
wait_marker 'BUKLOD_EMPIRE_MENU_RENDERED' menu
# Test actual buttons via landscape coordinates, scaled from real display.
tap_fraction() {
 local fx="$1" fy="$2"
 local xy
 xy="$(adb shell wm size | tail -1 | tr -d '\r' | grep -oE '[0-9]+x[0-9]+')"
 python3 - "$xy" "$fx" "$fy" <<'PY'
import sys,subprocess
a,b=map(int,sys.argv[1].split('x'))
w,h=max(a,b),min(a,b)
subprocess.check_call(['adb','shell','input','tap',str(int(w*float(sys.argv[2]))),str(int(h*float(sys.argv[3])))])
PY
}
for item in 'kingdom 0.25 0.33' 'arena 0.75 0.33' 'house 0.25 0.70' 'community 0.75 0.70'; do
 read -r world x y <<< "$item"
 adb logcat -c
 tap_fraction "$x" "$y"
 wait_marker "BUKLOD_EMPIRE_WORLD_RENDERED: $world" "$world"
 if [ "$world" = arena ]; then
  tap_fraction 0.50 0.70
  wait_marker 'BUKLOD_EMPIRE_OFFLINE_BATTLE_STARTED' arena-battle
 fi
 adb logcat -c
 adb shell input keyevent 4
 wait_marker 'BUKLOD_EMPIRE_MENU_RENDERED' "return-$world"
done
echo 'BUKLOD_EMPIRE_ANDROID_QA_PASS'
