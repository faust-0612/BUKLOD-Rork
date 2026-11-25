#!/usr/bin/env bash
# Local QA only. This file never calls EAS update, git push, or any backend migration.
set -euo pipefail
umask 077
MODE="${1:---qa}"
case "$MODE" in --qa|--export) ;; *) echo "Usage: bash local-genesis-206-staging-qa.sh [--qa|--export]" >&2; exit 2;; esac
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
export GITHUB_SHA=71e33b4cfa202a6e02bfb479b89504e7729b363e
export KINGDOM_SHA=72142b14fb4e2274945cf3b0f2c35c3527017c60
export BASE_SHA=27bad448a4b205edfe5bfe0b6a428b0d3059dab6
export PRIOR_GROUP=cc65a12a-3e1b-45fa-aa6a-1e2ed27f0f31
test "$(git rev-parse HEAD)" = "$GITHUB_SHA"
test -z "$(git status --porcelain)"
test "$(node -p "process.versions.node.split('.')[0]")" = 22
for cmd in git node npm npx python3 curl unzip sha256sum; do command -v "$cmd" >/dev/null; done
export EVIDENCE="$(mktemp -d)"
export EXPORT="$EVIDENCE/export"
trap 'rm -f "$EVIDENCE/preview.env"' EXIT
echo "Evidence directory: $EVIDENCE"
export CI='1'
export EXPO_NO_TELEMETRY='1'
export APP_VARIANT=staging
export EXPO_PUBLIC_APP_ENV=staging
export BUKLOD_APP_TARGET=main
export EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW='true'
export EXPO_PUBLIC_BUKLOD_SOS_NATIVE_R3='true'
export EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED='true'
export EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS='true'
export EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE='true'
export EXPO_PUBLIC_BUKLOD_ARENA_EXPERIMENTAL='true'
export EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED='false'
export EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V205='true'
export EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V206='true'
export EXPO_PUBLIC_BUKLOD_GENESIS_SHARED_BACKEND_REVIEW='true'
export EXPO_PUBLIC_POINTS_REWARDED_BONUS_ENABLED='false'
export EXPO_PUBLIC_STREAM_ANDROID_PUSH_PROVIDER_NAME=firebase-video-staging
export BUKLOD_GENESIS_PREMIUM_3D='true'
export BUKLOD_GENESIS_PRIVATE_ASSETS='false'
export BUKLOD_GENESIS_PRIVATE_FX='false'
export APK_SHA=f1bca8319113402caffe99bd78c7ed0e963f963f
export APK_PROOF_RUN='45168699649'
export MAIN_SHA=9aed7d6ad8b6d0ad80aa71daaf66962e9d49de04
export PUBLIC_CONTENT_SHA=0ddcad334a1facabb10aa9913a86e3dee0421224
export CHANNEL=season2-genesis-library-206-preview
export RUNTIME=2.0.6-genesis-godot-ota
export PACKAGE_NAME=org.mzbministry.buklod.staging
git merge-base --is-ancestor "$APK_SHA" HEAD
git merge-base --is-ancestor "$BASE_SHA" HEAD
git merge-base --is-ancestor "$KINGDOM_SHA" HEAD
test -z "$(git diff --name-only "$APK_SHA" HEAD -- modules plugins android ios native-genesis app.config.js eas.json package.json package-lock.json)"
test -z "$(git diff --name-only "$BASE_SHA" HEAD -- supabase .github/workflows)"
test -z "$(git diff --name-only "$PUBLIC_CONTENT_SHA" HEAD -- godot scripts/build-empire-godot-pack.mjs scripts/genesis-prepare-godot-ota-pack.mjs scripts/genesis-import-verified-3d.mjs)"
node --input-type=module <<'NODE'
import a from 'node:assert/strict'; import fs from 'node:fs'; import {execFileSync} from 'node:child_process';
import {assessChanges} from './scripts/engineering-regression-gate.mjs';
import {assessProtectedFeatureLock,parseNameStatusZ} from './scripts/protected-feature-lock.mjs';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'});
const components=[[process.env.BASE_SHA,process.env.KINGDOM_SHA,'.buklod/scopes/genesis-206-kingdom-restore-20261125.json'],[process.env.KINGDOM_SHA,process.env.GITHUB_SHA,'.buklod/scopes/genesis-206-health-backlog-staging-20261125.json']];
const receipt=[]; for(const [base,head,path] of components){const m=JSON.parse(git('show',head+':'+path));const entries=parseNameStatusZ(git('diff','--name-status','--find-renames','-z',base,head,'--'));const paths=entries.map(e=>e.path);a.deepEqual([...paths].sort(),[...m.allowedPaths].sort());const reg=assessChanges(paths,m,{consolidatedRc:false,requireScope:true});const lock=assessProtectedFeatureLock(entries,m);a.deepEqual(reg.failures,[]);a.deepEqual(lock.failures,[]);receipt.push({base,head,paths,protectedFeatures:lock.impacted});}
fs.writeFileSync(process.env.EVIDENCE+'/source-scope.json',JSON.stringify(receipt,null,2));
NODE
node <<'NODE'
const a=require('node:assert/strict'),fs=require('node:fs'); const root='https://api.github.com/repos/faust-0612/BUKLOD-Rork';
async function get(path){const r=await fetch(root+path,{headers:{'User-Agent':'buklod-independent-qa','Accept':'application/vnd.github+json'},signal:AbortSignal.timeout(25000)});a.equal(r.status,200,path);return r.json();}
(async()=>{const apk=await get('/actions/runs/'+process.env.APK_PROOF_RUN);a.equal(apk.head_sha,process.env.APK_SHA);a.equal(apk.conclusion,'success');const rows=await get('/actions/runs/'+apk.id+'/artifacts?per_page=100');const x=rows.artifacts.find(x=>x.id===14817753566);a.ok(x&&!x.expired&&x.size_in_bytes>100000000);a.equal(x.digest,'sha256:0174f72bab0daa48bddf851f835f4fb96c1ee365d145f93f428265a42dfa3bde');fs.writeFileSync(process.env.EVIDENCE+'/signed-apk-proof.json',JSON.stringify({id:apk.id,source:apk.head_sha,artifact:x.id,digest:x.digest}));})().catch(e=>{console.error(e.message);process.exitCode=1});
NODE
set -euo pipefail
npm ci --ignore-scripts --no-audit --no-fund
node --experimental-strip-types --test \
  tests/genesis-premium-world-content-ota-20261123.test.mjs \
  tests/genesis-206-3d-import.test.mjs \
  tests/genesis-full-staging-godot-ota-native-206.test.mjs \
  tests/buklod-ads-appwide-permanent-lock-20261111.test.mjs \
  tests/ad-dashboard-focus-performance-20261116.test.mjs \
  tests/dashboard-ad-navigation-prewarm-20261116.test.mjs \
  tests/genesis-206-staging-points-readonly-20261124.test.mjs \
  tests/genesis-main-home-no-empire-20261124.test.mjs \
  tests/genesis-navigation-auth-kingdom-retirement-20261124.test.mjs
npm run release:gate
npm run genesis:theme:gate
npx tsc --noEmit
node --experimental-strip-types --test tests/health-center-consultation-card-20261110.test.mjs tests/nov14-imci-health-flow.test.mjs tests/engineering-regression-gate.test.mjs tests/protected-feature-lock.test.mjs
node scripts/test-kingdom-game-platform-r1.mjs
node --experimental-strip-types --test tests/kingdom-*.test.mjs
node scripts/test-marites-release.cjs
node --test tests/buklod-ads-production-release-contract-20261111.test.mjs
node scripts/buklod-ad-surface-audit.mjs --summary
npm test -- --runInBand
set -euo pipefail
node scripts/genesis-import-verified-3d.mjs
node scripts/genesis-prepare-godot-ota-pack.mjs
python3 - <<'PY'
import json,zipfile,hashlib
archive='assets/season2/genesis/ota/empire-arena.zip'
with zipfile.ZipFile(archive) as z:
    names=z.namelist()
    assert not any(x.startswith(('private-fx/','3d/private/','audio/private/','vfx/private/','data/private_')) for x in names)
    m=json.loads(z.read('data/3d_manifest.json'))
    assert len(m['models'])==22 and m['license']=='CC0-1.0'
    assert sum(bool(v.get('rigged')) for v in m['models'])==2
    for model in m['models']:
        folder='3d/kaykit/' if model['id'].startswith('rig_') else '3d/kenney/'
        b=z.read(folder+model['id']+'.glb')
        assert b[:4]==b'glTF' and len(b)==model['bytes']
        assert hashlib.sha256(b).hexdigest()==model['sha256']
    audio=json.loads(z.read('data/audio_manifest.json'))
    assert audio['count']==70 and audio['prototype'] is False
    assert len([x for x in names if x.startswith('kingdom-items/') and x.endswith('.webp')])==42
PY
unzip -t assets/season2/genesis/ota/empire-arena.zip | tail -2
sha256sum assets/season2/genesis/ota/empire-arena.zip > "$EVIDENCE/pack-sha256.txt"
mkdir -p $EVIDENCE/godot206 $EVIDENCE/godot206-project
curl -fLsS --retry 2 --connect-timeout 20 --max-time 240 \
  https://github.com/godotengine/godot-builds/releases/download/4.7.2-stable/Godot_v4.7.2-stable_linux.x86_64.zip \
  -o $EVIDENCE/godot206.zip
unzip -q $EVIDENCE/godot206.zip -d $EVIDENCE/godot206
GODOT="$(find $EVIDENCE/godot206 -type f -name 'Godot_*linux.x86_64' -print -quit)"
test -n "$GODOT"
chmod +x "$GODOT"
"$GODOT" --version | grep -F '4.7.2'
unzip -q assets/season2/genesis/ota/empire-arena.zip -d $EVIDENCE/godot206-project
"$GODOT" --headless --path $EVIDENCE/godot206-project --editor --import --quit 2>&1 | tee $EVIDENCE/godot206-import.log
if grep -E 'SCRIPT ERROR|Parse Error|Parser Error|Failed to load script' $EVIDENCE/godot206-import.log; then exit 1; fi
for test_script in art_smoke.gd premium_smoke.gd world_smoke.gd premium_content_smoke.gd premium_3d_import_smoke.gd; do
  "$GODOT" --headless --path $EVIDENCE/godot206-project -s "res://tests/$test_script" 2>&1 | tee "$EVIDENCE/godot206-$test_script.log"
  if grep -E 'SCRIPT ERROR|Parse Error|Parser Error|Failed to load script' "$EVIDENCE/godot206-$test_script.log"; then exit 1; fi
done
"$GODOT" --headless --main-pack "$PWD/assets/season2/genesis/ota/empire-arena.zip" --quit-after 12 2>&1 | tee $EVIDENCE/godot206-packed.log
if grep -E 'SCRIPT ERROR|Parse Error|Parser Error|Failed to load script' $EVIDENCE/godot206-packed.log; then exit 1; fi
if [ "$MODE" = "--export" ]; then
set -euo pipefail
npx --yes eas-cli@27.9.0 whoami >/dev/null
npx --yes eas-cli@27.9.0 env:pull --environment preview --path "$EVIDENCE/preview.env" --non-interactive >/dev/null
set -a
. "$EVIDENCE/preview.env"
set +a
rm -f "$EVIDENCE/preview.env"
export APP_VARIANT=staging EXPO_PUBLIC_APP_ENV=staging BUKLOD_APP_TARGET=main
export EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW=true EXPO_PUBLIC_BUKLOD_SOS_NATIVE_R3=true
export EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED=true EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS=true
export EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE=true EXPO_PUBLIC_BUKLOD_ARENA_EXPERIMENTAL=true
export EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V205=true EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V206=true
export EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED=false EXPO_PUBLIC_POINTS_REWARDED_BONUS_ENABLED=false
export EXPO_PUBLIC_BUKLOD_GENESIS_SHARED_BACKEND_REVIEW=true EXPO_PUBLIC_STREAM_ANDROID_PUSH_PROVIDER_NAME=firebase-video-staging
export BUKLOD_GENESIS_PRIVATE_ASSETS=false BUKLOD_GENESIS_PRIVATE_FX=false BUKLOD_GENESIS_PREMIUM_3D=true
node <<'NODE'
const a=require('node:assert/strict'),e=require('./eas.json'),c=require('./app.config.js')({config:{}});
const original=e.build['season2-genesis-launch-recovery-staging'].env;
for(const k of ['EXPO_PUBLIC_SUPABASE_URL','EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']){
  a.ok(original[k]&&process.env[k]===original[k],'Preview backend differs from signed profile: '+k);
}
a.equal(c.android.package,process.env.PACKAGE_NAME);
a.equal(c.android.versionCode,18);
a.equal(c.runtimeVersion,process.env.RUNTIME);
a.equal(c.version,'2.0.6');
a.equal(c.extra.eas.projectId,'23dad7d0-389a-406e-8dec-08965dab85d8');
a.equal(c.extra.appEnvironment,'staging');
a.equal(c.extra.appTarget,'main');
a.equal(e.build['season2-genesis-godot-ota-native-staging'].channel,process.env.CHANNEL);
NODE
npx --yes eas-cli@27.9.0 channel:view "$CHANNEL" --json --non-interactive > "$EVIDENCE/stage-before.json"
npx --yes eas-cli@27.9.0 channel:view production --json --non-interactive > "$EVIDENCE/prod-before.json"
node <<'NODE'
const fs=require('node:fs'),a=require('node:assert/strict'),d=process.env.EVIDENCE;
const read=n=>JSON.parse(fs.readFileSync(d+'/'+n+'.json','utf8'));
function branch(raw,name){
  const c=raw.currentPage??raw;a.equal(c.name,name);a.notEqual(c.isPaused,true);
  const m=typeof c.branchMapping==='string'?JSON.parse(c.branchMapping):c.branchMapping;
  a.equal(m?.data?.length,1);
  const b=c.updateBranches?.find(x=>x.id===m.data[0].branchId);
  a.ok(b?.id&&b?.name,'Missing EAS branch '+name);return b;
}
const s=branch(read('stage-before'),process.env.CHANNEL),p=branch(read('prod-before'),'production');
a.equal(s.name,process.env.CHANNEL,'Staging must use its own dedicated 2.0.6 branch');
a.notEqual(s.id,p.id);a.notEqual(s.name,p.name);
fs.writeFileSync(d+'/targets.json',JSON.stringify({stageBranch:s.name,stageId:s.id,prodId:p.id,prodBranch:p.name}));
NODE
PROD_BRANCH="$(node -p "require(process.env.EVIDENCE+'/targets.json').prodBranch")"
npx --yes eas-cli@27.9.0 update:list --branch "$PROD_BRANCH" --limit 5 --json --non-interactive > "$EVIDENCE/prod-updates-before.json"
EXPO_MAX_WORKERS=2 npx expo export --platform android --output-dir "$EXPORT" --clear
test -s "$EXPORT/metadata.json"
node <<'NODE'
const a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const archive='assets/season2/genesis/ota/empire-arena.zip',size=fs.statSync(archive).size;
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expected=hash(archive);
const manifest=fs.readFileSync('src/features/season2/genesis/godotPackManifest.generated.ts','utf8');
a.ok(manifest.includes(expected),'Compiled Godot manifest hash not bound');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?files(path.join(dir,x.name)):[path.join(dir,x.name)]);}
a.ok(files(process.env.EXPORT).some(p=>fs.statSync(p).size===size&&hash(p)===expected),'Exact Godot ZIP absent from exported OTA');
console.log('EXACT_PUBLIC_GODOT_PACK_IN_ANDROID_EXPORT',expected,size);
NODE
test "$(git rev-parse HEAD)" = "$GITHUB_SHA"
  npx --yes eas-cli@27.9.0 update:list --branch "$CHANNEL" --limit 5 --json --non-interactive > "$EVIDENCE/stage-updates-before.json"
  node <<'NODE'
const fs=require('node:fs'),a=require('node:assert/strict');const raw=JSON.parse(fs.readFileSync(process.env.EVIDENCE+'/stage-updates-before.json','utf8'));const rows=raw.currentPage??raw;a.ok(Array.isArray(rows)&&rows.length);a.equal(rows[0].group,process.env.PRIOR_GROUP,'Staging advanced; reconcile before any release');
NODE
fi
printf '%s\n' "$GITHUB_SHA" > "$EVIDENCE/source-sha.txt"
printf '%s\n' "$MODE" > "$EVIDENCE/qa-mode.txt"
echo "LOCAL QA COMMANDS PASSED. Not an OTA or verified RC. Review independent full gate coverage and evidence before any release."
echo "Evidence directory: $EVIDENCE"
