import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const hotspots=JSON.parse(read('src/features/season2/genesis/genesisApprovedEntryHotspots.json'));
const map=read('src/features/season2/genesis/GenesisApprovedEntryMap.tsx');
const screen=read('src/app/buklod-map.tsx');
const guide=read('src/features/season2/world/BuklodMapGuideDock.tsx');
const shell=read('src/components/BuklodNavSafeShell.tsx');

test('Historical owner-approved original is kept byte-identical, new tropical scene uses bundled assets',()=>{
 const p=resolve(root,'assets/season2/genesis/world/buklod-approved-entry-map-1672x941.webp');
 const img=readFileSync(p);
 assert.equal(img.length,473226);
 assert.equal(createHash('sha256').update(img).digest('hex'),
   'a343c70d1c71e849b536570bd92ede7134667d40347f6465003d41710e818b02');
 assert.match(map,/GenesisReliablePortraitImage/);
 const image=read('src/features/season2/genesis/GenesisReliablePortraitImage.tsx');
 assert.match(image,/buklod-genesis-portrait-welcome-720x995\.jpg/);
 assert.match(image,/GENESIS_PORTRAIT_RESCUE_URI/);
 assert.match(image,/mode==='safe'/);
 assert.ok(existsSync(resolve(root,'assets/buklod-guide/wave.png')));
});

test('Exactly nine SPECIAL map doors; all nav destinations belong only to bottom pane',()=>{
 assert.equal(hotspots.hotspots.length,9);
 const ids=hotspots.hotspots.map(h=>h.id);
 assert.equal(new Set(ids).size,ids.length);
 assert.deepEqual(ids,['character-kingdom','hero-arena','learnings','university','my-house','church',
  'my-community','office-building','special-events']);
 const forbidden=new Set(['/hub','/buklod','/messages','/clusters','/me']);
 for(const h of hotspots.hotspots){
  assert.ok(!forbidden.has(h.route),'Main tab duplicated on map '+h.route);
  assert.ok(h.route.startsWith('/'),'bad route '+h.route);
  const file='src/app/'+h.route.slice(1);
  assert.ok(existsSync(resolve(root,file+'.tsx'))||
    existsSync(resolve(root,file+'/index.tsx'))||
    existsSync(resolve(root,'src/app/(tabs)/'+h.route.slice(1)+'.tsx')),file);
 }
 assert.equal(hotspots.hotspots.find(h=>h.id==='special-events').route,'/season2/special-events');
 assert.equal(hotspots.hotspots.find(h=>h.id==='hero-arena').route,'/games/empire-arena');
 assert.equal(hotspots.hotspots.find(h=>h.id==='my-community').route,'/season2/community-village');
 assert.equal(hotspots.hotspots.find(h=>h.id==='office-building').route,'/profile/focus-apps');
 assert.equal(hotspots.hotspots.find(h=>h.id==='university').route,'/season2/university');
});

test('Approved portrait map goes first, guide remains external, and new one-tap signs are real',()=>{
 assert.match(screen,/<BuklodMapHeader \/>/);
 assert.match(screen,/<GenesisApprovedEntryMap/);
 const portrait=screen.slice(screen.indexOf('portraitFirstView'));
 assert.ok(portrait.lastIndexOf('{mapNode}')>=0);
 assert.ok(portrait.lastIndexOf('{mapNode}')<portrait.lastIndexOf('<BuklodMapGuideDock'));
 assert.match(map,/onPress=\{\(\)=>onOpen\(door,door\.faithOnly&&!showFaith/);
 assert.match(screen,/router\.push\(route as any\)/);
 assert.match(map,/specialLandmark/);
 assert.match(map,/star-four-points/);
 assert.match(map,/AccessibilityInfo\.isReduceMotionEnabled/);
 assert.match(map,/!active\|\|reduceMotion/);
 assert.match(screen,/if \(!isGenesisPreviewBuild\(\)\)/);
 assert.doesNotMatch(screen,/BuklodFirstViewAd|toggleMusic|musicButton|awardBp|mintBp/);
});

test('Existing persistent bottom bar is restored in Genesis and never redrawn inside guide or map',()=>{
 assert.match(shell,/const genesisWorld = isGenesisPreviewBuild\(\)/);
 assert.match(shell,/const navOccupied = immersiveConversation \? 0 : rawNavOccupied/);
 assert.match(shell,/!immersiveIgpat && !immersiveConversation && rawNavOccupied > 0/);
 assert.match(shell,/<BuklodPersistentBottomNav \/>/);
 assert.match(shell,/bottom:Math\.max\(navOccupied,0\)\+11/);
 for(const label of ['Gusto mong may makasama?','Maglaro?','Matuto?','Makipag-usap?'])
  assert.ok(guide.includes(label),label);
 assert.doesNotMatch(guide,/BUKLOD_ENTRY_DOORS|label:'Home',route:'\/hub'/);
 assert.match(guide,/assets\/buklod-guide\/wave\.png/);
 assert.match(guide,/AccessibilityInfo\.isReduceMotionEnabled/);
 assert.match(guide,/!active\|\|reducedMotion/);
});

test('Each welcome question reaches the exact owner-approved destination',()=>{
 const routes=new Map([
  ['Gusto mong may makasama?','/clusters'],
  ['Maglaro?','/season2/games'],
  ['Matuto?','/season2/learnings'],
  ['Makipag-usap?','/buklod'],
 ]);
 for(const [label,route] of routes){
  const line=guide.split('\n').find(s=>s.includes("label:'"+label+"'"));
  assert.ok(line,'missing question '+label);
  assert.ok(line.includes("route:'"+route+"'"),'wrong target '+label);
 }
 const catalog=read('src/features/season2/world/BuklodSpecialDoorDirectory.tsx');
 for(const term of ['KL · Kabihasnang Ligaw','Children’s Stories','Daily Reading','ABAKA','WORD','Classrooms','Faculty'])
  assert.ok(catalog.includes(term),term);
 assert.match(catalog,/!item\.faithOnly\|\|showFaith/);
});

test('Special Events hero is animated and real programs are always distinct from attendance',()=>{
 const events=read('src/app/season2/special-events.tsx');
 const logic=read('src/features/season2/world/specialEventsLogic.ts');
 for(const p of ['src/app/season2/special-events.tsx','src/features/season2/world/specialEventsLogic.ts'])
  assert.ok(existsSync(resolve(root,p)),p);
 assert.match(events,/getBuklodCitySnapshot\(\)/);
 assert.match(events,/\.from\('church_events'\)/);
 assert.match(events,/useFocusEffect/);
 assert.match(events,/AccessibilityInfo\.isReduceMotionEnabled/);
 assert.match(events,/!focused\|\|!foreground\|\|reduceMotion/);
 assert.match(events,/BuklodHomeCheckinToday/);
 assert.match(events,/Detail|RSVP/i);
 assert.match(events,/Promise\.allSettled/);
 assert.match(logic,/Never infer LIVE without an explicit legitimate end time/);
 for(const bad of ['awardBp(','mintBp(','withdrawQMP(','rpc(']){
  assert.ok(!events.includes(bad),'Special Events must not mint/claim '+bad);
 }
 assert.match(events,/faithEnabled|churchEnabled/);
});

test('Feature guards, existing financial access and production isolation are unchanged',()=>{
 const base=read('src/app/index.tsx');
 assert.match(base,/isGenesisPreviewBuild\(\) \? '\/buklod-map' : '\/\(tabs\)\/buklod'/);
 for(const p of ['src/app/season2/special-events.tsx','src/features/season2/world/BuklodSpecialDoorDirectory.tsx']){
  const c=read(p);
  for(const gate of ['!isGenesisPreviewBuild()','!session','requiresAcceptance','maintenance_mode','update_required','!profile'])
   assert.ok(c.includes(gate),p+' '+gate);
 }
 assert.match(read('src/app/(tabs)/hub.tsx'),/BuklodFirstViewAd/);
 assert.doesNotMatch(guide,/supabase\.rpc|service_role|awardBp|claimBp/);
});
