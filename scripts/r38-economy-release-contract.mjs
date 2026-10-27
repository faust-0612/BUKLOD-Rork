import fs from 'node:fs';

const failures = [];
const warnings = [];

function read(path) {
  if (!fs.existsSync(path)) {
    failures.push(`Missing required R38 source: ${path}`);
    return '';
  }
  return fs.readFileSync(path, 'utf8');
}

function requireText(path, content, needles) {
  for (const needle of needles) {
    if (!content.includes(needle)) failures.push(`${path} is missing contract marker: ${needle}`);
  }
}

function forbidText(path, content, needles) {
  for (const needle of needles) {
    if (content.includes(needle)) failures.push(`${path} contains retired/unsafe R38 marker: ${needle}`);
  }
}

const userEconomyPath = 'src/lib/buklodR38Economy.ts';
const adminEconomyPath = 'src/lib/buklodR38AdminEconomy.ts';
const bayanihanPath = 'src/app/bayanihan/index.tsx';
const payoutPath = 'src/app/bayanihan/payout-profile.tsx';
const withdrawalsPath = 'src/app/bayanihan/withdrawals.tsx';
const referralPath = 'src/components/BuklodReferralInviteCard.tsx';
const redeemPath = 'src/components/points/BuklodRedeemCatalogSection.tsx';
const legacyAdminPath = 'src/app/admin/points-redemptions.tsx';
const adminReportPath = 'src/app/admin/bayanihan.tsx';
const adminOpsPath = 'src/app/admin/economy-operations.tsx';
const adminReportsPath = 'src/app/admin/reports-center.tsx';

const userEconomy = read(userEconomyPath);
const adminEconomy = read(adminEconomyPath);
const bayanihan = read(bayanihanPath);
const payout = read(payoutPath);
const withdrawals = read(withdrawalsPath);
const referral = read(referralPath);
const redeem = read(redeemPath);
const legacyAdmin = read(legacyAdminPath);
const adminReport = read(adminReportPath);
const adminOps = read(adminOpsPath);
const adminReports = read(adminReportsPath);

requireText(userEconomyPath, userEconomy, [
  'get_my_buklod_r38_economy_report_v1',
  'get_buklod_r38_economy_policy_v1',
  'get_my_buklod_r38_payout_profile_v1',
  'set_my_buklod_r38_payout_profile_v1',
  'get_my_buklod_r38_referral_withdrawals_v1',
  'request_my_buklod_r38_referral_withdrawal_v1',
  'cancel_my_buklod_r38_referral_withdrawal_v1',
  'admin_get_buklod_r38_economy_report_v1',
]);

requireText(adminEconomyPath, adminEconomy, [
  'admin_create_buklod_r38_economic_period_v1',
  'admin_add_buklod_r38_financial_entry_v1',
  'admin_set_buklod_r38_period_status_v1',
  'admin_finalize_buklod_r38_economic_period_v1',
  'admin_reconcile_buklod_r38_referrals_v1',
  // Withdrawal RPCs moved to Profit-First V2; require active APIs, not retired R38 V1.
  'admin_list_buklod_pf_withdrawals_v2',
  'admin_review_buklod_pf_withdrawal_v2',
  'admin_get_buklod_pf_withdrawal_payout_details_v2',
  'admin_mark_buklod_pf_withdrawal_paid_v2',
  // Current funded settlement; cash never inferred from Points/QMP.
  'admin_get_buklod_pf_finance_console_v3',
  'admin_record_buklod_pf_financial_entry_v3',
  'admin_finalize_buklod_pf_month_v3',
  'p_idempotency_key',
]);

requireText(bayanihanPath, bayanihan, [
  // Copy is localized; validate the invariant and separate authoritative API bindings.
  "t('economy.pointsNotMoney')",
  "t('economy.pointsNotMoneyBody')",
  "t('economy.earningsNote')",
  'loadMyBuklodFinancialSummaryV3',
  'loadMyCommunityContribution',
  'communityQmpMetrics(contribution)',
  'earnings.latest_finalized_user_share_php',
  'earnings.withdrawable_php',
]);
requireText(referralPath, referral, [
  'VIEW MY ECONOMY REPORT',
  'PAYOUT PROFILE',
  'HISTORY',
]);
requireText(redeemPath, redeem, [
  'Points stay progression-only',
  'OPEN ECONOMY & BAYANIHAN',
  "router.push('/points/economy'",
]);
requireText(legacyAdminPath, legacyAdmin, [
  'point-to-value workflow has been retired',
  'Point-derived money is disabled',
]);
requireText(adminReportPath, adminReport, [
  'Hard economic invariant',
  'OPEN ECONOMY OPERATIONS',
]);
requireText(adminOpsPath, adminOps, [
  // Finalization is gated and routed through the authoritative server workflow.
  'controls?.economics_enabled === true',
  'controls?.settlement_enabled === true',
  "currentStatus !== 'FINALIZED'",
  'Finalize Canonical Finance Month?',
  'adminFinalizeBuklodPfMonthV3',
  'ACCESS PAYOUT DESTINATION',
  'MARK PAID AFTER EXTERNAL TRANSFER',
]);
requireText(adminReportsPath, adminReports, [
  'Admin Reports Center',
  'Lifetime Points',
  'Pending Claimable',
  'Bayanihan, Shares & Revenue',
  'No fixed Points-to-peso',
]);

const clientSources = [
  [userEconomyPath, userEconomy],
  [adminEconomyPath, adminEconomy],
  [bayanihanPath, bayanihan],
  [payoutPath, payout],
  [withdrawalsPath, withdrawals],
  [referralPath, referral],
  [redeemPath, redeem],
  [legacyAdminPath, legacyAdmin],
  [adminReportPath, adminReport],
  [adminOpsPath, adminOps],
  [adminReportsPath, adminReports],
];

for (const [path, content] of clientSources) {
  forbidText(path, content, [
    'convertBuklodPointsToBayanihan',
    'requestBuklodCashReward',
    'point_equivalent_peso',
    'cash_redemption_enabled',
    'payout_destination_snapshot',
    'payout_destination_full_snapshot',
    'payout_account_name_snapshot',
  ]);
  if (/\.from\(\s*['\"](?:private\.)?(?:buklod_r38_|buklod_pf_)/m.test(content)) {
    failures.push(`${path} directly accesses a finance table; R38/PF financial access must remain RPC-mediated.`);
  }
}

const migrations = [
  '20260912141510_buklod_unified_economy_r38_a_foundation.sql',
  '20260912142712_buklod_r38_disable_legacy_point_money_paths.sql',
  '20260912143050_buklod_r38_actual_revenue_accounting_foundation.sql',
  '20260912143206_buklod_r38_referral_qualification_and_rcu_engine.sql',
  '20260912143322_buklod_r38_revenue_reconciliation_and_finalization.sql',
  '20260912143500_buklod_r38_user_admin_reports_and_withdrawals.sql',
  '20260912155310_buklod_r38_public_policy_contract_v1.sql',
  '20260912160805_buklod_r38_secure_payout_profile_v1.sql',
  '20260912161124_buklod_r38_admin_withdrawal_queue_hardening_v1.sql',
  '20260912161538_buklod_r38_user_withdrawal_history_v1.sql',
  '20260912161802_buklod_r38_withdrawal_destination_snapshot_v1.sql',
  '20260912161836_buklod_r38_withdrawal_replay_privacy_guard_v1.sql',
  '20260912164859_buklod_r38_fk_index_hardening_v1.sql',
];

for (const name of migrations) read(`supabase/migrations/${name}`);

const indexHardening = read('supabase/migrations/20260912164859_buklod_r38_fk_index_hardening_v1.sql');
const indexCount = (indexHardening.match(/create index if not exists/gi) || []).length;
if (indexCount !== 15) failures.push(`Expected 15 R38 FK hardening indexes, found ${indexCount}.`);

const replayGuard = read('supabase/migrations/20260912161836_buklod_r38_withdrawal_replay_privacy_guard_v1.sql');
requireText('withdrawal replay privacy guard', replayGuard, [
  'payout_account_name_snapshot',
  'payout_destination_snapshot',
]);

const snapshotGuard = read('supabase/migrations/20260912161802_buklod_r38_withdrawal_destination_snapshot_v1.sql');
requireText('withdrawal destination snapshot', snapshotGuard, [
  'payout_account_name_snapshot',
  'payout_destination_snapshot',
]);

if (failures.length) {
  console.error('R38 ECONOMY RELEASE CONTRACT: FAIL');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log('R38 ECONOMY RELEASE CONTRACT: PASS');
console.log(`Validated ${clientSources.length} R38 client/admin sources and ${migrations.length} ordered economy migrations.`);
for (const item of warnings) console.warn(`WARN: ${item}`);
