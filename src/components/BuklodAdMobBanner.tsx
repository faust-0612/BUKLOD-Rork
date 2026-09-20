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
} from '@/lib/buklodGlobalAdController';

const RETRY_DELAYS_MS = [8000, 20000, 45000];
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
};

function BuklodAdMobBanner({
  placement,
  compact = false,
  format = 'adaptive',
  diagnosticName,
  requireViewport = true,
  showLabel = true,
  placementId,
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
  const [opacity] = useState(() => new Animated.Value(0));
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestedAttempt = useRef(-1);
  const failedBecauseOffline = useRef(false);

  const unitId = getBuklodBannerUnitId(placement);
  const sdkReady = ready && canRequestAds;
  const shouldRequest =
    routeSafe && !!unitId && sdkReady && viewportReady && online && !failed;
  const mountBanner =
    routeSafe && (shouldRequest || loaded) && !!unitId && !failed;

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
    requestedAttempt.current = attempt;
    recordBuklodAdEvent(diagnostic, 'requested');
  }, [attempt, shouldRequest, diagnostic]);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    Animated.timing(opacity, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [loaded, opacity]);

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
      return <View ref={ref} collapsable={false} />;
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
              : { minHeight: BUKLOD_DASHBOARD_BANNER_AD_HEIGHT },
          ]}
        >
          {mountBanner && unitId ? (
            <BannerAd
              key={`${unitId}:${attempt}`}
              unitId={unitId}
              size={bannerSize}
              onAdLoaded={() => {
                setLoaded(true);
                recordBuklodAdEvent(diagnostic, 'loaded');
              }}
              onAdOpened={() => {
                recordBuklodAdEvent(diagnostic, 'displayed');
              }}
              {...({
                onAdImpression: () => {
                  recordBuklodAdEvent(diagnostic, 'impression');
                },
              } as object)}
              onAdFailedToLoad={(error) => {
                recordBuklodAdEvent(diagnostic, 'failed_load', error);
                setLoaded(false);

                if (!online) {
                  failedBecauseOffline.current = true;
                  setFailed(true);
                  return;
                }

                if (attempt >= MAX_RETRIES) {
                  setFailed(true);
                  return;
                }

                const delay = RETRY_DELAYS_MS[attempt] ?? 45000;
                retryTimer.current = setTimeout(() => {
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
