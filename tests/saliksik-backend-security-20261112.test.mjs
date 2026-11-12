import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261112221000_saliksik_private_vault_objective_mastery_r1.sql');
const edge=read('supabase/functions/saliksik-generate-v1/index.ts');
test('Private source objects and zero direct member table rights',()=>{
 assert.match(sql,/saliksik-source-originals','saliksik-source-originals',false/);
 assert.match(sql,/saliksik_source_admin_insert/);
 assert.match(sql,/public\.is_system_admin\(\)/);
 assert.match(sql,/REVOKE ALL ON public\.%I FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.%I\(%s\) TO authenticated/);
 assert.match(sql,/saliksik_admin_preview_v1/);
 assert.match(sql,/saliksik_admin_find_hash_v1/);
 assert.match(sql,/duplicate',true/);
 for(const name of ['saliksik_admin_register_v1','saliksik_admin_list_v1',
   'saliksik_catalog_v1','saliksik_begin_v1','saliksik_admin_find_hash_v1']){
   assert.equal(sql.split('CREATE OR REPLACE FUNCTION public.'+name).length-1,1,
     'SQL migration must define '+name+' exactly once');
 }
 assert.ok(sql.length<36000,'Migration must not accidentally duplicate a large block');
 assert.match(sql,/p_token uuid/);
});
test('Processing lease is bounded, checksum-checked, source review required',()=>{
 assert.match(sql,/lease_expires_at=now\(\)\+interval '3 minutes'/);
 assert.match(sql,/stale_processing_lease/);
 assert.match(edge,/source_checksum_mismatch/);
 assert.match(edge,/filter:f=>f\.name==='word\/document\.xml'/);
 assert.match(edge,/await client\.auth\.getUser\(\)/);
 assert.match(edge,/client\.rpc\('is_system_admin'\)/);
 assert.match(edge,/saliksik_admin_store_draft_v1/);
 assert.match(edge,/review_required:true/);
 assert.doesNotMatch(edge,/SUPABASE_SERVICE_ROLE_KEY/);
});
test('Account isolation and server-owned answer evaluation',()=>{
 assert.match(sql,/a\.user_id<>auth\.uid\(\)/);
 assert.match(sql,/buklod_user_is_active_scope_member/);
 assert.match(sql,/question_order integer\[\] NOT NULL/);
 assert.match(sql,/jsonb_typeof\(v_answer\)<>'number'/);
 assert.match(sql,/v_core:=/);
 assert.match(sql,/v_pass:=\(round\(v_score\)::int>=80 AND v_core\)/);
 assert.match(sql,/ON CONFLICT\(user_id,source_key\) DO NOTHING/);
 assert.match(sql,/IF coalesce\(v_new,false\) AND NOT public\.is_system_admin\(\)/);
});
