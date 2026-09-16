import AsyncStorage
  from '@react-native-async-storage/async-storage';

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
  INTERSTITIAL_COOLDOWN_MS,
  INTERSTITIAL_MIN_EVENT_COUNT,
} from '@/lib/buklodAdMonetizationPolicy';

import {
  buklodAdsTestMode,
  getBuklodInterstitialUnitId,
} from '@/lib/buklodAdUnits';

import {
  isBuklodAdLightPassActive,
} from '@/lib/buklodAdLightPass';

export async function initializeBuklodAds():
  Promise<boolean> {
  try {
    const state =
      await initializeBuklodAdsSdk();

    return state.ready && state.canRequestAds;
  } catch (error) {
    console.warn(
      'BUKLOD Ads initialization:',
      error
    );
    return false;
  }
}


export async function
getBuklodAdsDiagnostics() {

  let consent:
    Awaited<
      ReturnType<
        typeof AdsConsent.getConsentInfo
      >
    > |
    null =
    null;


  try {
    consent =
      await AdsConsent
        .getConsentInfo();
  }
  catch {
    consent = null;
  }


  return {
    testMode:
      buklodAdsTestMode,

    canRequestAds:
      consent?.canRequestAds ??
      false,

    consentStatus:
      consent?.status ??
      null,

    interstitialConfigured:
      Boolean(
        getBuklodInterstitialUnitId()
      ),

    fill:
      getBuklodAdDiagnosticsSummary(),
  };
}



/*
 * ===========================================================
 * INTERSTITIAL ENGINE
 *
 * NO automatic every-tap ads.
 *
 * A caller must explicitly invoke this only at a natural
 * transition such as:
 *
 * - completed devotional
 * - completed lesson/content session
 * - leaving a longer reading session
 *
 * Frequency is platform-configured. Android intentionally uses
 * a heavier cadence while web/iOS retain the conservative defaults.
 * ===========================================================
 */

const INTERSTITIAL_LAST_KEY =
  '@buklod/ad/interstitial-last';

const INTERSTITIAL_COUNT_KEY =
  '@buklod/ad/interstitial-count';

const MIN_EVENT_COUNT =
  INTERSTITIAL_MIN_EVENT_COUNT;

const COOLDOWN_MS =
  INTERSTITIAL_COOLDOWN_MS;


let interstitial:
  InterstitialAd | null =
  null;

let interstitialLoaded =
  false;

let listenerCleanup:
  (() => void)[] =
  [];


function cleanupInterstitialListeners() {

  listenerCleanup.forEach(
    (fn) => {
      try {
        fn();
      }
      catch {}
    }
  );

  listenerCleanup = [];
}


async function prepareInterstitial() {

  const ready =
    await initializeBuklodAds();


  if (!ready) {
    return;
  }


  const unitId =
    getBuklodInterstitialUnitId();


  if (!unitId) {
    return;
  }


  if (interstitial) {
    return;
  }


  interstitial =
    InterstitialAd
      .createForAdRequest(
        unitId
      );


  listenerCleanup.push(
    interstitial
      .addAdEventListener(
        AdEventType.LOADED,
        () => {
          interstitialLoaded =
            true;
        }
      )
  );


  listenerCleanup.push(
    interstitial
      .addAdEventListener(
        AdEventType.CLOSED,
        () => {
          interstitialLoaded =
            false;

          cleanupInterstitialListeners();

          interstitial =
            null;

          void prepareInterstitial();
        }
      )
  );


  listenerCleanup.push(
    interstitial
      .addAdEventListener(
        AdEventType.ERROR,
        () => {
          interstitialLoaded =
            false;

          cleanupInterstitialListeners();

          interstitial =
            null;
        }
      )
  );


  interstitial.load();
}


export function warmBuklodInterstitial() {
  void prepareInterstitial();
}


export async function
maybeShowBuklodInterstitial(
  reason:
    | 'devotional_completed'
    | 'lesson_completed'
    | 'reading_session_completed'
    | 'content_session_completed'
): Promise<boolean> {

  /*
   * `reason` is intentionally restricted.
   * Random button taps cannot call this engine
   * without changing its type/API.
   */
  void reason;


  if (await isBuklodAdLightPassActive()) {
    await prepareInterstitial();
    return false;
  }


  const previousCount =
    Number(
      await AsyncStorage
        .getItem(
          INTERSTITIAL_COUNT_KEY
        ) ??
      '0'
    );


  const count =
    previousCount + 1;


  await AsyncStorage
    .setItem(
      INTERSTITIAL_COUNT_KEY,
      String(count)
    );


  if (
    count <
    MIN_EVENT_COUNT
  ) {
    await prepareInterstitial();

    return false;
  }


  const lastShown =
    Number(
      await AsyncStorage
        .getItem(
          INTERSTITIAL_LAST_KEY
        ) ??
      '0'
    );


  if (
    Date.now() -
      lastShown <
    COOLDOWN_MS
  ) {
    await prepareInterstitial();

    return false;
  }


  await prepareInterstitial();


  if (
    !interstitial ||
    !interstitialLoaded
  ) {
    return false;
  }


  try {

    await interstitial.show();


    await AsyncStorage
      .multiSet([
        [
          INTERSTITIAL_LAST_KEY,
          String(
            Date.now()
          ),
        ],
        [
          INTERSTITIAL_COUNT_KEY,
          '0',
        ],
      ]);


    return true;
  }
  catch (error) {

    console.warn(
      'BUKLOD interstitial:',
      error
    );

    return false;
  }
}