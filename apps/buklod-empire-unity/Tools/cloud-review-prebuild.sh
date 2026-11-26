#!/usr/bin/env bash
set -euo pipefail
# Unity Build Automation invokes this after checkout, before the editor starts.
# The target is isolated; no publishing, no store credentials.
cd "$(dirname "${BASH_SOURCE[0]}")/.."
test -f ProjectSettings/ProjectVersion.txt
tr -d '\r' < ProjectSettings/ProjectVersion.txt | grep -Fx 'm_EditorVersion: 6000.0.86f1'
test -n "${DEVOPS_ENV:-}"
node -e 'if(Number(process.versions.node.split(".")[0])<18)throw Error("Node 18+ required")'
py=""
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; assert (3,10) <= sys.version_info[:2] <= (3,13)' >/dev/null 2>&1; then py="$candidate"; break; fi
done
test -n "$py"
# Use a native executable path so Node can spawn it on Windows.
export PYTHON="$("$py" -c 'import sys; print(sys.executable)' | tr -d '\r')"
export PYTHONOPTIMIZE=""
if ! "$py" -c 'import numpy, PIL'; then
  "$py" -m venv Tools/ReviewOutput/cloud-python
  if [[ "${BUILDER_OS:-}" == WINDOWS ]]; then
    export PYTHON="$(cygpath -am Tools/ReviewOutput/cloud-python/Scripts/python.exe)"
  else
    export PYTHON="$PWD/Tools/ReviewOutput/cloud-python/bin/python"
  fi
  "$PYTHON" -m pip install --disable-pip-version-check --only-binary=:all: 'numpy==2.2.6' 'Pillow==11.3.0'
fi
node Tools/run-offline-test-build.mjs --prepare
printf '%s\n' 'BUKLOD_EMPIRE_CLOUD_REVIEW=1' >> "$DEVOPS_ENV"
printf 'PYTHON=%s\n' "$PYTHON" >> "$DEVOPS_ENV"
