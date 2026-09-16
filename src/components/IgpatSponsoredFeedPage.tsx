import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';
import BuklodSponsorSlot from '@/components/BuklodSponsorSlot';
import { getBuklodBannerUnitId } from '@/lib/buklodAdUnits';

type Props = {
  height: number;
  bottomInset?: number;
};

export default function IgpatSponsoredFeedPage({
  height,
  bottomInset = 0,
}: Props) {
  const nativeUnitId = getBuklodBannerUnitId('reels');
  const useNetworkAd = Platform.OS === 'web' || Boolean(nativeUnitId);

  return (
    <View
      style={[styles.page, { height, paddingBottom: Math.max(bottomInset, 18) }]}
      accessibilityRole="summary"
      accessibilityLabel="Sponsored IGPAT feed item. Swipe up for the next normal IGPAT."
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>BUKLOD IGPAT</Text>
        <Text style={styles.title}>SPONSORED</Text>
        <Text style={styles.hint}>Swipe up to continue watching.</Text>
      </View>

      <View style={styles.adShell}>
        {useNetworkAd ? (
          <BuklodAdMobBanner
            placement="reels"
            format="mediumRectangle"
            diagnosticName="reels_inline"
            requireViewport={false}
            showLabel={false}
          />
        ) : (
          <BuklodSponsorSlot placement="community" />
        )}
      </View>

      <Text style={styles.footer}>
        Ads never cover IGPAT playback, captions, comments, recording, editing, publishing, or Arena actions.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
    backgroundColor: '#050807',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.46)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  hint: {
    marginTop: 5,
    color: 'rgba(255,255,255,0.56)',
    fontSize: 10,
    fontWeight: '700',
  },
  adShell: {
    width: '100%',
    minHeight: 250,
    justifyContent: 'center',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#0D120F',
  },
  footer: {
    marginTop: 18,
    alignSelf: 'center',
    maxWidth: 330,
    color: 'rgba(255,255,255,0.34)',
    fontSize: 8.5,
    lineHeight: 13,
    textAlign: 'center',
  },
});
