import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const village=read('src/app/community-village.tsx');
const spots=JSON.parse(read('src/features/season2/genesis/genesisApprovedEntryHotspots.json'));
const gate=read('src/app/buklod-map.tsx');

test('Community Village is a real distinct in-app route from approved owner entry art',()=>{
 assert.ok(existsSync(resolve(root,'src/app/community-village.tsx')));
 assert.equal(spots.hotspots.find(x=>x.id==='community-village').route,'/community-village');
 assert.match(gate,/router\.push\(route as any\)/);
 assert.match(gate,/onCommunityVillage=\{\(\) => router\.push\('\/community-village'/);
});

test('Community Village builds a premium nature scene with four genuine district links',()=>{
 assert.match(village,/kingdom-nature-panorama\.webp/);
 for(const id of ['lot','house','cluster','market'])assert.ok(village.includes("id:'"+id+"'"));
 for(const route of ['/personal-home','/clusters','/profile/buklod-business'])
   assert.ok(village.includes("route:'"+route+"'"),route);
 assert.match(village,/REGIONS\.map/);
 assert.match(village,/router\.push\(region\.route as any\)/);
});

test('Five visible construction stages and Levels 1–10 are explicitly nontransactional previews',()=>{
 for(const label of ['Land markers','Foundation','Structure','Roof & exterior','Amenities & expansion'])
  assert.ok(village.includes(label));
 assert.match(village,/setPreviewLevel\(x=>Math\.min\(10,x\+1\)\)/);
 assert.match(village,/setPreviewLevel\(x=>Math\.max\(1,x-1\)\)/);
 assert.match(village,/No real materials or BP spent/);
 assert.match(village,/NO CLAIMED PROPERTY/);
 assert.doesNotMatch(village,/(?:supabase|service_role|\.rpc\(|awardBp|claimBp|awardDiamond|sendBp|withdraw|fetch\()/i);
});

test('Read-only Village has full preview/auth/consent/update/maintenance gates; production unchanged',()=>{
 for(const token of [
 '!isGenesisPreviewBuild()','!session','requiresAcceptance','maintenance_mode',
 'update_required','pilot_access_required','!profile','onboarding',
 ])
 assert.ok(village.includes(token),token);
 assert.match(village,/router\.replace\('\/buklod-map'/);
 assert.match(village,/Permanent BP, QMP, items, property ownership and trade authority/);
});
