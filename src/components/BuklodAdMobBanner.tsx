import React, {
  memo,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePathname } from 'expo-router';

import {
  BannerAd,
  BannerAdSize,
} from 'react-native-google-mobile-ads';

import {
  BuklodAdPlacement,
  BUKLOD_DASHBOARD_BANNER_AD_HEIGHT,
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
  isBuklodPassiveAdAllowed,
  reserveBuklodPassiveAdRequest,
} from '@/lib/buklodGlobalAdController';
import { AD_SLOT_REMOUNT_COOLDOWN_MS, BANNER_RETRY_DELAYS_MS } from '@/lib/buklodAdMonetizationPolicy';

const RETRY_DELAYS_MS = BANNER_RETRY_DELAYS_MS;
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
  const { online } = useNetwork();
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
  const [reservationGranted, setReservationGranted] = useState(false);
  const [opacity] = useState(() => new Animated.Value(0));
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestedAttempt = useRef(-1);
  const renderedAttempt = useRef(-1);
  const slotReserved = useRef(false);
  const sdkFailureCount = useRef(0);
  const failedBecauseOffline = useRef(false);

  const unitId = getBuklodBannerUnitId(placement);
  const sdkReady = ready && canRequestAds;
  const shouldRequest =
    routeSafe && !!unitId && sdkReady && viewportReady && online && !failed;
  const mountBanner =
    routeSafe && reservationGranted && (shouldRequest || loaded) && !!unitId && !failed;

  useEffect(() => {
    return () => {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (online && retryTimer.current == null) {
      return;
    }
    if (!online && retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
      // A cancelled cooldown must be evaluated again on reconnect.
      if (!slotReserved.current) requestedAttempt.current = -1;
    }
  }, [online]);

  useEffect(() => {
    if (!online || !failed || !failedBecauseOffline.current) {
      return;
    }
    failedBecauseOffline.current = false;
    requestedAttempt.current = -1;
    setFailed(false);
  }, [online, failed]);

  useEffect(() => {
    if (!shouldRequest || requestedAttempt.current === attempt) {
      return;
    }
    if (!slotReserved.current) {
      const accepted = reserveBuklodPassiveAdRequest(
        stablePlacementId,
        `${pathname}:${stablePlacementId}`,
      );
      if (!accepted) {
        // Cooldown is temporary, not a permanent ad failure. Do not mount the
        // native BannerAd until the request reservation has been granted.
        requestedAttempt.current = attempt;
        if (!retryTimer.current) {
          retryTimer.current = setTimeout(() => {
            retryTimer.current = null;
            requestedAttempt.current = -1;
            setAttempt(current => current + 1);
          }, AD_SLOT_REMOUNT_COOLDOWN_MS);
        }
        return;
      }
      slotReserved.current = true;
      setReservationGranted(true);
    }

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

  if (!sdkReady || !viewportReady || (!online && !loaded)) {
    if (compact) {
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
      <Animated.View
        style={[
          styles.shell,
          compact && styles.compactShell,
          { opacity: compact ? opacity : 1 },
        ]}
      >
        {showLabel ? (
          <View style={styles.labelRow}>
            <Text style={styles.label}>Sponsored</Text>
          </View>
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
                sdkFailureCount.current = 0;
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
                recordBuklodAdEvent(diagnostic, 'ad_failed', error, { route: pathname, placementId: stablePlacementId });
                setLoaded(false);

                if (!online) {
                  failedBecauseOffline.current = true;
                  setFailed(true);
                  return;
                }

                if (sdkFailureCount.current >= MAX_RETRIES) {
                  setFailed(true);
                  return;
                }

                if (retryTimer.current) return;
                const delay = RETRY_DELAYS_MS[sdkFailureCount.current++] ?? 45000;
                retryTimer.current = setTimeout(() => {
                  retryTimer.current = null;
                  setAttempt((current) => current + 1);
                }, delay);
              }}
            />
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    pendingShell: {
      width: '100%',
      minHeight: 12,
    },

    shell: {
      width: '100%',
      backgroundColor: '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: '#E2E8E4',
      paddingTop: 2,
      paddingBottom: 4,
    },

    compactShell: {
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
