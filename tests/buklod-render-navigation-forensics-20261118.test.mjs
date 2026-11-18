import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=readFileSync('src/app/_layout.tsx','utf8');
const bsoc=readFileSync('src/app/admin/bsoc-conversations.tsx','utf8');
const helper=readFileSync('src/lib/buklodRouteDiagnostics.ts','utf8');

test('root render boundary preserves old failure signature but reports classified cause only',()=>{
  assert.match(root,/const errorSignature = renderErrorSignature\(error\)/);
  assert.match(root,/const renderEvidence = diagnoseBuklodRenderError\(error\)/);
  assert.match(root,/errorSignature,/);
  assert.match(root,/const correlationKey = buildBuklodRenderCorrelationKey/);
  assert.match(root,/correlationKey,/);
  assert.match(root,/routeModule,/);
  assert.match(root,/Preliminary cause:/);
  assert.doesNotMatch(root,/rawStack|errorStack|p_error_message|p_stack_trace/);
});

test('render classification only emits fixed codes, never raw error strings or stack paths',()=>{
  assert.match(helper,/causeCode = 'NULLISH_ACCESS'/);
  assert.match(helper,/causeCode = 'RENDER_LOOP'/);
  assert.match(helper,/causeCode = 'HOOK_ORDER'/);
  assert.match(helper,/originArea = 'UNKNOWN'/);
  assert.match(helper,/correlationKey: 'BUKLOD_SCREEN_RENDER_EXCEPTION\.'/);
  assert.doesNotMatch(helper,/return\s*\{[^}]*rawMessage:/);
});

test('BSOC selects only current case health rows through server RLS and never broadcasts evidence',()=>{
  assert.match(bsoc,/\.from\('bsoc_health_events'\)/);
  assert.match(bsoc,/\.eq\('support_case_id',caseId\)/);
  assert.match(bsoc,/\.limit\(5\)/);
  assert.match(bsoc,/currentCase\.current===caseId/);
  assert.match(bsoc,/setHealthEvidence\(\[\]\)/);
  assert.match(bsoc,/\.from\('bsoc_render_forensics_v1'\)/);
  assert.match(bsoc,/\.in\('health_event_id',events\.map\(e=>e\.id\)\)/);
  assert.match(bsoc,/renderDetails\[h\.id\]\.ota_update_id/);
  assert.match(bsoc,/Legacy cases may not have crash-time OTA evidence/);
  assert.doesNotMatch(bsoc,/healthEvidence[^;]*supabase\.functions\.invoke/);
  assert.doesNotMatch(bsoc,/\.from\('bsoc_health_events'\)[\s\S]{0,240}\.(?:insert|update|delete)\(/);
});


test('only render errors attach safe cause, frame and exact crash-time OTA to the existing health event receipt',()=>{
  const health=readFileSync('src/lib/buklodMainHealth.ts','utf8');
  const native=readFileSync('src/lib/buklodRenderReleaseIdentity.native.ts','utf8');
  const web=readFileSync('src/lib/buklodRenderReleaseIdentity.web.ts','utf8');
  assert.match(root,/getBuklodRenderReleaseIdentity\(\)/);
  assert.match(root,/renderForensics:\s*\{/);
  assert.match(health,/normalizeRenderForensics\(input\.renderForensics\)/);
  assert.match(health,/\.rpc\('buklod_attach_render_forensics_v1'/);
  assert.match(health,/p_health_event_id: receipt\.event_id/);
  assert.match(health,/if \(attachError\) throw attachError/);
  assert.match(health,/healthFlushUsers\.has\(userId\)/);
  assert.match(health,/withHealthQueueIO/);
  assert.match(health,/currentSession\.session\?\.user\?\.id !== userId/);
  assert.match(health,/await writeQueue\(userId, current\.filter/);
  assert.match(native,/Updates\.updateId/);
  assert.match(native,/Updates\.runtimeVersion/);
  assert.match(native,/Updates\.channel/);
  assert.doesNotMatch(native,/userId|deviceId|hardwareId|rawStack|errorMessage/);
  assert.match(web,/otaUpdateId:null/);
});

test('migration provides owner-bound idempotent forensic RPC with strict RLS and no raw payload',()=>{
  const sql=readFileSync('supabase/migrations/20261118152000_bsoc_render_forensics_v1.sql','utf8');
  const testSql=readFileSync('supabase/tests/bsoc_render_forensics_v1.sql','utf8');
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on table public\.bsoc_render_forensics_v1/);
  assert.match(sql,/revoke all on function public\.buklod_attach_render_forensics_v1/);
  assert.match(sql,/e\.id=p_health_event_id and e\.user_id=actor/);
  assert.match(sql,/on conflict\(health_event_id\) do nothing/);
  assert.match(sql,/recorded\.error_signature !~ '\^RENDER_/);
  assert.match(testSql,/has_function_privilege\('anon'/);
  assert.doesNotMatch(sql,/p_raw_stack|p_error_message|service_role/);
});

test('new diagnostics are additive and preserve release/AdMob/main navigator implementations',()=>{
  const identity=readFileSync('src/lib/buklodRenderReleaseIdentity.ts','utf8');
  assert.match(identity,/otaUpdateId: string \| null/);
  assert.match(root,/import \{ AdsProvider \} from/);
  assert.match(root,/<BuklodMainHealthAgent \/>/);
  assert.match(root,/<BuklodMandatoryUpdateBoundary>/);
});


test('old health event remains compatible while two bundled OTAs never share a forensic row',()=>{
  const health=readFileSync('src/lib/buklodMainHealth.ts','utf8');
  assert.match(helper,/\.OTA_.*\.R_/);
  assert.match(health,/row\.renderForensics/);
  assert.match(health,/\.rpc\('buklod_record_health_event_v1'/);
  assert.match(health,/\.rpc\('buklod_attach_render_forensics_v1'/);
  assert.match(health,/stored\.clientEventId = randomOpaqueRef\('health'\)/);
  assert.match(health,/if \(currentSession\.session\?\.user\?\.id !== userId\) break/);
});

test('migration rejects invalid hash and contains exactly one complete function definition',()=>{
  const sql=readFileSync('supabase/migrations/20261118152000_bsoc_render_forensics_v1.sql','utf8');
  assert.equal((sql.match(/create or replace function public\.buklod_attach_render_forensics_v1\(/g)||[]).length,1);
  assert.equal((sql.match(/comment on table public\.bsoc_render_forensics_v1/g)||[]).length,1);
  assert.match(sql,/recorded\.error_signature !~ '\^RENDER_\[0-9A-F\]\{1,8\}\$' then/);
  assert.match(sql,/get diagnostics inserted_count = row_count;/);
  assert.ok(sql.trimEnd().endsWith(" 'RLS-protected allowlisted code/position/OTA evidence only. Never store raw exception messages or stacks.';"));
});
