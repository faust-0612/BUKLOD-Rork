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
  assert.match(root,/correlationKey: renderEvidence\.correlationKey/);
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
  assert.match(bsoc,/No.*OTA update ID|does not carry an exact OTA update ID/);
  assert.doesNotMatch(bsoc,/healthEvidence[^;]*supabase\.functions\.invoke/);
  assert.doesNotMatch(bsoc,/\.from\('bsoc_health_events'\)[\s\S]{0,240}\.(?:insert|update|delete)\(/);
});
