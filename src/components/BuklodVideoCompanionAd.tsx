import React from 'react';
import { StyleSheet, View } from 'react-native';

import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';
import {
  shouldUseBuklodImaForVideo,
} from '@/lib/buklodVideoMonetization';

type Props = {
  contentId?: string | null;
  expectedDurationSeconds?: number | null;
};

/**
 * BUKLOD_VIDEO_COMPANION_FALLBACK_R1
 *
 * Clearly-labelled sponsored inventory directly below a content video.
 * This is an AdMob/AdSense companion-like fallback, not a claim that a VAST
 * master/companion pair was returned by IMA. True IMA master-companion serving
 * remains provider-tag driven and must not be faked.
 */
export default function BuklodVideoCompanionAd({
  contentId,
  expectedDurationSeconds,
}: Props) {
  if (
    shouldUseBuklodImaForVideo(
      expectedDurationSeconds,
    )
  ) {
    return null;
  }

  const safeId = String(contentId ?? 'unknown').slice(0, 80);

  return (
    <View style={styles.shell}>
      <BuklodAdMobBanner
        placement="video_companion"
        placementId={`wall_video_companion:${safeId}`}
        compact
        format="adaptive"
        requireViewport
        showLabel
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    marginTop: 6,
    marginBottom: 6,
  },
});
