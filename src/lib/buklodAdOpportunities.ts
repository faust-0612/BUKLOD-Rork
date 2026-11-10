import { Platform } from 'react-native';
import {
  maybeShowBuklodInterstitial,
  warmBuklodInterstitial,
} from '@/lib/buklodAds';
import type { BuklodNaturalInterstitialReason } from '@/lib/buklodGlobalAdController';

/**
 * BUKLOD_AD_OPPORTUNITIES_R1
 * Natural-break ads only, never a dependency of saving, submitting, claiming,
 * reading, navigation, account operations or a cash / redeemable balance.
 *
 * AdMob rewarded ads remain explicitly opt-in for NON-TRANSFERABLE in-app
 * benefits; the separate Points economy must never reward ad views.
 *
 * Existing global controller enforces route safety, remote kill switches,
 * session cap, multi-action threshold and cooldown. New slots share one
 * existing interstitial unit to avoid extra native/build requirements.
 */
const BREAKS = {
  // Only successfully completed reading/learning stages are eligible.
  bible_chapter_success: {
    reason: 'reading_session_completed',
    placement: 'interstitial_bible_chapter_completed',
  },
  abc_lesson_success: {
    reason: 'lesson_completed',
    placement: 'interstitial_abc_lesson_completed',
  },
  learning_assignment_success: {
    reason: 'content_session_completed',
    placement: 'interstitial_learning_assignment_submitted',
  },
  // Only after successful, authoritative server submissions; never as a gate to earning BP.
  points_submission_success: {
    reason: 'content_session_completed',
    placement: 'interstitial_points_submission_success',
  },
  points_claim_success: {
    reason: 'content_session_completed',
    placement: 'interstitial_points_claim_success',
  },
  devotional_reflection_success: {
    reason: 'devotional_completed',
    placement: 'interstitial_devotional_completed',
  },
  formation_lesson_success: {
    reason: 'lesson_completed',
    placement: 'interstitial_lesson_completed',
  },
  kl_chapter_success: {
    reason: 'reading_session_completed',
    placement: 'interstitial_kl_chapter_completed',
  },
  cluster_created_transition: {
    reason: 'content_session_completed',
    placement: 'interstitial_cluster_created',
  },
  organization_created_transition: {
    reason: 'content_session_completed',
    placement: 'interstitial_organization_created',
  },
  community_post_success: {
    reason: 'content_session_completed',
    placement: 'interstitial_community_post_published',
  },
  bible_flash_submission_success: { reason: 'content_session_completed', placement: 'interstitial_bible_flash_completed' },
  bible_arena_round_complete: { reason: 'content_session_completed', placement: 'interstitial_bible_arena_completed' },
  kingdom_mastery_verified: { reason: 'content_session_completed', placement: 'interstitial_kingdom_mastery_verified' },
  // Local game session results may have ads, never real BP/XP or monetary rewards.
  kingdom_game_completed: { reason: 'game_session_completed', placement: 'interstitial_kingdom_game_completed' },
  bulletin_published_success: {
    reason: 'content_session_completed',
    placement: 'interstitial_scope_bulletin_published',
  },
} as const satisfies Record<string, {
  reason: BuklodNaturalInterstitialReason;
  placement: string;
}>;

export type BuklodAdOpportunity = keyof typeof BREAKS;

/** Preload early; never stall a user action waiting for a network ad. */
export function warmBuklodAdOpportunity(event: BuklodAdOpportunity): void {
  if (Platform.OS !== 'android') return;
  warmBuklodInterstitial(BREAKS[event].placement);
}

/**
 * Call after server-confirmed reward success, or (for kingdom_game_completed)
 * after the account-scoped local game session was durably recorded.
 * Failure/no fill is a no-op.
 * No credit, reward mutation or re-submission is performed by this module.
 */
export async function showBuklodAdOpportunity(
  event: BuklodAdOpportunity,
): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    return await maybeShowBuklodInterstitial(
      BREAKS[event].reason,
      BREAKS[event].placement,
    );
  } catch {
    return false;
  }
}
