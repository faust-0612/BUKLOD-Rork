import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const page=read('src/app/season2/special-events.tsx');
const map=JSON.parse(read('src/features/season2/genesis/genesisApprovedEntryHotspots.json'));
const guide=read('src/features/season2/world/BuklodMapGuideDock.tsx');
test('Special Events is an actual one-tap map landmark',()=>{
 const event=map.hotspots.find(x=>x.id==='special-events');
 assert.ok(event);assert.equal(event.route,'/season2/special-events');
 assert.equal(event.label,'Special Events');
});
test('Events use RLS-governed live data and existing detail/RSVP',()=>{
 assert.match(page,/supabase\.from\('church_events'\)/);
 assert.match(page,/\.eq\('is_cancelled',false\)/);
 assert.match(page,/\/church\/event\//);
 assert.doesNotMatch(page,/service_role|award.*bp|rpc\('grant_/i);
});
test('Motion is bounded to active foreground and respects reduced motion',()=>{
 assert.match(page,/AccessibilityInfo\.isReduceMotionEnabled/);
 assert.match(page,/AppState\.addEventListener/);
 assert.match(page,/!focused\|\|!foreground\|\|reduceMotion/);
 assert.match(page,/seq\.stop\(\)/);
});
test('Guide prompts follow the four owner approved actions',()=>{
 assert.match(guide,/Gusto mong may makasama\?/);
 assert.match(guide,/Maglaro\?/);
 assert.match(guide,/Matuto\?/);
 assert.match(guide,/Makipag-usap\?/);
});
