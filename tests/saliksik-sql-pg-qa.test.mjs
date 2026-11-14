import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('SALIKSIK isolated SQL fixture exercises eight investigations, server-credited 170 pending points',()=>{
 const fixture=read('tests/fixtures/saliksik_pg_integration.sql');
 const schema=read('tests/fixtures/saliksik_pg_seed.sql');
 const workflow=read('.github/workflows/saliksik-sql-qa.yml');
 assert.match(fixture,/FOR v_i IN 1\.\.4 LOOP/);
 assert.match(fixture,/v_sum<>205 OR v_count<>10 OR v_events<>10/);
 assert.match(fixture,/public\.saliksik_submit_v1/);
 assert.match(fixture,/public\.saliksik_admin_publish_v1/);
 assert.match(schema,/CREATE TRIGGER test_reward AFTER INSERT/);
 assert.match(workflow,/image: postgres:17-alpine/);
 assert.match(workflow,/ON_ERROR_STOP=1/);
 assert.match(workflow,/saliksik_pg_integration\.sql/);
});
