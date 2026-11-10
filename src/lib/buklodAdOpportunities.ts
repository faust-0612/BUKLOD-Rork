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
 * multi-action threshold and durable full-screen reservation. New slots share one
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
  character_studio_saved: { reason: 'content_session_completed', placement: 'interstitial_character_studio_saved' },
  profile_note_saved: { reason: 'content_session_completed', placement: 'interstitial_profile_note_saved' },
  igpat_video_published: { reason: 'content_session_completed', placement: 'interstitial_igpat_video_published' },
  mentoring_response_submitted: { reason: 'content_session_completed', placement: 'interstitial_mentoring_response_submitted' },
  kingdom_legacy_claim_success: { reason: 'content_session_completed', placement: 'interstitial_kingdom_legacy_claim' },
  kingdom_power_unlock_success: { reason: 'content_session_completed', placement: 'interstitial_kingdom_power_unlocked' },
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
 * Call ONLY after server-confirmed success. Failure/no fill is a no-op.
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
