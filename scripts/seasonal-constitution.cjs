/**
 * BUKLOD seasonal constitutional guardrails.
 * Pure, dependency-free checks. Not imported by Season 1 production.
 * This is an advisory/CI contract, NOT a runtime authorization or release approval.
 */
'use strict';

const PROTECTED = Object.freeze([
  'lifetime_circle_rank','character_level','character_xp','character_inventory',
  'permanent_badges','owned_collectibles','verified_lifetime_progress',
  'financial_ledger','qmp','withdrawable_balance','withdrawal_history',
  'organization_membership','cluster_membership'
]);
const RESETTABLE = Object.freeze([
  'seasonal_score','seasonal_missions','seasonal_competition_tier'
]);
const RELEASE_GATES = Object.freeze([
  'season1_production_unchanged','separate_versioned_rules','signed_previous_season_results',
  'idempotent_rollover','concurrent_rollover_safe','ledger_reconciliation',
  'inventory_reconciliation','staging_rc_verified','admob_device_verified',
  'instant_navigation_verified','owner_sha_bound_approval','production_embargo_satisfied',
  'rollback_tested','monitoring_active'
]);
function evaluateSeasonProposal(proposal) {
  const p = proposal || {};
  const warnings = [];
  const changes = Array.isArray(p.changes) ? p.changes : [];
  for (const change of changes) {
    if (!change || typeof change !== 'object') {
      warnings.push({ severity:'BLOCK', code:'INVALID_CHANGE' }); continue;
    }
    if (change.operation === 'reset' && PROTECTED.includes(change.target))
      warnings.push({severity:'BLOCK',code:'PERMANENT_PROGRESS_RESET',target:change.target});
    if (change.operation === 'reset' && !RESETTABLE.includes(change.target) && !PROTECTED.includes(change.target))
      warnings.push({severity:'REVIEW',code:'UNKNOWN_RESET_TARGET',target:change.target});
    if (change.target === 'season1_rules' || change.target === 'production_runtime')
      warnings.push({severity:'BLOCK',code:'LIVE_SEASON_ISOLATION',target:change.target});
    if (change.operation === 'expire' && change.target === 'wallet_token' && !change.explicitPublishedTerms)
      warnings.push({severity:'BLOCK',code:'TOKEN_EXPIRY_WITHOUT_TERMS'});
  }
  if (p.release === 'production') {
    for (const gate of RELEASE_GATES)
      if (p.evidence?.[gate] !== true)
        warnings.push({severity:'BLOCK',code:'MISSING_RELEASE_EVIDENCE',gate});
  }
  return {allowed:!warnings.some(w=>w.severity==='BLOCK'),warnings};
}
module.exports={PROTECTED,RESETTABLE,RELEASE_GATES,evaluateSeasonProposal};
