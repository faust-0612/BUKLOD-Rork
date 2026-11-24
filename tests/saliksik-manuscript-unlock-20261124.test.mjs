import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/20261124035000_saliksik_complete_manuscript_unlock_r3.sql');
const backend=read('supabase/functions/saliksik-manuscript-v1/index.ts');
const client=read('src/lib/saliksikClient.ts');
const member=read('src/app/scope/saliksik.tsx');
const admin=read('src/app/admin/saliksik-library.tsx');
const sqlTest=read('supabase/tests/saliksik_complete_manuscript_unlock_r3.sql');

test('manuscript unlock uses authenticated immutable nine-part series, not Points claiming',()=>{
 assert.match(sql,/v_user uuid:=auth\.uid\(\)/);
 assert.match(sql,/public\.saliksik_series_mastery/);
 assert.match(sql,/m\.version=v_version AND m\.user_id=v_user/);
 assert.match(sql,/v_count<>9 OR v_completed<>9/);
 assert.match(sql,/v_status<>'published'/);
 assert.match(sql,/member_enabled/);
 assert.doesNotMatch(sql,/claim_state\s*=\s*'claimed'/i);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.saliksik_manuscript_access_v1\(uuid\)/);
 assert.match(sql,/TO authenticated/);
 assert.match(sqlTest,/Unqualified user accessed completed manuscript/);
 assert.match(sqlTest,/Download required a Points claim/);
});
test('private originals require source-rights confirmation and are never public objects',()=>{
 assert.match(sql,/original_member_download_allowed boolean NOT NULL DEFAULT false/);
 assert.match(sql,/IF auth\.uid\(\) IS NULL OR NOT public\.is_system_admin\(\)/);
 assert.match(sql,/CASE WHEN v_original_allowed THEN v_original_path ELSE NULL END/);
 assert.match(backend,/if\(data\.original_available && data\.original_storage_path/);
 assert.match(backend,/saliksik_manuscript_access_v1/);
 assert.match(backend,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(backend,/createSignedUrl/);
 assert.match(backend,/const TTL = 90/);
 assert.match(admin,/Confirm redistribution rights/);
 assert.match(admin,/Authorize original sharing/);
 assert.doesNotMatch(member,/createSignedUrl|from\('saliksik-source-originals'\)/);
 assert.doesNotMatch(client,/SUPABASE_SERVICE_ROLE_KEY/);
});
test('every verified member gets complete derived nine-chapter downloadable DOCX when original restricted',()=>{
 assert.match(backend,/data\.chapters\?\.length!==9/);
 assert.match(backend,/for\(const chapter of data\.chapters\)/);
 assert.match(backend,/zipSync/);
 for(const entry of ['\'[Content_Types].xml\'','\'_rels/.rels\'','\'word/document.xml\'']){
  assert.ok(backend.includes(entry),'Missing DOCX package part '+entry);
 }
 assert.match(backend,/complete-study-manuscript\.docx/);
 assert.match(backend,/compiled\/.*collectionId/);
 assert.match(backend,/upsert:false/);
 assert.match(member,/entries\.length===9&&entries\.every\(x=>x\.completed\)/);
 assert.match(member,/DOWNLOAD COMPLETE MANUSCRIPT/);
 assert.match(client,/saliksikRequestCompleteManuscript/);
 assert.match(client,/functions\.invoke\('saliksik-manuscript-v1'/);
});
test('download is not an unauthorized unverified rewards operation',()=>{
 assert.doesNotMatch(sql,/INSERT INTO public\.buklod_points_ledger/i);
 assert.doesNotMatch(backend,/buklod_points_ledger/);
 assert.match(sqlTest,/Download changed canonical Points/);
 assert.match(sqlTest,/Disabled rollout leaked manuscript/);
});
