import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import {
  setBuklodAdForeground,
  setBuklodAdRemoteFeatures,
  setBuklodAdRoute,
  isBuklodAdRouteSensitive,
} from '@/lib/buklodGlobalAdController';
import {
  flushBuklodAdOperationalTelemetry,
} from '@/lib/buklodAdOperationalTelemetry';
import { useRuntimeConfig } from '@/providers/RuntimeConfigProvider';
import { warmBuklodInterstitial } from '@/lib/buklodAds';

export default function BuklodAdSafetyRouteBridge() {
  const pathname = usePathname();
  const { config } = useRuntimeConfig();
  const remoteFeaturesReady = useRef(false);

  useEffect(() => {
    setBuklodAdRoute(pathname);
  }, [pathname]);

  useEffect(() => {
    setBuklodAdRemoteFeatures(config?.features);
    remoteFeaturesReady.current = Boolean(config?.features);
  }, [config?.features]);

  // Warm one full-screen creative on a regular, content-safe Android route.
  // This NEVER shows an ad on app open/navigation; only a later, server-
  // confirmed natural break with two eligible actions can display it. Without
  // this warm-up a loaded creative often arrived after its only opportunity.
  // Wait for the remote feature map so an explicit ad kill-switch is honored.
  useEffect(() => {
    if (Platform.OS !== 'android' || !config?.features ||
        AppState.currentState === 'background' ||
        AppState.currentState === 'inactive' ||
        isBuklodAdRouteSensitive(pathname)) return;
    warmBuklodInterstitial('interstitial_generic');
  }, [pathname, config?.features]);

  useEffect(() => {
    // React Native may report null before its first native AppState sync.
    // Treat unknown startup state as foreground; explicit background/inactive
    // events still close the ad gate immediately.
    setBuklodAdForeground(
      AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
    );
    const sub = AppState.addEventListener('change', state => {
      const active = state === 'active';
      setBuklodAdForeground(active);
      if (!active) {
        void flushBuklodAdOperationalTelemetry();
      } else if (remoteFeaturesReady.current) {
        // A resumed app can recover a failed/cancelled preload only after
        // remote flags were received; kill switches remain authoritative.
        warmBuklodInterstitial('interstitial_generic');
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}
