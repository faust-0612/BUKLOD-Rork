import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
  type PaidEvent,
  type RewardedAdReward,
} from 'react-native-google-mobile-ads';

import {
  initializeBuklodAds,
} from '@/lib/buklodAds';
import {
  buklodAdsTestMode,
} from '@/lib/buklodAdUnits';

import {
  recordBuklodAdMobPaidEvent,
} from '@/lib/buklodFbcFinance';

/**
 * Rewarded ads are strictly opt-in. This module never grants Circle Points,
 * cash, revenue-share credit, Bayanihan value, or any other transferable /
 * redeemable value. A caller may attach only an explicit non-cash in-app
 * benefit after EARNED_REWARD fires.
 */

export type BuklodRewardedAdResult = {
  shown: boolean;
  earned: boolean;
  reward: RewardedAdReward | null;
};

const LOAD_TIMEOUT_MS = 10_000;
const SHOW_FAILSAFE_TIMEOUT_MS = 5 * 60 * 1000;

function clean(value: string | undefined) {
  return String(value ?? '').trim();
}

function getBuklodRewardedUnitId(): string | null {
  if (buklodAdsTestMode) {
    return TestIds.REWARDED;
  }

  return (
    clean(
      process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID,
    ) || null
  );
}

let warmedAd: RewardedAd | null = null;
let warmedLoaded = false;
let loadingPromise: Promise<boolean> | null = null;
let showing = false;

function clearWarmedAd(ad?: RewardedAd) {
  if (ad && warmedAd !== ad) return;
  warmedAd = null;
  warmedLoaded = false;
  loadingPromise = null;
}

async function prepareRewardedAd(): Promise<boolean> {
  const ready = await initializeBuklodAds();
  if (!ready) return false;

  const unitId = getBuklodRewardedUnitId();
  if (!unitId) return false;

  if (warmedAd && warmedLoaded) return true;
  if (loadingPromise) return loadingPromise;

  const ad = RewardedAd.createForAdRequest(unitId, {
    requestNonPersonalizedAdsOnly: false,
  });

  warmedAd = ad;
  warmedLoaded = false;

  loadingPromise = new Promise<boolean>((resolve) => {
    let settled = false;
    let unsubscribeLoaded = () => {};
    let unsubscribeError = () => {};

    const finishLoad = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribeLoaded();
      unsubscribeError();

      if (loaded && warmedAd === ad) {
        warmedLoaded = true;
        loadingPromise = null;
        resolve(true);
        return;
      }

      clearWarmedAd(ad);
      resolve(false);
    };

    unsubscribeLoaded = ad.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => finishLoad(true),
    );

    unsubscribeError = ad.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        console.warn('BUKLOD rewarded load:', error);
        finishLoad(false);
      },
    );

    const timeout = setTimeout(
      () => finishLoad(false),
      LOAD_TIMEOUT_MS,
    );

    ad.load();
  });

  return loadingPromise;
}

export function warmBuklodRewardedAd() {
  void prepareRewardedAd();
}

export async function showBuklodRewardedAd(
  onEarnedNonCashBenefit?: (
    reward: RewardedAdReward,
  ) => void | Promise<void>,
): Promise<BuklodRewardedAdResult> {
  if (showing) {
    return {
      shown: false,
      earned: false,
      reward: null,
    };
  }

  const ready = await prepareRewardedAd();

  if (!ready || !warmedAd || !warmedLoaded) {
    return {
      shown: false,
      earned: false,
      reward: null,
    };
  }

  const ad = warmedAd;
  const rewardedUnitId = getBuklodRewardedUnitId() ?? '';
  let earnedReward: RewardedAdReward | null = null;
  let earnedHandled = false;
  showing = true;

  return await new Promise<BuklodRewardedAdResult>((resolve) => {
    let settled = false;

    const finish = (shown: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribePaid();
      unsubscribeEarned();
      unsubscribeClosed();
      unsubscribeError();
      showing = false;
      clearWarmedAd(ad);
      void prepareRewardedAd();
      resolve({
        shown,
        earned: Boolean(earnedReward),
        reward: earnedReward,
      });
    };

    const unsubscribePaid = ad.addAdEventListener(
      AdEventType.PAID,
      (event: PaidEvent) => {
        void recordBuklodAdMobPaidEvent({
          placement: 'rewarded',
          adUnitId: rewardedUnitId,
          value: event.value,
          currency: event.currency,
          precision: event.precision,
        });
      },
    );

    const unsubscribeEarned = ad.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      (reward) => {
        earnedReward = reward;
        if (!earnedHandled && onEarnedNonCashBenefit) {
          earnedHandled = true;
          void Promise.resolve(
            onEarnedNonCashBenefit(reward),
          ).catch((error) => {
            console.warn(
              'BUKLOD rewarded benefit callback:',
              error,
            );
          });
        }
      },
    );

    const unsubscribeClosed = ad.addAdEventListener(
      AdEventType.CLOSED,
      () => finish(true),
    );

    const unsubscribeError = ad.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        console.warn('BUKLOD rewarded ad:', error);
        finish(false);
      },
    );

    const timeout = setTimeout(
      () => finish(false),
      SHOW_FAILSAFE_TIMEOUT_MS,
    );

    void ad.show().catch((error) => {
      console.warn('BUKLOD rewarded show:', error);
      finish(false);
    });
  });
}
