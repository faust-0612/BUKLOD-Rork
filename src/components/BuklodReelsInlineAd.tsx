import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  BannerAd,
  BannerAdSize,
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
  TestIds,
} from 'react-native-google-mobile-ads';
import {
  type BuklodAdPlacement,
  getBuklodBannerUnitId,
  buklodAdsTestMode,
} from '@/lib/buklodAdUnits';
import { usePathname } from 'expo-router';
import { useAds } from '@/providers/AdsProvider';
import { isBuklodPassiveAdAllowed } from '@/lib/buklodGlobalAdController';

type Props = {
  slotId?: string;
  active?: boolean;
};

const AD_LOAD_TIMEOUT_MS = 8000;

function envValue(
  value: string | undefined,
) {
  return String(
    value ?? '',
  ).trim();
}

export default function BuklodReelsInlineAd({
  slotId,
  active = true,
}: Props) {
  const { width } =
    useWindowDimensions();

  const { ready, canRequestAds } = useAds();
  const pathname = usePathname();
  const sdkReady = ready && canRequestAds;
  const adEligible = active && isBuklodPassiveAdAllowed({
    placement: 'reels',
    placementId: 'igpat_reels_inline',
    pathname,
  });

  const [nativeAd, setNativeAd] =
    useState<NativeAd | null>(null);

  const [nativeFailed, setNativeFailed] =
    useState(false);

  const [bannerLoaded, setBannerLoaded] =
    useState(false);

  const [bannerFailed, setBannerFailed] =
    useState(false);

  const nativeTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const bannerTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const testMode = buklodAdsTestMode;

  const nativeUnitId =
    useMemo(() => {
      if (testMode) {
        return TestIds.NATIVE;
      }

      return (
        envValue(
          process.env
            .EXPO_PUBLIC_ADMOB_REELS_NATIVE_UNIT_ID,
        ) ||
        envValue(
          process.env
            .EXPO_PUBLIC_ADMOB_COMMUNITY_NATIVE_UNIT_ID,
        )
      );
    }, [testMode]);

  const bannerUnitId =
    getBuklodBannerUnitId(
      'community' as BuklodAdPlacement,
    );

  const adWidth =
    Math.max(
      280,
      Math.floor(
        width - 32,
      ),
    );

  useEffect(() => {
    if (
      !adEligible ||
      !sdkReady ||
      !nativeUnitId
    ) {
      setNativeFailed(true);
      return;
    }

    let cancelled = false;
    let timedOut = false;
    let createdAd: NativeAd | null = null;

    nativeTimeoutRef.current =
      setTimeout(() => {
        if (!cancelled) {
          timedOut = true;
          setNativeFailed(true);
        }
      }, AD_LOAD_TIMEOUT_MS);

    void NativeAd.createForAdRequest(
      nativeUnitId,
      {
        requestNonPersonalizedAdsOnly: false,
      },
    )
      .then((ad) => {
        createdAd = ad;

        if (cancelled || timedOut) {
          ad.destroy();
          return;
        }

        if (
          nativeTimeoutRef.current
        ) {
          clearTimeout(
            nativeTimeoutRef.current,
          );
          nativeTimeoutRef.current = null;
        }

        setNativeAd(ad);
      })
      .catch((error) => {
        if (
          nativeTimeoutRef.current
        ) {
          clearTimeout(
            nativeTimeoutRef.current,
          );
          nativeTimeoutRef.current = null;
        }

        console.warn(
          'BUKLOD Reels Native AdMob:',
          error,
        );

        if (!cancelled && !timedOut) {
          setNativeFailed(true);
        }
      });

    return () => {
      cancelled = true;

      if (
        nativeTimeoutRef.current
      ) {
        clearTimeout(
          nativeTimeoutRef.current,
        );
        nativeTimeoutRef.current = null;
      }

      if (createdAd) {
        createdAd.destroy();
      }
    };
  }, [
    adEligible,
    sdkReady,
    nativeUnitId,
    slotId,
  ]);

  useEffect(() => {
    if (
      !adEligible ||
      !sdkReady ||
      !nativeFailed ||
      !bannerUnitId ||
      bannerLoaded ||
      bannerFailed
    ) {
      return;
    }

    bannerTimeoutRef.current =
      setTimeout(() => {
        setBannerFailed(true);
      }, AD_LOAD_TIMEOUT_MS);

    return () => {
      if (
        bannerTimeoutRef.current
      ) {
        clearTimeout(
          bannerTimeoutRef.current,
        );
        bannerTimeoutRef.current = null;
      }
    };
  }, [
    adEligible,
    sdkReady,
    nativeFailed,
    bannerUnitId,
    bannerLoaded,
    bannerFailed,
    slotId,
  ]);

  if (
    !adEligible ||
    !sdkReady
  ) {
    return null;
  }

  if (
    nativeAd &&
    !nativeFailed
  ) {
    return (
      <NativeAdView
        nativeAd={nativeAd}
        style={styles.nativeShell}
      >
        <View style={styles.header}>
          <Text style={styles.adBadge}>
            AD
          </Text>

          <NativeAsset
            assetType={
              NativeAssetType.HEADLINE
            }
          >
            <Text
              numberOfLines={2}
              style={styles.headline}
            >
              {nativeAd.headline}
            </Text>
          </NativeAsset>
        </View>

        <Text style={styles.label}>
          Sponsored
        </Text>

        <NativeMediaView
          style={styles.media}
          resizeMode="cover"
        />

        {!!nativeAd.body && (
          <NativeAsset
            assetType={
              NativeAssetType.BODY
            }
          >
            <Text
              numberOfLines={2}
              style={styles.body}
            >
              {nativeAd.body}
            </Text>
          </NativeAsset>
        )}

        {!!nativeAd.callToAction && (
          <NativeAsset
            assetType={
              NativeAssetType.CALL_TO_ACTION
            }
          >
            <Text style={styles.cta}>
              {nativeAd.callToAction}
            </Text>
          </NativeAsset>
        )}
      </NativeAdView>
    );
  }

  if (
    !nativeFailed ||
    !bannerUnitId ||
    bannerFailed
  ) {
    return null;
  }

  return (
    <View
      style={
        bannerLoaded
          ? styles.bannerShell
          : styles.pendingShell
      }
      pointerEvents={
        bannerLoaded
          ? 'auto'
          : 'none'
      }
    >
      {bannerLoaded ? (
        <Text style={styles.label}>
          Sponsored
        </Text>
      ) : null}

      <View
        style={
          bannerLoaded
            ? styles.bannerArea
            : styles.pendingArea
        }
      >
        <BannerAd
          unitId={
            bannerUnitId
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
          onAdLoaded={() => {
            if (
              bannerTimeoutRef.current
            ) {
              clearTimeout(
                bannerTimeoutRef.current,
              );
              bannerTimeoutRef.current = null;
            }

            setBannerLoaded(
              true,
            );
          }}
          onAdFailedToLoad={(error) => {
            if (
              bannerTimeoutRef.current
            ) {
              clearTimeout(
                bannerTimeoutRef.current,
              );
              bannerTimeoutRef.current = null;
            }

            console.warn(
              'BUKLOD Reels fallback Banner AdMob:',
              error,
            );

            setBannerFailed(
              true,
            );
          }}
        />
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    pendingShell: {
      width: 0,
      height: 0,
      margin: 0,
      padding: 0,
      overflow: 'hidden',
      opacity: 0,
    },

    pendingArea: {
      width: 0,
      height: 0,
      overflow: 'hidden',
      opacity: 0,
    },

    nativeShell: {
      width: '100%',
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 14,
      paddingVertical: 20,
      backgroundColor: '#000000',
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },

    adBadge: {
      marginRight: 8,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
      backgroundColor: '#E7A927',
      color: '#FFFFFF',
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '800',
    },

    headline: {
      flexShrink: 1,
      color: '#FFFFFF',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '800',
    },

    label: {
      width: '100%',
      marginBottom: 8,
      color: '#A8B0AA',
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '700',
      letterSpacing: 0.35,
    },

    media: {
      width: '100%',
      height: 280,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: '#151515',
    },

    body: {
      marginTop: 10,
      color: '#E4E8E5',
      fontSize: 13,
      lineHeight: 18,
    },

    cta: {
      marginTop: 12,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
      overflow: 'hidden',
      textAlign: 'center',
      color: '#FFFFFF',
      backgroundColor: '#1F7A4D',
      fontSize: 13,
      fontWeight: '800',
    },

    bannerShell: {
      width: '100%',
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#000000',
    },

    bannerArea: {
      width: '100%',
      minHeight: 50,
      maxHeight: 100,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
  });