import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseBuklodProviderMetrics } from '../supabase/functions/buklod-admin-backend-metrics/parse.mjs';
const ref = 'yhanxndaqbmuzbdqlblu';
const sample = [
  `node_memory_MemTotal_bytes{supabase_project_ref="${ref}",service_type="db"} 1000`,
  `node_memory_MemAvailable_bytes{supabase_project_ref="${ref}",service_type="db"} 300`,
  `node_memory_SwapTotal_bytes{supabase_project_ref="${ref}",service_type="db"} 200`,
  `node_memory_SwapFree_bytes{supabase_project_ref="${ref}",service_type="db"} 100`,
  `node_filesystem_size_bytes{supabase_project_ref="${ref}",service_type="db",mountpoint="/"} 1000`,
  `node_filesystem_avail_bytes{supabase_project_ref="${ref}",service_type="db",mountpoint="/"} 600`,
  `node_cpu_seconds_total{supabase_project_ref="${ref}",service_type="db",cpu="0",mode="idle"} 3`,
  `node_cpu_seconds_total{supabase_project_ref="${ref}",service_type="db",cpu="1",mode="idle"} 2`,
  `node_load1{supabase_project_ref="${ref}",service_type="db"} 1.2`,
  'node_memory_MemTotal_bytes{service_type="gotrue"} 900000',
].join('\n');
test('provider parser reads only target project database series and never invents CPU percent', () => {
  const m = parseBuklodProviderMetrics(sample,ref);
  assert.equal(m.memory_percent,70);
  assert.equal(m.filesystem_used_percent,40);
  assert.equal(m.swap_used_percent,50);
  assert.equal(m.cpu_cores,2);
  assert.equal(m.cpu_load_per_core_percent,60);
  assert.equal(m.cpu_utilization_percent,null);
});
test('provider parser refuses missing, invalid, untrusted or oversized series', () => {
  assert.equal(parseBuklodProviderMetrics('',ref),null);
  assert.equal(parseBuklodProviderMetrics(sample,'../../etc'),null);
  assert.equal(parseBuklodProviderMetrics(sample,'a'.repeat(20)),null);
  assert.equal(parseBuklodProviderMetrics('a'.repeat(2_000_001),ref),null);
  const m = parseBuklodProviderMetrics(
    `node_memory_MemTotal_bytes{supabase_project_ref="${ref}",service_type="db"} 10\n`+
    `node_memory_MemAvailable_bytes{supabase_project_ref="${ref}",service_type="db"} 11`,ref);
  assert.equal(m,null); // invalid-only source must fail closed
});
test('edge only serves authenticated system admins and never returns secrets', () => {
  const src=fs.readFileSync('supabase/functions/buklod-admin-backend-metrics/index.ts','utf8');
  assert.match(src,/admin\.auth\.getUser\(token\)/);
  assert.match(src,/caller\.rpc\('is_system_admin'\)/);
  assert.match(src,/Basic/);
  assert.match(src,/PROVIDER_UNAVAILABLE/);
  assert.doesNotMatch(src,/respond\(\{[^}]*service[^}]*\}/);
});
