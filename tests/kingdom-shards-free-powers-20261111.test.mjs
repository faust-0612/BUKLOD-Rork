import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildKingdomOfflineLevel, KINGDOM_OFFLINE_MAX_LEVEL,
} from '../src/features/games/kingdom/platform/kingdomOfflineGenerator.mjs';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql = read('supabase/migrations/20261111014500_buklod_kingdom_shards_game_only_v1.sql');
const client = read('src/lib/buklodKingdomShards.ts');
const shop = read('src/app/games/rewards.tsx');
const legacy = read('src/app/games/legacy.tsx');
const practice = read('src/features/games/kingdom/platform/KingdomOfflineContinuation.tsx');
const gameIds = JSON.parse(read('src/features/games/kingdom/platform/game-catalog.json'))
  .characters.flatMap(c=>c.games.map(g=>g.id));

test('Kingdom Shards are private, noncash and cannot be directly minted from client input',()=>{
  assert.equal((sql.match(/enable row level security/g)||[]).length,3);
  assert.equal((sql.match(/revoke all on private\.buklod_kingdom_shards_/g)||[]).length,2);
  assert.match(sql,/revoke all on private\.buklod_kingdom_items_v1/);
  for(const table of ['private.buklod_kingdom_shards_wallet_v1',
    'private.buklod_kingdom_shards_ledger_v1','private.buklod_kingdom_items_v1']) {
    assert.match(sql,new RegExp(table.replaceAll('.','\\.')));
  }
  assert.match(sql,/balance >= 0/);
  assert.match(sql,/earned - spent = balance/);
  assert.match(sql,/primary key \(user_id, source_key\)/);
  assert.match(sql,/on conflict \(user_id,source_key\) do nothing/);
  assert.match(sql,/from private\.buklod_kingdom_shards_wallet_v1\s+where user_id=p_uid for update/);
  assert.match(sql,/security invoker set search_path=''/);
  assert.equal((sql.match(/security definer set search_path=''/g)||[]).length,2);
  assert.equal((sql.match(/grant execute on function public\./g)||[]).length,2);
  assert.match(sql,/v_uid uuid := \(select auth\.uid\(\)\)/);
  assert.match(sql,/a\.status='credited'/);
  assert.match(sql,/l\.source_key='kingdom:mastery:v1:'\|\|a\.game_id/);
  assert.match(sql,/c\.redeemed_at is not null/);
  assert.match(sql,/1::integer as reward/);
  assert.match(sql,/2::integer as reward/);
  assert.doesNotMatch(sql,/insert into public\.buklod_points_ledger/i);
  assert.doesNotMatch(sql,/service_role|user_metadata|p_amount|p_price/);
});

test('purchase is atomic, price comes from server, and repeat buys never charge again',()=>{
  assert.match(sql,/v_price := case v_item/);
  for (const [key,price] of [['wisdom_lens',2],['guardian_shield',3],
    ['explorer_compass',2],['aura_emerald',10]]) {
    assert.match(sql,new RegExp("when '"+key+"' then "+price));
    assert.match(shop,new RegExp(key));
    assert.match(client,new RegExp(key));
  }
  assert.match(sql,/where user_id=v_uid for update/);
  assert.match(sql,/if exists\(select 1 from private\.buklod_kingdom_items_v1/);
  assert.match(sql,/already_owned',true/);
  assert.match(sql,/if v_balance < v_price then/);
  assert.match(sql,/balance=balance-v_price, spent=spent\+v_price/);
  assert.match(sql,/values\(v_uid,'buy:'\|\|v_item,-v_price,v_balance-v_price\)/);
  assert.match(sql,/grant execute on function public\.buy_my_buklod_kingdom_item_v1\(text\) to authenticated/);
});

test('Shards client uses authenticated server data, user-specific offline cache and no optimistic debit',()=>{
  assert.match(client,/data\.session\?\.user\.id !== userId/);
  assert.match(client,/CACHE_PREFIX \+ userId/);
  assert.match(client,/balance ===? earned - spent|earned - spent !== balance/);
  assert.match(client,/get_my_buklod_kingdom_shards_v1/);
  assert.match(client,/buy_my_buklod_kingdom_item_v1/);
  assert.match(client,/await enforceAccount\(userId\)/);
  assert.match(client,/snapshot\.source !== 'server'/);
  assert.match(client,/Promise\.race/);
  assert.match(shop,/snapshot\.source==='server'/);
  assert.match(shop,/snapshot\.ownedItems\.includes\(item\.key\)/);
  assert.match(shop,/Refresh to check your balance before trying again/);
  assert.match(legacy,/router\.push\('\/games\/rewards'/);
  assert.match(legacy,/hasKingdomPower\(shards,'aura_emerald'\)/);
  assert.doesNotMatch(shop,/service_role|update_buklod_points|admob|setBalance\(.*-item\.price/);
});

test('all three powers have a concrete noncredit practice effect, offline cached entitlements and no BP edge',()=>{
  assert.match(practice,/useFocusEffect\(useCallback/);
  assert.match(practice,/getCachedKingdomShards\(userId\)/);
  assert.match(practice,/getMyKingdomShards\(userId\)/);
  assert.match(practice,/hasKingdomPower\(powerState,'wisdom_lens'\)/);
  assert.match(practice,/hasKingdomPower\(powerState,'guardian_shield'\)/);
  assert.match(practice,/hasKingdomPower\(powerState,'explorer_compass'\)/);
  assert.match(practice,/hasKingdomPower\(powerState,'aura_emerald'\)/);
  assert.match(practice,/setWisdomHintIndex\(i\)/);
  assert.match(practice,/eliminated\.includes\(j\)/);
  assert.match(practice,/if \(hasShield\)/);
  assert.match(practice,/items\[index\]\?\.answer_index === value/);
  assert.match(practice,/if \(score !== 3\)/);
  assert.match(practice,/await AsyncStorage\.setItem\(key,String\(saved\)\)/);
  assert.doesNotMatch(practice,/supabase\.rpc|awardBP|mintShards|giveMoney/);
});

test('free deterministic continuation has 39 valid games and 5,000 levels each',()=>{
  assert.equal(KINGDOM_OFFLINE_MAX_LEVEL,5000);
  assert.equal(gameIds.length,39);
  assert.equal(new Set(gameIds).size,39);
  for(const gameId of gameIds) {
    const selectedLevels=[1,2,10,199,200,201,299,500,1000,2000,3000,4000,5000];
    for(const level of selectedLevels){
      const questions=buildKingdomOfflineLevel(gameId,level,'test-user-a');
      assert.equal(questions.length,3);
      assert.deepEqual(questions,buildKingdomOfflineLevel(gameId,level,'test-user-a'));
      assert.equal(new Set(questions.map(q=>q.prompt)).size,3);
      questions.forEach(q=>{
        assert.equal(q.choices.length,4);
        assert.equal(new Set(q.choices).size,4);
        assert.ok(q.answer_index>=0 && q.answer_index<4);
        assert.match(q.choices[q.answer_index],/^\d+$/);
        assert.match(q.explanation,/Solution: \d+/);
      });
    }
  }
  assert.deepEqual(buildKingdomOfflineLevel(gameIds[0],5001,'test-user-a'),[]);
  assert.notDeepEqual(buildKingdomOfflineLevel(gameIds[0],5000,'test-user-a'),
    buildKingdomOfflineLevel(gameIds[0],5000,'test-user-b'));
  const generator=read('src/features/games/kingdom/platform/kingdomOfflineGenerator.mjs');
  assert.ok((generator.match(/\[\`/g)||[]).length>=30);
});
