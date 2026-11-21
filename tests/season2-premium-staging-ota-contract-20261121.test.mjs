import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
test('Premium Kingdom nature landmarks are selectable canonical character worlds',()=>{
 const portal=read('src/features/season2/genesis/GenesisKingdomPortal.tsx');
 assert.match(portal,/KINGDOM_NATURE_LANDMARKS\.map/);
 assert.match(portal,/onPress=\{\(\) => select\(realm\)\}/);
 for(const region of ['Living Forest','Kingdom Citadel','Winter Highlands','River Valley','Coastal District'])assert.ok(portal.includes(region),region);
 assert.match(portal,/accessibilityState=\{\{selected:isSelected\}\}/);
 assert.doesNotMatch(portal,/claimBp|awardBp|awardDiamond|supabase\.rpc/i);
});
test('EAS Genesis profile can no longer explicitly point to LIVE Supabase',()=>{
 const eas=JSON.parse(read('eas.json'));
 const env=eas.build['season2-genesis-preview'].env;
 assert.equal(env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW,'true');
 assert.equal(env.EXPO_PUBLIC_BUKLOD_ARENA_EXPERIMENTAL,'false');
 assert.equal(env.EXPO_PUBLIC_BUKLOD_GENESIS_SHARED_BACKEND_REVIEW,'false');
 assert.equal(env.EXPO_PUBLIC_SUPABASE_URL,undefined);
 assert.equal(env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,undefined);
});
test('Source gate passes but artifact release gate fails closed without independent backend/APK proof',()=>{
 const script=resolve(root,'scripts/season2-premium-staging-ota-gate.mjs');
 const source=spawnSync(process.execPath,[script,'--source'],{cwd:root,encoding:'utf8'});
 assert.equal(source.status,0,source.stderr||source.stdout);
 const srcReport=JSON.parse(source.stdout);
 assert.equal(srcReport.ok,true);
 assert.equal(srcReport.otaReady,false);
 assert.equal(srcReport.published,false);
 const release=spawnSync(process.execPath,[script,'--release'],{cwd:root,encoding:'utf8',
   env:{...process.env,BUKLOD_STAGING_PROJECT_REF:'',EXPO_PUBLIC_SUPABASE_URL:'',EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:''}});
 assert.notEqual(release.status,0,'Release must fail closed without signed EAS evidence');
 const report=JSON.parse(release.stdout);
 assert.equal(report.otaReady,false);
 assert.ok(report.failures.some(e=>e.includes('signed APK')||e.includes('EAS')));
});
