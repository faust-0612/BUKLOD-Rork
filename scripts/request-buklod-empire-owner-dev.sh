#!/usr/bin/env bash
# One-time owner-controlled provisioning, canary and protected build request.
# Requires a trusted Linux terminal, authenticated GitHub owner CLI, and
# BUKLOD_EMPIRE_STORAGE_SERVICE_KEY in the environment. Never paste secrets into chat.
set -euo pipefail
umask 077
REPO=faust-0612/BUKLOD-Rork
BRANCH=dev/buklod-empire-standalone-native-20261124
ENVIRONMENT=buklod-empire-dev
KEYDIR="${BUKLOD_EMPIRE_KEYDIR:-$HOME/.local/share/buklod-empire/dev-keys}"
test "$(git branch --show-current)" = "$BRANCH"
test -z "$(git status --porcelain --untracked-files=no)" || { echo 'Tracked working tree must be clean'; exit 1; }
test -n "${BUKLOD_EMPIRE_STORAGE_SERVICE_KEY:-}"
gh auth status >/dev/null
# Existing protected environment is required; refuse to expose signing secrets on other branches.
gh api "repos/$REPO/environments/$ENVIRONMENT" --jq '.deployment_branch_policy.custom_branch_policies' | grep -Fx true
gh api "repos/$REPO/environments/$ENVIRONMENT/deployment-branch-policies" --jq '.branch_policies[].name' | grep -Fx "$BRANCH"
test "$(gh api "repos/$REPO/environments/$ENVIRONMENT/deployment-branch-policies" --jq '.total_count')" = 1
bash scripts/setup-buklod-empire-dev-trust.sh
export BUKLOD_GENESIS_PREMIUM_3D=true BUKLOD_EMPIRE_OTA_CHANNEL=dev BUKLOD_EMPIRE_REQUIRE_RELEASE_SIGNING=true
export BUKLOD_EMPIRE_OTA_PUBLIC_KEY="$(cat "$KEYDIR/ota-public.pem")"
export BUKLOD_EMPIRE_OTA_PRIVATE_KEY_FILE="$KEYDIR/ota-private.pem"
node scripts/genesis-import-verified-3d.mjs
node scripts/build-buklod-empire-standalone.mjs
BASELINE=build/buklod-empire/ota-baseline.json
# Baseline is deterministic and does not include generated public key config.
# If the exact canary already exists, verify it rather than replace it.
if ! node scripts/verify-buklod-empire-public-canary.mjs; then
 TMP="$(mktemp -d)"
 trap 'rm -rf "$TMP"' EXIT
 cp -a apps/buklod-empire/app/src/main/assets/. "$TMP/"
 mkdir -p "$TMP/data"
 node --input-type=module - "$BASELINE" "$TMP/data/ota_canary.json" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const base=JSON.parse(readFileSync(process.argv[2]));
writeFileSync(process.argv[3],JSON.stringify({kind:'BUKLOD_EMPIRE_DEV_OTA_CANARY',base:base.base})+'\n');
JS
 node scripts/build-buklod-empire-ota.mjs "$BASELINE" "$TMP" 1 "$TMP-signed"
 node scripts/buklod-empire-storage.mjs publish-dev "$BASELINE" "$TMP-signed"
 rm -rf "$TMP-signed"
 node scripts/verify-buklod-empire-public-canary.mjs
fi
unset BUKLOD_EMPIRE_STORAGE_SERVICE_KEY BUKLOD_EMPIRE_OTA_PRIVATE_KEY_FILE
# Only the nonsecret request file is committed. Restore the empty tracked asset placeholder.
git restore -- apps/buklod-empire/app/src/main/assets/.gitkeep
mkdir -p .buklod/requests
REQUEST=.buklod/requests/buklod-empire-owner-signed-dev.json
node --input-type=module - "$REQUEST" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const receipt=JSON.parse(readFileSync('build/buklod-empire/remote-canary.json'));
writeFileSync(process.argv[2],JSON.stringify({...receipt,requestedAt:new Date().toISOString()},null,2)+'\n');
JS
git add -- "$REQUEST"
test "$(git diff --cached --name-only)" = "$REQUEST"
git commit -m "Request protected BUKLOD Empire owner-signed DEV build"
git push origin "HEAD:refs/heads/$BRANCH"
echo 'Protected owner-signed APK build requested. Do not distribute QA-only APKs.'
