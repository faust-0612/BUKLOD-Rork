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
bash scripts/resume-buklod-empire-owner-dev.sh
