import {
  AdEventType,
  AdsConsent,
  InterstitialAd,
} from 'react-native-google-mobile-ads';

import {
  initializeBuklodAds as initializeBuklodAdsSdk,
} from '@/lib/adMob';
import {
  getBuklodAdDiagnosticsSummary,
  recordBuklodAdEvent,
} from '@/lib/buklodAdDiagnostics';
import {
  buklodAdsTestMode,
  getBuklodInterstitialUnitId,
} from '@/lib/buklodAdUnits';
import {
  isBuklodAdLightPassActive,
} from '@/lib/buklodAdLightPass';
import {
  canWarmBuklodFullScreenAd,
  finishBuklodFullScreenAd,
  getBuklodGlobalAdSafetySnapshot,
  reserveBuklodFullScreenAd,
  type BuklodNaturalInterstitialReason,
} from '@/lib/buklodGlobalAdController';

export async function initializeBuklodAds(): Promise<boolean> {
  try {
    const state = await initializeBuklodAdsSdk();
    return state.ready && state.canRequestAds;
  } catch (error) {
    console.warn('BUKLOD Ads initialization:', error);
    return false;
  }
}

export async function getBuklodAdsDiagnostics() {
  let consent: Awaited<ReturnType<typeof AdsConsent.getConsentInfo>> | null =
    null;

  try {
    consent = await AdsConsent.getConsentInfo();
  } catch {
    consent = null;
  }

  return {
    testMode: buklodAdsTestMode,
    canRequestAds: consent?.canRequestAds ?? false,
    consentStatus: consent?.status ?? null,
    interstitialConfigured: Boolean(getBuklodInterstitialUnitId()),
    fill: getBuklodAdDiagnosticsSummary(),
    safety: getBuklodGlobalAdSafetySnapshot(),
  };
}

let interstitial: InterstitialAd | null = null;
let interstitialLoaded = false;
let listenerCleanup: (() => void)[] = [];

function cleanupInterstitialListeners() {
  listenerCleanup.forEach(fn => {
    try {
      fn();
    } catch {}
  });
  listenerCleanup = [];
}

async function prepareInterstitial(
  placementId = 'interstitial_generic',
) {
  if (!canWarmBuklodFullScreenAd(placementId)) return;

  const ready = await initializeBuklodAds();
  if (!ready) return;

  const unitId = getBuklodInterstitialUnitId();
  if (!unitId || interstitial) return;

  interstitial = InterstitialAd.createForAdRequest(unitId);
  const route = getBuklodGlobalAdSafetySnapshot().pathname;
  recordBuklodAdEvent(
    'interstitial',
    'ad_request',
    undefined,
    { route, adFormat: 'interstitial' },
  );

  listenerCleanup.push(
    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      interstitialLoaded = true;
      recordBuklodAdEvent(
        'interstitial',
        'ad_loaded',
        undefined,
        { route, adFormat: 'interstitial' },
      );
    }),
  );
  listenerCleanup.push(
    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      recordBuklodAdEvent(
        'interstitial',
        'ad_dismissed',
        undefined,
        { route, adFormat: 'interstitial' },
      );
      interstitialLoaded = false;
      cleanupInterstitialListeners();
      interstitial = null;
    }),
  );
  listenerCleanup.push(
    interstitial.addAdEventListener(AdEventType.ERROR, error => {
      recordBuklodAdEvent(
        'interstitial',
        'ad_failed',
        error,
        { route, adFormat: 'interstitial' },
      );
      interstitialLoaded = false;
      cleanupInterstitialListeners();
      interstitial = null;
    }),
  );

  listenerCleanup.push(
    interstitial.addAdEventListener(AdEventType.OPENED, () => {
      // OPENED proves the interstitial was actually presented. AdMob
      // impression/revenue callbacks are separate; do not invent impressions.
      interstitialLoaded = false;
      recordBuklodAdEvent(
        'interstitial',
        'ad_rendered',
        undefined,
        { route, adFormat: 'interstitial' },
      );
    }),
  );
  interstitial.load();
}

export function warmBuklodInterstitial(
  placementId = 'interstitial_generic',
) {
  if (canWarmBuklodFullScreenAd(placementId)) {
    void prepareInterstitial(placementId).catch(error => {
      // Preload must never raise an unhandled rejection during navigation
      // or app resume. A fresh eligible route can retry the next request.
      recordBuklodAdEvent('interstitial', 'ad_failed', error, {
        route: getBuklodGlobalAdSafetySnapshot().pathname,
        adFormat: 'interstitial',
      });
      interstitialLoaded = false;
      cleanupInterstitialListeners();
      interstitial = null;
    });
  }
}

export async function maybeShowBuklodInterstitial(
  reason: BuklodNaturalInterstitialReason,
  placementId = `interstitial_${reason}`,
): Promise<boolean> {
  try {
    if (await isBuklodAdLightPassActive()) return false;
  } catch (error) {
    // A failed local benefit lookup must not accidentally ignore an active
    // ad-light pass that a user has already earned.
    console.warn('BUKLOD Ad-Light pass check:', error);
    return false;
  }

  const reserved = await reserveBuklodFullScreenAd(reason, placementId);
  if (!reserved) {
    if (canWarmBuklodFullScreenAd(placementId)) {
      void prepareInterstitial(placementId);
    }
    return false;
  }

  await prepareInterstitial(placementId);

  if (!interstitial || !interstitialLoaded ||
      !canWarmBuklodFullScreenAd(placementId)) {
    // Never display a late SDK response over an exam, chat draft, SOS or
    // another protected route. A later natural break may reuse the preload.
    await finishBuklodFullScreenAd(false);
    return false;
  }

  try {
    await interstitial.show();
    await finishBuklodFullScreenAd(true);
    return true;
  } catch (error) {
    await finishBuklodFullScreenAd(false);
    recordBuklodAdEvent(
      'interstitial',
      'ad_failed',
      error,
      { route: getBuklodGlobalAdSafetySnapshot().pathname, adFormat: 'interstitial' },
    );
    // A consumed/stale SDK instance cannot be reused for another successful
    // action. Clear it, otherwise the app can stay permanently ad-empty.
    interstitialLoaded = false;
    cleanupInterstitialListeners();
    interstitial = null;
    console.warn('BUKLOD interstitial:', error);
    return false;
  }
}
