import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const root='apps/buklod-empire-unity/';
test('all canonical Kingdom games map to exactly one of 13 stones',()=>{
 const canonical=JSON.parse(read(root+'Assets/Resources/SacredStones.json')).stones;
 const text=read('src/lib/buklodArenaStoneCatalog.ts');
 const client=JSON.parse(text.split(' = ')[1].split(' as const;')[0]);
 const mastery=read('supabase/migrations/20261108030000_buklod_kingdom_mastery_challenges_v2.sql');
 const sql=read(root+'Tools/sacred-stones-kingdom-candidate.sql');
 const games=[...mastery.matchAll(/\('([^']+)','[^']*','[^']+','([^']+)',true\)/g)].map(m=>[m[1],m[2]]);
 assert.equal(games.length,39);assert.equal(client.length,13);
 for(const hero of client){
  const stone=canonical.find(s=>s.heroId===hero.heroId);
  assert.equal(hero.stone,stone.stone);
  assert.equal(hero.games.length,3);
  assert.deepEqual(hero.games,games.filter(g=>g[1]===hero.heroId).map(g=>g[0]));
  for(const game of hero.games)assert.ok(sql.includes("('"+hero.heroId+"','"+game+"')"));
 }
 assert.equal(new Set(client.flatMap(x=>x.games)).size,39);
});
test('quest mint requires canonical proof and isolated facade',()=>{
 const sql=read(root+'Tools/sacred-stones-kingdom-candidate.sql');
 assert.match(sql,/enabled boolean not null default false/);
 assert.match(sql,/bp_exchange_enabled boolean not null default false/);
 assert.match(sql,/a\.status='credited'/);assert.match(sql,/l\.points=2/);
 assert.match(sql,/verified_count=3/);assert.match(sql,/mastery-v1:/);
 assert.match(sql,/auth\.uid\(\)/);assert.match(sql,/buklod_is_platform_official_v1/);
 assert.match(sql,/state='cancelled'/);assert.match(sql,/revoke all on all functions in schema empire_stones/);
 assert.equal((sql.match(/\$\$/g)||[]).length,2*(sql.match(/^create function /gm)||[]).length);
});
test('actual Mastery Check and Kingdom treasury call server-only path',()=>{
 const check=read('src/features/games/kingdom/platform/KingdomMasteryCheck.tsx');
 const screen=read('src/app/games/rewards.tsx');
 const treasury=read('src/features/games/kingdom/ArenaStoneTreasury.tsx');
 const api=read('src/lib/buklodArenaStones.ts');
 assert.equal((check.match(/void syncStones\(\)/g)||[]).length,2);
 assert.match(check,/if \(result\?\.verified\)/);assert.match(screen,/<ArenaStoneTreasury/);
 assert.match(treasury,/AsyncStorage\.setItem\(key,JSON\.stringify\(req\)\)/);
 assert.match(treasury,/pendingWrites/);assert.match(treasury,/resolveArenaStoneRequest/);
 assert.match(api,/data\.session\?\.user\.id!==uid/);
 assert.match(api,/d\.owner!==uid/);assert.doesNotMatch(api,/grant_verified/);
});
