import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('official cosmetic gate is separate from earned rank and backend bound',()=>{
 const d=read('src/lib/buklodWallPostDesigns.ts');
 assert.match(d,/hasOfficialCosmeticAccess\(rankName\).*WALL_POST_DESIGNS/);
 const p=read('src/lib/buklodWallPostStylePersistence.ts');
 assert.match(p,/get_buklod_official_identity_v1/);
 assert.match(p,/cosmeticAdmin\?OFFICIAL_COSMETIC_ACCESS/);
 assert.match(p,/const enabled=!!userId&&config\?\.features\?\.rank_wall_designs===true/);
 assert.doesNotMatch(p,/cosmeticAdmin\?'BUKLOD Prime Elite I'/);
});
test('public badge is server verified, anonymous Dugtong remains anonymous',()=>{
 const b=read('src/components/points/BuklodSupremeAuthorityBadge.tsx');
 assert.match(b,/get_buklod_supreme_authority_v1/);
 assert.match(b,/verified===key/);
 assert.match(read('src/components/BuklodDugtongAction.tsx'),/row\.privacy==='public'&&<SupremeAuthorityBadge/);
 assert.match(read('supabase/drafts/buklod_supreme_authority_v1.sql'),/private\.buklod_is_platform_official_v1/);
});
test('Connect cosmetic authority does not grant member rank or rewards',()=>{
 const c=read('src/providers/RankConnectCosmeticProvider.tsx');
 assert.match(c,/order:0,official:true/);
 assert.match(c,/get_buklod_official_identity_v1/);
 assert.match(c,/state\.official\|\|a\.order<=state\.order/);
 assert.match(read('src/app/points/economy.tsx'),/hasRole\('system_admin'\).*Redirect/);
});
