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
 assert.match(sql,/values\('buklod-character-art-v1','buklod-character-art-v1',true,1048576/);
 assert.match(sql,/on conflict\(id\) do nothing/);
 assert.match(sql,/1048576/);
 assert.doesNotMatch(sql,/create policy[\s\S]{0,140}for insert\s+to authenticated/i);
 assert.match(publisher,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(publisher,/BUKLOD_ART_PUBLISH_APPROVED/);
 assert.match(publisher,/--publish/);
 assert.ok(publisher.includes('verifyRemoteCounts(client,manifest.items)'));
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
 assert.match(sql,/after insert or update of claim_state on public\.buklod_points_ledger/i);
 assert.match(sql,/private\.buklod_capture_verified_ledger_task_v1/);
 assert.match(sql,/on conflict\(user_id,metric_key,source_table,source_id\) do update/i);
 assert.match(sql,/verified=excluded\.verified/i);
 assert.match(sql,/set verified=false/i);
 assert.match(sql,/and verified=true/i);
 assert.match(sql,/on conflict do nothing/i);
});
test('13-Character inventory RPC cannot read another account or expose locked Special identity',()=>{
 assert.match(sql,/v_uid uuid:=\(select auth\.uid\(\)\)/);
 assert.match(sql,/get_my_buklod_character_selection_v2\(\)/);
 assert.match(sql,/visible_special_character_ids/);
 assert.match(sql,/Special Character is not unlocked/);
 assert.match(sql,/if v_character in \('ace','ellusur'/i);
 assert.match(sql,/character_id text not null check\(character_id in\s*\('phan','quin','van','christian','lhen'/i);
 assert.match(sql,/grant execute on function public\.get_my_buklod_character_story_tasks_v1\(text\) to authenticated/i);
 assert.match(sql,/revoke all on function private\.buklod_evaluate_character_story_tasks_v1\(uuid,text,integer\) from public,anon,authenticated/i);
 assert.doesNotMatch(sql,/insert into public\.buklod_points_ledger|update [^;]*buklod_kingdom_shards|update [^;]*qmp/i);
});
test('five independent per-character task slots, stage gate and verifiable ownership',()=>{
 for(const metric of ['character_public_post','character_public_comment','character_public_reaction',
  'character_public_share','character_public_active_week']) assert.match(sql,new RegExp(metric));
 assert.match(sql,/from generate_series\(1,p_level\)/i);
 assert.match(sql,/item_index between 1 and 4\)=4/i);
 assert.match(sql,/s\.level_no,5,/i);
 assert.match(rubric,/storyItemTaskTarget/);
 assert.match(hub,/storyStageProgress/);
 assert.match(hub,/item\.owned\|\|!item\.earned_at/);
 assert.match(hub,/storyItemKey\(worldId,item\.level,item\.item_index\)/);
});

test('Cross-feature task alternatives count only signed server-claimed BP credits',()=>{
 assert.match(sql,/lower\(coalesce\(new\.direction,''\)\) <> 'credit'/);
 assert.match(sql,/new\.points,0\)<=0/);
 assert.match(sql,/new\.claim_state,''\)\)='claimed'/);
 for(const name of ['daily_bible','devotional','abc_growth_lesson','learning_progress_verification',
  'bible_quiz_easy','bible_quiz_medium','bible_quiz_hard','scope_attendance','prayer_response'])
  assert.ok(sql.includes(name),'verified task signal missing: '+name);
 for(const key of ['character_bible_reading','character_devotional','character_formation',
  'character_quiz','character_attendance','character_prayer'])
  assert.ok(sql.includes(key),'metric missing: '+key);
 assert.match(sql,/v_posts>=c\.target or v_bible>=c\.target/);
 assert.match(sql,/v_comments>=c\.target or \(v_formation\+v_devotional\)>=c\.target/);
 assert.match(sql,/v_reactions>=c\.target or v_quiz>=c\.target/);
 assert.match(sql,/v_shares>=c\.target or \(v_attendance\+v_prayer\)>=c\.target/);
});

test('publisher checks byte-level remote integrity before writing readiness marker',async()=>{
 const {verifyRemoteCounts}=await import('../scripts/publish-character-collectible-art.mjs');
 const {expectedEntries}=await import('../scripts/validate-character-collectible-art.mjs');
 const {createHash}=await import('node:crypto');
 const payload=Buffer.from('known verified artwork payload');
 const hash=createHash('sha256').update(payload).digest('hex');
 const items=expectedEntries().map(x=>({...x,sha256:hash}));
 let corrupt=false;
 const client={storage:{from:()=>({
  list:async prefix=>({data:items.filter(x=>x.path.startsWith(prefix+'/')).map(x=>({name:x.path.split('/').at(-1)})),error:null}),
  download:async name=>({data:{arrayBuffer:async()=>corrupt&&name===items[0].path?Buffer.from('corrupted'):payload},error:null}),
 })}};
 await verifyRemoteCounts(client,items);
 corrupt=true;
 await assert.rejects(()=>verifyRemoteCounts(client,items),/Remote asset hash mismatch: phan:L01:I01/);
 assert.match(publisher,/BUKLOD_ART_EXPECTED_PROJECT_REF/);
 assert.match(publisher,/BUKLOD_ART_EXPECTED_MANIFEST_SHA256/);
 assert.match(publisher,/verifyRemoteCounts\\(client,manifest\\.items\\)/);
});
