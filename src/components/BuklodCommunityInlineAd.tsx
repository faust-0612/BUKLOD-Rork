import React, {
  useEffect,
  useState,
} from 'react';

import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  BannerAd,
  BannerAdSize,
} from 'react-native-google-mobile-ads';

import {
  type BuklodAdPlacement,
  getBuklodBannerUnitId,
} from '@/lib/buklodAdUnits';

import {
  initializeBuklodAds,
} from '@/lib/buklodAds';

/* PATCH_186K_PUBLIC_COMMUNITY_INLINE_ADMOB
 *
 * Inline adaptive is intentionally used because this ad lives INSIDE
 * scrolling Community content.
 *
 * IMPORTANT:
 * - No manual reload() is called.
 * - Pull-to-refresh does NOT remount/reload this ad on purpose.
 * - Existing BUKLOD test/production unit selection remains canonical.
 */
export default function
BuklodCommunityInlineAd() {
  const {
    width,
  } =
    useWindowDimensions();

  const [
    sdkReady,
    setSdkReady,
  ] =
    useState(false);

  const [
    failed,
    setFailed,
  ] =
    useState(false);

  const [
    loaded,
    setLoaded,
  ] =
    useState(false);

  const unitId =
    getBuklodBannerUnitId(
      'community' as
        BuklodAdPlacement,
    );

  const adWidth =
    Math.max(
      280,
      Math.floor(
        width - 32,
      ),
    );

  useEffect(
    () => {
      let mounted =
        true;

      void initializeBuklodAds()
        .then(
          ready => {
            if (mounted) {
              setSdkReady(
                Boolean(
                  ready,
                ),
              );
            }
          },
        )
        .catch(
          () => {
            if (mounted) {
              setFailed(true);
            }
          },
        );

      return () => {
        mounted =
          false;
      };
    },
    [],
  );

  if (
    !unitId ||
    !sdkReady ||
    failed
  ) {
    return null;
  }

  return (
    <View
      style={
        styles.shell
      }
    >
      <Text
        style={
          styles.label
        }
      >
        Sponsored
      </Text>

      <View
        style={[
          styles.adArea,
          !loaded && {
            opacity: 0,
          },
        ]}
      >
        <BannerAd
          unitId={
            unitId
          }
          size={
            BannerAdSize
              .INLINE_ADAPTIVE_BANNER
          }
          width={
            adWidth
          }
          maxHeight={
            100
          }
          onAdLoaded={
            () =>
              setLoaded(true)
          }
          onAdFailedToLoad={
            error => {
              console.warn(
                'BUKLOD Community inline AdMob:',
                error,
              );

              setFailed(true);
            }
          }
        />
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    shell: {
      width: '100%',
      marginTop: 10,
      marginBottom: 14,
      paddingTop: 7,
      paddingBottom: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        'transparent',
    },

    label: {
      width: '100%',
      marginBottom: 5,
      paddingHorizontal: 4,
      textAlign: 'center',
      color: '#7A857E',
      fontSize: 9,
      lineHeight: 12,
      fontWeight: '700',
      letterSpacing: 0.35,
    },

    adArea: {
      width: '100%',
      minHeight: 50,
      maxHeight: 100,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
  });