import React, {
  useEffect,
  useState,
} from 'react';

import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  BannerAd,
  BannerAdSize,
  type PaidEvent,
} from 'react-native-google-mobile-ads';

import BuklodPaidHeaderAd
  from '@/components/BuklodPaidHeaderAd';

import {
  BuklodAdPlacement,
  getBuklodBannerUnitId,
} from '@/lib/buklodAdUnits';

import {
  initializeBuklodAds,
} from '@/lib/buklodAds';

import {
  recordBuklodAdMobPaidEvent,
} from '@/lib/buklodFbcFinance';

type Placement =
  | 'home'
  | 'messages'
  | 'community';

function admobPlacement(
  placement: Placement,
): BuklodAdPlacement {
  if (placement === 'messages') {
    return 'messages' as BuklodAdPlacement;
  }

  if (placement === 'community') {
    return 'community' as BuklodAdPlacement;
  }

  return 'home' as BuklodAdPlacement;
}

function StandardScopedAdMob({
  placement,
}: {
  placement: Placement;
}) {
  const [
    sdkReady,
    setSdkReady,
  ] = useState(false);

  const [
    failed,
    setFailed,
  ] = useState(false);

  const [
    loaded,
    setLoaded,
  ] = useState(false);

  const [
    opacity,
  ] = useState(
    () =>
      new Animated.Value(0)
  );

  const unitId =
    getBuklodBannerUnitId(
      admobPlacement(
        placement,
      ),
    );

  useEffect(
    () => {
      let mounted = true;

      void initializeBuklodAds()
        .then(
          (ready) => {
            if (mounted) {
              setSdkReady(
                ready,
              );
            }
          },
        );

      return () => {
        mounted = false;
      };
    },
    [],
  );

  useEffect(
    () => {
      if (!loaded) {
        return;
      }

      Animated
        .timing(
          opacity,
          {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          },
        )
        .start();
    },
    [
      loaded,
      opacity,
    ],
  );

  if (
    !unitId ||
    !sdkReady ||
    failed
  ) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.standardCreativeShell,
        {
          opacity,
        },
      ]}
    >
      <View
        style={
          styles.sponsoredRow
        }
      >
        <Text
          style={
            styles.sponsoredText
          }
        >
          Sponsored
        </Text>
      </View>

      <View
        style={
          styles.adCreative
        }
      >
        <BannerAd
          unitId={unitId}
          size={
            BannerAdSize.BANNER
          }
          onAdLoaded={
            () =>
              setLoaded(true)
          }
          onPaid={(event: PaidEvent) => {
            void recordBuklodAdMobPaidEvent({
              placement: `scoped_header_${placement}`,
              adUnitId: unitId,
              value: event.value,
              currency: event.currency,
              precision: event.precision,
            });
          }}
          onAdFailedToLoad={
            (error) => {
              console.warn(
                `BUKLOD scoped AdMob ${placement}:`,
                error,
              );

              setFailed(true);
            }
          }
        />
      </View>
    </Animated.View>
  );
}

/*
 * PATCH 172E-R4
 *
 * Managed-scope title/header layout:
 *
 *   identity/title row
 *   [ one complete full-width banner row ]
 *   encouragement
 *
 * The ROW spans the managed header width.
 * The Google AdMob creative remains the standard fixed
 * BANNER size: 320 x 50 dp. It is centered, never stretched.
 *
 * Existing paid local header advertisements keep priority.
 */
export default function
BuklodScopedHeaderBanner({
  placement,
}: {
  placement: Placement;
}) {
  return (
    <View
      style={
        styles.fullBannerRow
      }
    >
      <BuklodPaidHeaderAd
        placement={placement}
        fallback={
          <StandardScopedAdMob
            placement={
              placement
            }
          />
        }
      />
    </View>
  );
}

const styles =
  StyleSheet.create({
    fullBannerRow: {
      width: '100%',
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
    },

    standardCreativeShell: {
      width: 320,
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
    },

    sponsoredRow: {
      width: '100%',
      paddingHorizontal: 2,
      paddingBottom: 1,
      alignItems: 'flex-start',
    },

    sponsoredText: {
      fontSize: 7,
      fontWeight: '700',
      opacity: 0.65,
    },

    adCreative: {
      width: 320,
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
    },
  });