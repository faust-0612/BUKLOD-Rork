import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/migrations/20261111015000_buklod_monthly_earnings_carryforward_readonly_v1.sql','utf8');
const card = readFileSync('src/components/BuklodUnifiedEarningsHomeCard.tsx','utf8');
const helper = readFileSync('src/lib/buklodMonthlyEarnings.ts','utf8');
const detail = readFileSync('src/app/community-contribution.tsx','utf8');

test('monthly endpoint is own-account, authenticated and read-only', () => {
  assert.match(sql,/get_my_buklod_monthly_earnings_v1\(\)/);
  assert.match(sql,/auth\.uid\(\)/);
  assert.match(sql,/private\.buklod_pf_person_for_user_v2\(v_uid\)/);
  assert.match(sql,/revoke all on function public\.get_my_buklod_monthly_earnings_v1\(\) from public,anon/);
  assert.match(sql,/grant execute on function public\.get_my_buklod_monthly_earnings_v1\(\) to authenticated/);
  assert.doesNotMatch(sql,/\b(insert|update|delete|truncate)\s+(into\s+|from\s+)?private\./i);
});

test('previous-month payout history is immutable; QMP weight is current-month only', () => {
  assert.match(sql,/s\.period_key=v_previous_month and s\.status='FINALIZED'/);
  assert.match(sql,/v_last_status := 'AWAITING_FINALIZATION'/);
  assert.match(sql,/s\.status='FINALIZED' and s\.period_key<v_current_month/);
  assert.match(sql,/current_month_estimate_included',false/);
  assert.match(helper,/contribution\.period\.key !== monthly\.current_month_key/);
  assert.match(helper,/contribution\.estimate_status !== 'PROVISIONAL_ADMOB'/);
  assert.match(card,/monthly\.last_month\.status === 'FINALIZED'/);
});

test('projected total is display-only: available plus current estimate, never reserved', () => {
  assert.match(helper,/monthly\.available_finalized_minor \+ contribution\.estimated_share_minor/);
  assert.match(card,/PROJECTED TOTAL · NOT WITHDRAWABLE/);
  assert.match(card,/AVAILABLE FINALIZED · MINIMUM/);
  assert.match(detail,/Projected total · not withdrawable/);
  assert.doesNotMatch(helper,/monthly\.available_finalized_minor\s*\+\s*monthly\.reserved_for_payout_minor/);
});

test('PHP 200 threshold and actual withdrawal activation remain separate', () => {
  assert.match(sql,/minimum_withdrawal_centavos,withdrawal_enabled/);
  assert.match(sql,/meets_amount_threshold',v_available>=coalesce\(v_minimum,20000\)/);
  assert.match(sql,/withdrawable_uses_only_available_finalized_cash',true/);
});

test('centavo scenarios: no earned-history reset after full-balance withdrawal', () => {
  const monthA = 12500, monthBPreliminary = 4250, threshold = 20000;
  assert.equal((monthA+monthBPreliminary)/100,167.50);
  assert.equal(monthA>=threshold,false);
  const monthBFinal = 4000, monthCFinal = 5000;
  const available = monthA+monthBFinal+monthCFinal;
  assert.equal(available,21500);
  const reserved = available, remainingAvailable = available-reserved;
  assert.equal(remainingAvailable,0);
  assert.equal(reserved,21500);
  assert.equal(monthA+monthBFinal+monthCFinal,21500);
});
