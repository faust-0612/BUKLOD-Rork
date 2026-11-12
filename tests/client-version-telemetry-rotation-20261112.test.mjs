import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../supabase/migrations/20261112022000_client_version_telemetry_bounded_rotation.sql',import.meta.url),'utf8');
test('version telemetry keeps 20 IDs, per-user lock and deterministic rotation',()=>{
  for(const rule of ['pg_advisory_xact_lock','hashtextextended(actor::text','>= 20','delete from private.buklod_client_version_registry_r1','order by last_seen_at asc, first_seen_at asc, installation_id asc','OBSERVE_ONLY',"'upgrade_required',false","'enforcement_enabled',false"])assert.ok(sql.includes(rule),rule);
  assert.ok(!sql.includes("raise exception 'Client version telemetry installation limit'"));
});
