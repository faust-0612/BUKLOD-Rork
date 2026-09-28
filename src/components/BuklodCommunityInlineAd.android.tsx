import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import BuklodCommunityIgpatPreview from '@/components/BuklodCommunityIgpatPreview';
import { type BuklodAdPlacement, getBuklodBannerUnitId } from '@/lib/buklodAdUnits';
import { initializeBuklodAds } from '@/lib/buklodAds';

type Props = {
  slotId?: string;
  active?: boolean;
};

const AD_LOAD_TIMEOUT_MS = 8000;

function envValue(value: string | undefined) {
  return String(value ?? '').trim();
}

function inlineSlotNumber(slotId?: string) {
  const match = String(slotId ?? '').match(/__buklod_inline_ad_(\d+)_/);
  return match ? Number(match[1]) : 1;
}

function shouldShowIgpatPreview(slotId?: string) {
  const slot = inlineSlotNumber(slotId);

  // Android Community ads are intentionally denser (roughly every 4–6 posts).
  // Show IGPAT on alternating ad slots so IGPAT stays near the requested
  // 8–12-post cadence without reducing or replacing ad inventory.
  if (Platform.OS === 'android') {
    return slot % 2 === 0;
  }

  // iOS/default feed cadence is already around 8–12 posts.
  return true;
}

export default function BuklodCommunityInlineAd({
  slotId,
  active = true,
}: Props) {
  const { width } = useWindowDimensions();

  const [sdkReady, setSdkReady] = useState(false);
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);
  const [nativeFailed, setNativeFailed] = useState(false);
  const [bannerLoaded, setBannerLoaded] = useState(false);
  const [bannerFailed, setBannerFailed] = useState(false);

  const nativeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const appEnv =
    envValue(process.env.EXPO_PUBLIC_APP_ENV || 'development').toLowerCase();

  const testMode =
    __DEV__ ||
    appEnv !== 'production';

  const nativeUnitId =
    useMemo(() => {
      if (testMode) {
        return TestIds.NATIVE;
      }

      return envValue(
        process.env.EXPO_PUBLIC_ADMOB_COMMUNITY_NATIVE_UNIT_ID,
      );
    }, [testMode]);

  const bannerUnitId =
    getBuklodBannerUnitId(
      'community' as BuklodAdPlacement,
    );

  const adWidth =
    Math.max(
      280,
      Math.floor(width - 32),
    );

  const showIgpatPreview = active && shouldShowIgpatPreview(slotId);

  const igpatPreview = showIgpatPreview ? (
    <BuklodCommunityIgpatPreview
      slotId={slotId}
      active={active}
    />
  ) : null;

  useEffect(() => {
    if (!active) return;

    let mounted = true;

    void initializeBuklodAds()
      .then((ready) => {
        if (mounted) {
          setSdkReady(
            Boolean(ready),
          );
        }
      })
      .catch((error) => {
        console.warn(
          'BUKLOD AdMob init:',
          error,
        );

        if (mounted) {
          setSdkReady(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [active]);

  useEffect(() => {
    if (
      !active ||
      !sdkReady ||
      !nativeUnitId
    ) {
      setNativeFailed(true);
      return;
    }

    let cancelled = false;
    let createdAd: NativeAd | null = null;

    nativeTimeoutRef.current =
      setTimeout(() => {
        if (!cancelled) {
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

        if (cancelled) {
          ad.destroy();
          return;
        }

        if (nativeTimeoutRef.current) {
          clearTimeout(
            nativeTimeoutRef.current,
          );
          nativeTimeoutRef.current = null;
        }

        setNativeAd(ad);
      })
      .catch((error) => {
        if (nativeTimeoutRef.current) {
          clearTimeout(
            nativeTimeoutRef.current,
          );
          nativeTimeoutRef.current = null;
        }

        console.warn(
          'BUKLOD Community Native AdMob:',
          error,
        );

        if (!cancelled) {
          setNativeFailed(true);
        }
      });

    return () => {
      cancelled = true;

      if (nativeTimeoutRef.current) {
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
    active,
    sdkReady,
    nativeUnitId,
    slotId,
  ]);

  useEffect(() => {
    if (
      !active ||
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
      if (bannerTimeoutRef.current) {
        clearTimeout(
          bannerTimeoutRef.current,
        );
        bannerTimeoutRef.current = null;
      }
    };
  }, [
    active,
    sdkReady,
    nativeFailed,
    bannerUnitId,
    bannerLoaded,
    bannerFailed,
    slotId,
  ]);

  if (!active) {
    return null;
  }

  if (!sdkReady) {
    return igpatPreview;
  }

  if (
    nativeAd &&
    !nativeFailed
  ) {
    return (
      <View>
        {igpatPreview}

        <NativeAdView
          nativeAd={nativeAd}
          style={styles.nativeShell}
        >
          <View style={styles.nativeHeader}>
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
      </View>
    );
  }

  if (
    !nativeFailed ||
    !bannerUnitId ||
    bannerFailed
  ) {
    return igpatPreview;
  }

  return (
    <View>
      {igpatPreview}

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
            unitId={bannerUnitId}
            size={
              BannerAdSize.INLINE_ADAPTIVE_BANNER
            }
            width={adWidth}
            maxHeight={100}
            onAdLoaded={() => {
              if (bannerTimeoutRef.current) {
                clearTimeout(
                  bannerTimeoutRef.current,
                );
                bannerTimeoutRef.current = null;
              }

              setBannerLoaded(true);
            }}
            onAdFailedToLoad={(error) => {
              if (bannerTimeoutRef.current) {
                clearTimeout(
                  bannerTimeoutRef.current,
                );
                bannerTimeoutRef.current = null;
              }

              console.warn(
                'BUKLOD Community fallback Banner AdMob:',
                error,
              );

              setBannerFailed(true);
            }}
          />
        </View>
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
      marginTop: 10,
      marginBottom: 14,
      padding: 12,
      borderRadius: 14,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor: '#DDE4E0',
      backgroundColor: '#FFFFFF',
      overflow: 'hidden',
    },

    nativeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 3,
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
      color: '#16251D',
      fontSize: 15,
      lineHeight: 19,
      fontWeight: '800',
    },

    label: {
      width: '100%',
      marginBottom: 6,
      color: '#7A857E',
      fontSize: 9,
      lineHeight: 12,
      fontWeight: '700',
      letterSpacing: 0.35,
    },

    media: {
      width: '100%',
      height: 190,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: '#EEF2EF',
    },

    body: {
      marginTop: 8,
      color: '#4D5B53',
      fontSize: 12,
      lineHeight: 17,
    },

    cta: {
      marginTop: 9,
      borderRadius: 9,
      paddingHorizontal: 12,
      paddingVertical: 9,
      overflow: 'hidden',
      textAlign: 'center',
      color: '#FFFFFF',
      backgroundColor: '#1F7A4D',
      fontSize: 12,
      fontWeight: '800',
    },

    bannerShell: {
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

    bannerArea: {
      width: '100%',
      minHeight: 50,
      maxHeight: 100,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
  });
