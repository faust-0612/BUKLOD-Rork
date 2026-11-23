#!/usr/bin/env bash
# Developer-only local pack export. Requires genuine Godot project and export preset.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="$ROOT/godot/empire-arena"
DEST="$ROOT/native-genesis/android/app/src/main/assets/godot"
command -v godot >/dev/null || { echo 'Godot command not installed' >&2; exit 3; }
[ -f "$PROJECT/project.godot" ] || { echo 'Godot source project missing' >&2; exit 3; }
[ -f "$PROJECT/export_presets.cfg" ] || { echo 'Approved Android pack export preset missing' >&2; exit 3; }
mkdir -p "$DEST"
godot --headless --path "$PROJECT" --editor --quit
godot --headless --path "$PROJECT" --export-pack Android "$DEST/empire-arena.pck"
[ -s "$DEST/empire-arena.pck" ] || { echo 'No real PCK output' >&2; exit 1; }
sha256sum "$DEST/empire-arena.pck" | awk '{print $1}' > "$DEST/empire-arena.sha256"
echo 'DEV Godot pack prepared; game acceptance not implied.'
