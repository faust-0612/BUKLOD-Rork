import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  INTERSTITIAL_COOLDOWN_MS,
  INTERSTITIAL_MIN_EVENT_COUNT,
  INTERSTITIAL_SESSION_CAP,
  AD_SLOT_REMOUNT_COOLDOWN_MS,
} from '@/lib/buklodAdMonetizationPolicy';
import type { BuklodAdPlacement } from '@/lib/buklodAdUnits';

export type BuklodAdInteractionLock =
  | 'typing'
  | 'form'
  | 'transaction'
  | 'exam'
  | 'classroom'
  | 'error_recovery'
  | 'critical_admin';

export type BuklodNaturalInterstitialReason =
  | 'focus_app_entry'
  | 'accessory_entry'
  | 'devotional_completed'
  | 'lesson_completed'
  | 'reading_session_completed'
  | 'content_session_completed'
  | 'game_session_completed';

const LAST_KEY = '@buklod/ad/interstitial-last';
const COUNT_KEY = '@buklod/ad/interstitial-count';

const SENSITIVE_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/account/reset-password',
  '/account/recovery',
  '/account/delete',
  '/delete-account',
  '/bayanihan/withdraw',
  '/bayanihan/payout',
  '/admin',
  '/system/maintenance',
  '/system/update-required',
  '/privacy/consent',
  '/help',
  '/moderation/report',
  '/profile/buklod-classroom',
  '/profile/buklod-faculty',
  '/classroom',
  '/faculty-',
  '/quiz',
  '/quick-check',
  '/igpat',
  '/reels',
  '/games',
  '/personal-home',
];

/** Radio and PTT keep a normal content banner. The rest of Personal Home stays ad-free. */
const PASSIVE_AD_ROUTE_ALLOWANCES = [
  '/personal-home/radio',
  '/personal-home/ptt',
];

let pathname = '/';
let foreground = true;
let fullScreenShownThisSession = 0;
let fullScreenReservation = false;
let remoteFeatures: Record<string, boolean> = {};
const passiveRequestTimes = new Map<string, number>();

const locks: Record<BuklodAdInteractionLock, number> = {
  typing: 0,
  form: 0,
  transaction: 0,
  exam: 0,
  classroom: 0,
  error_recovery: 0,
  critical_admin: 0,
};

function normalizePath(value: string | null | undefined) {
  const raw = String(value ?? '/').trim().toLowerCase();
  const pathOnly = raw.split('?')[0]?.split('#')[0] || '/';
  return pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
}

function enabled(key: string) {
  return remoteFeatures[key] !== false;
}

function hasInteractionLock() {
  return (Object.keys(locks) as BuklodAdInteractionLock[]).some(
    key => locks[key] > 0,
  );
}

function placementEnabled(placementId: string) {
  return (
    enabled('ads_all') &&
    enabled('ads_placements') &&
    enabled(`ads_platform_${Platform.OS}`) &&
    enabled(`ads_placement_${placementId}`)
  );
}

export function setBuklodAdRoute(value: string | null | undefined) {
  pathname = normalizePath(value);
}

export function setBuklodAdForeground(value: boolean) {
  foreground = value;
}

export function setBuklodAdRemoteFeatures(
  features: Record<string, boolean> | null | undefined,
) {
  remoteFeatures = { ...(features ?? {}) };
}

export function acquireBuklodAdSafetyLock(kind: BuklodAdInteractionLock) {
  locks[kind] += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks[kind] = Math.max(0, locks[kind] - 1);
  };
}

export function isBuklodAdRouteSensitive(
  candidate: string | null | undefined = pathname,
) {
  const route = normalizePath(candidate);
  if (route === '/') return true;
  if (
    PASSIVE_AD_ROUTE_ALLOWANCES.some(
      (allowed) => route === allowed || route.startsWith(`${allowed}/`),
    )
  ) {
    return false;
  }
  return SENSITIVE_PREFIXES.some(
    prefix => route === prefix || route.startsWith(`${prefix}/`),
  );
}

export function reserveBuklodPassiveAdRequest(
  placementId: string,
  requestKey = placementId,
  cooldownMs = AD_SLOT_REMOUNT_COOLDOWN_MS,
) {
  const key = `${placementId}:${String(requestKey || placementId)}`;
  const now = Date.now();
  const previous = passiveRequestTimes.get(key) ?? 0;

  if (previous > 0 && now - previous < Math.max(1_000, cooldownMs)) {
    return false;
  }

  passiveRequestTimes.set(key, now);

  if (passiveRequestTimes.size > 600) {
    const cutoff = now - Math.max(1_000, cooldownMs);
    for (const [candidate, timestamp] of passiveRequestTimes) {
      if (timestamp < cutoff || passiveRequestTimes.size > 500) {
        passiveRequestTimes.delete(candidate);
      }
    }
  }

  return true;
}

export function isBuklodPassiveAdAllowed({
  placementId,
  placement,
  pathname: candidate,
}: {
  placementId: string;
  placement?: BuklodAdPlacement;
  pathname?: string | null;
}) {
  if (
    placement === 'home' ||
    placementId === 'legacy_home_banner'
  ) {
    return false;
  }

  return (
    foreground &&
    enabled('ads_passive') &&
    placementEnabled(placementId) &&
    !isBuklodAdRouteSensitive(candidate ?? pathname) &&
    !hasInteractionLock()
  );
}

export function isBuklodRewardedAdAllowed(
  placementId = 'rewarded_generic',
) {
  return (
    foreground &&
    enabled('ads_rewarded') &&
    placementEnabled(placementId) &&
    !isBuklodAdRouteSensitive(pathname) &&
    !hasInteractionLock()
  );
}

export function canWarmBuklodFullScreenAd(
  placementId = 'interstitial_generic',
) {
  return (
    foreground &&
    enabled('ads_interstitial') &&
    placementEnabled(placementId) &&
    !isBuklodAdRouteSensitive(pathname) &&
    !hasInteractionLock() &&
    fullScreenShownThisSession < INTERSTITIAL_SESSION_CAP
  );
}

export async function reserveBuklodFullScreenAd(
  _reason: BuklodNaturalInterstitialReason,
  placementId: string,
): Promise<boolean> {
  if (!canWarmBuklodFullScreenAd(placementId) || fullScreenReservation) {
    return false;
  }

  try {
    const pairs = await AsyncStorage.multiGet([COUNT_KEY, LAST_KEY]);
    const previousCount = Number(pairs[0]?.[1] ?? '0');
    const lastShown = Number(pairs[1]?.[1] ?? '0');
    const nextCount =
      Number.isFinite(previousCount) && previousCount >= 0
        ? previousCount + 1
        : 1;

    await AsyncStorage.setItem(COUNT_KEY, String(nextCount));

    if (nextCount < Math.max(1, INTERSTITIAL_MIN_EVENT_COUNT)) {
      return false;
    }

    if (
      Number.isFinite(lastShown) &&
      lastShown > 0 &&
      Date.now() - lastShown < Math.max(60_000, INTERSTITIAL_COOLDOWN_MS)
    ) {
      return false;
    }

    fullScreenReservation = true;
    return true;
  } catch {
    return false;
  }
}

export async function finishBuklodFullScreenAd(shown: boolean) {
  const hadReservation = fullScreenReservation;
  fullScreenReservation = false;
  if (!hadReservation || !shown) return;

  fullScreenShownThisSession += 1;

  try {
    await AsyncStorage.multiSet([
      [LAST_KEY, String(Date.now())],
      [COUNT_KEY, '0'],
    ]);
  } catch {
    fullScreenShownThisSession = INTERSTITIAL_SESSION_CAP;
  }
}

export function getBuklodGlobalAdSafetySnapshot() {
  return {
    pathname,
    foreground,
    sensitiveRoute: isBuklodAdRouteSensitive(pathname),
    interactionLocked: hasInteractionLock(),
    fullScreenShownThisSession,
    fullScreenReserved: fullScreenReservation,
    remoteFeatures: { ...remoteFeatures },
  };
}
