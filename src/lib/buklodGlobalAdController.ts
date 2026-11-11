import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  INTERSTITIAL_MIN_EVENT_COUNT,
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
  '/profile/buklod-health',
  '/health',
  '/consultation',
  '/emergency',
  '/bsoc',
  '/support',
  '/prayer/new',
  '/faith/bible-quiz',
  '/connect/community',
  '/connect/personal',
  '/mzb/connect/community',
  '/mzb/connect/personal',
  '/giving',
  '/bayanihan/withdrawals',
  '/scope/attendance',
  '/scope/faith-monitoring',
  '/scope/manage',
  '/organizations/admin-module',
  '/organizations/settings',
  '/organizations/manage',
  '/clusters/manage',
  '/clusters/settings',
  '/premium',
  '/mzb/admin',
];

let pathname = '/';
let foreground = true;
let fullScreenShownThisSession = 0; // Diagnostics only. There is no session quota.
let fullScreenReservation = false;
let fullScreenCadenceCheckInFlight = false;
let fullScreenCadencePersistenceFailed = false;
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
  return SENSITIVE_PREFIXES.some(
    prefix => route === prefix || route.startsWith(`${prefix}/`),
  );
}

/** Read-only cooldown check so an eligible slot can defer rather than disappear. */
export function getBuklodPassiveAdRequestWaitMs(
  placementId: string,
  requestKey = placementId,
  cooldownMs = AD_SLOT_REMOUNT_COOLDOWN_MS,
) {
  const key = `${placementId}:${String(requestKey || placementId)}`;
  const previous = passiveRequestTimes.get(key) ?? 0;
  return previous > 0
    ? Math.max(0, previous + Math.max(1_000, cooldownMs) - Date.now())
    : 0;
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
  // Preserve the retired legacy unit block while allowing the current Home placement.
  if (placementId === 'legacy_home_banner') return false;
  const route = normalizePath(candidate ?? pathname);

  // The Faculty Focus landing explicitly mounts a sponsor strip, but the
  // generic sensitive-route prefix had silently disabled it. Permit only
  // this passive ad on the public-facing landing; grade/exam/roster child
  // screens and all interstitial/rewarded ads remain blocked.
  const safeFacultyLanding =
    placement === 'focus' && route === '/profile/buklod-faculty';
  // Reels are intentionally native-feed sponsored cards, NOT interstitials.
  // The IGPAT route is otherwise sensitive to prevent forced ads; allow
  // only the explicit passive reels placement, respecting all remote gates.
  // Radio and PTT may show their EXACT passive content banners only.
  // They remain sensitive to interstitial and rewarded interruptions.
  const safePersonalMediaBanner =
    placement === 'content' &&
    ((route === '/personal-home/radio' && placementId === 'dzas_radio_medium_rectangle') ||
      (route === '/personal-home/ptt' && placementId === 'ptt_banner'));
  // Health information banner appears only in the nonurgent, user-screened
  // section; the Health Center component itself decides when to mount it.
  // No full-screen ads or generic placements on the health route.
  const safeHealthInformationBanner =
    route === '/profile/buklod-health' &&
    placement === 'focus' &&
    placementId === 'health_consultation_safe_info_banner';
  const safeReelsPlacement =
    placement === 'reels' &&
    placementId === 'reels_inline' &&
    (route === '/igpat' || route === '/reels');
  // Passive inventory only on explicit Kingdom surfaces. Active game/quiz controls
  // and all other sensitive routes remain blocked.
  const safeKingdomPassive =
    (route === '/games' && placementId === 'kingdom_map_footer') ||
    (route === '/games/legacy' && placementId === 'kingdom_legacy_native') ||
    (route === '/games/rewards' && placementId === 'kingdom_treasury_native') ||
    (route === '/games/practice' && placementId === 'kingdom_practice_complete_banner') ||
    (route.startsWith('/games/') && placementId === 'kingdom_game_center_completed');

  return (
    foreground &&
    enabled('ads_passive') &&
    placementEnabled(placementId) &&
    (!isBuklodAdRouteSensitive(route) || safeFacultyLanding || safePersonalMediaBanner || safeHealthInformationBanner || safeReelsPlacement || safeKingdomPassive) &&
    !hasInteractionLock()
  );
}

export function isBuklodRewardedAdAllowed(
  placementId = 'rewarded_generic',
) {
  const safeKingdomOptIn =
    pathname === '/games/practice' && placementId === 'kingdom_practice_hint';
  return (
    foreground &&
    enabled('ads_rewarded') &&
    placementEnabled(placementId) &&
    (!isBuklodAdRouteSensitive(pathname) || safeKingdomOptIn) &&
    !hasInteractionLock()
  );
}

export function canWarmBuklodFullScreenAd(
  placementId = 'interstitial_generic',
) {
  // Completion-only exception after server-confirmed state transitions.
  // No map taps, questions, payment forms or failed/duplicate submissions.
  const safeKingdomCompletion =
    (pathname.startsWith('/games/') && placementId === 'interstitial_kingdom_mastery_verified') ||
    (pathname === '/games/legacy' && placementId === 'interstitial_kingdom_legacy_claim') ||
    (pathname === '/games/rewards' && placementId === 'interstitial_kingdom_power_unlocked') ||
    (pathname === '/igpat/create' && placementId === 'interstitial_igpat_video_published');
  return (
    foreground &&
    enabled('ads_interstitial') &&
    placementEnabled(placementId) &&
    (!isBuklodAdRouteSensitive(pathname) || safeKingdomCompletion) &&
    !hasInteractionLock() &&
    !fullScreenCadencePersistenceFailed
  );
}

/**
 * Only authenticated, truly completed eligible events reach this method.
 * The async storage guard prevents two concurrent completion callbacks from
 * reading the same event count and producing duplicate full-screen ads.
 */
export async function reserveBuklodFullScreenAd(
  _reason: BuklodNaturalInterstitialReason,
  placementId: string,
): Promise<boolean> {
  if (
    !canWarmBuklodFullScreenAd(placementId) ||
    fullScreenReservation ||
    fullScreenCadenceCheckInFlight
  ) {
    return false;
  }

  fullScreenCadenceCheckInFlight = true;
  try {
    const previousCount = Number(await AsyncStorage.getItem(COUNT_KEY) ?? '0');
    const nextCount =
      Number.isFinite(previousCount) && previousCount >= 0
        ? previousCount + 1
        : 1;

    await AsyncStorage.setItem(COUNT_KEY, String(nextCount));

    // Keep the Google-required action spacing. The removed 8-minute timer
    // and 5-per-session cap are NOT replaced by hidden time/session limits.
    if (nextCount < Math.max(2, INTERSTITIAL_MIN_EVENT_COUNT)) {
      return false;
    }
    if (!canWarmBuklodFullScreenAd(placementId) || fullScreenReservation) {
      return false;
    }
    fullScreenReservation = true;
    return true;
  } catch {
    // Missing/stale storage must not create back-to-back interstitials.
    return false;
  } finally {
    fullScreenCadenceCheckInFlight = false;
  }
}

export async function finishBuklodFullScreenAd(shown: boolean) {
  if (!fullScreenReservation) return;
  try {
    if (!shown) return;
    fullScreenShownThisSession += 1;
    // The reservation stays locked until this reset is durable. Otherwise
    // another completion could read the pre-ad count and show immediately.
    await AsyncStorage.setItem(COUNT_KEY, '0');
  } catch {
    // Fail closed on storage errors rather than risk consecutive ads.
    fullScreenCadencePersistenceFailed = true;
  } finally {
    fullScreenReservation = false;
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
    fullScreenCadenceCheckInFlight,
    fullScreenCadencePersistenceFailed,
    remoteFeatures: { ...remoteFeatures },
  };
}
