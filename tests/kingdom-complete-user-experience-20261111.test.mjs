import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildKingdomOfflineLevel } from '../src/features/games/kingdom/platform/kingdomOfflineGenerator.mjs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const catalog = JSON.parse(read('src/features/games/kingdom/platform/game-catalog.json'));
const games = catalog.characters.flatMap(c => c.games.map(g => g.id));

test('all 39 Kingdom games have 200 reproducible, unique and answerable offline practice levels', () => {
  assert.equal(games.length,39);
  assert.equal(new Set(games).size,39);
  for(const game of games) {
    const prompts = new Set();
    for(let level=1;level<=200;level++) {
      const items=buildKingdomOfflineLevel(game,level,'account-A');
      assert.equal(items.length,3);
      assert.deepEqual(items,buildKingdomOfflineLevel(game,level,'account-A'));
      for(const item of items) {
        assert.equal(item.choices.length,4);
        assert.equal(new Set(item.choices).size,4);
        assert.ok(item.answer_index>=0&&item.answer_index<4);
        assert.match(item.choices[item.answer_index], /^\d+$/);
        assert.match(item.explanation, /Solution: \d+/);
        assert.ok(!prompts.has(item.prompt),game+' duplicated '+item.prompt);
        prompts.add(item.prompt);
      }
    }
    assert.equal(prompts.size,600);
  }
  assert.notDeepEqual(buildKingdomOfflineLevel(games[0],5,'account-A'),
    buildKingdomOfflineLevel(games[0],5,'account-B'));
  for(const invalid of [0,201,-1,2.5,NaN]) {
    assert.deepEqual(buildKingdomOfflineLevel(games[0],invalid,'account-A'),[]);
  }
});

test('the actual Kingdom game centers, including Christian and Mitch, open one catalog-gated offline route', () => {
  const practice=read('src/app/games/practice.tsx');
  for(const path of [
    'src/features/games/kingdom/platform/KingdomInteriorCenter.tsx',
    'src/app/games/christian-civic-leadership.tsx',
    'src/app/games/mitch-restore-mural.tsx',
  ]) assert.match(read(path), /\/games\/practice/);
  assert.match(practice,/ALL_IDS\.has\(gameParam\)/);
  assert.match(practice,/<KingdomOfflineContinuation/);
  assert.match(practice,/!user\?\.id/);
  assert.match(practice,/no BP, XP or cash/);
  const local=read('src/features/games/kingdom/platform/KingdomOfflineContinuation.tsx');
  assert.match(local,/buklod:kingdom:offline:v1:/);
  assert.match(local,/if \(score !== 3\)/);
  assert.match(local,/score===3 && level<LIMIT/);
  assert.match(local,/score<3/);
  assert.match(local,/keyRef\.current !== key/);
  assert.match(local,/await AsyncStorage\.setItem\(key,String\(saved\)\)/);
  assert.doesNotMatch(local,/supabase\.rpc|creditBP|grantXP|cash_reward/);
});

test('Kingdom has a locally bundled original ambient theme and movable character companion', () => {
  const audio=read('src/features/games/runtime/rorkAudio.ts');
  const map=read('src/features/games/kingdom/BuklodKingdomMapPremium.tsx');
  const companion=read('src/features/games/runtime/BuklodGameCharacterCompanion.tsx');
  const file=new URL('../assets/sounds/buklod-kingdom-ambient-original.wav',import.meta.url);
  assert.ok(readFileSync(file).byteLength>10000);
  assert.match(audio,/LOCAL_KINGDOM_AMBIENCE/);
  assert.match(audio,/isBuklodGameSoundEnabled/);
  assert.match(audio,/AppState\.currentState/);
  assert.match(audio,/readyListener\.remove\(\)/);
  assert.match(map,/useRorkGameAmbience\('kingdom-map'\)/);
  assert.match(map,/onPress=\{toggleMusic\}/);
  assert.match(companion,/PanResponder\.create/);
  assert.match(companion,/width - 88/);
  assert.match(companion,/getTranslateTransform/);
});

test('claimed badge collection has real equipment controls and noncredit skill trials', () => {
  const legacy=read('src/app/games/legacy.tsx');
  const trials=read('src/features/games/kingdom/KingdomBadgeTrials.tsx');
  const medal=read('src/features/games/kingdom/KingdomRelicEmblem.tsx');
  assert.match(legacy,/changeItem\(item\.level, item\.itemIndex, equipped\)/);
  assert.match(legacy,/collectibleNames\(core, targetLevel\)/);
  assert.match(legacy,/SHOW MORE CLAIMED ITEMS/);
  assert.match(legacy,/trialItem\.redeemedAt/);
  assert.match(legacy,/<KingdomBadgeTrials/);
  assert.match(legacy,/getMyCharacterCollectibles\(core\)/);
  assert.match(legacy,/supabase\.auth\.getSession\(\)/);
  assert.match(trials,/if \(!item\.redeemedAt \|\| !item\.collectibleId\) return null/);
  assert.match(trials,/buklod:kingdom:badge-trial:v1:/);
  assert.match(trials,/score !== 3/);
  assert.match(trials,/await AsyncStorage\.setItem\(key,'mastered'\)/);
  assert.equal((trials.match(/question:'/g)||[]).length,15);
  for(const kind of ['expression','speech','profile_frame','visual_effect','title_badge']) {
    assert.match(medal,new RegExp(kind));
    assert.match(trials,new RegExp(kind+':'));
  }
  for(const forbidden of ['setShards(','grantBP(','creditPoints(','giveMoney(','updateLevel(']) {
    assert.ok(!legacy.includes(forbidden) && !trials.includes(forbidden));
  }
});
