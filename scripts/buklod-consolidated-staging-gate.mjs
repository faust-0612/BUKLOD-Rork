#!/usr/bin/env node
/**
 * BUKLOD consolidated staging release hold, Nov 14 2026.
 * This is a fail-closed implementation/acceptance gate, not a visual mock.
 * Source-only tests never count as Android runtime acceptance.
 * It does not alter production or the existing APK/runtime identity.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const REQUIRED_CHECK_IDS = Object.freeze([
  'kingdom_map_skia_reanimated',
  'kingdom_rive_character_scenes',
  'kingdom_13_games_interaction',
  'connect_notification_exact_thread',
  'submission_notification_exact_review_comment',
  'wall_gif_comment_no_refresh',
  'profile_rank_cutoff_posts_privacy',
  'profile_org_suborg_no_duplicates',
  'home_tips_announcements',
  'search_natural_questions_coverage',
  'sounds_themes',
  'health_center_consult_professional',
  'health_imci_guidance',
  'saliksik_staging_integration',
  'bsoc_gpt_operator_case_triage',
  'feature_merge_parity',
  'sponsored_video_fast_start',
  'sponsored_video_original_quality_cache',
]);

export function evaluateBuklodConsolidatedAcceptance(contract) {
  const errors = [];
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    return ['No valid consolidated acceptance contract.'];
  }
  if (contract.schemaVersion !== 1 ||
      contract.id !== 'BUKLOD_20261114_CONSOLIDATED_OWNER_ACCEPTANCE') {
    errors.push('Consolidated contract identity/version mismatch.');
  }
  if (contract.sourceBranch !== 'dev/full-visual-transformation-20261113' ||
      contract.targetChannel !== 'staging-user' ||
      contract.runtimeVersion !== '1.3.2' ||
      contract.nativeRebuildPermitted !== false) {
    errors.push('Staging-only/native-free release identity no longer matches the signed APK.');
  }
  if (contract.integrationStatus !== 'merged_and_verified') {
    errors.push('All requested changes must be reconciled into one verified staging candidate.');
  }
  if (contract.readyForRelease !== true) errors.push('Consolidated release has not been accepted.');
  const checks = Array.isArray(contract.checks) ? contract.checks : [];
  const seen = new Set();
  for (const check of checks) {
    if (!check || typeof check.id !== 'string' || seen.has(check.id)) {
      errors.push('Invalid or duplicate feature acceptance entry.');
      continue;
    }
    seen.add(check.id);
  }
  for (const id of REQUIRED_CHECK_IDS) {
    const check = checks.find(item => item?.id === id);
    if (!check) {
      errors.push('Missing required acceptance: ' + id);
    } else if (check.status !== 'verified' ||
      !Array.isArray(check.evidence) ||
      !check.evidence.some(e => typeof e === 'string' && e.trim().length >= 12)) {
      errors.push('Not accepted: ' + id + ' — ' + String(check.blocker || 'missing runtime evidence'));
    }
  }
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const path = process.argv[2] || 'release/visual/buklod-consolidated-acceptance-20261114.json';
  let contract;
  try { contract = JSON.parse(fs.readFileSync(path, 'utf8')); }
  catch { console.error('CONSOLIDATED STAGING HOLD: acceptance manifest missing or invalid.'); process.exit(1); }
  const errors = evaluateBuklodConsolidatedAcceptance(contract);
  if (errors.length) {
    for (const issue of errors) console.error('CONSOLIDATED STAGING HOLD: ' + issue);
    console.error('BLOCKED BEFORE NEXT OTA. Do not publish a partial candidate.');
    process.exit(1);
  }
  console.log('Consolidated BUKLOD staging acceptance verified; continue standard native/CI/Expo release gates.');
}
