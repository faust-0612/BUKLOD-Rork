import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
test('Genesis has exactly one five-destination navigation bar with approved order and names',()=>{
 const bar=read('src/components/BuklodPersistentBottomNav.tsx');
 const shell=read('src/components/BuklodNavSafeShell.tsx');
 assert.match(bar,/BASE_ITEMS\[0\],BASE_ITEMS\[2\],BASE_ITEMS\[3\],BASE_ITEMS\[1\],BASE_ITEMS\[4\]/);
 assert.match(bar,/item\.key === 'community' \? 'Community'/);
 assert.match(shell,/<BuklodPersistentBottomNav \/>/);
 assert.match(bar,/pathname === '\/buklod-map'/);
});
test('Portrait map respects vertical room for guide, bottom nav and all nine signs',()=>{
 const map=read('src/features/season2/genesis/GenesisApprovedEntryMap.tsx');
 assert.match(map,/Math\.min\(mapHeight-44/);
 assert.match(map,/PORTRAIT_RATIO=995\/720/);
 assert.match(map,/COMPACT_RATIO=670\/720/);
 const doors=JSON.parse(read('src/features/season2/genesis/genesisApprovedEntryHotspots.json')).hotspots;
 assert.equal(doors.length,9);
 assert.equal(new Set(doors.map(d=>d.route)).size,9);
});
test('ABAKA top-level directory is a real route with original A-Z lessons and Show Faith guard',()=>{
 const dir='src/app/faith/abc/index.tsx';assert.ok(existsSync(resolve(root,dir)));
 const source=read(dir);
 assert.match(source,/ABC_LESSONS/);
 assert.match(source,/show_faith_content/);
 assert.match(source,/\/faith\/abc\//);
 assert.match(source,/maintenance_mode/);
 assert.match(source,/requiresAcceptance/);
 assert.doesNotMatch(source,/awardBp|supabase\.rpc|claimBp/);
});
