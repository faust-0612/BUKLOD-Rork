import type { BuklodNetworkQuality } from '@/lib/buklodNetworkQuality';

/** Campaign creative variants are optional; legacy approved campaigns retain their original URL. */
export type SponsoredVideoRenditions = {
  video_url: string | null;
  video_url_mobile?: string | null;
  video_url_low?: string | null;
};

function validHttpsUrl(value: string | null | undefined): string | null {
  if (!value || value.length > 2048) return null;
  const url = value.trim();
  if (!/^https:\/\/[^\s/?#]+\/[^\s]*$/i.test(url)) return null;
  return url;
}

/**
 * Choose once when the campaign/URLs change, not on every bandwidth hint.
 * The original is always the fallback; Android video cache and prewarm stay enabled.
 * This never transforms a URL, fetches an asset or downgrades active playback.
 */
export function selectSponsoredVideoSource(
  campaign: SponsoredVideoRenditions,
  network: BuklodNetworkQuality,
): string | null {
  const original = validHttpsUrl(campaign.video_url);
  const mobile = validHttpsUrl(campaign.video_url_mobile);
  const low = validHttpsUrl(campaign.video_url_low);
  if (network === 'degraded' || network === 'offline') {
    return low ?? mobile ?? original;
  }
  return mobile ?? original;
}

export const SPONSORED_VIDEO_SCROLLBACK_WARM_MS = 1_250;
