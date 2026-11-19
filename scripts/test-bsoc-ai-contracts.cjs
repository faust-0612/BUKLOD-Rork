'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const root=process.cwd();
const load=p=>fs.readFileSync(root+'/'+p,'utf8');
const migration=load('supabase/migrations/20261119223000_bsoc_ai_autofix_reports_v1.sql');
const edge=load('supabase/functions/bsoc-auto-triage-v1/index.ts');
const workflow=load('.github/workflows/bsoc-ai-dev-autofix.yml');
const member=load('src/app/support/live.tsx');
const expect=(condition,message)=>assert.ok(condition,message);
expect(/bsoc_ai_case_jobs/.test(migration),'durable case queue exists');
expect(/unique\(case_id,report_key\)/.test(migration),'member report idempotency exists');
expect(/revoke all on public\.bsoc_ai_case_jobs from public, anon, authenticated/i.test(migration),
  'automation jobs are not readable by members');
expect(/f\.user_id=\(select auth\.uid\(\)\)/.test(migration),
  'member reports remain owner-only under RLS');
expect(/coalesce\(auth\.jwt\(\)->>'role',''\) <> 'service_role'/.test(migration),
  'member reports require service-role claims');
expect(/where case_id=p_case_id and stage='VERIFIED_RESOLVED' and verified_at is not null/.test(migration),
  'resolved notice requires audited release verification');
expect(/'bsoc_support'/.test(migration),'notification uses pre-existing support deep-link kind');
expect(!/update public\.user_feedback/i.test(migration),'automation migration cannot silently resolve cases');
expect(!/\binsert into public\.buklod_.*(?:point|reward)/i.test(migration),
  'automation cannot alter live economy or Season 2 rewards');
expect(/BSOC_AI_AUTOFIX_ENABLED/.test(edge)&&/BSOC_AI_PAID_INFERENCE_APPROVED/.test(edge),
  'paid GPT requires distinct explicit activation and budget flags');
expect(/auth!==`Bearer \$\{key\}`/.test(edge),'service-role auth required on Edge Function');
expect(!/JSON\.stringify\(\{[^}]*message:ticket\.message/.test(edge),
  'raw member message not forwarded in GPT request');
expect(/Raw free text is screened locally/.test(edge),'sensitivity gate exists');
expect(/store:false/.test(edge),'OpenAI retention opt-out set');
expect(/BSOC_DEV_REPAIR_DISPATCH_ENABLED/.test(edge),'DEV coding dispatch opt-in');
expect(/event_type:"bsoc_ai_triage"/.test(edge),'event type matches coding workflow');
expect(/ref: dev\/bsoc-ai-autofix-user-reports-20261119/.test(workflow),
  'agent must start on protected isolated DEV branch');
expect(/base: dev\/bsoc-ai-autofix-user-reports-20261119/.test(workflow),
  'agent PR cannot target main or production');
expect(/draft: true/.test(workflow),'agent proposals cannot auto-merge');
expect(!/eas (update|build|deploy)|expo publish/i.test(workflow),
  'agent workflow may not publish an OTA');
expect(/bsoc_ai_case_reports/.test(member)&&/aiReports\.map/.test(member),
  'member private report history is wired into support UI');
console.log('PASS: 18 BSOC AI safety and report contracts');
