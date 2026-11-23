#!/usr/bin/env bash
# REAL Godot 4.7.2 PCK export from canonical offline Arena ZIP source.
# DEV only. No APK, publishing, server economy or external game assets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GODOT=godot
if [ -n "$(printenv GODOT_BIN || true)" ]; then GODOT="$(printenv GODOT_BIN)"; fi
command -v "$GODOT" >/dev/null || { echo 'Godot 4.7.2 editor unavailable' >&2; exit 3; }
for cmd in node unzip python3 sha256sum; do
  command -v "$cmd" >/dev/null || { echo "Missing required local tool: $cmd" >&2; exit 3; }
done
"$GODOT" --version | grep -F '4.7.2' >/dev/null ||
  { echo 'Wrong Godot editor version; require exactly 4.7.2' >&2; exit 3; }

DEST="$ROOT/native-genesis/android/app/src/main/assets/godot"
# Stale pack/hash must never survive a failed new export and be mistaken for current.
mkdir -p "$DEST"
rm -f "$DEST/empire-arena.pck" "$DEST/empire-arena.sha256"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/project"
node "$ROOT/scripts/build-empire-godot-pack.mjs" --out="$TMP/source.zip"
unzip -q "$TMP/source.zip" -d "$TMP/project"
test -s "$TMP/project/project.godot"
test -s "$TMP/project/scenes/Arena.tscn"
test -s "$TMP/project/scenes/WorldPreview.tscn"
cp "$ROOT/native-genesis/godot-export-presets.cfg" "$TMP/project/export_presets.cfg"

bounded() {
  if command -v timeout >/dev/null; then timeout 180s "$@"; else "$@"; fi
}
check_log() {
  if grep -Ei 'SCRIPT ERROR|Parse Error|Parser Error|Failed to load script|ERROR:' "$1"; then
    echo "Godot emitted a fatal error in $1" >&2
    exit 1
  fi
}
if ! bounded "$GODOT" --headless --path "$TMP/project" --import > "$TMP/import.log" 2>&1; then
  cat "$TMP/import.log"; exit 1
fi
check_log "$TMP/import.log"
if ! bounded "$GODOT" --headless --path "$TMP/project" --export-pack "BUKLOD Native Pack" "$TMP/empire-arena.pck" > "$TMP/export.log" 2>&1; then
  cat "$TMP/export.log"; exit 1
fi
check_log "$TMP/export.log"
python3 - "$TMP/empire-arena.pck" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
assert p.is_file() and p.stat().st_size > 1024 * 1024, "Godot emitted no usable native PCK"
assert p.open("rb").read(4) == b"GDPC", "Not a native Godot PCK; ZIP cannot be renamed"
print("GENESIS_GODOT_REAL_PCK_HEADER_PASS", p.stat().st_size)
PY
if ! bounded "$GODOT" --headless --main-pack "$TMP/empire-arena.pck" --quit-after 15 > "$TMP/arena.log" 2>&1; then
  cat "$TMP/arena.log"; exit 1
fi
check_log "$TMP/arena.log"
grep -F 'BUKLOD_GODOT_ARENA_SCENE_READY' "$TMP/arena.log"
for target in "smoke.gd|BUKLOD_GODOT_SMOKE_PASS" "world_smoke.gd|BUKLOD_GENESIS_GODOT_WORLDS_PASS"; do
  script="$(printf '%s' "$target" | cut -d'|' -f1)"
  sentinel="$(printf '%s' "$target" | cut -d'|' -f2)"
  if ! bounded "$GODOT" --headless --main-pack "$TMP/empire-arena.pck" --script "res://tests/$script" > "$TMP/$script.log" 2>&1; then
    cat "$TMP/$script.log"; exit 1
  fi
  check_log "$TMP/$script.log"
  grep -F "$sentinel" "$TMP/$script.log"
done
cp "$TMP/empire-arena.pck" "$DEST/empire-arena.pck"
sha256sum "$DEST/empire-arena.pck" | awk '{print $1}' > "$DEST/empire-arena.sha256"
python3 - "$DEST" <<'PY'
from pathlib import Path
import hashlib
import sys
d = Path(sys.argv[1])
p = d / "empire-arena.pck"
recorded = (d / "empire-arena.sha256").read_text().strip()
assert hashlib.sha256(p.read_bytes()).hexdigest() == recorded
print("BUKLOD_GODOT_DEV_PCK_READY", recorded, p.stat().st_size)
PY
echo 'DEV Godot PCK and four-world smoke passed; NOT full Kingdom/BUKLOD functionality.'
