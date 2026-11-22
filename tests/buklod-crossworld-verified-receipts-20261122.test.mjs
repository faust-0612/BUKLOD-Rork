import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261122150000_buklod_crossworld_verified_cosmetics_v1.sql');
const client=read('src/lib/buklodCrossWorldCosmetics.ts');
const panel=read('src/components/games/BuklodCrossWorldAchievements.tsx');
const house=read('src/features/season2/world/Season2DevelopmentMap.tsx');
const kingdom=read('src/features/games/kingdom/BuklodKingdomMap.tsx');
const arena=read('src/app/games/empire-arena.tsx');

test('all three game worlds show the same opt-in verified receipt component',()=>{
  assert.match(house,/<BuklodCrossWorldAchievements world="house"\/>/);
  assert.match(kingdom,/<BuklodCrossWorldAchievements world="kingdom" \/>/);
  assert.match(arena,/<BuklodCrossWorldAchievements world="arena" \/>/);
  assert.match(panel,/if\(!expanded\|\|!userId\)return/);
  assert.match(panel,/claimMyBuklodCrossWorldCosmetics/);
  assert.match(panel,/No rewards were assumed/);
  assert.match(panel,/requestVersion\.current\+=1/);
  assert.match(panel,/version===requestVersion\.current/);
  assert.match(arena,/router\.push\('\/personal-home'/);
  assert.match(kingdom,/router\.push\('\/personal-home'/);
});

test('schema is private and denies table access to public clients',()=>{
  assert.match(sql,/create table if not exists private\.buklod_crossworld_cosmetic_receipts_v1/);
  assert.match(sql,/references auth\.users\(id\) on delete cascade/);
  assert.match(sql,/alter table private\.buklod_crossworld_cosmetic_receipts_v1 enable row level security/);
  assert.match(sql,/revoke all on private\.buklod_crossworld_cosmetic_receipts_v1 from public, anon, authenticated/);
  assert.match(sql,/primary key \(user_id, cosmetic_key\)/);
  assert.match(sql,/unique \(user_id, source_key, cosmetic_key\)/);
});

test('claim and read APIs use trusted 3\\/3 server-scored receipts and own account',()=>{
  for(const functionName of [
    'get_my_buklod_crossworld_cosmetics_v1',
    'claim_my_buklod_crossworld_cosmetics_v1',
  ]){
    assert.match(sql,new RegExp('function public\\.'+functionName+'\\(\\)'));
    assert.match(sql,new RegExp('grant execute on function public\\.'+functionName+'\\(\\)\\s+to authenticated'));
  }
  assert.equal((sql.match(/language plpgsql security definer/g)||[]).length,2);
  assert.equal((sql.match(/set search_path = ''/g)||[]).length,2);
  assert.equal((sql.match(/v_uid uuid := auth\.uid\(\)/g)||[]).length,2);
  assert.equal((sql.match(/a\.status='credited'/g)||[]).length,2);
  assert.equal((sql.match(/l\.points=2/g)||[]).length,2);
  assert.equal((sql.match(/l\.source_key='kingdom:mastery:v1:' \|\| a\.game_id/g)||[]).length,2);
  assert.match(sql,/count\(distinct a\.game_id\)/);
  assert.match(sql,/on conflict \(user_id,cosmetic_key\) do nothing/);
  assert.doesNotMatch(sql,/insert into public\.buklod_points_ledger|update public\.buklod_points_ledger|insert into private\.buklod_kingdom_shards_ledger_v1/i);
  assert.doesNotMatch(sql,/p_client_score|p_winner|p_target_user_id|p_game_id/i);
});

test('verified 1, 10 and 25 Kingdom checks each grant one display monument in every world',()=>{
  const owned=['kingdom_prospect_lantern','kingdom_honor_beacon','kingdom_masterwork_arch',
    'house_artisan_planter','house_heritage_pergola','house_verified_fountain',
    'arena_apprentice_banner','arena_kingdom_banner','arena_verified_veteran_emblem'];
  for(const key of owned){
    assert.match(sql,new RegExp("'"+key+"'"));
    assert.match(client,new RegExp(key));
  }
  for(const tier of [1,10,25]){
    const pattern=new RegExp('\\('+tier+",'[^']+'\\)",'g');
    const events=(sql.match(pattern)||[]);
    assert.equal(events.length,3,'expected three world cosmetics at '+tier+' checks');
  }
  assert.match(sql,/display_only',true,'tradeable',false,'bp_awarded',0/);
  assert.match(sql,/'arena_stat_bonus',0/);
});

test('client fail-closed checks replay, foreign account and malformed server state',()=>{
  assert.match(client,/supabase\.auth\.getSession\(\)/);
  assert.match(client,/data\.session\?\.user\.id!==userId/);
  assert.match(client,/normalizeCrossWorldCosmeticSnapshot/);
  assert.match(client,/!allowed\.has\(/);
  assert.match(client,/unique\.has\(key\)/);
  assert.match(client,/v\.display_only!==true\|\|v\.tradeable!==false/);
  assert.match(client,/arena_stat_bonus!==0/);
  assert.match(client,/item\.source_key!=='kingdom:verified_checks:'\+target\.requiredChecks/);
  assert.match(client,/Number\(v\.verified_checks\)<target\.requiredChecks/);
  assert.match(client,/return normalizeCrossWorldCosmeticSnapshot\(data\)\?\?empty\(\)/);
  assert.match(client,/claim_my_buklod_crossworld_cosmetics_v1/);
  assert.doesNotMatch(client,/AsyncStorage|localStorage|setItem/);
  assert.doesNotMatch(client,/awardBP|setPoints|p_points|p_cosmetic_key|p_recipient/i);
});

test('Arena combat cannot be boosted by cross-world house or kingdom achievement',()=>{
  assert.match(panel,/No BP, Diamonds, combat stats or tradable items/);
  assert.match(arena,/DEVELOPMENT PRACTICE ONLY/);
  assert.doesNotMatch(sql,/update .*rating|insert into .*diamond|update .*arena_pvp/i);
});
