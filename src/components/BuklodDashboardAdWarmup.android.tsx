import React, { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'expo-router';
import { NativeAd, TestIds } from 'react-native-google-mobile-ads';
import { useAds } from '@/providers/AdsProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import {
  getBuklodAdSafetyRevision, getBuklodPassiveAdRequestWaitMs,
  isBuklodAdRouteSensitive, isBuklodPassiveAdAllowed,
  reserveBuklodPassiveAdRequest, subscribeBuklodAdSafety,
} from '@/lib/buklodGlobalAdController';
import { buklodAdsTestMode, diagnosticPlacementFor, type BuklodAdPlacement } from '@/lib/buklodAdUnits';
import { recordBuklodAdEvent, type BuklodAdDiagnosticPlacement } from '@/lib/buklodAdDiagnostics';

// Native SDK objects only. The on-screen first-view owns the view/impression.
const MAX_WARM_CREATIVES = 2;
const NATIVE_WARM_TTL_MS = 30 * 60_000;
const NATIVE_WARM_TIMEOUT_MS = 16_000;
const FAILED_COOLDOWN_MS = 120_000;
type State = 'none' | 'loading' | 'ready' | 'failed';
type Entry = { unitId: string; state: Exclude<State, 'none'>; startedAt: number;
  ad?: NativeAd; timeout?: ReturnType<typeof setTimeout> };
type Target = { placementId: string; placement: BuklodAdPlacement; route: string;
  unitId: string; diagnostic: BuklodAdDiagnosticPlacement };
const pool = new Map<string, Entry>();
const subscriptions = new Map<string, Set<() => void>>();
const owners = new Map<string, number>();
function notify(id: string) { for (const fn of subscriptions.get(id) ?? []) fn(); }
function evict(id: string) {
  const e = pool.get(id);
  if (!e) return;
  pool.delete(id);
  if (e.timeout) clearTimeout(e.timeout);
  e.ad?.destroy();
  notify(id);
}
function prune() {
  for (const [id, e] of pool) {
    const ttl = e.state === 'failed' ? FAILED_COOLDOWN_MS : NATIVE_WARM_TTL_MS;
    if (Date.now() - e.startedAt > ttl) evict(id);
  }
}
export function clearBuklodDashboardAdPreloads() {
  for (const id of [...pool.keys()]) evict(id);
}
export function subscribeBuklodDashboardAdPreload(id: string, fn: () => void) {
  const set = subscriptions.get(id) ?? new Set<() => void>();
  set.add(fn); subscriptions.set(id, set);
  return () => { set.delete(fn); if (!set.size) subscriptions.delete(id); };
}
export function getBuklodDashboardAdPreloadState(id: string, unitId: string): State {
  prune();
  const e = pool.get(id);
  return e?.unitId === unitId ? e.state : 'none';
}
export function noteBuklodDashboardNativeAdOwned(id: string) {
  owners.set(id, (owners.get(id) ?? 0) + 1);
}
export function releaseBuklodDashboardNativeAdOwned(id: string) {
  const count = (owners.get(id) ?? 0) - 1;
  if (count > 0) owners.set(id, count);
  else owners.delete(id);
}
export function takeBuklodDashboardAdPreload(id: string, unitId: string): NativeAd | null {
  if (getBuklodDashboardAdPreloadState(id, unitId) !== 'ready') return null;
  const entry = pool.get(id), ad = entry?.ad;
  if (!ad) return null;
  pool.delete(id);
  if (entry?.timeout) clearTimeout(entry.timeout);
  noteBuklodDashboardNativeAdOwned(id);
  return ad;
}
function preload(target: Target, source: string) {
  prune();
  if (!target.unitId || pool.has(target.placementId) || owners.has(target.placementId)) return;
  if (getBuklodPassiveAdRequestWaitMs(target.placementId, target.placementId) > 0) return;
  if ([...pool.values()].filter(e => e.state !== 'failed').length >= MAX_WARM_CREATIVES) return;
  if (isBuklodAdRouteSensitive(source) ||
    !isBuklodPassiveAdAllowed({ placementId: target.placementId, placement: target.placement, pathname: source }) ||
    !isBuklodPassiveAdAllowed({ placementId: target.placementId, placement: target.placement, pathname: target.route }) ||
    !reserveBuklodPassiveAdRequest(target.placementId, target.placementId)) return;
  const e: Entry = { unitId: target.unitId, state: 'loading', startedAt: Date.now() };
  pool.set(target.placementId, e);
  const metadata = { route: source, placementId: target.placementId, adFormat: 'native' as const };
  recordBuklodAdEvent(target.diagnostic, 'ad_request', undefined, metadata);
  e.timeout = setTimeout(() => {
    if (pool.get(target.placementId) !== e || e.state !== 'loading') return;
    e.state = 'failed';
    recordBuklodAdEvent(target.diagnostic, 'ad_failed', new Error('NATIVE_AD_LOAD_TIMEOUT'), metadata);
    notify(target.placementId);
  }, NATIVE_WARM_TIMEOUT_MS);
  void NativeAd.createForAdRequest(target.unitId, { requestNonPersonalizedAdsOnly: false })
    .then(ad => {
      if (pool.get(target.placementId) !== e || e.state !== 'loading') { ad.destroy(); return; }
      if (e.timeout) clearTimeout(e.timeout);
      e.timeout = undefined; e.ad = ad; e.state = 'ready';
      recordBuklodAdEvent(target.diagnostic, 'ad_loaded', undefined, metadata);
      notify(target.placementId);
    })
    .catch(error => {
      if (pool.get(target.placementId) !== e || e.state !== 'loading') return;
      if (e.timeout) clearTimeout(e.timeout);
      e.timeout = undefined; e.state = 'failed';
      recordBuklodAdEvent(target.diagnostic, 'ad_failed', error, metadata);
      notify(target.placementId);
    });
}
function nativeUnit(placement: BuklodAdPlacement) {
  if (buklodAdsTestMode) return TestIds.NATIVE;
  const community = String(process.env.EXPO_PUBLIC_ADMOB_COMMUNITY_NATIVE_UNIT_ID ?? '').trim();
  if (placement === 'profile') return String(process.env.EXPO_PUBLIC_ADMOB_PROFILE_NATIVE_UNIT_ID ?? '').trim() || community;
  if (placement === 'messages') return String(process.env.EXPO_PUBLIC_ADMOB_CONNECT_NATIVE_UNIT_ID ?? '').trim() || community;
  return community;
}
const targets: Record<string, { placementId: string; placement: BuklodAdPlacement; route: string }[]> = {
  '/buklod': [
    { placementId: 'new_home_first_view', placement: 'home', route: '/hub' },
    { placementId: 'connect_personal_first_view', placement: 'messages', route: '/messages' },
  ],
  '/hub': [
    { placementId: 'public_wall_entry', placement: 'community_entry', route: '/buklod' },
    { placementId: 'profile_first_view', placement: 'profile', route: '/me' },
  ],
  '/me': [
    { placementId: 'public_wall_entry', placement: 'community_entry', route: '/buklod' },
    { placementId: 'new_home_first_view', placement: 'home', route: '/hub' },
  ],
  '/messages': [
    { placementId: 'public_wall_entry', placement: 'community_entry', route: '/buklod' },
    { placementId: 'new_home_first_view', placement: 'home', route: '/hub' },
  ],
};
// One coordinator in the persistent authenticated tab shell, none per frozen tab.
export default function BuklodDashboardAdWarmup() {
  const pathname = usePathname();
  const { ready, canRequestAds } = useAds();
  const { isConnected, isInternetReachable } = useNetwork();
  const safetyRevision = useSyncExternalStore(
    subscribeBuklodAdSafety, getBuklodAdSafetyRevision, getBuklodAdSafetyRevision);
  useEffect(() => {
    if (!ready || !canRequestAds || !isConnected || isInternetReachable === false) {
      clearBuklodDashboardAdPreloads(); return;
    }
    if (isBuklodAdRouteSensitive(pathname)) return;
    for (const spec of targets[pathname] ?? []) {
      preload({ ...spec, unitId: nativeUnit(spec.placement),
        diagnostic: diagnosticPlacementFor(spec.placement) }, pathname);
    }
  }, [pathname, ready, canRequestAds, isConnected, isInternetReachable, safetyRevision]);
  useEffect(() => () => clearBuklodDashboardAdPreloads(), []);
  return null;
}
