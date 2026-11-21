import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Real state machine never declares a live event without a trusted start and end window',async()=>{
 const stripped=stripTypeScriptTypes(read('src/features/season2/world/specialEventsLogic.ts'),{mode:'strip'});
 const {deriveSpecialEventState,normalizeSpecialEventRows}=await import('data:text/javascript;base64,'+Buffer.from(stripped).toString('base64'));
 const now=Date.parse('2026-11-21T12:00:00Z');
 const item=(start,end)=>({startsAt:start,endsAt:end});
 assert.equal(deriveSpecialEventState(item(null,null),now),'schedule-unconfirmed');
 assert.equal(deriveSpecialEventState(item('2026-11-21T11:00:00Z',null),now),'schedule-unconfirmed');
 assert.equal(deriveSpecialEventState(item('2026-11-21T11:00:00Z','2026-11-21T13:00:00Z'),now),'live');
 assert.equal(deriveSpecialEventState(item('2026-11-21T14:00:00Z','2026-11-21T16:00:00Z'),now),'upcoming');
 assert.equal(deriveSpecialEventState(item('2026-11-20T10:00:00Z','2026-11-20T12:00:00Z'),now),'ended');
 const event=(key,title,startsAt,endsAt)=>({
  key,id:key,title,description:null,category:'Community',startsAt,endsAt,
  location:null,source:'city',route:null,verified:false,
 });
 const live=event('one','Live now','2026-11-21T11:00:00Z','2026-11-21T13:00:00Z');
 const future=event('two','Next month','2026-12-01T10:00:00Z','2026-12-01T11:00:00Z');
 const old=event('old','Old','2026-08-01T00:00:00Z','2026-08-01T01:00:00Z');
 assert.deepEqual(normalizeSpecialEventRows([future,old,live,live],now).map(x=>x.key),['one','two']);
});
test('Landing Special Events is the ninth original special door, not a replacement for main navigation',()=>{
 const entry=JSON.parse(read('src/features/season2/genesis/genesisApprovedEntryHotspots.json'));
 const special=entry.hotspots.find(h=>h.id==='special-events');
 assert.equal(entry.hotspots.length,9);
 assert.equal(special.route,'/season2/special-events');
 assert.equal(special.districtId,'events');
 const map=read('src/features/season2/genesis/GenesisApprovedEntryMap.tsx');
 assert.match(map,/styles\.specialLandmark/);
 assert.match(map,/eventSparkle/);
 assert.match(map,/star-four-points/);
 const shell=read('src/components/BuklodNavSafeShell.tsx');
 assert.match(shell,/<BuklodPersistentBottomNav \/>/);
});
test('Special Events never fakes attendance, RSVP, BP or event data; program examples are not claimed as live',()=>{
 const scene=read('src/app/season2/special-events.tsx');
 for(const literal of ['getBuklodCitySnapshot','church_events','is_cancelled',
  'BuklodHomeCheckinToday','Promise.allSettled','churchEnabled','getBuklodCitySnapshot()',
  'liveCount','AccessibilityInfo.isReduceMotionEnabled','AppState.addEventListener'])
  assert.ok(scene.includes(literal),literal);
 assert.match(scene,/Lokal|announcement|anunsiyo/i);
 assert.match(scene,/Hindi nangangahulugang may aktibong event sa lahat/);
 assert.match(scene,/!focused\|\|!foreground\|\|reduceMotion/);
 for(const forbidden of [/awardBp\(/,/mintBp\(/,/awardDiamond\(/,/getServiceRole/,/\.rpc\('rsvp_event'/])
  assert.doesNotMatch(scene,forbidden);
 const c=read('src/app/church/event/[id].tsx');
 assert.match(c,/supabase\.rpc\('rsvp_event'/);
 assert.match(c,/supabase\.rpc\('self_checkin_event'/);
});
