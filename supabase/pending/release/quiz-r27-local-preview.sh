#!/usr/bin/env bash
# One exact MAIN-target build and verified preview. Never promotes production.
set -euo pipefail
REF=1e43a7ca363680edc3c3f6f76f2cbe10ea4f2ef9
SRC=systems/quiz/BUKLOD_Quiz_Standalone_CANDIDATES/BUKLODQ_R10_BUILD_project_3d5647803088_04e596c8cfeb
WORK="$1"
cd "$WORK"
test "$(git remote get-url origin | sed -E 's/\.git$//')" = "https://github.com/faust-0612/BUKLOD-Migrated-Sources" || { echo "BLOCKED: unexpected repository origin"; exit 1; }
test -z "$(git status --porcelain --untracked-files=no)" || { echo "BLOCKED: tracked local changes; not overwritten"; exit 1; }
if ! git cat-file -e "$REF^{commit}" 2>/dev/null; then
  git fetch --no-tags origin dev/quiz-main-cutover-20261127
fi
git checkout --detach "$REF"
test "$(git rev-parse HEAD)" = "$REF"
export CI=true EXPO_NO_DOTENV=1 EXPO_PUBLIC_BUKLOD_QUIZ_EXPECTED_PROJECT=main_rc
export EXPO_PUBLIC_SUPABASE_URL=https://yhanxndaqbmuzbdqlblu.supabase.co
export EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$(sed -n 's/^ *EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: //p' .github/workflows/quiz-main-web-rc-export.yml)"
[[ "$EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY" == sb_publishable_* ]] || { echo "BLOCKED: MAIN public key unavailable"; exit 1; }
cd "$SRC"
node - <<'NODE'
const assert=require('node:assert/strict'),fs=require('node:fs');
const c=require('./app.config.js')({config:{}});const x=c.expo||c;
assert.equal(x.slug,'buklod-quiz');assert.equal(x.extra.eas.projectId,'cb7608c2-d967-44b0-9001-10b8d4c445a8');assert.equal(x.web.output,'single');
for(const p of [x.icon,x.android.icon,x.android.adaptiveIcon.foregroundImage,x.web.favicon])assert(fs.existsSync(p),'Missing '+p);
NODE
# R27 changes review UI and CI only. Reuse dependencies if the installed
# project lock matches the already-built R26 candidate.
if git diff --quiet a242c9f1bf957ee9d745118fd59d2263619a555f "$REF" -- package.json package-lock.json && [[ -x node_modules/.bin/expo && -x node_modules/.bin/tsc ]]; then
  echo "Reusing R26 dependencies; package manifests unchanged"
else
  npm ci --prefer-offline --no-audit --no-fund
fi
node - <<'NODE'
const fs=require('node:fs'),assert=require('node:assert/strict');
const s=fs.readFileSync('app/review.tsx','utf8');
for(const marker of ['AI CHECK ALL CONFIRMED','AI CHECK STUDENT','MASS APPROVE READY + FINALIZE','buklod_quiz_historical_class_review_v2','buklod_quiz_approve_historical_class_v1','reference_digest:aiDigests[id]'])assert(s.includes(marker),'Missing R27 review control: '+marker);
console.log('R27_REVIEW_CONTROL_CONTRACT_PASS');
NODE
npm run check:quiz-target
npm run check:quiz-ui
npm run check:quiz-routes
npm run typecheck
DIST="$(basename "$(mktemp -d "$PWD/dist-quiz-main-r27.XXXXXX")")"
export DIST REF
NODE_ENV=production npx --no-install expo export --platform web --output-dir "$DIST"
node scripts/check-quiz-web-release.cjs --self-test
node scripts/check-quiz-web-release.cjs --stamp "$DIST" "$REF"
node - <<'NODE'
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),c=require('./scripts/check-quiz-web-release.cjs');
const html=fs.readFileSync(path.join(process.env.DIST,'index.html'),'utf8');assert.equal(c.marker(html),process.env.REF);
const refs=c.scripts(html);assert(refs.length>0);
assert(refs.some(s=>{const b=fs.readFileSync(c.localAsset(process.env.DIST,s).file);return b.includes(Buffer.from(process.env.EXPO_PUBLIC_SUPABASE_URL))&&b.includes(Buffer.from(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY));}),'MAIN target not present in exported entry');
(async()=>{const r=await fetch('https://buklod-quiz.expo.app/',{signal:AbortSignal.timeout(15000),cache:'no-store'});assert(r.ok);fs.writeFileSync(path.join(process.env.DIST,'production-baseline.txt'),c.marker(await r.text()));})().catch(e=>{console.error(e.message);process.exitCode=1});
NODE
echo QUIZ_R27_WEB_EXPORT_PASS
LOG="$(mktemp)"
export LOG
trap 'rm -f "$LOG"' EXIT
npx --yes eas-cli@27.5.0 deploy --environment preview --export-dir "$DIST" --non-interactive 2>&1 | tee "$LOG"
node - <<'NODE'
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),c=require('./scripts/check-quiz-web-release.cjs');
const root=process.env.DIST,sha=process.env.REF,log=fs.readFileSync(process.env.LOG,'utf8');
const urls=[...new Set(log.match(/https:\/\/buklod-quiz--[a-z0-9-]+\.expo\.app\b/gi)||[])];assert.equal(urls.length,1,'Expected immutable preview URL');const preview=urls[0]+'/';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(20000),cache:'no-store'});assert(r.ok,'HTTP '+r.status+' '+new URL(url).origin);return Buffer.from(await r.arrayBuffer());}
(async()=>{const local=fs.readFileSync(path.join(root,'index.html'),'utf8'),remote=(await get(preview+'?buklod_release='+sha)).toString('utf8');
assert.equal(c.marker(local),sha);assert.equal(c.marker(remote),sha);const refs=c.scripts(local);assert(refs.length>0);const remoteRefs=new Set(c.scripts(remote).map(src=>new URL(src,preview).pathname));const entries=[];
for(const src of refs){const a=c.localAsset(root,src),url=new URL(a.path,preview);assert.equal(url.origin,new URL(preview).origin);assert(remoteRefs.has(url.pathname));const b=fs.readFileSync(a.file);assert.equal(hash(await get(url.toString())),hash(b));entries.push({path:a.path,sha256:hash(b),bytes:b.length});}
const baseline=fs.readFileSync(path.join(root,'production-baseline.txt'),'utf8').trim();assert.equal(c.marker((await get('https://buklod-quiz.expo.app/?buklod_verify='+sha)).toString('utf8')),baseline,'Production marker changed unexpectedly');
fs.writeFileSync(path.join(root,'quiz-r27-preview-proof.json'),JSON.stringify({status:'PREVIEW_MARKER_AND_JS_HASH_VERIFIED',sourceCommit:sha,previewUrl:preview,productionMarkerUnchanged:baseline,entries,verifiedAtUtc:new Date().toISOString()},null,2)+'\n');console.log('QUIZ_R27_PREVIEW_VERIFIED '+preview);console.log('PROOF='+path.resolve(root,'quiz-r27-preview-proof.json'));
})().catch(e=>{console.error(e.message);process.exitCode=1});
NODE
