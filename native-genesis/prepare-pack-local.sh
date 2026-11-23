#!/usr/bin/env bash
# Original Arena 13-hero, 68-art, 70-audio ZIP pack; never rename ZIP as PCK.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/native-genesis/android/app/src/main/assets/godot"
mkdir -p "$DEST"
command -v node >/dev/null || { echo "Node 22 missing" >&2; exit 3; }
node "$ROOT/scripts/build-empire-godot-pack.mjs" --out="$DEST/empire-arena.zip"
test -s "$DEST/empire-arena.zip"
unzip -t "$DEST/empire-arena.zip" >/dev/null
for entry in project.godot scenes/Arena.tscn scenes/WorldPreview.tscn scripts/world_preview.gd art/fullbody/phan_idle.png; do
  unzip -Z -1 "$DEST/empire-arena.zip" | grep -Fx "$entry" >/dev/null || {
    echo "Godot game pack entry missing: $entry" >&2; exit 3; }
done
sha256sum "$DEST/empire-arena.zip" | awk '{print $1}' > "$DEST/empire-arena.sha256"
echo 'Original Arena art/SFX packed, world-DEV pack ready. Full app parity NOT claimed.'
