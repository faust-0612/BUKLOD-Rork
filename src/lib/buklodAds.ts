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

  listenerCleanup.push(
    interstitial.addAdEventListener(AdEventType.LOADED, () => {
      interstitialLoaded = true;
    }),
  );
  listenerCleanup.push(
    interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      interstitialLoaded = false;
      cleanupInterstitialListeners();
      interstitial = null;
    }),
  );
  listenerCleanup.push(
    interstitial.addAdEventListener(AdEventType.ERROR, () => {
      interstitialLoaded = false;
      cleanupInterstitialListeners();
      interstitial = null;
    }),
  );

  interstitial.load();
}

export function warmBuklodInterstitial(
  placementId = 'interstitial_generic',
) {
  if (canWarmBuklodFullScreenAd(placementId)) {
    void prepareInterstitial(placementId);
  }
}

export async function maybeShowBuklodInterstitial(
  reason: BuklodNaturalInterstitialReason,
  placementId = `interstitial_${reason}`,
): Promise<boolean> {
  try {
    if (await isBuklodAdLightPassActive()) return false;
  } catch (error) {
    console.warn('BUKLOD Ad-Light pass check:', error);
  }

  const reserved = await reserveBuklodFullScreenAd(reason, placementId);
  if (!reserved) {
    if (canWarmBuklodFullScreenAd(placementId)) {
      void prepareInterstitial(placementId);
    }
    return false;
  }

  await prepareInterstitial(placementId);

  if (!interstitial || !interstitialLoaded) {
    await finishBuklodFullScreenAd(false);
    return false;
  }

  try {
    await interstitial.show();
    await finishBuklodFullScreenAd(true);
    return true;
  } catch (error) {
    await finishBuklodFullScreenAd(false);
    console.warn('BUKLOD interstitial:', error);
    return false;
  }
}
