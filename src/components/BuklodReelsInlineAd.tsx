import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'expo-router';
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
  NativeAdEventType,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
  TestIds,
} from 'react-native-google-mobile-ads';
import {
  buklodAdsTestMode,
  getBuklodBannerUnitId,
} from '@/lib/buklodAdUnits';
import { recordBuklodAdEvent } from '@/lib/buklodAdDiagnostics';
import {
  isBuklodPassiveAdAllowed,
  reserveBuklodPassiveAdRequest,
} from '@/lib/buklodGlobalAdController';
import { useAds } from '@/providers/AdsProvider';
import { useNetwork } from '@/providers/NetworkProvider';

export type BuklodReelsAdLoadState = 'loading' | 'ready' | 'unavailable';
type Props = {
  slotId?: string;
  active?: boolean;
  /** Prepare native inventory one nearby page ahead without showing offscreen. */
  prepare?: boolean;
  onLoadStateChange?: (state: BuklodReelsAdLoadState) => void;
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
  prepare = false,
  onLoadStateChange,
}: Props) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const { ready, canRequestAds } = useAds();
  const { online } = useNetwork();
  const sdkReady = ready && canRequestAds;
  // Never reset a loaded native creative as the user swipes away/back.
  const [prepared, setPrepared] = useState(false);
  useEffect(() => {
    if (active || prepare) setPrepared(true);
  }, [active, prepare]);
  const callbackRef = useRef(onLoadStateChange);
  callbackRef.current = onLoadStateChange;
  const routeSafe = isBuklodPassiveAdAllowed({
    placement: 'reels',
    placementId: 'reels_inline',
    pathname,
  });
  const requestKey = String(slotId ?? 'reels-default').slice(0, 80);
  const canAttempt = prepared && sdkReady && online && routeSafe;
  const [requested, setRequested] = useState(false);
  useEffect(() => {
    if (canAttempt) setRequested(true);
  }, [canAttempt]);

  const [nativeAd, setNativeAd] =
    useState<NativeAd | null>(null);
  const renderedRef=useRef(false);

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

  const bannerUnitId = getBuklodBannerUnitId('reels');

  const adWidth =
    Math.max(
      280,
      Math.floor(
        width - 32,
      ),
    );

  useEffect(() => {
    // After first eligible request, retain its loaded NativeAd until this
    // row unmounts; temporary background/network changes must not destroy it.
    if (!requested) return;
    if (!nativeUnitId) {
      setNativeFailed(true);
      return;
    }
    if (!reserveBuklodPassiveAdRequest('reels_inline', requestKey)) {
      // A recycled ad slot must not generate duplicate requests.
      setNativeFailed(true);
      setBannerFailed(true);
      return;
    }

    let cancelled = false;
    let timedOut = false;
    let createdAd: NativeAd | null = null;
    let impressionSub: { remove: () => void } | null = null;
    recordBuklodAdEvent('reels_inline', 'ad_request', undefined, {
      placementId: 'reels_inline', route: pathname,
    });

    nativeTimeoutRef.current =
      setTimeout(() => {
        if (!cancelled) {
          timedOut = true;
          recordBuklodAdEvent('reels_inline', 'ad_failed',
            new Error('REELS_NATIVE_TIMEOUT'), { placementId: 'reels_inline', route: pathname });
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

        impressionSub = ad.addAdEventListener(
          NativeAdEventType.IMPRESSION,
          () => recordBuklodAdEvent('reels_inline', 'ad_impression',
            undefined, { placementId: 'reels_inline', route: pathname }),
        );
        recordBuklodAdEvent('reels_inline', 'ad_loaded', undefined,
          { placementId: 'reels_inline', route: pathname });
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
          recordBuklodAdEvent('reels_inline', 'ad_failed', error,
            { placementId: 'reels_inline', route: pathname });
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

      impressionSub?.remove();
      createdAd?.destroy();
    };
  }, [
    requested,
    nativeUnitId,
    pathname,
    requestKey,
  ]);

  useEffect(() => {
    if (
      !active ||
      !canAttempt ||
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
    active,
    canAttempt,
    nativeFailed,
    bannerUnitId,
    bannerLoaded,
    bannerFailed,
    slotId,
  ]);

  const adState: BuklodReelsAdLoadState =
    !sdkReady || !routeSafe || !online ? 'unavailable' :
    (nativeAd && !nativeFailed) || bannerLoaded ? 'ready' :
    (nativeFailed && (bannerFailed || !bannerUnitId)) ? 'unavailable' : 'loading';
  useEffect(() => {
    if (prepared) callbackRef.current?.(adState);
  }, [adState, prepared]);
  useEffect(() => {
    if (active && adState==='ready' && !renderedRef.current) {
      renderedRef.current=true;
      recordBuklodAdEvent('reels_inline','ad_rendered',undefined,
        {placementId:'reels_inline',route:pathname});
    }
  },[active,adState,pathname]);

  if (!active || !sdkReady || !routeSafe || !online) return null;

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
          onAdImpression={()=>{
            recordBuklodAdEvent('reels_inline','ad_impression',undefined,
              {placementId:'reels_inline',route:pathname});
          }}
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

            recordBuklodAdEvent('reels_inline', 'ad_loaded', undefined,
              { placementId: 'reels_inline', route: pathname });
            setBannerLoaded(true);
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

            recordBuklodAdEvent('reels_inline', 'ad_failed', error,
              { placementId: 'reels_inline', route: pathname });
            setBannerFailed(true);
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