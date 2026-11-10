import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const fundCard=read('src/components/BuklodScopeFundCard.tsx');
const fundScreen=read('src/app/scope-fund.tsx');
const bankSql=read('supabase/migrations/20261110200000_buklod_scope_bank_treasurer_v1.sql');
const settings=read('src/app/scope-giving-settings.tsx');
const health=read('src/app/profile/buklod-health.tsx');
const launcher=read('src/lib/buklodHealthCenterLauncher.ts');
test('scope fund buttons navigate to independent destinations',()=>{
  assert.match(fundCard,/open\('\/scope-contribute'\)/);
  assert.match(fundCard,/open\('\/scope-fund'\)/);
  assert.match(fundCard,/open\('\/scope-contribution-reports'\)/);
  assert.match(read('src/app/scope-contribute.tsx'),/mode="contribute"/);
  assert.match(read('src/app/scope-contribution-reports.tsx'),/mode="reports"/);
  assert.match(fundScreen,/mode==='contribute'/);
  assert.match(fundScreen,/mode==='reports'/);
});
test('GCash handoff copies exact registered number; no auto payment',()=>{
  assert.match(fundScreen,/Clipboard.setStringAsync\(registered.mobile\)/);
  assert.match(fundScreen,/Linking.openURL\('gcash:\/\/'\)/);
  assert.match(fundScreen,/Opening the app is not a payment/);
  assert.match(fundScreen,/report_buklod_scope_gcash_contribution_v1/);
});
test('bank transfers require registered scope receiver and independent verification',()=>{
  assert.match(fundScreen,/buklod_scope_bank_dashboard_v1/);
  assert.match(fundScreen,/buklod_scope_bank_report_v1/);
  assert.match(fundScreen,/buklod_scope_bank_review_v1/);
  assert.match(bankSql,/public.buklod_scope_can_access_v1/);
  assert.match(bankSql,/public.buklod_is_exact_scope_admin_v1/);
  assert.match(bankSql,/v_actor=v_report.submitted_by/);
  assert.match(bankSql,/unique\(scope_id,receiver_bank,receiver_number,transfer_reference\)/);
  assert.match(bankSql,/spendable_in_buklod',false/);
  assert.doesNotMatch(bankSql,/insert into private.buklod_pf_cash_ledger|insert into private.buklod_pf_community_fund_ledger/i);
});
test('only exact scope admin authorizes active-member treasurers',()=>{
  assert.match(bankSql,/Only exact-scope admin may authorize treasurers/);
  assert.match(bankSql,/public.buklod_scope_has_active_membership_v1/);
  assert.match(settings,/buklod_scope_treasurer_authorize_v1/);
  assert.match(read('src/components/BuklodGivingSettingsButton.tsx'),/giving_get_receiver_admin_scope/);
  assert.match(read('src/components/BuklodGivingSettingsButton.tsx'),/pathname: '\/scope-giving-settings'/);
});
test('main Health doorway is bilingual, with visible safety and disclosures, not falsely activated',()=>{
  assert.match(health,/setLanguage\('fil'\)/);
  assert.match(health,/setLanguage\('en'\)/);
  assert.match(health,/BUKLOD Health Guide/);
  assert.match(health,/t\('Seek immediate medical help'/);
  assert.match(health,/t\('Contributor requirements'/);
  assert.match(health,/BUKLOD_HEALTH_CONSULTATION_READY/);
  assert.match(launcher,/EXPO_PUBLIC_HEALTH_CONSULTATION_ENABLED === 'true'/);
  assert.match(launcher,/EXPO_PUBLIC_HEALTH_PROFESSIONAL_PORTAL_ENABLED === 'true'/);
});
