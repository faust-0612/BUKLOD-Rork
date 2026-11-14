import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(new URL('../supabase/migrations/20261114150000_buklod_hc_consultation_r1.sql', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/health-center-online-backend-qa.yml', import.meta.url), 'utf8');
const tables = ['professional_applications','verified_professionals','consultation_cases','consultation_messages'];

test('Health consultation schema is private, identity-scoped and revocable', () => {
  for (const table of tables) {
    assert.match(sql, new RegExp(`alter table public\\.buklod_hc_${table} enable row level security`, 'i'));
  }
  assert.match(sql, /revoke all on[\s\S]*from public, anon, authenticated;/i);
  assert.doesNotMatch(sql, /grant\s+(?:all|update|delete)\b[^;]*to\s+(?:anon|authenticated|public)/i);
  assert.match(sql, /hc_cases_participant_read/);
  assert.match(sql, /hc_cases_patient_create/);
  assert.match(sql, /hc_messages_participant_read/);
  assert.match(sql, /hc_messages_participant_write/);
  assert.match(sql, /patient_id\s*=\s*\(select auth\.uid\(\)\)/);
  assert.match(sql, /clinician_id\s*=\s*\(select auth\.uid\(\)\)/);
  assert.match(sql, /v\.authorized\s*=\s*true/);
  assert.match(sql, /v\.revoked_at\s+is\s+null/);
  assert.match(sql, /v\.valid_until\s*>\s*now\(\)/);
  assert.match(sql, /unique\s*\(case_id, sender_id, client_nonce\)/);
});

test('Isolated PostgreSQL 17 CI executes actual patient, nonparticipant and revoked-clinician role tests', () => {
  assert.match(workflow, /postgres:17/);
  assert.match(workflow, /tests\/fixtures\/nov14_health_auth_bootstrap\.sql/);
  assert.match(workflow, /supabase\/migrations\/20261114150000_buklod_hc_consultation_r1\.sql/);
  assert.match(workflow, /tests\/fixtures\/nov14_health_access_rls\.sql/);
  const checks = readFileSync(new URL('../tests/fixtures/nov14_health_access_rls.sql', import.meta.url), 'utf8');
  assert.match(checks, /nonparticipant leaked case/);
  assert.match(checks, /revoked clinician still sees case/);
  assert.match(checks, /patient cannot see own case/);
});
