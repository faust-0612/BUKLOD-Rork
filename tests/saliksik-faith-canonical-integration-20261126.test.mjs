import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('local QA runs canonical R1-R4 and actual Faith report/trigger before R4 behavior',()=>{
 const run=read('scripts/local-genesis-saliksik-isolated-qa.sh');
 const r4='tests/fixtures/saliksik_r4_auto_pg_integration.sql';
 for(const path of ['tests/fixtures/saliksik_faith_bridge_postgres17_20261126.sql','supabase/migrations/20261125141800_faith_accomplishment_report_v2.sql','supabase/migrations/20261125142000_faith_accomplishment_named_notifications.sql'])assert.ok(run.indexOf(path)>0&&run.indexOf(path)<run.indexOf(r4));
 assert.ok(run.indexOf('supabase/tests/saliksik_faith_canonical_integration_20261126.sql')>run.indexOf(r4));
 assert.match(run,/PRIVATE_SOCKET_ONLY/);
 assert.match(run,/ON_ERROR_STOP=1/);
 assert.doesNotMatch(run,/supabase db push|eas update/);
});
test('real mastery fixture verifies named notifications, 18 historical plus new investigation counts, and cross-cluster exclusion',()=>{
 const sql=read('supabase/tests/saliksik_faith_canonical_integration_20261126.sql');
 assert.match(sql,/v_count<>9/);
 assert.match(sql,/saliksik_completed_count' is distinct from '18'/);
 assert.match(sql,/saliksik_completed_count' is distinct from '0'/);
 assert.match(sql,/<>410/);
 assert.match(sql,/exception when insufficient_privilege/);
});
