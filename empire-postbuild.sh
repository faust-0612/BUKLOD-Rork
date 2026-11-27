#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for project in "$here" "$here/apps/buklod-empire-unity"; do
  if [[ -f "$project/ProjectSettings/ProjectVersion.txt" && -f "$project/Tools/cloud-review-postbuild.sh" ]]; then
    exec bash "$project/Tools/cloud-review-postbuild.sh"
  fi
done
echo "BUKLOD Empire project not found for postbuild" >&2
exit 1
