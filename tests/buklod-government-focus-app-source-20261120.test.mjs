import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const entry=src('src/app/profile/buklod-local.tsx');
const api=src('src/lib/buklodGovernment.ts');
const nav=src('src/components/BuklodFoundationWorkspaceNav.tsx');
const focus=src('src/app/profile/focus-apps.tsx');
const guard=src('src/components/BuklodFocusAppRouteGuard.tsx');
const integration=src('src/lib/buklodFocusAppIntegration.ts');
const migration=src('supabase/migrations/20261120224500_buklod_government_focus_app.sql');

test('Government is the existing free Focus Apps door, not a new global navigation tab',()=>{
 assert.match(nav,/app === 'government'/);
 assert.match(nav,/Citizen services.*Verified government offices.*Free/);
 assert.match(guard,/pathname === '\/profile\/buklod-local'/);
 assert.match(focus,/Government public information is free for citizens/);
 assert.match(integration,/displayName: 'BUKLOD Government'/);
 assert.match(integration,/availability: 'AVAILABLE',\s*foundationApp: 'government'/);
 assert.doesNotMatch(entry,/BuklodFoundationPortalShell|BuklodFocusAppGate/);
});
test('citizen and agency operations exist without overriding the shared Wall or identity',()=>{
 for(const op of ['governmentDirectory','governmentApply','governmentVerifyEntity','governmentPosts',
  'governmentSubmitCase','governmentTransitionCase','governmentSaveService','governmentSaveEvent',
  'governmentAssignStaff','governmentToggleFollow']) {
   assert.ok(api.includes('export async function '+op),op);
 }
 for(const label of ['Find verified government offices','Government Wall & announcements',
  'Private Citizen Concern Desk','Official government workspace',
  'Publish official update','Official services & public programs']) assert.ok(entry.includes(label),label);
 assert.match(api,/\.rpc\('buklod_government_publish_v1'/);
 assert.match(api,/\.rpc\('buklod_government_submit_case_v1'/);
 assert.match(api,/\.rpc\('buklod_government_case_transition_v1'/);
 assert.doesNotMatch(api,/service_role|raw_user_meta_data/);
});
test('new tables have RLS, agency identity cannot be self-verified, staff privileges are scoped',()=>{
 const tables=['entities','staff','jurisdictions','publications','services','events','follows','cases','case_events','audit'];
 for(const t of tables){
   assert.ok(migration.includes('alter table public.buklod_government_'+t+' enable row level security;'),t+' RLS');
 }
 assert.match(migration,/gov_entities_apply[\s\S]*status='PENDING' and reviewed_by is null/);
 assert.match(migration,/gov_entities_verify[\s\S]*buklod_is_system_admin\(\)/);
 assert.match(migration,/gov_staff_update[\s\S]*role <> 'OWNER'/);
 assert.match(migration,/has_role\(p_entity uuid, p_roles text\[\]\)/);
 assert.match(migration,/status='VERIFIED' and s\.role=any\(p_roles\)/);
 assert.match(migration,/Location outside verified agency jurisdiction/);
});
test('moderation, private case visibility and network duplicate protection remain in the backend',()=>{
 for(const name of ['buklod_government_publish_v1','buklod_government_submit_case_v1','buklod_government_case_transition_v1']){
   assert.equal(migration.split('create or replace function public.'+name+'(').length-1,1,'duplicate function '+name);
 }
 assert.match(migration,/create_buklod_community_post_v3/);
 assert.match(migration,/p_public_wall and v_entity.entity_type<>'NATIONAL'/);
 assert.match(migration,/gov_cases_read[\s\S]*submitted_by=\(select auth.uid\(\)\)/);
 assert.match(migration,/gov_case_events_read[\s\S]*c.submitted_by=\(select auth.uid\(\)\)/);
 assert.match(migration,/p_request_key uuid/);
 assert.match(migration,/pg_advisory_xact_lock/);
 assert.match(migration,/unique\(entity_id,created_by,idempotency_key\)/);
 assert.match(migration,/Daily concern limit reached/);
 assert.match(api,/requestKey\?:string/);
 assert.match(entry,/setPostRequestKey\(randomUUID\(\)\)/);
 assert.match(entry,/setCaseRequestKey\(randomUUID\(\)\)/);
 assert.match(entry,/setCaseUpdateRequestKey\(randomUUID\(\)\)/);
});
test('migration has not accidentally duplicated SQL blocks',()=>{
 for(const anchor of [
  '-- BUKLOD Government:','-- Atomic case transition','-- Append-only audit',
  'create table if not exists public.buklod_government_entities',
  'create table if not exists public.buklod_government_jurisdictions',
  'create table if not exists public.buklod_government_audit',
 ]) assert.equal(migration.split(anchor).length-1,1,'duplicate SQL: '+anchor);
 assert.match(migration,/psgc_code ~ '\^\[A-Za-z0-9_-\]\{2,30\}\$'/);
 assert.ok(!migration.includes('drop table public.community_posts'));
});
