import React from 'react';

import {
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import BuklodPaidHeaderAd
  from '@/components/BuklodPaidHeaderAd';

import BuklodHeaderSponsorLegacy
  from '@/components/BuklodHeaderSponsorLegacy';

import BuklodAdMobBanner
  from '@/components/BuklodAdMobBanner';

type Placement =
  | 'home'
  | 'messages'
  | 'learn'
  | 'community'
  | 'prayer'
  | 'me';

function admobPlacement(
  placement: Placement,
) {
  if (placement === 'messages') {
    return 'messages';
  }

  if (placement === 'community') {
    return 'community';
  }

  if (placement === 'prayer') {
    return 'prayer';
  }

  if (
    placement === 'learn' ||
    placement === 'me'
  ) {
    return 'content';
  }

  return 'home';
}

export default function
BuklodHeaderSponsor({
  placement,
}: {
  placement: Placement;
}) {
  const {
    width,
  } = useWindowDimensions();

  // Keep the narrow Android phone header uncluttered (the first-view
  // sponsored card already owns its full-width inventory below it). On
  // tablets/wide Android screens, the existing 320px sponsor fits safely.
  if (Platform.OS === 'android' && width < 680) {
    return null;
  }

  /*
   * IMPORTANT:
   * The old compact title-bar sponsor is about 188x42.
   * A normal AdMob phone banner needs substantially more width.
   *
   * Therefore:
   * - normal phones keep the EXACT old compact sponsor footprint;
   * - AdMob is allowed only when the screen is wide enough that
   *   the title-bar side can hold a proper banner without forcing
   *   the header wider.
   *
   * This component does NOT modify the title-bar layout.
   */
  const canFitBanner =
    width >= 680;

  const fallback =
    canFitBanner
      ? (
          <View
            style={
              styles.admobWideShell
            }
          >
            <BuklodAdMobBanner
              placement={
                admobPlacement(
                  placement,
                ) as any
              }
              compact
            />
          </View>
        )
      : (
          <BuklodHeaderSponsorLegacy
            placement={
              placement as any
            }
          />
        );

  return (
    <BuklodPaidHeaderAd
      placement={placement}
      fallback={fallback}
    />
  );
}

const styles =
  StyleSheet.create({
    admobWideShell: {
      width: 320,
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
  });