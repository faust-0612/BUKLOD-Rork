import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const wf=source('.github/workflows/genesis-conso-staging-ota-verify-20261120.yml');
test('read-only Genesis staging verifier binds exact remotely published group and Android runtime',()=>{
 for(const token of [
  'RELEASE_SHA: fd335823622de5bfaef32f649b076831057cd29d',
  'RELEASE_ID: 01a1f905-1cc1-7c4a-9a48-636622f2fc05',
  'RELEASE_GROUP: 6f334c67-e040-4a51-8bd2-adb883c3956a',
  'RELEASE_RUNTIME: 2.0.0-genesis-preview',
  'RELEASE_CHANNEL: season2-genesis-preview',
  'EAS_PROJECT_ID: 23dad7d0-389a-406e-8dec-08965dab85d8'
 ])assert.ok(wf.includes(token),token);
 assert.ok(wf.includes("git merge-base --is-ancestor \"$RELEASE_SHA\" HEAD"));
 assert.ok(wf.includes('test "$CHANGED" = "$EXPECTED"'));
 assert.ok(wf.includes('BLOCK: unexpected post-publish source changes'));
});
test('verifier checks current production/staging branches plus live Expo Updates manifest with no publish',()=>{
 assert.ok(wf.includes('npx --yes eas-cli@27.9.0 update:view "$RELEASE_GROUP" --json'));
 assert.ok(wf.includes('npx --yes eas-cli@27.9.0 channel:view "$RELEASE_CHANNEL" --json'));
 assert.ok(wf.includes('npx --yes eas-cli@27.9.0 channel:view production --json'));
 assert.ok(wf.includes('PROD_PREVIOUS_GROUP: a4bd0eb9-53f2-4108-b8ad-2fca6b3fa0d8'));
 assert.ok(wf.includes("assert.equal(m.id,process.env.RELEASE_ID,'Live Expo manifest is not the published Genesis OTA')"));
 assert.ok(wf.includes("assert.equal(m.extra?.expoClient?.android?.package,'org.mzbministry.buklod.staging')"));
 assert.ok(wf.includes("assert.equal(liveProduction[0]?.group,process.env.PROD_PREVIOUS_GROUP"));
 assert.ok(wf.includes("mappedProductionBranchUnchanged:true,productionUpdateUnchanged:true"));
 assert.doesNotMatch(wf,/\beas-cli@\S+ update --channel|--profile production|\beas-cli@\S+ build --/);
});
