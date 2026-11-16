import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const workflow=read('.github/workflows/buklod-character-no-staging-sql-qa.yml');
const fixture=read('supabase/tests/character_story_offline_fixture_20261116.sql');
const behavior=read('supabase/tests/character_story_offline_behavior_20261116.sql');
test('no staging SQL QA never connects to live project, publishes OTA or uses service keys',()=>{
 assert.match(workflow,/image: postgres:17/);
 assert.match(workflow,/postgres\.id/);
 assert.match(workflow,/--set=ON_ERROR_STOP=1/);
 assert.match(workflow,/github\.event\.pull_request\.head\.sha/);
 assert.match(workflow,/persist-credentials: false/);
 assert.doesNotMatch(workflow,/EXPO_TOKEN|SUPABASE_SERVICE_ROLE_KEY|supabase\.co|eas-cli|eas update|--channel production|apply_migration|workflow_dispatch/);
 assert.match(workflow,/character_story_art_security_20261116\.sql/);
 assert.match(workflow,/character_story_offline_behavior_20261116\.sql/);
});
test('disposable schema explicitly mocks auth, storage and the canonical V3 read authority',()=>{
 assert.match(fixture,/create schema auth/);
 assert.match(fixture,/create schema private/);
 assert.match(fixture,/create table storage\.buckets/);
 assert.match(fixture,/private\.buklod_character_progress_v3/);
 assert.match(fixture,/private\.buklod_character_selection_v2/);
 assert.match(fixture,/public\.buklod_points_ledger/);
});
test('behavior tests cover original character, replay, cross-account and false BP claims',()=>{
 for(const phrase of ['Character switch attributed tasks incorrectly','Retry minted duplicate','Another user can see or claim','Pending BP counted as verified','Rejected BP remained verified','Unauthorized Special Character']){
  assert.ok(behavior.includes(phrase),phrase);
 }
 assert.match(behavior,/^begin;/m);
 assert.match(behavior,/^rollback;/m);
});
