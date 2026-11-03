import mobileAds, {
  AdsConsent,
  MaxAdContentRating,
} from 'react-native-google-mobile-ads';

import {
  getBuklodAdTestDeviceIds,
} from '@/lib/buklodAdUnits';

let requestConfigurationPromise:
  Promise<void> | null = null;

let initializationPromise:
  Promise<void> | null = null;

let consentRefreshPromise: Promise<void> | null = null;
let startupPromise: Promise<BuklodAdsState> | null = null;

async function configureAdRequests() {
  if (!requestConfigurationPromise) {
    const testDeviceIdentifiers =
      getBuklodAdTestDeviceIds();

    requestConfigurationPromise =
      mobileAds()
        .setRequestConfiguration({
          maxAdContentRating:
            MaxAdContentRating.PG,
          ...(testDeviceIdentifiers.length
            ? { testDeviceIdentifiers }
            : {}),
        })
        .then(() => undefined)
        .catch(error => {
          requestConfigurationPromise =
            null;

          throw error;
        });
  }

  await requestConfigurationPromise;
}


async function gatherConsentOnce() {
  if (!consentRefreshPromise) {
    consentRefreshPromise = AdsConsent.gatherConsent()
      .then(() => undefined)
      .catch(error => {
        console.warn('BUKLOD UMP consent refresh:', error);
      })
      .finally(() => {
        consentRefreshPromise = null;
      });
  }

  await consentRefreshPromise;
}

async function startGoogleMobileAdsIfAllowed() {
  const consentInfo =
    await AdsConsent
      .getConsentInfo();

  if (!consentInfo.canRequestAds) {
    return false;
  }

  if (!initializationPromise) {
    initializationPromise =
      mobileAds()
        .initialize()
        .then(() => undefined)
        .catch(error => {
          initializationPromise =
            null;

          throw error;
        });
  }

  await initializationPromise;

  return true;
}

export type BuklodAdsState = {
  ready: boolean;
  canRequestAds: boolean;
  /** Existing consent permits immediate SDK startup while UMP refreshes. */
  consentRefreshPending: boolean;
};

async function initializeBuklodAdsInternal(): Promise<BuklodAdsState> {
  await configureAdRequests();

  // A previously approved UMP state can start the SDK immediately. Refresh
  // consent in the background instead of holding every ad slot behind a
  // second network round-trip on every app launch.
  const previousConsent = await AdsConsent.getConsentInfo();
  if (previousConsent.canRequestAds) {
    const ready = await startGoogleMobileAdsIfAllowed();
    return {
      ready,
      canRequestAds: true,
      consentRefreshPending: true,
    };
  }

  // First-run / unresolved consent remains fail-closed: do not initialize or
  // request ads until UMP has completed and explicitly permits requests.
  await gatherConsentOnce();
  const consentInfo = await AdsConsent.getConsentInfo();
  const ready = await startGoogleMobileAdsIfAllowed();

  return {
    ready,
    canRequestAds: consentInfo.canRequestAds,
    consentRefreshPending: false,
  };
}

/** Concurrent startup callers share one UMP/SDK bootstrap operation. */
export function initializeBuklodAds(): Promise<BuklodAdsState> {
  if (!startupPromise) {
    startupPromise = initializeBuklodAdsInternal().finally(() => {
      startupPromise = null;
    });
  }
  return startupPromise;
}

export async function refreshBuklodAdConsent():
  Promise<BuklodAdsState> {

  await gatherConsentOnce();
  const ready = await startGoogleMobileAdsIfAllowed();
  const consentInfo = await AdsConsent.getConsentInfo();

  return {
    ready,
    canRequestAds: consentInfo.canRequestAds,
    consentRefreshPending: false,
  };
}

export async function getBuklodAdConsentState() {
  return AdsConsent
    .getConsentInfo();
}