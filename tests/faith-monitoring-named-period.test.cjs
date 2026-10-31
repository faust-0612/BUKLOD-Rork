const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sql = fs.readFileSync('supabase/migrations/20261101044500_faith_monitoring_named_period_reports_v1.sql', 'utf8');
const screen = fs.readFileSync('src/app/scope/faith-monitoring/report.tsx', 'utf8');
const period = fs.readFileSync('src/components/BuklodFaithPeriodReport.tsx', 'utf8');
const client = fs.readFileSync('src/lib/buklodScopeFaithPeriodReport.ts', 'utf8');
const dbTest = fs.readFileSync('supabase/tests/faith_monitoring_named_period_security_20261101.sql', 'utf8');

test('named period RPC is additive, read-only and guarded by exact workspace leadership', () => {
  assert.match(sql, /create or replace function public\.buklod_scope_faith_monitoring_period_v1/);
  assert.match(sql, /security definer\s+set search_path = ''/);
  assert.match(sql, /auth\.uid\(\) is null/);
  assert.match(sql, /buklod_is_exact_scope_admin_v1/);
  assert.match(sql, /buklod_user_has_functional_approver_role/);
  assert.match(sql, /join allowed_scopes allowed on allowed\.scope_id = s\.cluster_id/);
  assert.match(sql, /join allowed_scopes allowed on allowed\.scope_id = f\.scope_id/);
  assert.match(sql, /revoke all on function public\.buklod_scope_faith_monitoring_period_v1[\s\S]+?from public, anon;/);
  assert.match(sql, /grant execute on function public\.buklod_scope_faith_monitoring_period_v1[\s\S]+?to authenticated,service_role;/);
  assert.doesNotMatch(sql, /\b(?:insert|update|delete|truncate|drop)\s+(?:into\s+|from\s+|table\s+)?public\./i);
});

test('Philippine-local dates use assignment dates and one distinct date per member', () => {
  assert.match(sql, /timezone\('Asia\/Manila', now\(\)\)/);
  assert.match(sql, /extract\(isodow from v_anchor\)/);
  assert.match(sql, /date_trunc\('month', v_anchor::timestamp\)/);
  assert.match(sql, /v_through := least\(v_end, v_today\)/);
  assert.match(sql, /a\.reading_date as activity_date/);
  assert.match(sql, /dc\.completion_date as activity_date/);
  assert.match(sql, /group by user_id, activity_date/);
  assert.match(sql, /v_anchor < v_today - 366/);
});

test('report has independent named CSV and existing daily report stays visible', () => {
  assert.match(screen, /<BuklodFaithPeriodReport scopeId=\{scope\.scope_id\}/);
  assert.match(screen, /<SectionTitle>TODAY'S AUTOMATIC PIPELINE<\/SectionTitle>/);
  assert.match(screen, /readScopeIdFromParams/);
  assert.match(period, /INDIVIDUAL MEMBER REPORT/);
  assert.match(period, /Show more/);
  assert.match(period, /faithPeriodToCsvRows\(activeReport\)/);
  assert.match(client, /safeCsvText/);
  assert.match(client, /if \(raw\.scope_id !== scopeId/);
  assert.match(dbTest, /has_function_privilege\('anon'/);
});
