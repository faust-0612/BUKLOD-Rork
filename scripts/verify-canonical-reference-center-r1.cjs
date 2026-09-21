'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const failures = [];

function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing required file: ${rel}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
}

function requireText(source, needle, label) {
  if (!source.includes(needle)) {
    failures.push(label || `Missing contract: ${needle}`);
  }
}

function forbidText(source, needle, label) {
  if (source.includes(needle)) {
    failures.push(label || `Forbidden contract found: ${needle}`);
  }
}

const migration = read(
  'supabase/migrations/20260921113000_buklod_canonical_reference_center_r1.sql',
);
const service = read('src/lib/buklodCanonicalReference.ts');
const gate = read('src/components/CanonicalReferenceGate.tsx');
const renderer = read('src/components/BuklodCanonicalMarkdown.tsx');
const screen = read('src/app/admin/canonical-reference.tsx');
const dbTest = read('supabase/tests/buklod_canonical_reference_center_r1_test.sql');
const admin = read('src/app/admin/index.tsx');
const layout = read('src/app/_layout.tsx');

[
  'buklod_canonical_documents',
  'buklod_canonical_document_versions',
  'buklod_canonical_sections',
  'buklod_canonical_implementation_links',
  'buklod_canonical_change_log',
].forEach(name =>
  requireText(migration, name, `Missing canonical table/domain object: ${name}`),
);

[
  'canonical.reference.view',
  'canonical.reference.restricted_view',
  'canonical.reference.draft',
  'canonical.reference.review',
  'canonical.reference.approve',
  'canonical.reference.publish',
  'canonical.reference.high_risk_publish',
  'canonical.reference.implementation',
].forEach(permission =>
  requireText(migration, permission, `Missing granular permission: ${permission}`),
);

requireText(
  migration,
  "revoke all on function public.buklod_canonical_audit_v1",
  'Internal audit helper must not be executable by normal authenticated users.',
);
requireText(
  migration,
  "visibility_scope='INTERNAL'",
  'Section visibility boundary is missing.',
);
requireText(
  migration,
  "canonical.reference.restricted_view",
  'Restricted internal section permission is missing.',
);
requireText(
  migration,
  "create unique index if not exists buklod_canonical_one_effective_uq",
  'One-effective-version unique guard is missing.',
);
requireText(
  migration,
  "where status='EFFECTIVE'",
  'Effective-version partial uniqueness filter is missing.',
);
requireText(
  migration,
  "Only DRAFT versions can be edited",
  'Published/reviewed canonical sections are not locked against in-place edits.',
);
requireText(
  migration,
  'STALE_CANONICAL_SECTION',
  'Section optimistic-concurrency guard is missing.',
);
requireText(
  migration,
  'STALE_CANONICAL_VERSION',
  'Version optimistic-concurrency guard is missing.',
);
requireText(
  migration,
  'STALE_CANONICAL_BASE',
  'Publish stale-base protection is missing.',
);
requireText(
  migration,
  'DIFF_REVIEW_REQUIRED',
  'Mandatory high-risk diff acknowledgement is missing.',
);
requireText(
  migration,
  "v.risk_level in('FINANCIAL','SECURITY','PRIVACY')",
  'Elevated publish class guard is missing.',
);
requireText(
  migration,
  "buklod_canonical_assert_permission_v1('canonical.reference.high_risk_publish')",
  'Elevated high-risk publish permission is missing.',
);
requireText(
  migration,
  'request_idempotency_key',
  'Draft idempotency key is missing.',
);
requireText(
  migration,
  'buklod_queue_notification_once_v1',
  'Material-change notification dedupe is missing.',
);
requireText(
  migration,
  "and rp.permission_key in(",
  'Publish notifications are not restricted to canonical-reference staff.',
);
requireText(
  migration,
  "p_include_history",
  'Effective-only search with optional history contract is missing.',
);
requireText(
  migration,
  "v.id=d.current_effective_version_id",
  'Default canonical search is not anchored to the effective version.',
);
requireText(
  migration,
  "implementation_status",
  'Policy/implementation status separation is missing.',
);
requireText(
  migration,
  "verification_status",
  'Reference/implementation mismatch status is missing.',
);
requireText(
  migration,
  "insert into public.audit_logs",
  'Existing platform audit infrastructure is not reused.',
);

const sectionKeys = [
  '01_authority_change_control',
  '02_product_architecture',
  '03_organization_institutional_workspace',
  '04_institutional_partnership',
  '05_standalone_apps',
  '06_economy_designated_funding',
  '07_points_participant_benefits',
  '08_referral_program',
  '09_community_fund_rates',
  '10_community_fund_governance',
  '11_suborg_finance_governance',
  '12_rewards_incentives',
  '13_monetization_positioning',
  '14_public_messaging',
  '15_bsoc_support',
  '16_finance_control_center',
  '17_reliability_self_heal',
  '18_security_financial_invariants',
  '19_release_engineering',
  '20_reference_center_rules',
  '21_definitions_wording',
  '22_change_log',
];
for (const key of sectionKeys) {
  requireText(migration, `'${key}'`, `Missing canonical seed section: ${key}`);
}
const seededKeys = sectionKeys.filter(key => migration.includes(`'${key}'`));
if (seededKeys.length !== 22) {
  failures.push(`Expected 22 stable seed sections; found ${seededKeys.length}.`);
}

[
  'PHP 20',
  '10% for six months',
  '1-29 -> 5%',
  '30+ -> 7%',
  '30 days',
  '30% / 10% / 5-7%',
  'P0 CONTAINMENT -> STRUCTURE -> END-TO-END FUNCTION -> 1M SCALE HARDENING -> LOAD/FAILURE TEST -> EXACT RELEASE-CANDIDATE VERIFICATION -> RELEASE',
  'Community Wall is the canonical/root user screen. Do not resurrect a legacy Public Home.',
].forEach(marker =>
  requireText(migration, marker, `Seed meaning marker missing or altered: ${marker}`),
);

const forbiddenRuntimeDml = [
  /(?:insert\s+into|update|delete\s+from)\s+public\.buklod_r38_/i,
  /(?:insert\s+into|update|delete\s+from)\s+public\.buklod_revenue/i,
  /(?:insert\s+into|update|delete\s+from)\s+public\.buklod_referral/i,
  /(?:insert\s+into|update|delete\s+from)\s+public\.buklod_community_fund/i,
  /(?:insert\s+into|update|delete\s+from)\s+public\.buklod_bayanihan/i,
  /(?:insert\s+into|update|delete\s+from)\s+public\.giving_/i,
];
for (const pattern of forbiddenRuntimeDml) {
  if (pattern.test(migration)) {
    failures.push(
      `Reference Center migration contains forbidden runtime financial DML: ${pattern}`,
    );
  }
}

requireText(
  migration,
  'No authenticated direct write policies are created',
  'Direct-write containment statement is missing.',
);
requireText(
  migration,
  'from anon,authenticated',
  'Explicit table privilege revocation is missing.',
);
requireText(
  migration,
  'grant select on table',
  'Authenticated read-only table grant is missing.',
);
forbidText(
  migration,
  'create policy buklod_canonical_documents_write',
  'Direct canonical document write policy must not exist.',
);
forbidText(
  migration,
  'grant insert on public.buklod_canonical',
  'Authenticated direct insert grants must not exist.',
);

requireText(dbTest, 'select plan(36);', 'Reference Center pgTAP plan is missing or stale.');
requireText(dbTest, 'STALE_CANONICAL_SECTION', 'pgTAP stale-editor coverage is missing.');
requireText(dbTest, 'DIFF_REVIEW_REQUIRED', 'pgTAP high-risk diff guard coverage is missing.');
requireText(dbTest, 'canonical.reference.publish', 'pgTAP publish-permission coverage is missing.');
requireText(dbTest, 'RLS exposes only INTERNAL sections', 'pgTAP restricted-section RLS coverage is missing.');

requireText(service, 'copyCanonicalSection', 'Copy Section support is missing.');
requireText(service, 'copyCanonicalMarkdown', 'Copy Current Rules support is missing.');
requireText(service, 'searchCanonicalReference', 'Reference search client is missing.');
requireText(service, 'compareCanonicalVersions', 'Reference compare client is missing.');

requireText(gate, 'canonical.reference.view', 'Direct route permission gate is missing.');
requireText(admin, 'title="Canonical Reference"', 'Administration entry is missing.');
requireText(admin, 'path="/admin/canonical-reference"', 'Admin route entry is missing.');
requireText(layout, 'name="admin/canonical-reference"', 'Root stack route registration is missing.');

[
  'dangerouslySetInnerHTML',
  'WebView',
  'renderHTML',
  'eval(',
  'new Function(',
].forEach(token =>
  forbidText(renderer, token, `Unsafe Markdown rendering primitive found: ${token}`),
);
requireText(renderer, 'BuklodCanonicalMarkdown', 'Controlled Markdown renderer is missing.');

requireText(
  screen,
  'Publishing updates the canonical documentation only. It does NOT change runtime money rules, RLS, permissions, settlement behavior, feature flags, or production code.',
  'Runtime/documentation separation warning is missing from Publish.',
);
requireText(
  screen,
  'CURRENT EFFECTIVE VERSION',
  'Current-effective banner is missing.',
);
requireText(
  screen,
  'Include history',
  'Search history toggle is missing.',
);
requireText(
  screen,
  'Copy Section',
  'Copy Section action is missing.',
);
requireText(
  screen,
  'Copy Current Rules',
  'Copy Current Rules action is missing.',
);
requireText(
  screen,
  'Conflict detected:',
  'Visible optimistic-concurrency conflict handling is missing.',
);
requireText(
  screen,
  'requestId:',
  'Stable draft request identity is missing.',
);

if (failures.length) {
  console.error('BUKLOD Canonical Reference Center R1 Contract');
  console.error('============================================');
  failures.forEach(failure => console.error(`FAIL: ${failure}`));
  console.error(`\nContract FAILED with ${failures.length} blocker(s).`);
  process.exit(1);
}

console.log('BUKLOD_CANONICAL_REFERENCE_CENTER_R1_CONTRACT_OK');
