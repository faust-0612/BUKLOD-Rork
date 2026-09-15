import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowDir = path.join(root, '.github', 'workflows');
const failures = [];

const canonicalMutators = new Set([
  'production_release_manual.yml',
  'production_web_rollback_manual.yml',
]);

const retired = [
  'character_r25c_containment_deploy.yml',
  'character_r25d_context_viewport_deploy.yml',
  'daily_devotional_r24_android_deploy.yml',
  'daily_devotional_r24_autopatch.yml',
  'daily_devotional_r24_web_deploy.yml',
  'emergency_web_restore_known_good.yml',
  'emergency_web_supabase_env_restore.yml',
  'formation_ai_play_apk_release.yml',
  'formation_r27_production_deploy.yml',
  'home_identity_r23_autopatch.yml',
  'igpat_production_ota.yml',
  'igpat_production_web_deploy.yml',
  'main_auth_storm_r21_deploy.yml',
  'mzb_profile_home_door_r26_fix.yml',
  'org_directory_home_door_r25_fix.yml',
  'org_profile_setup_hub_r24_dispatch.yml',
  'patch_production_web_env_pipeline.yml',
  'production_android_apk.yml',
  'production_android_ota.yml',
  'production_points_claim.yml',
  'production_web_deploy.yml',
  'production_web_r21_navigation_fix.yml',
  'profile_org_quick_card_r24_fix.yml',
  'web_advance_r29_exact.yml',
  'web_advance_r31_exact.yml',
  'web_live_atmosphere_r1_deploy.yml',
  'web_restore_r31_exact.yml',
  'web_rollback_r27a_exact.yml',
];

for (const file of retired) {
  if (fs.existsSync(path.join(workflowDir, file))) {
    failures.push(`Retired production bypass workflow still exists: ${file}`);
  }
}

if (!fs.existsSync(path.join(workflowDir, 'production_release_manual.yml'))) {
  failures.push('Missing canonical manual production release workflow.');
}
if (!fs.existsSync(path.join(workflowDir, 'production_web_rollback_manual.yml'))) {
  failures.push('Missing canonical manual web rollback workflow.');
}

const files = fs
  .readdirSync(workflowDir)
  .filter((name) => /\.ya?ml$/i.test(name));

// Mutating EAS verbs must be followed by whitespace. This intentionally does
// not classify read-only commands such as `build:view` or `build:list` as a
// production build.
const easMutation = /\bnpx\s+eas-cli@latest\s+(?:update(?=\s)|deploy(?::alias)?(?=\s)|build(?=\s)|submit(?=\s))/i;
const directMainPush = /\bgit\s+push\b[^\n]*\bmain\b/i;
const productionDispatch = /\bgh\s+workflow\s+run\b[^\n]*\bproduction[^\n]*/i;
const supabaseProductionMutation = /\bsupabase\s+(?:db\s+push|migration\s+up|functions\s+deploy)\b/i;

for (const name of files) {
  const text = fs.readFileSync(path.join(workflowDir, name), 'utf8');
  const hasTopLevelPush = /^\s{2}push:\s*$/m.test(text);
  const hasWorkflowDispatch = /^\s{2}workflow_dispatch:\s*$/m.test(text);
  const hasEasMutation = easMutation.test(text);
  const hasSupabaseMutation = supabaseProductionMutation.test(text);

  if (directMainPush.test(text)) {
    failures.push(`${name}: workflow may push source directly to main.`);
  }
  if (productionDispatch.test(text)) {
    failures.push(`${name}: workflow may dispatch another production workflow.`);
  }

  if (hasEasMutation || hasSupabaseMutation) {
    if (!canonicalMutators.has(name)) {
      failures.push(`${name}: production mutation exists outside the canonical manual release/rollback workflows.`);
    }
    if (hasTopLevelPush) {
      failures.push(`${name}: production-mutating workflow must not have a push trigger.`);
    }
    if (!hasWorkflowDispatch) {
      failures.push(`${name}: production-mutating workflow must require workflow_dispatch.`);
    }
    if (/contents:\s*write/i.test(text)) {
      failures.push(`${name}: production-mutating workflow must not have contents: write.`);
    }
  }
}

if (failures.length) {
  console.error('BUKLOD PRODUCTION WORKFLOW SAFETY CONTRACT FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('BUKLOD PRODUCTION WORKFLOW SAFETY CONTRACT PASSED.');
console.log('Production release is manual-only, exact-source, and centralized.');
