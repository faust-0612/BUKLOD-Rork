#!/usr/bin/env bash
# Promote the exact, user-tested R28 immutable deployment. No export/build/upload.
set -euo pipefail
WORK="${1:-$HOME/projects/BUKLOD-Quiz-Main-RC.DiKBju}"
SRC=systems/quiz/BUKLOD_Quiz_Standalone_CANDIDATES/BUKLODQ_R10_BUILD_project_3d5647803088_04e596c8cfeb
REF=9b6081baf357eaeee945633e71bb41af5104887e
DEPLOYMENT=jf5rqsyiw4
DIST=dist-quiz-main-r28.iO8He0
cd "$WORK"
test "$(git remote get-url origin | sed -E 's/\.git$//')" = 'https://github.com/faust-0612/BUKLOD-Migrated-Sources'
test "$(git rev-parse HEAD)" = "$REF" || { echo 'BLOCKED: R28 checkout changed; use the original verified worktree.'; exit 1; }
test -z "$(git status --porcelain --untracked-files=no)" || { echo 'BLOCKED: tracked checkout changes'; exit 1; }
cd "$SRC"
test -f "$DIST/quiz-r28-preview-proof.json"
export REF DEPLOYMENT DIST CI=true EXPO_NO_DOTENV=1
CHECK="$(mktemp)"
trap 'rm -f "$CHECK"' EXIT
export CHECK
cat > "$CHECK" <<'NODE'
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict'), crypto=require('node:crypto');
const checker=require(path.resolve('scripts/check-quiz-web-release.cjs'));
const sha=process.env.REF, root=process.env.DIST, preview='https://buklod-quiz--'+process.env.DEPLOYMENT+'.expo.app/', prod='https://buklod-quiz.expo.app/';
const proof=JSON.parse(fs.readFileSync(path.join(root,'quiz-r28-preview-proof.json'),'utf8'));
assert.equal(proof.status,'PREVIEW_MARKER_AND_JS_HASH_VERIFIED');
assert.equal(proof.sourceCommit,sha); assert.equal(proof.previewUrl,preview);
assert.match(proof.productionMarkerUnchanged,/^[a-f0-9]{40}$/);
const config=require(path.resolve('app.config.js'))({config:{}}), c=config.expo||config;
assert.equal(c.slug,'buklod-quiz'); assert.equal(c.extra.eas.projectId,'cb7608c2-d967-44b0-9001-10b8d4c445a8');
const local=fs.readFileSync(path.join(root,'index.html'),'utf8'), hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(checker.marker(local),sha);
const entries=checker.scripts(local).map(src=>{const a=checker.localAsset(root,src),b=fs.readFileSync(a.file);return {path:a.path,sha256:hash(b),bytes:b.length,main:b.includes(Buffer.from('https://yhanxndaqbmuzbdqlblu.supabase.co'))};});
assert(entries.length>0&&entries.some(x=>x.main),'MAIN target not present');
assert.equal(proof.entries.length,entries.length);for(const a of entries)assert(proof.entries.some(b=>a.path===b.path&&a.sha256===b.sha256&&a.bytes===b.bytes),'Local proof mismatch');
async function get(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000),redirect:'error'});assert(r.ok,'HTTP '+r.status+' '+new URL(url).origin);return Buffer.from(await r.arrayBuffer());}
async function verify(url){const html=(await get(url+'?buklod_release='+sha)).toString('utf8');assert.equal(checker.marker(html),sha);const refs=new Set(checker.scripts(html).map(x=>new URL(x,url).pathname));for(const a of entries){const asset=new URL(a.path,url);assert.equal(asset.origin,new URL(url).origin);assert(refs.has(asset.pathname));const b=await get(asset.toString());assert.equal(hash(b),a.sha256);assert.equal(b.length,a.bytes);}}
(async()=>{if(process.argv[2]==='preflight'){await verify(preview);const current=checker.marker((await get(prod+'?buklod_baseline='+sha)).toString('utf8'));assert(current===proof.productionMarkerUnchanged||current===sha,'Production changed since verified preview; refusing stale promotion');console.log(current===sha?'ALREADY_PROMOTED':'PROMOTION_PREFLIGHT_PASS');}
else{await verify(prod);const receipt={status:'QUIZ_CONNECT_PRODUCTION_ARTIFACT_VERIFIED',sourceCommit:sha,deploymentId:process.env.DEPLOYMENT,productionUrl:prod,previewUrl:preview,priorProductionMarker:proof.productionMarkerUnchanged,entries,verifiedAtUtc:new Date().toISOString()};fs.writeFileSync(path.join(root,'quiz-connect-production-proof.json'),JSON.stringify(receipt,null,2)+'\n');console.log(receipt.status);console.log('PROOF='+path.resolve(root,'quiz-connect-production-proof.json'));}})().catch(e=>{console.error('BLOCKED: '+e.message);process.exitCode=1;});
NODE
PRE="$(node "$CHECK" preflight)"
printf '%s\n' "$PRE"
if [[ "$PRE" != 'ALREADY_PROMOTED' ]]; then
  test "$PRE" = 'PROMOTION_PREFLIGHT_PASS'
  npx --yes eas-cli@27.5.0 deploy:alias --prod --id="$DEPLOYMENT" --non-interactive
fi
node "$CHECK" verify
echo 'No rebuild, database write, MAIN OTA, or Dedicated deletion performed by this script.'
