#!/usr/bin/env bash
set -euo pipefail
PKG=org.mzbministry.buklod.godotqa
APK=tests/android-godot-bootstrap/app/build/outputs/apk/release/app-release.apk
EVIDENCE=build/genesis-207-android-qa
mkdir -p "$EVIDENCE"
DIGEST="$(sha256sum tests/android-godot-bootstrap/app/src/main/assets/qa-content.zip | cut -d' ' -f1)"
adb install -r "$APK"
adb shell input keyevent 82 || true
verify_world() {
  local world="$1" source="$2" expected="$3" expected_state="$4" label="$5"
  adb shell am force-stop "$PKG"
  adb logcat -c
  adb shell am start -W -n "$PKG/expo.modules.buklodgenesisgodot.QaLaunchActivity" --es world "$world" --es source "$source"
  local passed=0
  for i in $(seq 1 30); do
    adb logcat -d > "$EVIDENCE/$label.log"
    if python3 - "$EVIDENCE/$label.log" "$world" "$expected" "$expected_state" "$source" <<'PY'
import sys,json
file,world,pack,state,source=sys.argv[1:]
for line in open(file,errors='replace'):
    if 'BUKLOD_NATIVE_BOOTSTRAP {' not in line: continue
    try: r=json.loads(line.split('BUKLOD_NATIVE_BOOTSTRAP ',1)[1].strip())
    except ValueError: continue
    if r.get('state')==state and r.get('world')==world and r.get('pack')==pack:
        if source=='ota' and r.get('public3d') is not True: continue
        if source=='embedded' and r.get('public3d') is not False: continue
        print('ANDROID_SCENE_RECEIPT',json.dumps(r));sys.exit(0)
sys.exit(1)
PY
    then passed=1; break; fi
    if grep -E 'Unable to setup the Godot engine|Unable to complete engine setup|FATAL EXCEPTION|--main-pack is attempting|SCRIPT ERROR|Parse Error|Parser Error' "$EVIDENCE/$label.log"; then return 1; fi
    sleep 2
  done
  adb exec-out screencap -p > "$EVIDENCE/$label.png"
  test "$passed" = 1
  if grep -E 'Unable to setup the Godot engine|Unable to complete engine setup|FATAL EXCEPTION|SCRIPT ERROR|Parse Error|Parser Error' "$EVIDENCE/$label.log"; then return 1; fi
}
verify_world arena embedded embedded ready embedded-arena
for world in arena kingdom community house; do
 verify_world "$world" ota "$DIGEST" ready "ota-$world"
done
verify_world arena ota "$DIGEST" ready ota-arena-repeat
verify_world kingdom rejected embedded failed rejected-content
echo 'BUKLOD_GENESIS_207_ANDROID_BOOTSTRAP_GATE_PASS'
