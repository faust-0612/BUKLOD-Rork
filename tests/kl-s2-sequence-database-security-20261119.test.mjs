import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL('../'+file, import.meta.url),'utf8');
const original = read('supabase/migrations/20261119150000_kl_s2_rewards_15_5_min20_forward_only.sql');
const seq = read('supabase/migrations/20261119221000_kl_s2_sequential_no_timer_series_reflection.sql');
const readRpc = read('supabase/migrations/20261119221500_kl_s2_reader_rpc_server_lock.sql');

test('all new S2 member entrypoints scope identity to authenticated auth.uid',()=>{
 for (const signature of [
   'kl_s2_reader_progress_v1','kl_s2_series_reflection_status_v1',
   'kl_s2_submit_series_reflection_v1']) {
   const start=seq.indexOf('CREATE OR REPLACE FUNCTION public.'+signature);
   assert.ok(start>0,signature);
   const block=seq.slice(start,seq.indexOf('END $fn$;',start)+8);
   assert.match(block,/auth\.uid\(\)/,signature);
   assert.match(block,/IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'/,signature);
   assert.doesNotMatch(block,/p_user_id|p_claimed_user_id/,signature);
 }
});
test('private reflection records are not accessible through direct anon/authenticated table grants',()=>{
 assert.match(seq,/private\.kl_s2_series_reflections ENABLE ROW LEVEL SECURITY/);
 assert.match(seq,/REVOKE ALL ON TABLE private\.kl_s2_series_reflections FROM PUBLIC,anon,authenticated/);
 assert.match(seq,/PRIMARY KEY\(user_id,season_number\)/);
 assert.match(seq,/reflection_text text NOT NULL CHECK/);
 assert.doesNotMatch(seq,/GRANT SELECT ON TABLE private\.kl_s2_series_reflections TO authenticated/);
});
test('public RPC permissions have anonymous execution revoked and only member permissions granted',()=>{
 for (const entry of ['kl_s2_reader_progress_v1(integer)',
  'kl_s2_series_reflection_status_v1(integer)',
  'kl_s2_submit_series_reflection_v1(integer,text)']) {
   assert.ok(seq.includes('REVOKE ALL ON FUNCTION public.'+entry+' FROM PUBLIC,anon'));
   assert.ok(seq.includes('GRANT EXECUTE ON FUNCTION public.'+entry+' TO authenticated'));
 }
});
test('old client manuscript and signed-media-path RPC check ordering before exposure',()=>{
 const readGate=readRpc.indexOf('private.kl_s2_previous_chapter_complete_v1(auth.uid(),p_episode_id)');
 const manuscript=readRpc.indexOf('jsonb_build_array(jsonb_build_object(\'text\',v.manuscript))');
 const mediaGate=readRpc.lastIndexOf('private.kl_s2_previous_chapter_complete_v1(auth.uid(),p_episode_id)');
 const mediaPaths=readRpc.indexOf("'path', m.storage_path");
 assert.ok(readGate>=0 && manuscript>readGate);
 assert.ok(mediaGate>readGate && mediaPaths>mediaGate);
 assert.match(readRpc,/v_episode\.status = 'approved'/);
 assert.match(original,/BEFORE INSERT OR UPDATE OF episode_id ON public\.kl_reading_sessions/);
});
test('wallet credits require verified 30-chapter source and one idempotent ledger source key',()=>{
 assert.match(seq,/v_count<>30/);
 assert.match(seq,/v_words<8 OR v_distinct<6/);
 assert.match(seq,/ON CONFLICT \(user_id,season_number\) DO NOTHING/);
 assert.match(seq,/PERFORM 1 FROM private\.kl_s2_series_reflections[\s\S]+FOR UPDATE/);
 assert.match(seq,/NOT v_existing THEN[\s\S]*public\.buklod_award_verification_points_v1/);
 assert.match(seq,/l\.direction='credit' AND l\.points=50/);
 assert.match(seq,/RAISE EXCEPTION 'KL bonus ledger verification failed'/);
});
test('Season2 economy and completion remain off until explicitly approved and on/after Dec6',()=>{
 assert.match(original,/enabled boolean NOT NULL DEFAULT false/);
 assert.match(original,/effective_at timestamptz NOT NULL DEFAULT '2026-12-06/);
 assert.match(seq,/IF NOT private\.kl_s2_rewards_enabled_v1\(\) THEN/);
 assert.doesNotMatch(seq,/UPDATE private\.kl_s2_reward_rollout/);
});

test('existing quiz attempts and old clients cannot bypass S2 progression or 2-hour limit',()=>{
 assert.match(seq,/AND NOT private\.kl_s2_previous_chapter_complete_v1\(v_user,p_episode_id\)/);
 assert.match(seq,/AND NOT private\.kl_s2_previous_chapter_complete_v1\(auth\.uid\(\),v\.episode_id\)/);
 assert.match(seq,/NOT private\.kl_s2_rewards_enabled_v1\(\) AND\s+v\.started_at<now\(\)-interval '2 hours'/);
});

test('series metadata private RLS and public release-only catalog do not leak drafts',()=>{
 const sql=read('supabase/migrations/20261123203000_kl_s2_series_dashboard_catalog.sql');
 assert.match(sql,/ALTER TABLE private\\.kl_s2_series_metadata ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON TABLE private\\.kl_s2_series_metadata FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/p\\.is_active IS TRUE AND p\\.role::text='system_admin'/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\\.kl_s2_admin_save_series_v1/);
 const released=sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.kl_s2_reader_series_catalog_v1'));
 assert.match(released,/e\\.status='approved' AND e\\.approved_at IS NOT NULL/);
 assert.match(released,/e\\.release_at IS NOT NULL AND e\\.release_at<=now\\(\\)/);
 assert.doesNotMatch(released,/manuscript|storage_path|reflection_text|answer_key/);
 assert.match(released,/TO anon, authenticated/);
});
