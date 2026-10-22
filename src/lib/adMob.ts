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
};

export async function initializeBuklodAds():
  Promise<BuklodAdsState> {

  await configureAdRequests();

  /*
   * Previous-session consent may already
   * allow ads while UMP refreshes.
   */
  let ready = false;

  try {
    ready =
      await startGoogleMobileAdsIfAllowed();
  }
  catch (error) {
    console.warn(
      'BUKLOD Ads previous consent check:',
      error
    );
  }

  /*
   * Refresh consent information each launch
   * and present the Google UMP form if required.
   */
  try {
    await AdsConsent
      .gatherConsent();
  }
  catch (error) {
    console.warn(
      'BUKLOD UMP consent refresh:',
      error
    );
  }

  if (!ready) {
    try {
      ready =
        await startGoogleMobileAdsIfAllowed();
    }
    catch (error) {
      console.warn(
        'BUKLOD Ads SDK initialization:',
        error
      );
    }
  }

  const consentInfo =
    await AdsConsent
      .getConsentInfo();

  return {
    ready,
    canRequestAds:
      consentInfo.canRequestAds,
  };
}

export async function refreshBuklodAdConsent():
  Promise<BuklodAdsState> {

  try {
    await AdsConsent
      .gatherConsent();
  }
  catch (error) {
    console.warn(
      'BUKLOD UMP consent refresh:',
      error
    );
  }

  const ready =
    await startGoogleMobileAdsIfAllowed();

  const consentInfo =
    await AdsConsent
      .getConsentInfo();

  return {
    ready,
    canRequestAds:
      consentInfo.canRequestAds,
  };
}

export async function getBuklodAdConsentState() {
  return AdsConsent
    .getConsentInfo();
}