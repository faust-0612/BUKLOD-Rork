import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
  type RewardedAdReward,
} from 'react-native-google-mobile-ads';

import {
  initializeBuklodAds,
} from '@/lib/buklodAds';
import {
  buklodAdsTestMode,
} from '@/lib/buklodAdUnits';

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
let warmedCleanup: Array<() => void> = [];

function cleanupWarmedListeners() {
  warmedCleanup.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch {}
  });
  warmedCleanup = [];
}

function resetWarmedAd() {
  cleanupWarmedListeners();
  warmedAd = null;
  warmedLoaded = false;
}

async function prepareRewardedAd(): Promise<boolean> {
  const ready = await initializeBuklodAds();
  if (!ready) return false;

  const unitId = getBuklodRewardedUnitId();
  if (!unitId) return false;

  if (warmedAd && warmedLoaded) return true;
  if (warmedAd) return false;

  const ad = RewardedAd.createForAdRequest(unitId, {
    requestNonPersonalizedAdsOnly: false,
  });

  warmedAd = ad;

  warmedCleanup.push(
    ad.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => {
        warmedLoaded = true;
      },
    ),
  );

  warmedCleanup.push(
    ad.addAdEventListener(
      AdEventType.ERROR,
      () => {
        resetWarmedAd();
      },
    ),
  );

  ad.load();
  return false;
}

export function warmBuklodRewardedAd() {
  void prepareRewardedAd();
}

export async function showBuklodRewardedAd(
  onEarnedNonCashBenefit?: (
    reward: RewardedAdReward,
  ) => void | Promise<void>,
): Promise<BuklodRewardedAdResult> {
  await prepareRewardedAd();

  if (!warmedAd || !warmedLoaded) {
    return {
      shown: false,
      earned: false,
      reward: null,
    };
  }

  const ad = warmedAd;
  let earnedReward: RewardedAdReward | null = null;
  let earnedHandled = false;

  return await new Promise<BuklodRewardedAdResult>((resolve) => {
    let settled = false;

    const finish = (shown: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribeEarned();
      unsubscribeClosed();
      unsubscribeError();
      resetWarmedAd();
      void prepareRewardedAd();
      resolve({
        shown,
        earned: Boolean(earnedReward),
        reward: earnedReward,
      });
    };

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
      LOAD_TIMEOUT_MS,
    );

    void ad.show().catch((error) => {
      console.warn('BUKLOD rewarded show:', error);
      finish(false);
    });
  });
}
