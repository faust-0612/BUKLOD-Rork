import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const migrationDir = 'supabase/migrations';
let failed = false;

function fail(message) {
  console.error(`IGPAT SQL CONTRACT FAILED: ${message}`);
  failed = true;
}

if (!existsSync(migrationDir)) {
  fail(`missing ${migrationDir}`);
  process.exit(1);
}

// Current IGPAT release migrations are deliberately grouped under the 20260915
// prefix. Older unrelated/legacy migrations are not retroactively judged here.
const files = readdirSync(migrationDir)
  .filter(name => /^20260915.*igpat/i.test(name) && name.endsWith('.sql'))
  .sort();

const sources = new Map(files.map(name => [name, readFileSync(join(migrationDir, name), 'utf8')]));

for (const [name, sql] of sources) {
  if (/as\s+\$\$\s*;/i.test(sql)) fail(`${name} contains malformed "AS $$;" function delimiter`);

  const dollars = sql.match(/\$\$/g)?.length ?? 0;
  if (dollars % 2 !== 0) fail(`${name} has an odd number of $$ delimiters (${dollars})`);

  const lowered = sql.toLowerCase();
  let cursor = 0;
  while ((cursor = lowered.indexOf('security definer', cursor)) >= 0) {
    const after = lowered.slice(cursor, cursor + 220);
    if (!after.includes("set search_path = ''")) {
      fail(`${name} has SECURITY DEFINER without an immediately hardened empty search_path`);
      break;
    }
    cursor += 'security definer'.length;
  }

  if (/grant\s+all\s+on\s+table[\s\S]{0,180}\bauthenticated\b/i.test(sql)) {
    fail(`${name} grants broad table access to authenticated`);
  }
  if (/grant\s+all\s+on\s+table[\s\S]{0,180}\banon\b/i.test(sql)) {
    fail(`${name} grants broad table access to anon`);
  }
}

function latestDefinition(functionName) {
  const needle = `create or replace function public.${functionName.toLowerCase()}(`;
  let latest = null;
  for (const name of files) {
    if (sources.get(name).toLowerCase().includes(needle)) latest = name;
  }
  return latest;
}

const expectedLatest = {
  igpat_create_squad_match_v1: 'squad_roster_lock_r35',
  igpat_respond_squad_match_v1: 'squad_roster_lock_r35',
  igpat_cancel_squad_match_v1: 'squad_pending_cancel_r35',
  igpat_submit_squad_match_v1: 'competitive_fairness_r35_r39',
  igpat_finalize_squad_match_v1: 'competitive_fairness_r35_r39',
  igpat_start_lms_event_v1: 'competitive_fairness_r35_r39',
  igpat_submit_lms_entry_v1: 'competitive_fairness_r35_r39',
  igpat_advance_lms_round_v1: 'competitive_fairness_r35_r39',
  igpat_vote_lms_v1: 'lms_voting_fairness_r39',
  get_buklod_igpat_arena_rankings_v1: 'rank_visibility_seasons_r35_r39_r40',
  get_buklod_igpat_season_rankings_v1: 'rank_visibility_seasons_r35_r39_r40',
  get_my_buklod_igpat_arena_record_v1: 'structured_record_r32_r35_r39',
  get_my_buklod_igpat_creator_analytics_v1: 'creator_analytics_complete_r61',
};

for (const [fn, marker] of Object.entries(expectedLatest)) {
  const latest = latestDefinition(fn);
  if (!latest) fail(`missing required final function ${fn}`);
  else if (!latest.includes(marker)) fail(`${fn} final override is ${latest}, expected marker ${marker}`);
}

const requiredSqlMarkers = [
  'igpat_arena_one_active_captain_squad_idx',
  'roster is snapshotted at acceptance',
  'Outside Respect opens only after every active participant',
  'viewer may inspect contributes',
  'Normal social IGPATs never receive W/L records',
];
const allSql = [...sources.values()].join('\n');
for (const marker of requiredSqlMarkers) {
  if (!allSql.toLowerCase().includes(marker.toLowerCase())) fail(`missing SQL safety contract marker: ${marker}`);
}

if (failed) process.exit(1);
console.log(`IGPAT SQL contract: PASS (${files.length} current-release migrations inspected)`);
