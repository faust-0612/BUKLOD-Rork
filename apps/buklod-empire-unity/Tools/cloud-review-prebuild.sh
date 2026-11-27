#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
echo "BUKLOD REVIEW PREBUILD START"
test -f ProjectSettings/ProjectVersion.txt
tr -d '\r' < ProjectSettings/ProjectVersion.txt | grep -Fx 'm_EditorVersion: 6000.3.29f1'
test -n "${DEVOPS_ENV:-}"
node -e 'if(Number(process.versions.node.split(".")[0])<18)throw Error("Node 18+ required"); if(process.env.BUILDER_OS==="WINDOWS" && process.platform!=="win32")throw Error("Native Windows Node required")'
# Select Python that Node can execute directly, not the Cygwin Python shim.
pycheck='import os,sys; assert (3,10)<=sys.version_info[:2]<=(3,13); assert os.environ.get("BUILDER_OS")!="WINDOWS" or os.name=="nt"; print(sys.executable)'
py=""
for candidate in python3 python py; do
  if command -v "$candidate" >/dev/null 2>&1; then
    if [[ "$candidate" == py ]]; then
      py="$("$candidate" -3 -c "$pycheck" 2>/dev/null | tr -d '\r')" || py=""
    else
      py="$("$candidate" -c "$pycheck" 2>/dev/null | tr -d '\r')" || py=""
    fi
    [[ -z "$py" ]] || break
  fi
done
test -n "$py" || { echo "Native Python 3.10-3.13 not found" >&2; exit 1; }
if [[ "${BUILDER_OS:-}" == WINDOWS ]]; then py="$(cygpath -am "$py")"; fi
export PYTHON="$py" PYTHONOPTIMIZE=""
if ! "$PYTHON" -c 'import numpy, PIL'; then
  "$PYTHON" -m venv Tools/ReviewOutput/cloud-python
  if [[ "${BUILDER_OS:-}" == WINDOWS ]]; then
    export PYTHON="$(cygpath -am Tools/ReviewOutput/cloud-python/Scripts/python.exe)"
  else
    export PYTHON="$PWD/Tools/ReviewOutput/cloud-python/bin/python"
  fi
  "$PYTHON" -m pip install --disable-pip-version-check --only-binary=:all: --retries 2 --timeout 30 'numpy==2.2.6' 'Pillow==11.3.0'
fi
node -e 'const r=require("child_process").spawnSync(process.env.PYTHON,["-c","import numpy,PIL"],{stdio:"inherit"});if(r.error||r.status!==0)throw Error("Node/Python preflight failed")'
node Tools/run-offline-test-build.mjs --prepare
test -s Tools/ReviewOutput/offline-preparation.json
printf '%s\n' 'BUKLOD_EMPIRE_CLOUD_REVIEW=1' >> "$DEVOPS_ENV"
printf 'PYTHON=%s\n' "$PYTHON" >> "$DEVOPS_ENV"
echo "BUKLOD REVIEW PREBUILD COMPLETE"
