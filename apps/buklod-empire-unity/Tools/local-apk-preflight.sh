#!/usr/bin/env bash
set -euo pipefail
project="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
editor="${UNITY_EDITOR:-}"
expected="6000.0.86f1"
if [[ -z "$editor" || ! -x "$editor" ]]; then
  echo "BLOCKED: Set UNITY_EDITOR to the executable of Unity $expected with Android Build Support." >&2
  exit 2
fi
if ! grep -Fxq "m_EditorVersion: $expected" "$project/ProjectSettings/ProjectVersion.txt"; then
  echo "BLOCKED: Project editor pin does not match $expected." >&2
  exit 2
fi
version="$("$editor" -version 2>&1)"
if [[ "$version" != *"$expected"* ]]; then echo "BLOCKED: wrong Unity editor: $version" >&2; exit 2; fi
if [[ ! -f "$project/Assets/Production/VisualCatalog.asset" ]]; then
  echo "BLOCKED: approved production visual catalog missing; no placeholder or review bypass." >&2
  exit 3
fi
out="${BUKLOD_PREFLIGHT_OUTPUT:-$(mktemp -d)}"
mkdir -p "$out"
for mode in EditMode PlayMode; do
  "$editor" -batchmode -projectPath "$project" -runTests -testPlatform "$mode" -testResults "$out/$mode.xml" -logFile "$out/$mode.log"
  python3 - "$out/$mode.xml" <<'PY'
import sys,xml.etree.ElementTree as ET
root=ET.parse(sys.argv[1]).getroot()
if root.attrib.get("result") != "Passed" or int(root.attrib.get("total","0")) <= 0 or int(root.attrib.get("failed","0")) != 0:
    raise SystemExit("BLOCKED: Unity test results are not a nonempty pass")
PY
done
echo "Unity test runs passed; actual scene assembly, asset approval, Android configuration and device acceptance remain mandatory. No APK built."
