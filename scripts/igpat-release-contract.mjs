import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const contentOnly = process.argv.includes('--content-only');

function fail(message) {
  console.error(`IGPAT RELEASE CONTRACT FAILED: ${message}`);
  process.exitCode = 1;
}

function requireFile(path) {
  if (!existsSync(path)) fail(`missing required file: ${path}`);
}

function text(path) {
  requireFile(path);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

const required = [
  'src/app/igpat/index.tsx',
  'src/app/igpat/create.tsx',
  'src/app/igpat/create.web.tsx',
  'src/app/igpat/share/[id].tsx',
  'src/app/igpat/captions/[id].tsx',
  'src/app/igpat/arena/index.tsx',
  'src/app/igpat/arena/squad.tsx',
  'src/app/igpat/arena/last-man.tsx',
  'src/components/IgpatSponsoredFeedPage.tsx',
  'src/lib/igpat/adPolicy.ts',
  'src/lib/igpat/quickEdit.ts',
  'supabase/functions/buklod-igpat-captions/index.ts',
  'scripts/igpat-sql-contract.mjs',
];
required.forEach(requireFile);

const feed = text('src/app/igpat/index.tsx');
for (const marker of [
  'An Instant Bond.',
  'cleanScreen',
  'IgpatSponsoredFeedPage',
  'DATA_SAVER_KEY',
  'get_buklod_igpat_caption_v1',
  '/igpat/share/${row.id}',
]) {
  if (!feed.includes(marker)) fail(`feed is missing required contract marker: ${marker}`);
}

const arenaHub = text('src/app/igpat/arena/index.tsx');
for (const marker of ['/igpat/arena/squad', '/igpat/arena/last-man']) {
  if (!arenaHub.includes(marker)) fail(`Arena hub is missing completed mode: ${marker}`);
}

const squad = text('src/app/igpat/arena/squad.tsx');
for (const marker of [
  'igpat_cancel_squad_match_v1',
  'roster',
  'outside Respect',
  'CANCEL BEFORE SUBMISSION',
]) {
  if (!squad.includes(marker)) fail(`Squad UI is missing integrity marker: ${marker}`);
}

const lastMan = text('src/app/igpat/arena/last-man.tsx');
for (const marker of [
  'igpat_advance_lms_round_v1',
  'outside Respect voting begins',
  'entry.user_id === user?.id',
  'allVisibleToMe',
]) {
  if (!lastMan.includes(marker)) fail(`Last Man Standing UI is missing integrity marker: ${marker}`);
}

const communityCreate = text('src/app/community/create.tsx');
if (communityCreate.includes("'video/*'") || communityCreate.includes('"video/*"')) {
  fail('Community composer reintroduced direct video picking');
}
if (/image\/gif/i.test(communityCreate)) {
  fail('Community composer reintroduced direct GIF posting');
}
if (!communityCreate.includes("p_media_mime_type:uploadedMomentPath?'image/jpeg':null")) {
  fail('Community photo-only media contract changed unexpectedly');
}

const pendingDir = 'supabase/igpat_pending';
if (existsSync(pendingDir)) {
  const pending = readdirSync(pendingDir).filter(name => name.endsWith('.sql'));
  if (pending.length) fail(`release SQL is still stranded in igpat_pending: ${pending.join(', ')}`);
}

const migrationDir = 'supabase/migrations';
const migrationNames = readdirSync(migrationDir).filter(name => /igpat/i.test(name));
const releaseMigrationNames = migrationNames.filter(name => /^20260915/.test(name));
const requiredMigrationMarkers = [
  'quick_edit_metadata_r17',
  'arena_hardening_r28',
  'smart_feed_controls_r47_r48',
  'caption',
  'share_context',
  'monetization',
  'creator_analytics',
  'notifications',
  'squad_lms_r35_r39',
  'competitive_rank_integration_r35_r39',
  'competitive_fairness_r35_r39',
  'creator_analytics_complete_r61',
  'structured_record_r32_r35_r39',
  'squad_roster_lock_r35',
  'squad_pending_cancel_r35',
  'lms_voting_fairness_r39',
  'rank_visibility_seasons_r35_r39_r40',
  'internal_function_privileges_r35_r39_r62',
  'share_helper_privilege_r53_r54',
];
for (const marker of requiredMigrationMarkers) {
  if (!releaseMigrationNames.some(name => name.includes(marker))) fail(`missing IGPAT release migration containing: ${marker}`);
}

for (const name of releaseMigrationNames) {
  const sql = text(join(migrationDir, name));
  if (/grant\s+all\s+on\s+table[\s\S]{0,160}\bauthenticated\b/i.test(sql)) fail(`${name} grants broad table access to authenticated`);
  if (/grant\s+all\s+on\s+table[\s\S]{0,160}\banon\b/i.test(sql)) fail(`${name} grants broad table access to anon`);
}

const internalPrivilegeSql = releaseMigrationNames
  .filter(name => name.includes('internal_function_privileges') || name.includes('share_helper_privilege'))
  .map(name => text(join(migrationDir, name)))
  .join('\n');
for (const signature of [
  'igpat_is_active_squad_member_v1(uuid,uuid)',
  'igpat_can_user_view_post_v1(uuid,uuid)',
]) {
  if (!internalPrivilegeSql.includes(`revoke all on function public.${signature} from public,anon,authenticated`)) {
    fail(`internal helper is not explicitly removed from authenticated execution: ${signature}`);
  }
}

if (!contentOnly) {
  try {
    const mergeBase = execFileSync('git', ['merge-base', 'origin/main', 'HEAD'], { encoding: 'utf8' }).trim();
    const changed = execFileSync('git', ['diff', '--name-only', `${mergeBase}..HEAD`], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    const isAllowed = path =>
      path.startsWith('src/app/igpat/') ||
      path.startsWith('src/lib/igpat/') ||
      path === 'src/components/CommunityVideo.tsx' ||
      path === 'src/components/IgpatSponsoredFeedPage.tsx' ||
      (path.startsWith('supabase/migrations/') && /igpat/i.test(path)) ||
      path.startsWith('supabase/functions/buklod-igpat-captions/') ||
      path.startsWith('.github/workflows/igpat_') ||
      path.startsWith('scripts/igpat-') ||
      path.startsWith('src/lib/igpat/__tests__/');

    const bad = changed.filter(path => !isAllowed(path));
    if (bad.length) fail(`out-of-scope files changed: ${bad.join(', ')}`);

    const forbidden = changed.filter(path => /quickcheck|quiz|classroom|src\/lib\/education\//i.test(path));
    if (forbidden.length) fail(`forbidden non-IGPAT app scope changed: ${forbidden.join(', ')}`);
  } catch (error) {
    fail(`could not evaluate branch scope: ${error instanceof Error ? error.message : String(error)}`);
  }
} else {
  console.log('IGPAT release contract: integrated content-only mode (strict branch-scope check intentionally skipped)');
}

if (!process.exitCode) console.log('IGPAT release contract: PASS');
