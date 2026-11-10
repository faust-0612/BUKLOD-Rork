import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql = read('supabase/migrations/20261110110100_buklod_kingdom_ai_continuation_v1.sql');
const edge = read('supabase/functions/buklod-kingdom-ai-continuation-v1/index.ts');
const practice = read('src/features/games/kingdom/platform/KingdomAIContinuation.tsx');
const center = read('src/features/games/kingdom/platform/KingdomInteriorCenter.tsx');
const map = read('src/features/games/kingdom/BuklodKingdomMapPremium.tsx');
const audio = read('src/features/games/runtime/rorkAudio.ts');
const catalog = JSON.parse(read('src/features/games/kingdom/platform/game-catalog.json'));

test('all 13 stations show Kingdom sponsorship and available continuation', () => {
  assert.equal(catalog.characters.length,13);
  const routes = catalog.characters.map(v=>v.stationId);
  assert.equal(new Set(routes).size,13);
  for(const id of routes){
    const route=read('src/app/games/'+id+'.tsx');
    assert.ok(route.includes('KingdomInteriorCenter') ||
      (route.includes('KingdomMasteryCheck') &&
       route.includes('KingdomAIContinuation') &&
       route.includes('BuklodAdMobBanner')),
      id + ' must expose practice, mastery and placement');
  }
  assert.match(center, /<KingdomAIContinuation/);
  assert.match(center, /<BuklodAdMobBanner placement="content"/);
  assert.match(center, /NEXT CHALLENGE/);
  assert.match(center, /\% options\.length/);
});

test('AI continuation sessions cap charges globally and per member and prevent concurrent generation', () => {
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /pg_advisory_xact_lock/g);
  assert.match(sql, /v_daily>=4/);
  assert.match(sql, /v_daily>=2/);
  assert.match(sql, /v_daily>=100/);
  assert.match(sql, /unique \(user_id,game_id,level_no\)/);
  assert.match(sql, /generation_attempts between 1 and 2/);
  assert.match(sql, /'started',v_started/);
  assert.match(sql, /status='ready'/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.buklod_kingdom_ai_levels_v1 from public, anon, authenticated/);
  assert.match(sql, /grant select,insert,update on public\.buklod_kingdom_ai_levels_v1 to service_role/);
  assert.doesNotMatch(sql, /insert into public\.buklod_points_ledger|update public\.buklod_point_rules|buklod_pf_|qmp/i);
});

test('Edge AI generator fails closed before provider spending and never manufactures BP', () => {
  assert.match(edge, /BUKLOD_KINGDOM_AI_ENABLED/);
  assert.match(edge, /!== 'true'/);
  assert.match(edge, /session\.auth\.getUser\(\)/);
  assert.match(edge, /reserve_my_buklod_kingdom_ai_level_v1/);
  assert.match(edge, /!reservation\.started/);
  assert.match(edge, /MAX_PREVIOUS = 1000/);
  assert.match(edge, /duplicate_ai_question/);
  assert.match(edge, /similar\(prompt, previous\)/);
  assert.match(edge, /attempt < 2/);
  assert.match(edge, /AbortSignal\.timeout\(14000\)/);
  assert.match(edge, /practice_only: true, bp_awarded: 0/);
  assert.doesNotMatch(edge, /buklod_points_ledger|award_buklod|grant_points|buklod_pf_|qmp/i);
  assert.match(practice, /supabase\.functions\.invoke<Response>/);
  assert.match(practice, /bp_awarded !== 0/);
  assert.match(practice, /safeQuestions/);
  assert.match(practice, /NEXT AI PRACTICE LEVEL/);
});

test('offline ambience is a real packaged original WAV and obeys game-sound settings', () => {
  const asset=new URL('../assets/sounds/buklod-kingdom-ambient-original.wav',import.meta.url);
  assert.ok(existsSync(asset));
  const wav=readFileSync(asset);
  assert.equal(wav.subarray(0,4).toString('ascii'),'RIFF');
  assert.equal(wav.subarray(8,12).toString('ascii'),'WAVE');
  assert.equal(wav.readUInt32LE(24),12000);
  assert.ok(wav.byteLength>120000 && wav.byteLength<500000);
  assert.match(audio, /LOCAL_KINGDOM_AMBIENCE/);
  assert.match(audio, /isBuklodGameSoundEnabled\(\)/);
  assert.match(audio, /getBuklodGameSoundSettings\(\)/);
  assert.match(audio, /AppState\.addEventListener/);
  assert.match(audio, /loadedOnce/);
  assert.match(map, /useRorkGameAmbience\('kingdom-map'\)/);
  assert.match(map, /music-note-off/);
  assert.match(map, /getRorkGameMedia\(selectedStation\.id\)/);
});
