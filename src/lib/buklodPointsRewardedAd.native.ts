import { Platform } from 'react-native';
import {
  AdEventType, RewardedAd, RewardedAdEventType, TestIds,
} from 'react-native-google-mobile-ads';
import { initializeBuklodAds } from '@/lib/buklodAds';
import { buklodAdsTestMode } from '@/lib/buklodAdUnits';
import { isBuklodRewardedAdAllowed } from '@/lib/buklodGlobalAdController';

let rewardInFlight = false;

/**
 * A separate ad instance guarantees SSV userId/nonce are attached BEFORE loading.
 * Never trust the local earned event to mutate Points; only Google's signed
 * callback via buklod-admob-points-ssv is allowed to credit the ledger.
 */
export async function showBuklodPointsVerifiedAd(
  userId: string, nonce: string,
): Promise<{ shown: boolean; earned: boolean }> {
  if (Platform.OS !== 'android' || rewardInFlight ||
      !isBuklodRewardedAdAllowed('rewarded_generic')) {
    return { shown: false, earned: false };
  }
  const initialized = await initializeBuklodAds();
  const unit = buklodAdsTestMode
    ? TestIds.REWARDED
    : String(process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID ?? '').trim();
  if (!initialized || !unit) return { shown: false, earned: false };

  rewardInFlight = true;
  try {
    const ad = RewardedAd.createForAdRequest(unit, {
      requestNonPersonalizedAdsOnly: false,
      serverSideVerificationOptions: { userId, customData: nonce },
    });

    const loaded = await new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer); onLoad(); onError(); resolve(ok);
      };
      const onLoad = ad.addAdEventListener(RewardedAdEventType.LOADED, () => done(true));
      const onError = ad.addAdEventListener(AdEventType.ERROR, () => done(false));
      const timer = setTimeout(() => done(false), 12000);
      ad.load();
    });
    if (!loaded || !isBuklodRewardedAdAllowed('rewarded_generic')) {
      return { shown: false, earned: false };
    }

    return await new Promise<{ shown: boolean; earned: boolean }>((resolve) => {
      let settled = false;
      let earned = false;
      const finish = (shown: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer); onEarned(); onClosed(); onError();
        resolve({ shown, earned });
      };
      const onEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      });
      const onClosed = ad.addAdEventListener(AdEventType.CLOSED, () => finish(true));
      const onError = ad.addAdEventListener(AdEventType.ERROR, () => finish(false));
      const timer = setTimeout(() => finish(false), 120000);
      void ad.show().catch(() => finish(false));
    });
  } finally {
    rewardInFlight = false;
  }
}
