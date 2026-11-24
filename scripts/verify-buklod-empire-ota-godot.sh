#!/usr/bin/env bash
set -euo pipefail
GODOT="$1"
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT
node scripts/prepare-buklod-empire-ota-fixture.mjs "$ROOT/project"
export XDG_DATA_HOME="$ROOT/userdata"
for phase in stage activate interrupt recover rollback verify-rollback; do
 timeout 45s "$GODOT" --headless --path "$ROOT/project" --script res://scripts/test.gd -- "$phase" 2>&1 | tee "$ROOT/$phase.log"
 grep -F "BUKLOD_EMPIRE_OTA_RUNTIME_TEST_PASS $phase" "$ROOT/$phase.log"
 if grep -E 'SCRIPT ERROR|Parse Error|Parser Error|EMPIRE_OTA_TEST_FAILED' "$ROOT/$phase.log"; then exit 1; fi
done
echo 'BUKLOD_EMPIRE_OTA_CRYPTO_MOUNT_RECOVERY_PASS'
