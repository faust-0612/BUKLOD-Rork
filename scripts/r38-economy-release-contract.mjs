import fs from 'node:fs';

const failures = [];

function read(path) {
  if (!fs.existsSync(path)) {
    failures.push(`Missing canonical economy source: ${path}`);
    return '';
  }
  return fs.readFileSync(path, 'utf8');
}

function requireText(path, content, needles) {
  for (const needle of needles) {
    if (!content.includes(needle)) {
      failures.push(`${path} is missing canonical marker: ${needle}`);
    }
  }
}

function forbidText(path, content, needles) {
  for (const needle of needles) {
    if (content.includes(needle)) {
      failures.push(`${path} contains retired/unsafe marker: ${needle}`);
    }
  }
}

const financeMigrationPath =
  'supabase/migrations/20260920140000_buklod_main_profit_first_referral_v2.sql';
const payoutMigrationPath =
  'supabase/migrations/20260920143000_buklod_main_profit_first_payout_v2.sql';
const economyLibPath = 'src/lib/buklodEconomyV3.ts';
const bayanihanPath = 'src/app/bayanihan/index.tsx';
const guidePath = 'src/app/bayanihan/guide.tsx';
const referralPath = 'src/components/BuklodReferralInviteCard.tsx';
const payoutPath = 'src/app/bayanihan/payout-profile.tsx';
const withdrawalsPath = 'src/app/bayanihan/withdrawals.tsx';
const payoutLibPath = 'src/lib/buklodR38Economy.ts';
const adminPayoutLibPath = 'src/lib/buklodR38AdminEconomy.ts';
const i18nPath = 'src/providers/BuklodI18nProvider.tsx';
const languageCatalogPath = 'src/i18n/catalog.ts';

const financeMigration = read(financeMigrationPath);
const payoutMigration = read(payoutMigrationPath);
const economyLib = read(economyLibPath);
const bayanihan = read(bayanihanPath);
const guide = read(guidePath);
const referral = read(referralPath);
const payout = read(payoutPath);
const withdrawals = read(withdrawalsPath);
const payoutLib = read(payoutLibPath);
const adminPayoutLib = read(adminPayoutLibPath);
const i18n = read(i18nPath);
const languageCatalog = read(languageCatalogPath);

requireText(financeMigrationPath, financeMigration, [
  'canonical_finance_v3',
  'user_pool_bps integer not null default 3000',
  'first_line_bps integer not null default 1000',
  'cluster_fund_bps integer not null default 500',
  'organization_fund_bps integer not null default 700',
  'one_time_referral_centavos bigint not null default 2000',
  'referred_qualification_centavos bigint not null default 4000',
  'no_referrer_qualification_centavos bigint not null default 6000',
  'organization_contributor_threshold integer not null default 30',
  'buklod_pf_user_settlements',
  'USER_POOL_SETTLEMENT',
  'FIRST_LINE_SETTLEMENT',
  'buklod_pf_community_designations',
  'idx_buklod_pf_one_active_community_destination',
  'buklod_pf_qualification_fund_ledger',
  'admin_finalize_buklod_pf_month_v3',
  'get_my_buklod_financial_summary_v3',
  'POINTS NEVER ENTER THIS TABLE',
  'monthly settlement performs the economic distribution',
]);

requireText(payoutMigrationPath, payoutMigration, [
  'PROFIT_FIRST_V3',
  'person_id uuid',
  'idx_buklod_pf_withdrawal_person_request',
  'buklod_pf_cash_balance_centavos_v3',
  'payout_identity_snapshotted',
]);

requireText(economyLibPath, economyLib, [
  'get_my_buklod_financial_summary_v3',
  'ensureBuklodProfitFirstIdentity',
]);

requireText(bayanihanPath, bayanihan, [
  'loadMyBuklodFinancialSummaryV3',
  "t('economy.progressTitle')",
  "t('economy.earningsTitle')",
  "t('economy.referralTitle')",
  "t('economy.communityTitle')",
  "router.push('/bayanihan/guide'",
]);

forbidText(bayanihanPath, bayanihan, [
  'loadMyBuklodR38EconomyReport',
  'Qualified BCU',
  'Qualified RCU',
  'Current Period BCU',
  'Direct Referral pool share',
  'BCU helps determine',
  'RCU only shares',
]);

requireText(guidePath, guide, [
  "t('economy.guide.stickySummary')",
  "router.replace('/bayanihan'",
  "router.push('/preferences/language'",
  "t('economy.guide.estimator')",
  'loadMyBuklodFinancialSummaryV3',
]);

requireText(referralPath, referral, [
  '₱20 PENDING',
  'WITHDRAWABLE',
]);

requireText(payoutLibPath, payoutLib, [
  "'request_my_buklod_pf_withdrawal_v2'",
  "'cancel_my_buklod_pf_withdrawal_v2'",
]);
requireText(adminPayoutLibPath, adminPayoutLib, [
  "'admin_mark_buklod_pf_withdrawal_paid_v2'",
]);

requireText(i18nPath, i18n, [
  'English fallback',
  'formatPhp',
  "currency: 'PHP'",
  'productionBuklodLanguages',
]);
requireText(languageCatalogPath, languageCatalog, [
  "code: 'en'",
  "code: 'fil'",
  "code: 'zh-CN'",
  "code: 'zh-TW'",
  "code: 'de'",
  "code: 'ar'",
  'productionReady: true',
]);

forbidText(
  languageCatalogPath,
  languageCatalog,
  [
    "code: 'fil',\n    englishName: 'Filipino',\n    nativeName: 'Filipino',\n    intlLocale: 'fil-PH',\n    direction: 'ltr',\n    packVersion: 'fil-v1',\n    completionPercent: 100",
  ],
);

const clientSources = [
  [economyLibPath, economyLib],
  [bayanihanPath, bayanihan],
  [guidePath, guide],
  [referralPath, referral],
  [payoutPath, payout],
  [withdrawalsPath, withdrawals],
  [payoutLibPath, payoutLib],
  [adminPayoutLibPath, adminPayoutLib],
];

for (const [path, content] of clientSources) {
  forbidText(path, content, [
    'point_equivalent_peso',
    'cash_redemption_enabled',
    'convertBuklodPointsToBayanihan',
    'requestBuklodCashReward',
  ]);
  if (/\.from\(\s*['"](?:private\.)?buklod_pf_/m.test(content)) {
    failures.push(
      `${path} directly accesses private Profit-First tables; financial client access must remain RPC-mediated.`,
    );
  }
}

if (failures.length) {
  console.error('BUKLOD CANONICAL ECONOMY RELEASE CONTRACT: FAIL');
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}

console.log('BUKLOD CANONICAL ECONOMY RELEASE CONTRACT: PASS');
console.log(
  'Validated canonical monthly User Pool, first-line referral, one Community destination, centavo ledger, payout bridge, guide and i18n boundaries.',
);
