import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261116120000_character_task_story_art_v1.sql');
const art=read('src/lib/buklodCharacterArt.ts');
const publisher=read('scripts/publish-character-collectible-art.mjs');
const hub=read('src/app/points/character-collections.tsx');
const rubric=read('src/lib/buklodCharacterCollectionLogic.ts');

test('public static-art bucket has no authenticated upload write grants',()=>{
 assert.match(sql,/buklod-character-art-v1/);
 assert.match(sql,/public=true/);
 assert.match(sql,/1048576/);
 assert.doesNotMatch(sql,/create policy[\s\S]{0,140}for insert\s+to authenticated/i);
 assert.match(publisher,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(publisher,/BUKLOD_ART_PUBLISH_APPROVED/);
 assert.match(publisher,/--publish/);
 assert.match(publisher,/verifyRemoteCounts/);
 assert.match(publisher,/MARKER,new TextEncoder/);
 assert.match(art,/published-v1\.json/);
});
test('server task ledger locks accounts and snapshots active character at event arrival',()=>{
 assert.match(sql,/primary key\(user_id,metric_key,source_table,source_id\)/i);
 assert.match(sql,/primary key\(user_id,character_id,level_no,item_index\)/i);
 assert.match(sql,/alter table private\.buklod_character_task_events_v1 enable row level security/i);
 assert.match(sql,/alter table private\.buklod_character_story_awards_v1 enable row level security/i);
 assert.match(sql,/revoke all on private\.buklod_character_task_events_v1 from public,anon,authenticated/i);
 assert.match(sql,/revoke all on private\.buklod_character_story_awards_v1 from public,anon,authenticated/i);
 assert.match(sql,/private\.buklod_character_selection_v2/);
 assert.match(sql,/after insert on private\.buklod_character_public_events_v3/i);
 assert.match(sql,/on conflict do nothing/i);
});
test('Special inventory RPC cannot read another account or expose locked Special identity',()=>{
 assert.match(sql,/v_uid uuid:=\(select auth\.uid\(\)\)/);
 assert.match(sql,/get_my_buklod_character_selection_v2\(\)/);
 assert.match(sql,/visible_special_character_ids/);
 assert.match(sql,/Special Character is not unlocked/);
 assert.match(sql,/grant execute on function public\.get_my_buklod_character_story_tasks_v1\(text\) to authenticated/i);
 assert.match(sql,/revoke all on function private\.buklod_evaluate_character_story_tasks_v1\(uuid,text,integer\) from public,anon,authenticated/i);
 assert.doesNotMatch(sql,/buklod_points_ledger|set_shards|qmp|finance|admob/i);
});
test('five independent per-character task slots, stage gate and verifiable ownership',()=>{
 for(const metric of ['character_public_post','character_public_comment','character_public_reaction',
  'character_public_share','character_public_active_week']) assert.match(sql,new RegExp(metric));
 assert.match(sql,/from generate_series\(1,p_level\)/i);
 assert.match(sql,/item_index between 1 and 4\)=4/i);
 assert.match(sql,/item_index,5,/i);
 assert.match(rubric,/storyItemTaskTarget/);
 assert.match(hub,/storyStageProgress/);
 assert.match(hub,/item\.owned&&Boolean\(item\.earned_at\)/);
});
