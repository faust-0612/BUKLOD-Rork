import fs from 'node:fs';

const failures = [];

function read(path) {
  if (!fs.existsSync(path)) {
    failures.push(`Missing required canonical finance source: ${path}`);
    return '';
  }
  return fs.readFileSync(path, 'utf8');
}

function requireText(path, content, needles) {
  for (const needle of needles) {
    if (!content.includes(needle)) {
      failures.push(`${path} is missing contract marker: ${needle}`);
    }
  }
}

function forbidText(path, content, needles) {
  for (const needle of needles) {
    if (content.includes(needle)) {
      failures.push(`${path} contains retired/unsafe finance marker: ${needle}`);
    }
  }
}

const userEconomyPath = 'src/lib/buklodR38Economy.ts';
const adminEconomyPath = 'src/lib/buklodR38AdminEconomy.ts';
const identityPath = 'src/lib/buklodCanonicalFinanceIdentity.ts';
const rewardsPath = 'src/lib/buklodRewards.ts';
const authPath = 'src/providers/AuthProvider.tsx';
const registerPath = 'src/app/(auth)/register.tsx';
const bayanihanPath = 'src/app/bayanihan/index.tsx';
const adminReportPath = 'src/app/admin/bayanihan.tsx';
const adminOpsPath = 'src/app/admin/economy-operations.tsx';
const migrationPath = 'supabase/migrations/20260924144309_buklod_main_profit_first_referral_v2.sql';
const containmentMigrationPath = 'supabase/migrations/20260925115931_buklod_finance_v3_containment_guard.sql';
const indexHardeningMigrationPath = 'supabase/migrations/20260925121017_buklod_finance_v3_fk_index_hardening.sql';
const earningsBreakdownMigrationPath = 'supabase/migrations/20260925121444_buklod_finance_v3_user_earnings_breakdown.sql';
const referralEdgePath = 'supabase/functions/buklod-referral-v2/index.ts';
const valueEdgePath = 'supabase/functions/buklod-finalized-value-v2/index.ts';

const userEconomy = read(userEconomyPath);
const adminEconomy = read(adminEconomyPath);
const identity = read(identityPath);
const rewards = read(rewardsPath);
const auth = read(authPath);
const register = read(registerPath);
const bayanihan = read(bayanihanPath);
const adminReport = read(adminReportPath);
const adminOps = read(adminOpsPath);
const migration = read(migrationPath);
const containmentMigration = read(containmentMigrationPath);
const indexHardeningMigration = read(indexHardeningMigrationPath);
const earningsBreakdownMigration = read(earningsBreakdownMigrationPath);
const referralEdge = read(referralEdgePath);
const valueEdge = read(valueEdgePath);

requireText(userEconomyPath, userEconomy, [
  'get_my_buklod_financial_summary_v3',
  'get_my_buklod_referral_summary_v2',
  'get_my_buklod_pf_withdrawals_v2',
  'request_my_buklod_pf_withdrawal_v2',
  'cancel_my_buklod_pf_withdrawal_v2',
  'admin_get_buklod_pf_financial_report_v3',
  'ESTIMATED — SUBJECT TO MONTHLY FINALIZATION',
]);

requireText(adminEconomyPath, adminEconomy, [
  'admin_record_buklod_pf_financial_entry_v3',
  'admin_finalize_buklod_pf_month_v3',
  'admin_review_buklod_pf_withdrawal_v2',
  'admin_get_buklod_pf_withdrawal_payout_details_v2',
  'admin_mark_buklod_pf_withdrawal_paid_v2',
]);

requireText(identityPath, identity, [
  "supabase.functions.invoke('buklod-referral-v2'",
  "invokeReferralIdentityService('ensure_identity')",
  "invokeReferralIdentityService('attach_referral', code)",
]);

requireText(rewardsPath, rewards, [
  'get_my_buklod_referral_summary_v2',
  'attachBuklodCanonicalReferral',
  'one_time_reward_php',
  'first_line_share_pct',
  'referral_months',
]);

requireText(authPath, auth, [
  'ensureCanonicalFinanceForUser',
  'ensureBuklodCanonicalFinanceIdentity',
]);

requireText(registerPath, register, [
  'ensureBuklodCanonicalFinanceIdentity',
  'recordReferral',
]);

requireText(bayanihanPath, bayanihan, [
  'const canonical = report?.canonical_finance;',
  'Qualified Monthly Points',
  '30% User Pool',
  'First-Line Referral',
  'Points are not money',
]);

requireText(adminReportPath, adminReport, [
  'Canonical Finance V3',
  'User Revenue Pool 30%',
  'Qualified Monthly Points',
]);

requireText(adminOpsPath, adminOps, [
  'FINALIZE CANONICAL MONTH',
  'UNATTRIBUTED_ELIGIBLE_REVENUE',
  'Canonical server gates remain authoritative',
  'ACCESS PAYOUT DESTINATION',
  'MARK PAID AFTER EXTERNAL TRANSFER',
]);

requireText(migrationPath, migration, [
  'BUKLOD_CANONICAL_FINANCIAL_ENGINE_V3',
  "policy_version text not null default 'canonical_finance_v3'",
  'user_pool_bps integer not null default 3000',
  'first_line_bps integer not null default 1000',
  'one_time_referral_centavos bigint not null default 2000',
  'referred_qualification_centavos bigint not null default 4000',
  'no_referrer_qualification_centavos bigint not null default 6000',
  'referral_months integer not null default 6',
  'USER_POOL_LARGEST_REMAINDER',
  'record_buklod_finalized_value_v2',
  'admin_finalize_buklod_pf_month_v3',
  'get_my_buklod_financial_summary_v3',
  'R38 financial finalization is superseded',
  'Legacy R38 withdrawal is superseded',
  'System Admin access required',
]);

requireText(containmentMigrationPath, containmentMigration, [
  'buklod_pf_finalized_value_economics_guard_v3',
  'Canonical finance economics is disabled. Finalized value writes are blocked.',
  'revoke execute on function public.buklod_qualify_referral_v1(uuid)',
  'revoke execute on function public.buklod_record_referral_v1(text)',
]);

requireText(indexHardeningMigrationPath, indexHardeningMigration, [
  'idx_buklod_pf_cash_referral',
  'idx_buklod_pf_cash_source_value',
  'idx_buklod_pf_referral_settlements_referrer',
  'idx_buklod_pf_referral_settlements_referred',
  'idx_buklod_pf_user_settlements_person',
]);

requireText(earningsBreakdownMigrationPath, earningsBreakdownMigration, [
  'get_my_buklod_financial_earnings_breakdown_v1',
  'latest_finalized',
  'lifetime_earned',
  'referral_reward_php',
  'points_used_for_cash',
]);

requireText(userEconomyPath, userEconomy, [
  'get_my_buklod_financial_earnings_breakdown_v1',
  'latest_first_line_share_php',
  'lifetime_referral_reward_earned_php',
]);

requireText(referralEdgePath, referralEdge, [
  'REFERRAL_IDENTITY_PEPPER',
  'buklod_pf_link_identity_service_v2',
  'buklod_pf_attach_referral_service_v2',
  'auth.getUser(token)',
]);

requireText(valueEdgePath, valueEdge, [
  'BUKLOD_FINANCE_VALUE_WEBHOOK_SECRET',
  'x-buklod-finance-secret',
  'record_buklod_finalized_value_v2',
  'idempotency_key',
  'Positive gross_value_php required',
]);

const clientSources = [
  [userEconomyPath, userEconomy],
  [adminEconomyPath, adminEconomy],
  [identityPath, identity],
  [rewardsPath, rewards],
  [authPath, auth],
  [registerPath, register],
  [bayanihanPath, bayanihan],
  [adminReportPath, adminReport],
  [adminOpsPath, adminOps],
];

for (const [path, content] of clientSources) {
  forbidText(path, content, [
    'convertBuklodPointsToBayanihan',
    'requestBuklodCashReward',
    'point_equivalent_peso',
    'cash_redemption_enabled',
  ]);
}

forbidText(rewardsPath, rewards, [
  'get_my_buklod_referral_summary_v1',
  'buklod_record_referral_v1',
]);

forbidText(userEconomyPath, userEconomy, [
  "'get_my_buklod_r38_referral_withdrawals_v1'",
  "'request_my_buklod_r38_referral_withdrawal_v1'",
  "'cancel_my_buklod_r38_referral_withdrawal_v1'",
  "'admin_get_buklod_r38_economy_report_v1'",
]);

if (/\.from\(\s*['"](?:private\.)?buklod_pf_/m.test(
  [userEconomy, adminEconomy, rewards, identity].join('\n'),
)) {
  failures.push('Client canonical finance code directly accesses private PF tables; all money access must remain RPC/service mediated.');
}

if (failures.length) {
  console.error('CANONICAL FINANCE V3 RELEASE CONTRACT: FAIL');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log('CANONICAL FINANCE V3 RELEASE CONTRACT: PASS');
console.log('Validated canonical identity, points-weighted User Pool, referral, withdrawal, admin settlement, migration parity and trusted revenue ingress.');
