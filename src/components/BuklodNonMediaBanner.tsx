import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Keyboard, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useFocusEffect, usePathname } from 'expo-router';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { getBuklodBannerUnitId, type BuklodAdPlacement } from '@/lib/buklodAdUnits';
import { recordBuklodAdEvent } from '@/lib/buklodAdDiagnostics';
import { isBuklodPassiveAdAllowed, reserveBuklodPassiveAdRequest } from '@/lib/buklodGlobalAdController';
import { useBuklodAdViewportGate } from '@/lib/buklodAdViewport';
import { useAds } from '@/providers/AdsProvider';
import { useNetwork } from '@/providers/NetworkProvider';

export const NON_MEDIA_AD_SLOTS = {
  bible_directory_bottom: { route: '/bible/directory', unit: 'bible', inline: false },
  devotion_list_inline: { route: '/word', unit: 'devotion', inline: true },
  faith_library_bottom: { route: '/faith/library', unit: 'content', inline: false },
  focus_directory_bottom: { route: '/profile/focus-directory', unit: 'focus', inline: false },
  lesson_catalog_bottom: { route: '/learn', unit: 'content', inline: true },
} as const satisfies Record<string, { route: string; unit: BuklodAdPlacement; inline: boolean }>;
export type NonMediaAdSlot = keyof typeof NON_MEDIA_AD_SLOTS;

/** Phase 1 only. Does not change or wrap any existing ad/media renderer. */
export default function BuklodNonMediaBanner({ placementId }: { placementId: NonMediaAdSlot }) {
  const slot = NON_MEDIA_AD_SLOTS[placementId];
  const pathname = usePathname();
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  const { ready, canRequestAds } = useAds();
  const { online } = useNetwork();
  const { ref, eligible } = useBuklodAdViewportGate();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [keyboard, setKeyboard] = useState(Keyboard.isVisible());
  const [width, setWidth] = useState(0);
  const [reserved, setReserved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const requested = useRef(false);
  const unitId = getBuklodBannerUnitId(slot.unit);
  const routeSafe = pathname === slot.route && isBuklodPassiveAdAllowed({
    placement: slot.unit, placementId, pathname,
  });
  const allowed = routeSafe && focused && foreground && !keyboard && ready && canRequestAds;
  const canLoad = allowed && online && eligible && width > 0 && !!unitId && !failed;

  useEffect(() => {
    const app = AppState.addEventListener('change', state => setForeground(state === 'active'));
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { app.remove(); shown.remove(); hidden.remove(); };
  }, []);

  useEffect(() => {
    if (!allowed || (!online && !loaded)) {
      requested.current = false;
      setReserved(false);
      setLoaded(false);
      return;
    }
    if (!canLoad || requested.current) return;
    requested.current = true;
    // One load attempt per mounted slot. No timers or repeated no-fill loading.
    if (!reserveBuklodPassiveAdRequest(placementId, `${pathname}:${placementId}`)) return;
    setReserved(true);
    recordBuklodAdEvent('content_inline', 'ad_request', undefined, { route: pathname, placementId });
  }, [allowed, canLoad, loaded, online, pathname, placementId]);

  const measure = (event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    if (Number.isFinite(next) && next >= 0) setWidth(next);
  };
  if (!routeSafe || !focused || failed || !unitId) return null;
  const mountAd = allowed && reserved && eligible && width > 0 && (online || loaded);
  return (
    <View ref={ref} onLayout={measure} collapsable={false}
      style={loaded && allowed ? styles.slot : styles.probe}>
      {loaded && allowed ? <Text style={styles.label}>Sponsored</Text> : null}
      {mountAd ? (
        <BannerAd unitId={unitId} width={width}
          size={slot.inline ? BannerAdSize.INLINE_ADAPTIVE_BANNER : BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          {...(slot.inline ? { maxHeight: 100 } : {})}
          onAdLoaded={() => {
            setLoaded(true);
            recordBuklodAdEvent('content_inline', 'ad_loaded', undefined, { route: pathname, placementId });
          }}
          onAdImpression={() => {
            recordBuklodAdEvent('content_inline', 'ad_rendered', undefined, { route: pathname, placementId });
            recordBuklodAdEvent('content_inline', 'ad_impression', undefined, { route: pathname, placementId });
          }}
          onAdFailedToLoad={error => {
            setLoaded(false); setFailed(true);
            recordBuklodAdEvent('content_inline', 'ad_failed', error, { route: pathname, placementId });
          }}
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  slot: { width: '100%', alignItems: 'center', paddingVertical: 12, marginVertical: 8 },
  probe: { width: '100%', minHeight: 12, alignItems: 'center' },
  label: { alignSelf: 'flex-start', fontSize: 10, color: '#64746B', marginBottom: 6 },
});
