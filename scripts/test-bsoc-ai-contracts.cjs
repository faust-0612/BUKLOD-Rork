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
const zero=load('supabase/migrations/20261119234500_bsoc_zero_budget_scheduler_v1.sql');
expect(/cron\.schedule\('buklod-bsoc-zero-budget-screening-r1','\*\/15 \* \* \* \*'/.test(zero),
  'bounded 15-minute screening on existing cron is present');
expect(/limit limit_n for update skip locked/.test(zero),
  'concurrent worker claims are row-locked and batch-bounded');
expect(/'paid_api_calls',0/.test(zero)&&!/fetch\(|OPENAI_API_KEY|BSOC_GITHUB_DISPATCH_TOKEN/.test(zero),
  'zero-cost scheduler cannot call paid external inference or dispatch');
expect(!/update public\.user_feedback/i.test(zero),
  'zero-cost scheduler cannot falsely resolve canonical support cases');
expect(/t\.stage='VERIFIED_RESOLVED' and t\.verified_at is not null/.test(zero),
  'verified member report gated on independently audited release proof');
expect(/report notification deferred for case/.test(migration),
  'new support requests must not fail if notification delivery is unavailable');
expect(/screening-/.test(zero)&&/member_read_own_reports_v1/.test(migration),
  'screening status messages are idempotent and private');
const followup=load('supabase/migrations/20261119235500_bsoc_member_reply_followup_v1.sql');
expect(/member_id<>new.sender_id/.test(followup),'member reply cannot mutate other case jobs');
expect(/state='NEEDS_DETAILS'/.test(followup),'member reply cannot reset unrelated case state');
expect(/member-followup-/.test(followup)&&/private\.bsoc_ai_emit_member_report_v1/.test(followup),
 'member replies get a scoped idempotent private status report');
expect(!/update public\.user_feedback|fetch\(/i.test(followup),
 'member followup cannot auto resolve canonical cases or make network calls');
const failOpen=load('supabase/migrations/20261120000500_bsoc_support_failopen_reliability_v1.sql');
expect(/intake queue deferred for case/.test(failOpen),
  'normal member feedback cannot fail just because the screening queue fails');
expect(/reopened queue deferred for case/.test(failOpen),
  'reopening a case is not blocked by auxiliary automation');
expect(/member followup deferred for message/.test(failOpen)&&/exception when others then/.test(failOpen),
  'normal support messages fail open if member-report processing breaks');
console.log('PASS: 35 BSOC AI and zero-budget safety contracts');
