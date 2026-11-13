import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const cluster=read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');
const door=read('src/components/BuklodSaliksikDoor.tsx');
const admin=read('src/app/admin/index.tsx');
const vault=read('src/app/admin/saliksik-library.tsx');
const member=read('src/app/scope/saliksik.tsx');
const client=read('src/lib/saliksikClient.ts');
const sql=read('supabase/migrations/20261112221000_saliksik_private_vault_objective_mastery_r1.sql');

test('Cluster Home doorway is lazy and gated behind faith and separate rollout',()=>{
 assert.match(cluster,/<BuklodSaliksikDoor scope=\{scope\}/);
 assert.match(door,/EXPO_PUBLIC_SALIKSIK_ENABLED!=='true'/);
 assert.match(door,/scope\.scope_type!=='CLUSTER'/);
 assert.match(door,/!scope\.show_faith_content/);
 assert.doesNotMatch(door,/supabase|fetch\(/);
 assert.match(cluster,/BuklodScopeBuklodLessonPanel scope=\{scope\}/);
 assert.match(cluster,/BuklodFirstViewAd placement="cluster"/);
});
test('Admin vault never makes unverified AI drafts live and preserves original privacy',()=>{
 assert.match(admin,/title="SALIKSIK Knowledge Vault"/);
 assert.match(vault,/AdminGate/);
 assert.match(vault,/Review draft/);
 assert.match(vault,/APPROVE AND PUBLISH CONTENT/);
 assert.match(client,/saliksik_admin_register_v1/);
 assert.match(client,/saliksik_admin_preview_v1/);
 assert.match(client,/saliksik_admin_publish_v1/);
 assert.match(client,/saliksik-source-originals/);
 assert.match(sql,/member_enabled boolean NOT NULL DEFAULT false/);
 assert.match(sql,/saliksik_admin_publish_v1/);
});
test('Member assessment never receives answer keys or self-awards rewards',()=>{
 assert.match(member,/saliksikBegin/);
 assert.match(member,/saliksikSubmit/);
 assert.doesNotMatch(member,/correctIndex|buklod_points_ledger/);
 assert.match(sql,/'prompt',v_q->>'prompt','options',v_q->'options'/);
 assert.doesNotMatch(sql,/'correctIndex',v_q->>'correctIndex'/);
 assert.match(sql,/CREATE UNIQUE INDEX IF NOT EXISTS saliksik_single_open_attempt/);
 assert.match(sql,/ON CONFLICT\(user_id,source_key\) DO NOTHING/);
 assert.match(sql,/IF v_pass THEN/);
 assert.match(sql,/IF v_required=8 AND v_earned=v_required THEN/);
 assert.match(sql,/IF v_count<>8/);
 assert.match(sql,/claim_state/);
 assert.match(sql,/retry_after/);
 assert.match(sql,/v_existing NOT IN \(0,2,4,6\)/);
});
test('Objective credits fixed at 10/20; Master 35 cannot publish',()=>{
 assert.match(sql,/WHEN 'discover' THEN 10 ELSE 20 END/);
 assert.match(sql,/master_tier_not_approved/);
 assert.match(sql,/i\.tier='master'/);
 assert.match(sql,/\('saliksik_master','SALIKSIK Master',35,35,NULL,NULL,false/);
 assert.match(sql,/source_key,source_id,description/);
 assert.match(sql,/status='published'/);
});
