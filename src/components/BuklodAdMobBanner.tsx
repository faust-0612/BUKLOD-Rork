import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Animated,
  AppState,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, usePathname } from 'expo-router';

import {
  BannerAd,
  BannerAdSize,
} from 'react-native-google-mobile-ads';

import {
  BuklodAdPlacement,
  BUKLOD_DASHBOARD_BANNER_AD_HEIGHT,
  BUKLOD_DASHBOARD_BANNER_RESERVED_HEIGHT,
  diagnosticPlacementFor,
  getBuklodBannerUnitId,
} from '@/lib/buklodAdUnits';

import {
  recordBuklodAdEvent,
  type BuklodAdDiagnosticPlacement,
} from '@/lib/buklodAdDiagnostics';

import {
  useBuklodAdViewportGate,
} from '@/lib/buklodAdViewport';

import {
  useAds,
} from '@/providers/AdsProvider';

import {
  useNetwork,
} from '@/providers/NetworkProvider';
import {
  getBuklodPassiveAdRequestWaitMs,
  isBuklodPassiveAdAllowed,
  reserveBuklodPassiveAdRequest,
} from '@/lib/buklodGlobalAdController';
import {
  AD_SLOT_REMOUNT_COOLDOWN_MS,
  BANNER_RETRY_DELAYS_MS,
} from '@/lib/buklodAdMonetizationPolicy';

const RETRY_DELAYS_MS = BANNER_RETRY_DELAYS_MS;
const BANNER_LOAD_TIMEOUT_MS = 8_000;
const MAX_RETRIES = RETRY_DELAYS_MS.length;

type Props = {
  placement:
    BuklodAdPlacement;

  compact?: boolean;

  format?:
    | 'adaptive'
    | 'inline'
    | 'mediumRectangle';

  diagnosticName?:
    BuklodAdDiagnosticPlacement;

  /** When false, skip viewport gating (already known visible). */
  requireViewport?: boolean;

  showLabel?: boolean;
  placementId?: string;
  /** Tall inline banners only. Ignored for anchored and rectangle sizes. */
  maxHeight?: number;
};

function BuklodAdMobBanner({
  placement,
  compact = false,
  format = 'adaptive',
  diagnosticName,
  requireViewport = true,
  showLabel = true,
  placementId,
  maxHeight,
}: Props) {
  const { ready, canRequestAds } = useAds();
  const { isConnected, isInternetReachable } = useNetwork();
  // A connected transport with unknown reachability can still serve ads;
  // captive/offline states remain blocked and the SDK handles request errors.
  const adNetworkAvailable = isConnected && isInternetReachable !== false;
  const pathname = usePathname();
  const stablePlacementId = placementId ?? `${placement}_generic`;
  const routeSafe = isBuklodPassiveAdAllowed({
    placement,
    placementId: stablePlacementId,
    pathname,
  });
  const { ref, eligible } = useBuklodAdViewportGate();
  const viewportReady = !requireViewport || eligible;
  const diagnostic =
    diagnosticName ?? diagnosticPlacementFor(placement);

  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [reservationReady, setReservationReady] = useState(false);
  const [reservationTick, setReservationTick] = useState(0);
  const [opacity] = useState(() => new Animated.Value(0));
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestedAttempt = useRef(-1);
  const renderedAttempt = useRef(-1);
  const failedAt = useRef(0);
  const failedBecauseOffline = useRef(false);

  const unitId = getBuklodBannerUnitId(placement);
  const sdkReady = ready && canRequestAds;
  const shouldRequest =
    routeSafe && !!unitId && sdkReady && viewportReady && adNetworkAvailable && !failed;
  // Never mount native BannerAd until the shared cooldown accepts this slot.
  // Previous code mounted it *before* the reservation effect could reject it.
  const mountBanner =
    routeSafe && reservationReady &&
    (shouldRequest || loaded) && !!unitId && !failed;
  const requestKey = `${pathname}:${stablePlacementId}`;

  // A banner callback that never arrives must not leave a reserved blank slot.
  // Bound each SDK attempt, then collapse and recover only after the cooldown.
  useEffect(() => {
    if (!mountBanner || loaded || failed) return;
    loadTimer.current = setTimeout(() => {
      loadTimer.current = null;
      recordBuklodAdEvent(
        diagnostic,
        'ad_failed',
        new Error('BANNER_AD_LOAD_TIMEOUT'),
        { route: pathname, placementId: stablePlacementId },
      );
      failedBecauseOffline.current = false;
      failedAt.current = Date.now();
      setFailed(true);
    }, BANNER_LOAD_TIMEOUT_MS);
    return () => {
      if (loadTimer.current) clearTimeout(loadTimer.current);
      loadTimer.current = null;
    };
  }, [mountBanner, loaded, failed, attempt, diagnostic, pathname, stablePlacementId]);


  const recoverAfterQuietPeriod = useCallback(() => {
    if (!failed || !adNetworkAvailable ||
      Date.now() - failedAt.current < AD_SLOT_REMOUNT_COOLDOWN_MS ||
      getBuklodPassiveAdRequestWaitMs(stablePlacementId, requestKey) > 0
    ) return;
    requestedAttempt.current = -1;
    renderedAttempt.current = -1;
    failedBecauseOffline.current = false;
    opacity.setValue(0);
    setReservationReady(false);
    setAttempt(0);
    setLoaded(false);
    setFailed(false);
  }, [failed, adNetworkAvailable, opacity, requestKey, stablePlacementId]);

  // Failed slots retry only after the shared quiet period, on focus/resume
  // or through the single bounded timer below; never in a fast no-fill loop.
  useFocusEffect(useCallback(() => {
    recoverAfterQuietPeriod();
  }, [recoverAfterQuietPeriod]));

  // One bounded retry after the shared quiet period, even if the user stays
  // on this screen. No-fill cannot leave a dead slot until manual navigation.
  useEffect(() => {
    if (!failed || !adNetworkAvailable) return;
    const elapsed = Date.now() - failedAt.current;
    const waitMs = Math.max(
      Math.max(0, AD_SLOT_REMOUNT_COOLDOWN_MS - elapsed),
      getBuklodPassiveAdRequestWaitMs(stablePlacementId, requestKey),
    );
    const timer = setTimeout(recoverAfterQuietPeriod, waitMs + 25);
    return () => clearTimeout(timer);
  }, [failed, adNetworkAvailable, requestKey, stablePlacementId, recoverAfterQuietPeriod]);


  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') recoverAfterQuietPeriod();
    });
    return () => sub.remove();
  }, [recoverAfterQuietPeriod]);

  useEffect(() => {
    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      if (loadTimer.current) clearTimeout(loadTimer.current);
    };
  }, []);

  useEffect(() => {
    if (adNetworkAvailable && retryTimer.current == null) {
      return;
    }
    if (!adNetworkAvailable && retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, [adNetworkAvailable]);

  useEffect(() => {
    if (!adNetworkAvailable || !failed || !failedBecauseOffline.current) {
      return;
    }
    failedBecauseOffline.current = false;
    requestedAttempt.current = -1;
    setReservationReady(false);
    setAttempt(0);
    setLoaded(false);
    setFailed(false);
  }, [adNetworkAvailable, failed]);

  useEffect(() => {
    if (!shouldRequest || reservationReady) return;
    if (reserveBuklodPassiveAdRequest(stablePlacementId, requestKey)) {
      setReservationReady(true);
      return;
    }
    // A quick remount is not a permanent ad failure. Keep a tiny viewport
    // probe and retry eligibility once, only after this request cooldown.
    const waitMs = Math.max(
      1_000,
      getBuklodPassiveAdRequestWaitMs(stablePlacementId, requestKey),
    );
    const timer = setTimeout(
      () => setReservationTick(value => value + 1),
      waitMs + 25,
    );
    return () => clearTimeout(timer);
  }, [
    shouldRequest,
    reservationReady,
    reservationTick,
    requestKey,
    stablePlacementId,
  ]);

  useEffect(() => {
    if (!shouldRequest || !reservationReady ||
        requestedAttempt.current === attempt) return;
    requestedAttempt.current = attempt;
    recordBuklodAdEvent(
      diagnostic,
      'ad_request',
      undefined,
      { route: pathname, placementId: stablePlacementId },
    );
  }, [
    attempt,
    shouldRequest,
    reservationReady,
    diagnostic,
    pathname,
    stablePlacementId,
  ]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    if (renderedAttempt.current !== attempt) {
      renderedAttempt.current = attempt;
      recordBuklodAdEvent(
        diagnostic,
        'ad_rendered',
        undefined,
        { route: pathname, placementId: stablePlacementId },
      );
    }

    Animated.timing(opacity, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [attempt, diagnostic, loaded, opacity, pathname]);

  const bannerSize =
    format === 'mediumRectangle'
      ? BannerAdSize.MEDIUM_RECTANGLE
      : format === 'inline'
        ? BannerAdSize.INLINE_ADAPTIVE_BANNER
        : BannerAdSize.ANCHORED_ADAPTIVE_BANNER;

  if (!routeSafe || !unitId || failed) {
    return null;
  }

  if (!sdkReady || !viewportReady || !reservationReady || (!adNetworkAvailable && !loaded)) {
    if (compact) {
      // Viewport measurement requires >=8px height; a zero-height compact
      // placeholder can never become eligible, permanently starving the ad.
      return <View ref={ref} collapsable={false} style={styles.pendingShell} />;
    }

    return (
      <View
        ref={ref}
        collapsable={false}
        style={styles.pendingShell}
      />
    );
  }

  return (
    <View ref={ref} collapsable={false}>
      <View style={[styles.shell, compact && styles.compactShell]}>
        {showLabel ? (
          <Animated.View style={[styles.labelRow, { opacity }]}>
            <Text style={styles.label}>Sponsored</Text>
          </Animated.View>
        ) : null}

        <View
          style={[
            styles.adArea,
            format === 'mediumRectangle'
              ? { minHeight: 250 }
              : format === 'inline' && maxHeight
                ? { minHeight: maxHeight }
                : { minHeight: BUKLOD_DASHBOARD_BANNER_AD_HEIGHT },
          ]}
        >
          {mountBanner && unitId ? (
            <BannerAd
              key={`${unitId}:${attempt}`}
              unitId={unitId}
              size={bannerSize}
              {...(format === 'inline' && maxHeight ? { maxHeight } : {})}
              onAdLoaded={() => {
                if (loadTimer.current) {
                  clearTimeout(loadTimer.current);
                  loadTimer.current = null;
                }
                setLoaded(true);
                recordBuklodAdEvent(diagnostic, 'ad_loaded', undefined, { route: pathname, placementId: stablePlacementId });
              }}
              onAdOpened={() => {
                recordBuklodAdEvent(diagnostic, 'ad_opened', undefined, { route: pathname, placementId: stablePlacementId });
              }}
              {...({
                onAdImpression: () => {
                  recordBuklodAdEvent(diagnostic, 'ad_impression', undefined, { route: pathname, placementId: stablePlacementId });
                },
              } as object)}
              onAdFailedToLoad={(error) => {
                if (loadTimer.current) {
                  clearTimeout(loadTimer.current);
                  loadTimer.current = null;
                }
                recordBuklodAdEvent(diagnostic, 'ad_failed', error, { route: pathname, placementId: stablePlacementId });
                setLoaded(false);

                const code = String((error as { code?: string })?.code ?? '');
                const noFill = code.includes('no-fill');
                if (noFill && adNetworkAvailable) {
                  // A no-fill is terminal for this mounted slot. Collapse the
                  // empty creative and allow one quiet-period recovery instead
                  // of leaving a permanent blank banner in the feed.
                  failedBecauseOffline.current = false;
                  failedAt.current = Date.now();
                  setFailed(true);
                  return;
                }
                if (!adNetworkAvailable || attempt >= MAX_RETRIES) {
                  failedBecauseOffline.current = !adNetworkAvailable;
                  failedAt.current = Date.now();
                  setFailed(true);
                  return;
                }

                const delay = RETRY_DELAYS_MS[attempt] ?? 45000;
                retryTimer.current = setTimeout(() => {
                  retryTimer.current = null;
                  setAttempt((current) => current + 1);
                }, delay);
              }}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    pendingShell: {
      width: '100%',
      minHeight: BUKLOD_DASHBOARD_BANNER_RESERVED_HEIGHT,
    },

    shell: {
      width: '100%',
      minHeight: BUKLOD_DASHBOARD_BANNER_RESERVED_HEIGHT,
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: '#E2E8E4',
      paddingTop: 2,
      paddingBottom: 4,
    },

    compactShell: {
      minHeight: BUKLOD_DASHBOARD_BANNER_RESERVED_HEIGHT,
      borderWidth: 1,
      borderColor: '#E1E7E3',
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
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },

    adArea: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
  });

export default memo(BuklodAdMobBanner);
