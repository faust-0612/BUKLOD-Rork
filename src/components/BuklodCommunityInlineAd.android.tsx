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
  getBuklodPassiveAdRequestWaitMs,
  isBuklodPassiveAdAllowed,
  reserveBuklodPassiveAdRequest,
} from '@/lib/buklodGlobalAdController';
import { useBuklodAdViewportGate } from '@/lib/buklodAdViewport';
import { useAds } from '@/providers/AdsProvider';
import { useNetwork } from '@/providers/NetworkProvider';

type CommunityAdInventory = 'public' | 'org' | 'cluster';

type NativeSponsoredSurface =
  | 'wall'
  | 'home'
  | 'profile'
  | 'connect'
  | 'cluster_dashboard';

type Props = {
  slotId?: string;
  active?: boolean;
  inventory?: CommunityAdInventory;
  surface?: NativeSponsoredSurface;
};

// Weak mobile networks need a larger native-media opportunity; never flood
// retries to compensate for missing inventory.
const AD_LOAD_TIMEOUT_MS = 15_000;
const FEED_AD_CARD_HEIGHT = 392;

function clean(value: string | undefined) {
  return String(value ?? '').trim();
}

export default function BuklodCommunityInlineAd({
  slotId,
  active = true,
  inventory = 'public',
  surface = 'wall',
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
  // Do not mount a fallback BannerAd until its shared request is accepted.
  const [bannerRequestReady, setBannerRequestReady] = useState(false);
  const [reservationTick, setReservationTick] = useState(0);

  const nativeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativeRequestStarted = useRef(false);
  const bannerRequestStarted = useRef(false);
  const nativeRendered = useRef(false);
  const bannerRendered = useRef(false);

  const diagnosticPlacement =
    surface === 'home'
      ? 'content_inline'
      : surface === 'profile'
        ? 'profile_banner'
        : surface === 'connect'
          ? 'messages_banner'
          : surface === 'cluster_dashboard'
            ? 'cluster_home_entry'
            : inventory === 'org'
              ? 'org_wall_feed'
              : inventory === 'cluster'
                ? 'cluster_wall_feed'
                : 'community_wall_feed';

  const placementId =
    surface === 'wall'
      ? inventory === 'org'
        ? 'org_wall_feed'
        : inventory === 'cluster'
          ? 'cluster_wall_feed'
          : 'public_wall_feed'
      : `${surface}_native_sponsored`;

  const bannerPlacement =
    surface === 'home'
      ? 'home'
      : surface === 'profile'
        ? 'profile'
        : surface === 'connect'
          ? 'messages'
          : surface === 'cluster_dashboard'
            ? 'cluster'
            : inventory === 'org'
              ? 'org_community'
              : inventory === 'cluster'
                ? 'cluster_community'
                : 'community';

  const routeSafe = isBuklodPassiveAdAllowed({
    placement: bannerPlacement,
    placementId,
    pathname,
  });

  const nativeUnitId = useMemo(() => {
    if (buklodAdsTestMode) return TestIds.NATIVE;

    if (surface === 'profile') {
      return (
        clean(process.env.EXPO_PUBLIC_ADMOB_PROFILE_NATIVE_UNIT_ID) ||
        clean(process.env.EXPO_PUBLIC_ADMOB_COMMUNITY_NATIVE_UNIT_ID)
      );
    }
    if (surface === 'connect') {
      return (
        clean(process.env.EXPO_PUBLIC_ADMOB_CONNECT_NATIVE_UNIT_ID) ||
        clean(process.env.EXPO_PUBLIC_ADMOB_COMMUNITY_NATIVE_UNIT_ID)
      );
    }
    if (surface === 'home' || surface === 'cluster_dashboard') {
      return (
        clean(process.env.EXPO_PUBLIC_ADMOB_COMMUNITY_NATIVE_UNIT_ID)
      );
    }
    if (inventory === 'org') {
      return (
        clean(process.env.EXPO_PUBLIC_ADMOB_ORG_COMMUNITY_NATIVE_UNIT_ID) ||
        clean(process.env.EXPO_PUBLIC_ADMOB_COMMUNITY_NATIVE_UNIT_ID)
      );
    }

    if (inventory === 'cluster') {
      return (
        clean(process.env.EXPO_PUBLIC_ADMOB_CLUSTER_COMMUNITY_NATIVE_UNIT_ID) ||
        clean(process.env.EXPO_PUBLIC_ADMOB_COMMUNITY_NATIVE_UNIT_ID)
      );
    }

    return clean(process.env.EXPO_PUBLIC_ADMOB_COMMUNITY_NATIVE_UNIT_ID);
  }, [inventory, surface]);

  const bannerUnitId = getBuklodBannerUnitId(bannerPlacement);
  const sdkReady = ready && canRequestAds;
  const canAttempt =
    active &&
    routeSafe &&
    eligible &&
    sdkReady &&
    online;

  const requestKey = slotId || 'community-wall-inline';
  const adWidth = Math.max(280, Math.floor(width - 32));
  // A Banner unit can also supply a genuine 300x250 rich-media/video creative.
  // Keep Wall fallback small, but use a post-sized rectangle for new Home,
  // Profile, Connect and Cluster placements when Native inventory is absent.
  const usePostRectangle = surface !== 'wall';

  // Eligibility transitions destroy the NativeAd instance in the request
  // effect cleanup. Never render that destroyed instance on re-entry, and
  // never reuse completed request flags/loaded state from a previous session.
  // New requests still obey the existing shared passive-ad cooldown.
  useEffect(() => {
    if (canAttempt) return;
    nativeRequestStarted.current = false;
    bannerRequestStarted.current = false;
    nativeRendered.current = false;
    bannerRendered.current = false;
    setNativeAd(null);
    setBannerLoaded(false);
    setBannerFailed(false);
    setBannerRequestReady(false);
  }, [canAttempt]);

  useEffect(() => {
    if (!canAttempt || nativeRequestStarted.current || nativeFailed) return;

    if (!nativeUnitId) {
      // No Native ad unit configured: fall back to the existing banner.
      setNativeFailed(true);
      return;
    }

    if (!reserveBuklodPassiveAdRequest(placementId, requestKey)) {
      // Recycled feed rows may remount within the shared cooldown. Preserve
      // the probe; never turn that normal rejection into a permanent failure.
      const waitMs = Math.max(
        1_000,
        getBuklodPassiveAdRequestWaitMs(placementId, requestKey),
      );
      const timer = setTimeout(
        () => setReservationTick(value => value + 1),
        waitMs + 25,
      );
      return () => clearTimeout(timer);
    }

    nativeRequestStarted.current = true;
    recordBuklodAdEvent(
      diagnosticPlacement,
      'ad_request',
      undefined,
      { route: pathname, placementId },
    );

    let cancelled = false;
    let timedOut = false;
    let createdAd: NativeAd | null = null;
    let impressionSubscription: { remove: () => void } | null = null;

    nativeTimeoutRef.current = setTimeout(() => {
      if (!cancelled) {
        timedOut = true;
        recordBuklodAdEvent(
          diagnosticPlacement,
          'ad_failed',
          new Error('NATIVE_AD_LOAD_TIMEOUT'),
          { route: pathname, placementId },
        );
        setNativeFailed(true);
      }
    }, AD_LOAD_TIMEOUT_MS);

    void NativeAd.createForAdRequest(nativeUnitId, {
      requestNonPersonalizedAdsOnly: false,
    })
      .then(ad => {
        createdAd = ad;

        if (cancelled || timedOut) {
          // The slot may already be rendering fallback inventory.
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
              diagnosticPlacement,
              'ad_impression',
              undefined,
              { route: pathname, placementId },
            );
          },
        );

        recordBuklodAdEvent(
          diagnosticPlacement,
          'ad_loaded',
          undefined,
          { route: pathname, placementId },
        );
        setNativeAd(ad);
      })
      .catch(error => {
        if (nativeTimeoutRef.current) {
          clearTimeout(nativeTimeoutRef.current);
          nativeTimeoutRef.current = null;
        }

        if (!cancelled && !timedOut) {
          recordBuklodAdEvent(
            diagnosticPlacement,
            'ad_failed',
            error,
            { route: pathname, placementId },
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
  }, [
    canAttempt,
    diagnosticPlacement,
    nativeFailed,
    nativeUnitId,
    pathname,
    placementId,
    requestKey,
    reservationTick,
  ]);

  useEffect(() => {
    if (!nativeAd || nativeRendered.current) return;
    nativeRendered.current = true;
    recordBuklodAdEvent(
      diagnosticPlacement,
      'ad_rendered',
      undefined,
      { route: pathname, placementId },
    );
  }, [diagnosticPlacement, nativeAd, pathname, placementId]);

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

    // When Native was never requested (no Native unit configured), the
    // banner still needs a shared reservation. Native->banner fallback reuses
    // its existing reservation rather than reserving the same slot twice.
    if (!nativeRequestStarted.current &&
        !reserveBuklodPassiveAdRequest(placementId, requestKey)) {
      const waitMs = Math.max(
        1_000,
        getBuklodPassiveAdRequestWaitMs(placementId, requestKey),
      );
      const timer = setTimeout(
        () => setReservationTick(value => value + 1),
        waitMs + 25,
      );
      return () => clearTimeout(timer);
    }

    bannerRequestStarted.current = true;
    setBannerRequestReady(true);
    recordBuklodAdEvent(
      diagnosticPlacement,
      'ad_request',
      undefined,
      { route: pathname, placementId },
    );

    bannerTimeoutRef.current = setTimeout(() => {
      recordBuklodAdEvent(
        diagnosticPlacement,
        'ad_failed',
        new Error('BANNER_AD_LOAD_TIMEOUT'),
        { route: pathname, placementId },
      );
      setBannerFailed(true);
    }, AD_LOAD_TIMEOUT_MS);

    return () => {
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
        bannerTimeoutRef.current = null;
      }
    };
  }, [
    bannerFailed,
    bannerUnitId,
    canAttempt,
    diagnosticPlacement,
    nativeFailed,
    pathname,
    placementId,
    requestKey,
    reservationTick,
  ]);

  useEffect(() => {
    if (!bannerLoaded || bannerRendered.current) return;
    bannerRendered.current = true;
    recordBuklodAdEvent(
      diagnosticPlacement,
      'ad_rendered',
      undefined,
      { route: pathname, placementId },
    );
  }, [bannerLoaded, diagnosticPlacement, pathname, placementId]);

  if (!active || !routeSafe) return null;

  if (!eligible || !sdkReady || !online) {
    return (
      <View
        ref={ref}
        collapsable={false}
        pointerEvents="none"
        style={[styles.viewportProbe, !nativeUnitId && styles.bannerOnlyFrame]}
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

  if (!nativeFailed || !bannerUnitId || bannerFailed || !bannerRequestReady) {
    // Keep the reserved frame stable for this visible row when no inventory
    // is available. Never synthesize an ad or a billable impression.
    return (
      <View
        ref={ref}
        collapsable={false}
        pointerEvents="none"
        style={[styles.viewportProbe, !nativeUnitId && styles.bannerOnlyFrame]}
      />
    );
  }

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.bannerShell, !nativeUnitId && styles.bannerOnlyFrame]}
      pointerEvents={bannerLoaded ? 'auto' : 'none'}
    >
      {bannerLoaded ? <Text style={styles.label}>Sponsored</Text> : null}
      <View style={bannerLoaded
        ? usePostRectangle ? styles.rectangleArea : styles.bannerArea
        : styles.pendingArea}>
        <BannerAd
          unitId={bannerUnitId}
          size={usePostRectangle
            ? BannerAdSize.MEDIUM_RECTANGLE
            : BannerAdSize.INLINE_ADAPTIVE_BANNER}
          {...(usePostRectangle ? {} : { width: adWidth, maxHeight: 100 })}
          onAdLoaded={() => {
            if (bannerTimeoutRef.current) {
              clearTimeout(bannerTimeoutRef.current);
              bannerTimeoutRef.current = null;
            }
            recordBuklodAdEvent(
              diagnosticPlacement,
              'ad_loaded',
              undefined,
              { route: pathname, placementId },
            );
            setBannerLoaded(true);
          }}
          onAdImpression={() => {
            recordBuklodAdEvent(
              diagnosticPlacement,
              'ad_impression',
              undefined,
              { route: pathname, placementId },
            );
          }}
          onAdFailedToLoad={error => {
            if (bannerTimeoutRef.current) {
              clearTimeout(bannerTimeoutRef.current);
              bannerTimeoutRef.current = null;
            }
            recordBuklodAdEvent(
              diagnosticPlacement,
              'ad_failed',
              error,
              { route: pathname, placementId },
            );
            // On genuine AdMob no-fill, keep the BannerAd mounted. Google
            // may refresh a visible banner when the ad unit's automatic
            // refresh is configured, without a manual retry storm.
            const errorCode = String((error as { code?: string })?.code ?? '');
            if (!errorCode.includes('no-fill')) {
              setBannerFailed(true);
            }
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewportProbe: {
    width: '100%',
    height: FEED_AD_CARD_HEIGHT,
    marginTop: 10,
    marginBottom: 14,
    opacity: 0,
  },
  // Without a Native unit, allow an existing Banner ad unit to fill a
  // fixed 300x250 sponsored rich-media/video rectangle, never fake creative.
  bannerOnlyFrame: {
    height: 300,
    minHeight: 300,
  },
  pendingArea: {
    width: '100%',
    minHeight: 50,
    overflow: 'hidden',
    // Keep the SDK view visible so AdMob automatic refresh can recover no-fill.
  },
  nativeShell: {
    width: '100%',
    height: FEED_AD_CARD_HEIGHT,
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
    height: 200,
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
    height: FEED_AD_CARD_HEIGHT,
    marginTop: 10,
    marginBottom: 14,
    paddingTop: 7,
    paddingBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  rectangleArea: {
    width: '100%',
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
