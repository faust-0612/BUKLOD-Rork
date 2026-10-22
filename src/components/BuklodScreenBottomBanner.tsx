import React from 'react';

import { StyleSheet, View } from 'react-native';

import {
  useBuklodFooterAdBottomPadding,
} from '@/lib/buklodSafeArea';

import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';

import type { BuklodAdPlacement } from '@/lib/buklodAdUnits';

type Props = {
  placement: BuklodAdPlacement;
  /** `large` = full-width adaptive footer; default `compact`. */
  variant?: 'compact' | 'large';
};

/**
 * Full-width footer banner for Home / Connect surfaces.
 * Collapses when the ad fails to load or is off-screen.
 */
export default function BuklodScreenBottomBanner({
  placement,
  variant = 'compact',
}: Props) {
  const footerPadding =
    useBuklodFooterAdBottomPadding();
  const isLarge = variant === 'large';

  return (
    <View
      style={[
        styles.shell,
        isLarge && styles.shellLarge,
        {
          paddingBottom: footerPadding,
        },
      ]}
    >
      <BuklodAdMobBanner
        placement={placement}
        compact={!isLarge}
        format="adaptive"
        diagnosticName={
          placement === 'home' ? 'home_bottom_banner' : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    paddingTop: 8,
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
  },
  shellLarge: {
    paddingTop: 12,
    paddingHorizontal: 10,
  },
});
