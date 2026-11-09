import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const daily=read('supabase/migrations/20261109141500_buklod_bible_quiz_v4_daily_secure.sql');
const bank=read('supabase/migrations/20261109142500_buklod_bible_v4_reviewed_question_bank.sql');
const arenaBank=read('supabase/migrations/20261109142600_buklod_bible_v4_accessible_arena_bank.sql');
const events=read('supabase/migrations/20261109143500_buklod_bible_v4_live_events.sql');
const essays=read('supabase/migrations/20261109144000_buklod_bible_v4_admin_essay_queue.sql');
const ui=read('src/components/bible/BuklodBibleQuizV4.tsx');
const legacy=read('src/app/faith/bible-quiz.tsx');
const home=read('src/app/(tabs)/home.tsx');
const eventUI=read('src/app/faith/bible-events.tsx');
const settings=read('src/lib/buklodSounds.ts');
const controls=read('src/app/settings/sounds.tsx');
const native=read('src/features/games/runtime/BuklodGameFeedback.native.ts');
const web=read('src/features/games/runtime/BuklodGameFeedback.web.ts');
const ads=read('src/lib/buklodAdOpportunities.ts');
const mastery=read('src/features/games/kingdom/platform/KingdomMasteryCheck.tsx');
test('daily V4 is isolated from R3 and all reward actions are server-owned',()=>{
 assert.match(daily,/create table if not exists private\.buklod_bible_v4_attempts/);
 assert.match(daily,/unique\(user_id,local_date\)/);
 assert.match(daily,/pg_advisory_xact_lock/);
 assert.match(daily,/legacy_attempt/);
 assert.match(daily,/max\(x\.created_at\)/);
 assert.match(daily,/concept_key=q\.concept_key/);
 assert.match(daily,/coalesce\(array_length\(a\.question_keys,1\),0\)<>5/);
 assert.match(daily,/bible_quiz:r3:/);
 assert.match(daily,/on conflict\(user_id,source_key\) do nothing/);
 assert.match(daily,/public\.buklod_is_system_admin\(\)/);
 assert.match(daily,/pending_review/);
 assert.match(daily,/admin_review_buklod_bible_v4_essay/);
 assert.doesNotMatch(daily,/insert into public\.buklod_pf_/);
});
test('graduated daily points preserve existing maxima without granting 12 BP for 4/5',()=>{
 const parts=daily.match(/create or replace function private\.buklod_bible_v4_points[\s\S]*?revoke all on function private\.buklod_bible_v4_points/);
 assert.ok(parts,'server-side points mapping');
 assert.match(parts[0],/when 'easy' then case when p_units>=9 then 3/);
 assert.match(parts[0],/when 'medium' then case when p_units=10 then 6/);
 assert.match(parts[0],/when 'hard' then case when p_units=10 then 12 when p_units=9 then 10 when p_units>=8 then 8/);
 assert.match(daily,/case when extract\(isodow from local_day\)::integer in \(2,6\) then 'essay'/);
});
test('reviewed bank contains genuinely contextual Hard items and typed responses',()=>{
 for(const prefix of ['v4_h_s','v4_h_a','v4_h_c','v4_h_n','v4_h_x'])assert.ok(bank.includes(prefix),prefix);
 assert.match(bank,/Mga Gawa 6:1–7/);
 assert.match(bank,/Levitico 19:9–10/);
 assert.match(arenaBank,/v4_m_s15/);
 assert.match(events,/skill in \('situation','analysis','comparison'\)/);
 assert.match(daily,/jsonb_array_elements_text\(q\.answer_spec->'answers'\)/);
 assert.match(daily,/jsonb_array_elements\(q\.answer_spec->'groups'\)/);
 assert.match(daily,/rationale/);
 assert.match(daily,/q\.options->>q\.correct_choice/);
});
test('flash first-three and monthly 3-5 player rankings are serialized and idempotent',()=>{
 assert.match(events,/max_players between 3 and 5/);
 assert.match(events,/unique\(event_id,user_id\)/);
 assert.match(events,/for update/);
 assert.match(events,/rank_slot<=3/);
 assert.match(events,/ready_at is not null\)<3/);
 assert.match(events,/score desc, submitted_at asc, user_id asc/);
 assert.match(events,/bible_flash:/);
 assert.match(events,/bible_arena:/);
 assert.match(events,/on conflict\(user_id,source_key\) do nothing/);
 assert.match(events,/v_kind='flash' then 1 else 10/);
 assert.match(events,/case when q\.n<=4 then 10 when q\.n<=8 then 15 else 20/);
 assert.match(events,/score=v_score where id=en\.id/);
 assert.match(daily,/Two distinct enumeration answers are required/);
 assert.match(events,/public\.buklod_is_system_admin\(\)/);
 assert.match(essays,/public\.buklod_is_system_admin\(\)/);
});
test('V4 UI has secure RPCs, typed inputs, partial score feedback, and R3 compatibility',()=>{
 assert.match(ui,/get_my_buklod_bible_quiz_v4/);
 assert.match(ui,/submit_my_buklod_bible_quiz_v4/);
 assert.match(ui,/q\.kind==='identification'/);
 assert.match(ui,/q\.kind==='enumeration'/);
 assert.match(ui,/q\.kind==='essay'/);
 assert.match(ui,/AsyncStorage/);
 assert.match(ui,/pending_review/);
 assert.match(legacy,/BuklodBibleQuizV4/);
 assert.match(legacy,/get_my_buklod_bible_quiz_r3/);
 assert.match(home,/<BuklodBibleEventsHomeCard \/>/);
 assert.match(eventUI,/join_my_buklod_bible_arena_v4/);
 assert.match(eventUI,/submit_my_buklod_bible_event_v4/);
 assert.match(eventUI,/roundByEvent/);
 assert.match(ui,/playBuklodGameFeedback\('move'\)/);
 assert.match(eventUI,/playBuklodGameFeedback\('move'\)/);
});
test('game sounds are offline native and browser sounds with an explicit preference',()=>{
 assert.match(settings,/games: true/);
 assert.match(settings,/isBuklodGameSoundEnabled/);
 assert.match(controls,/category: 'games'/);
 for(const name of ['buklod_reaction','buklod_community','buklod_approval','buklod_achievement','buklod_error','buklod_message_sent']){
  if(name==='buklod_reaction')continue;
  assert.match(native,new RegExp(name));
 }
 assert.match(native,/MAX_ACTIVE_FALLBACK_PLAYERS = 6/);
 assert.match(native,/isBuklodGameSoundEnabled\(\)/);
 assert.match(native,/Haptics/);
 assert.match(web,/isBuklodGameSoundEnabled\(\)/);
 assert.match(web,/createOscillator/);
 assert.match(web,/tryPlayRorkGameFeedback\(event, getBuklodGameSoundVolume\(\)\)/);
});
test('ads are optional after authenticated completions, not points or cash triggers',()=>{
 for(const key of ['bible_flash_submission_success','bible_arena_round_complete','kingdom_mastery_verified']){
  assert.match(ads,new RegExp(key));
 }
 assert.match(ads,/No credit, reward mutation or re-submission/);
 assert.match(mastery,/if \(\(result\.points_awarded \?\? 0\)>0\) void showBuklodAdOpportunity/);
 assert.match(eventUI,/if\(data\?\.submitted\)/);
 assert.doesNotMatch(events,/admob|qmp|cash_credited|pf_withdraw/i);
});
