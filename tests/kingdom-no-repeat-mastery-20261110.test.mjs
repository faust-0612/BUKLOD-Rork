import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url),'utf8');
const sql = read('supabase/migrations/20261110110500_buklod_kingdom_mastery_no_repeat_v3.sql');
const oldSql = read('supabase/migrations/20261108030000_buklod_kingdom_mastery_challenges_v2.sql');
const map = read('src/features/games/kingdom/BuklodKingdomMapPremium.tsx');
const atmosphere = read('src/features/games/kingdom/BuklodKingdomAtmosphere.tsx');
const entries = [...sql.matchAll(/^\s*\('([a-z][a-z0-9-]+)',(\d+),'((?:[^']|'')*)','((?:[^']|'')*)'::jsonb,(\d+)\),?$/gm)]
  .map(m => ({ game:m[1], number:Number(m[2]), prompt:m[3].replaceAll("''","'"),
    choices:JSON.parse(m[4].replaceAll("''","'")), answerIndex:Number(m[5]) }));

test('39 game banks each have 15 fresh nonrepeated items in addition to their five untouched originals', () => {
  assert.equal(entries.length,585);
  assert.equal(new Set(entries.map(q=>q.game)).size,39);
  for (const game of new Set(entries.map(q=>q.game))) {
    const questions = entries.filter(q=>q.game===game);
    assert.deepEqual(questions.map(q=>q.number).sort((a,b)=>a-b),
      Array.from({length:15},(_,i)=>i+6));
  }
  assert.equal(new Set(entries.map(q=>q.prompt.toLowerCase())).size,585);
  assert.match(sql,/on conflict\(game_id,question_no\) do nothing/);
  assert.match(oldSql,/question_no between 1 and 20/);
});

test('all new answer choices are distinct, bounded and server-scored',()=>{
  for(const q of entries){
    assert.equal(q.choices.length,4,q.game+' '+q.number);
    assert.ok(q.answerIndex>=0 && q.answerIndex<4);
    assert.equal(new Set(q.choices.map(v=>String(v).toLowerCase().trim())).size,4);
    assert.ok(q.prompt.length>=30,q.game+' '+q.number);
    assert.ok(String(q.choices[q.answerIndex]).length>0);
  }
  assert.match(sql,/v_rotation := floor\(random\(\)\*4\)/);
  assert.match(sql,/v_q\.answer_index-v_rotation\+4/);
});

test('server never repeats an exposed question to the same user across all past attempt states',()=>{
  assert.match(sql,/not exists \(/);
  assert.match(sql,/private\.buklod_kingdom_mastery_attempts_v1 h/);
  assert.match(sql,/h\.user_id=v_uid and h\.game_id=v_game/);
  assert.match(sql,/asked\.item->>'id'=b\.question_no::text/);
  assert.match(sql,/Fresh Kingdom mastery questions are exhausted/);
  assert.match(sql,/v_count>=3/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/already_earned/);
  assert.doesNotMatch(sql,/insert into public\.buklod_points_ledger|update public\.buklod_point_rules/);
});

test('corrected consumable resource and shield scenarios are coherent',()=>{
  const kits=entries.filter(q=>q.prompt.includes('A kit starts with'));
  const shields=entries.filter(q=>q.prompt.includes('shield points and loses'));
  assert.equal(kits.length,6);
  assert.equal(shields.length,11);
  for(const q of kits){
    const m=q.prompt.match(/starts with (\d+) water packets\. At (\d+) packets per day for (\d+) days/);
    assert.ok(m,q.prompt);
    const answer=Number(m[1])-Number(m[2])*Number(m[3]);
    assert.equal(q.choices[q.answerIndex],String(answer));
  }
  for(const q of shields){
    const m=q.prompt.match(/starts with (\d+) shield points and loses (\d+) points twice/);
    assert.ok(m,q.prompt);
    const answer=Number(m[1])-Number(m[2])*2;
    assert.equal(q.choices[q.answerIndex],String(answer));
  }
});

test('approved visual map is bright, layered, richer and still uses the original 13 station coordinates',()=>{
  const section=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)+a.length));
  const legacy=read('src/features/games/kingdom/BuklodKingdomMap.tsx');
  assert.equal(section(map,'const STATIONS:','const JOURNEY_PATH'),
    section(legacy,'const STATIONS:','const JOURNEY_PATH'));
  assert.equal(section(map,'const JOURNEY_PATH','const FOREST_POINTS'),
    section(legacy,'const JOURNEY_PATH','const FOREST_POINTS'));
  for(const token of ['#3db5d6','BuklodKingdomAtmosphere','bridge-',
    'Waterfalls in the northern highlands','Coastal pier','cottage-',
    'showDock','MAP ONLY','musicEnabled','zoomStep',
    'music-lantern-', 'treasury-light-', 'sky-window-', 'flower-',
    'cottage-', 'kingdom-world-light-', 'mural-', 'bridge-']){
    assert.ok(map.includes(token),token+' missing');
  }
  assert.match(atmosphere,/isReduceMotionEnabled/);
  assert.match(atmosphere,/AppState\.addEventListener/);
  assert.match(atmosphere,/useNativeDriver: true/);
  assert.doesNotMatch(atmosphere,/fetch\(|ImageBackground/);
});
