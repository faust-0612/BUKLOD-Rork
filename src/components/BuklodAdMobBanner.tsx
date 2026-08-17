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
} from 'react-native-google-mobile-ads';

import {
  BuklodAdPlacement,
  getBuklodBannerUnitId,
} from '@/lib/buklodAdUnits';

import {
  initializeBuklodAds,
} from '@/lib/buklodAds';


type Props = {
  placement:
    BuklodAdPlacement;

  compact?: boolean;

  format?:
    | 'adaptive'
    | 'mediumRectangle';
};


export default function BuklodAdMobBanner({
  placement,
  compact = false,
  format = 'adaptive',
}: Props) {

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
      placement
    );


  useEffect(
    () => {

      let mounted = true;


      void initializeBuklodAds()
        .then(
          (ready) => {
            if (mounted) {
              setSdkReady(
                ready
              );
            }
          }
        );


      return () => {
        mounted = false;
      };
    },
    []
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
            duration: 280,
            useNativeDriver: true,
          }
        )
        .start();
    },
    [
      loaded,
      opacity,
    ]
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
        styles.shell,

        compact &&
          styles.compactShell,

        {
          opacity,
        },
      ]}
    >
      <View
        style={
          styles.labelRow
        }
      >
        <Text
          style={
            styles.label
          }
        >
          Sponsored
        </Text>
      </View>


      <View
        style={
          styles.adArea
        }
      >
        <BannerAd
          unitId={
            unitId
          }

          size={
            format ===
            'mediumRectangle'
              ? BannerAdSize
                  .MEDIUM_RECTANGLE
              : BannerAdSize
                  .ANCHORED_ADAPTIVE_BANNER
          }

          onAdLoaded={
            () =>
              setLoaded(true)
          }

          onAdFailedToLoad={
            (error) => {
              console.warn(
                `BUKLOD AdMob ${placement}:`,
                error
              );

              setFailed(true);
            }
          }
        />
      </View>
    </Animated.View>
  );
}


const styles =
  StyleSheet.create({
    shell: {
      width: '100%',
      backgroundColor:
        '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor:
        '#E2E8E4',
      paddingTop: 2,
      paddingBottom: 4,
    },

    compactShell: {
      borderWidth: 1,
      borderColor:
        '#E1E7E3',
      borderRadius: 14,
      overflow: 'hidden',
      marginVertical: 8,
    },

    labelRow: {
      paddingHorizontal: 8,
      paddingTop: 2,
    },

    label: {
      color: '#77837C',
      fontSize: 8,
      fontWeight: '700',
      textTransform:
        'uppercase',
      letterSpacing: 0.6,
    },

    adArea: {
      alignItems: 'center',
      justifyContent:
        'center',
      overflow: 'hidden',
    },
  });