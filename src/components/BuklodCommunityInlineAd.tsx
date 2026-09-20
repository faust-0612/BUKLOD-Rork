import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { usePathname } from 'expo-router';
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
  getBuklodBannerUnitId,
  buklodAdsTestMode,
} from '@/lib/buklodAdUnits';
import { recordBuklodAdEvent } from '@/lib/buklodAdDiagnostics';
import {
  isBuklodPassiveAdAllowed,
  reserveBuklodPassiveAdRequest,
} from '@/lib/buklodGlobalAdController';
import { useBuklodAdViewportGate } from '@/lib/buklodAdViewport';
import { useAds } from '@/providers/AdsProvider';
import { useNetwork } from '@/providers/NetworkProvider';

type Props = {
  slotId?: string;
  active?: boolean;
};

const AD_LOAD_TIMEOUT_MS = 8_000;
const PLACEMENT_ID = 'community_wall_feed';

function clean(value: string | undefined) {
  return String(value ?? '').trim();
}

export default function BuklodCommunityInlineAd({
  slotId,
  active = true,
}: Props) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const { ready, canRequestAds } = useAds();
  const { online } = useNetwork();
  const { ref, eligible } = useBuklodAdViewportGate();

  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);
  const [nativeFailed, setNativeFailed] = useState(false);
  const [bannerLoaded, setBannerLoaded] = useState(false);
  const [bannerFailed, setBannerFailed] = useState(false);

  const nativeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativeRequestStarted = useRef(false);
  const bannerRequestStarted = useRef(false);
  const nativeRendered = useRef(false);
  const bannerRendered = useRef(false);

  const routeSafe = isBuklodPassiveAdAllowed({
    placement: 'community',
    placementId: PLACEMENT_ID,
    pathname,
  });

  const nativeUnitId = useMemo(() => {
    if (buklodAdsTestMode) return TestIds.NATIVE;
    return clean(process.env.EXPO_PUBLIC_ADMOB_COMMUNITY_NATIVE_UNIT_ID);
  }, []);

  const bannerUnitId = getBuklodBannerUnitId('community');
  const sdkReady = ready && canRequestAds;
  const canAttempt =
    active &&
    routeSafe &&
    eligible &&
    sdkReady &&
    online;

  const requestKey = slotId || 'community-wall-inline';
  const adWidth = Math.max(280, Math.floor(width - 32));

  useEffect(() => {
    if (!canAttempt || nativeRequestStarted.current || nativeFailed) return;

    if (!nativeUnitId) {
      setNativeFailed(true);
      return;
    }

    if (!reserveBuklodPassiveAdRequest(PLACEMENT_ID, requestKey)) {
      setNativeFailed(true);
      setBannerFailed(true);
      return;
    }

    nativeRequestStarted.current = true;
    recordBuklodAdEvent(
      'community_wall_feed',
      'ad_request',
      undefined,
      { route: pathname },
    );

    let cancelled = false;
    let createdAd: NativeAd | null = null;
    let impressionSubscription: { remove: () => void } | null = null;

    nativeTimeoutRef.current = setTimeout(() => {
      if (!cancelled) {
        recordBuklodAdEvent(
          'community_wall_feed',
          'ad_failed',
          new Error('NATIVE_AD_LOAD_TIMEOUT'),
          { route: pathname },
        );
        setNativeFailed(true);
      }
    }, AD_LOAD_TIMEOUT_MS);

    void NativeAd.createForAdRequest(nativeUnitId, {
      requestNonPersonalizedAdsOnly: false,
    })
      .then(ad => {
        createdAd = ad;

        if (cancelled) {
          ad.destroy();
          return;
        }

        if (nativeTimeoutRef.current) {
          clearTimeout(nativeTimeoutRef.current);
          nativeTimeoutRef.current = null;
        }

        impressionSubscription = ad.addAdEventListener(
          NativeAdEventType.IMPRESSION,
          () => {
            recordBuklodAdEvent(
              'community_wall_feed',
              'ad_impression',
              undefined,
              { route: pathname },
            );
          },
        );

        recordBuklodAdEvent(
          'community_wall_feed',
          'ad_loaded',
          undefined,
          { route: pathname },
        );
        setNativeAd(ad);
      })
      .catch(error => {
        if (nativeTimeoutRef.current) {
          clearTimeout(nativeTimeoutRef.current);
          nativeTimeoutRef.current = null;
        }

        if (!cancelled) {
          recordBuklodAdEvent(
            'community_wall_feed',
            'ad_failed',
            error,
            { route: pathname },
          );
          setNativeFailed(true);
        }
      });

    return () => {
      cancelled = true;
      if (nativeTimeoutRef.current) {
        clearTimeout(nativeTimeoutRef.current);
        nativeTimeoutRef.current = null;
      }
      impressionSubscription?.remove();
      createdAd?.destroy();
    };
  }, [canAttempt, nativeFailed, nativeUnitId, pathname, requestKey]);

  useEffect(() => {
    if (!nativeAd || nativeRendered.current) return;
    nativeRendered.current = true;
    recordBuklodAdEvent(
      'community_wall_feed',
      'ad_rendered',
      undefined,
      { route: pathname },
    );
  }, [nativeAd, pathname]);

  useEffect(() => {
    if (
      !canAttempt ||
      !nativeFailed ||
      !bannerUnitId ||
      bannerRequestStarted.current ||
      bannerFailed
    ) {
      return;
    }

    bannerRequestStarted.current = true;
    recordBuklodAdEvent(
      'community_wall_feed',
      'ad_request',
      undefined,
      { route: pathname },
    );

    bannerTimeoutRef.current = setTimeout(() => {
      recordBuklodAdEvent(
        'community_wall_feed',
        'ad_failed',
        new Error('BANNER_AD_LOAD_TIMEOUT'),
        { route: pathname },
      );
      setBannerFailed(true);
    }, AD_LOAD_TIMEOUT_MS);

    return () => {
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
        bannerTimeoutRef.current = null;
      }
    };
  }, [bannerFailed, bannerUnitId, canAttempt, nativeFailed, pathname]);

  useEffect(() => {
    if (!bannerLoaded || bannerRendered.current) return;
    bannerRendered.current = true;
    recordBuklodAdEvent(
      'community_wall_feed',
      'ad_rendered',
      undefined,
      { route: pathname },
    );
  }, [bannerLoaded, pathname]);

  if (!active || !routeSafe) return null;

  if (!eligible || !sdkReady || !online) {
    return (
      <View
        ref={ref}
        collapsable={false}
        pointerEvents="none"
        style={styles.viewportProbe}
      />
    );
  }

  if (nativeAd && !nativeFailed) {
    return (
      <View ref={ref} collapsable={false}>
        <NativeAdView nativeAd={nativeAd} style={styles.nativeShell}>
          <View style={styles.nativeHeader}>
            <Text style={styles.adBadge}>AD</Text>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text numberOfLines={2} style={styles.headline}>
                {nativeAd.headline}
              </Text>
            </NativeAsset>
          </View>
          <Text style={styles.label}>Sponsored</Text>
          <NativeMediaView style={styles.media} resizeMode="cover" />
          {!!nativeAd.body && (
            <NativeAsset assetType={NativeAssetType.BODY}>
              <Text numberOfLines={2} style={styles.body}>
                {nativeAd.body}
              </Text>
            </NativeAsset>
          )}
          {!!nativeAd.callToAction && (
            <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
              <Text style={styles.cta}>{nativeAd.callToAction}</Text>
            </NativeAsset>
          )}
        </NativeAdView>
      </View>
    );
  }

  if (!nativeFailed || !bannerUnitId || bannerFailed) {
    return (
      <View
        ref={ref}
        collapsable={false}
        pointerEvents="none"
        style={styles.viewportProbe}
      />
    );
  }

  return (
    <View
      ref={ref}
      collapsable={false}
      style={bannerLoaded ? styles.bannerShell : styles.viewportProbe}
      pointerEvents={bannerLoaded ? 'auto' : 'none'}
    >
      {bannerLoaded ? <Text style={styles.label}>Sponsored</Text> : null}
      <View style={bannerLoaded ? styles.bannerArea : styles.pendingArea}>
        <BannerAd
          unitId={bannerUnitId}
          size={BannerAdSize.INLINE_ADAPTIVE_BANNER}
          width={adWidth}
          maxHeight={100}
          onAdLoaded={() => {
            if (bannerTimeoutRef.current) {
              clearTimeout(bannerTimeoutRef.current);
              bannerTimeoutRef.current = null;
            }
            recordBuklodAdEvent(
              'community_wall_feed',
              'ad_loaded',
              undefined,
              { route: pathname },
            );
            setBannerLoaded(true);
          }}
          onAdImpression={() => {
            recordBuklodAdEvent(
              'community_wall_feed',
              'ad_impression',
              undefined,
              { route: pathname },
            );
          }}
          onAdFailedToLoad={error => {
            if (bannerTimeoutRef.current) {
              clearTimeout(bannerTimeoutRef.current);
              bannerTimeoutRef.current = null;
            }
            recordBuklodAdEvent(
              'community_wall_feed',
              'ad_failed',
              error,
              { route: pathname },
            );
            setBannerFailed(true);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewportProbe: {
    width: '100%',
    minHeight: 16,
    marginVertical: 2,
    opacity: 0,
  },
  pendingArea: {
    width: '100%',
    minHeight: 16,
    overflow: 'hidden',
    opacity: 0,
  },
  nativeShell: {
    width: '100%',
    marginTop: 10,
    marginBottom: 14,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
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
    backgroundColor: 'transparent',
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
