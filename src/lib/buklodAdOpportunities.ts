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
