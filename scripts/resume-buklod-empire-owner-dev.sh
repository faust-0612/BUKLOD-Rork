#!/usr/bin/env bash
# Resume only the failed canary publication. Preserve the already provisioned
# owner keys, generated APK baseline and all unrelated local files.
set -euo pipefail
umask 077
BRANCH=dev/buklod-empire-standalone-native-20261124
KEYDIR="${BUKLOD_EMPIRE_KEYDIR:-$HOME/.local/share/buklod-empire/dev-keys}"
ASSETS=apps/buklod-empire/app/src/main/assets
BASELINE=build/buklod-empire/ota-baseline.json
test "$(git branch --show-current)" = "$BRANCH"
test -n "${BUKLOD_EMPIRE_STORAGE_SERVICE_KEY:-}"
test -s "$KEYDIR/ota-private.pem"
test -s "$KEYDIR/ota-public.pem"
test -s "$BASELINE"
test -s "$ASSETS/empire-ota/config.json"
# Refuse staged changes or changes to tracked files other than the known
# generated asset placeholder. Do not stage the generated game assets.
test -z "$(git diff --cached --name-only)" || { echo 'Existing staged changes; refusing release request'; exit 1; }
other="$(git diff --name-only | grep -vFx "$ASSETS/.gitkeep" || true)"
test -z "$other" || { echo 'Unrelated tracked changes; refusing release request'; exit 1; }
export BUKLOD_EMPIRE_OTA_PUBLIC_KEY="$(cat "$KEYDIR/ota-public.pem")"
export BUKLOD_EMPIRE_OTA_PRIVATE_KEY_FILE="$KEYDIR/ota-private.pem"
node --input-type=module - "$BASELINE" "$ASSETS" <<'JS'
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash,createPublicKey} from 'node:crypto';
import path from 'node:path';
const base=JSON.parse(readFileSync(process.argv[2]));
const root=process.argv[3];
const cfg=JSON.parse(readFileSync(path.join(root,'empire-ota/config.json')));
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(base.channel,'dev');assert.equal(cfg.channel,'dev');assert.equal(base.runtime,cfg.runtime);assert.equal(base.base,cfg.base);
assert.equal(hash(JSON.stringify(base.inventory)),base.base);
assert.equal(hash(createPublicKey(cfg.key).export({type:'spki',format:'der'})),base.keyFingerprint);
assert.equal(hash(createPublicKey(process.env.BUKLOD_EMPIRE_OTA_PUBLIC_KEY).export({type:'spki',format:'der'})),base.keyFingerprint);
const current={};
function walk(dir){for(const n of readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,n.name);assert.ok(!n.isSymbolicLink());if(n.isDirectory())walk(f);else{const p=path.relative(root,f).split(path.sep).join('/');if(p==='empire-ota/config.json'||p==='.gitkeep')continue;current[p]=hash(readFileSync(f));}}}
walk(root);
assert.deepEqual(current,base.inventory);
console.log('EXISTING_OWNER_TRUST_AND_ASSET_BASELINE_VERIFIED');
JS
if ! node scripts/verify-buklod-empire-public-canary.mjs; then
 TMP="$(mktemp -d)"
 trap 'rm -rf "$TMP"' EXIT
 mkdir -p "$TMP/assets" "$TMP/signed"
 cp -a "$ASSETS/." "$TMP/assets/"
 rm -f "$TMP/assets/.gitkeep"
 mkdir -p "$TMP/assets/data"
 node --input-type=module - "$BASELINE" "$TMP/assets/data/ota_canary.json" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const base=JSON.parse(readFileSync(process.argv[2]));
writeFileSync(process.argv[3],JSON.stringify({kind:'BUKLOD_EMPIRE_DEV_OTA_CANARY',base:base.base})+'\n');
JS
 node scripts/build-buklod-empire-ota.mjs "$BASELINE" "$TMP/assets" 1 "$TMP/signed"
 node scripts/buklod-empire-storage.mjs publish-dev "$BASELINE" "$TMP/signed"
 node scripts/verify-buklod-empire-public-canary.mjs
fi
unset BUKLOD_EMPIRE_STORAGE_SERVICE_KEY BUKLOD_EMPIRE_OTA_PRIVATE_KEY_FILE
git restore -- "$ASSETS/.gitkeep"
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
