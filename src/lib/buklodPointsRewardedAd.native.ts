import { Platform } from 'react-native';
import {
  AdEventType, RewardedAd, RewardedAdEventType, TestIds,
} from 'react-native-google-mobile-ads';
import { initializeBuklodAds } from '@/lib/buklodAds';
import { buklodAdsTestMode } from '@/lib/buklodAdUnits';
import { isBuklodRewardedAdAllowed } from '@/lib/buklodGlobalAdController';
import { recordBuklodAdEvent } from '@/lib/buklodAdDiagnostics';

const REWARD_DIAGNOSTICS = {
  placementId: 'rewarded_points_bonus',
  route: '/points',
  adFormat: 'rewarded' as const,
};
function recordRewarded(event: Parameters<typeof recordBuklodAdEvent>[1], error?: unknown) {
  recordBuklodAdEvent('rewarded_optional', event, error, REWARD_DIAGNOSTICS);
}

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
    recordRewarded('ad_request');
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
      const onLoad = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        recordRewarded('ad_loaded');
        done(true);
      });
      const onError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
        recordRewarded('ad_failed', error);
        done(false);
      });
      const timer = setTimeout(() => {
        recordRewarded('ad_failed', 'AD_TIMEOUT');
        done(false);
      }, 12000);
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
        clearTimeout(timer); onEarned(); onClosed(); onError(); onOpened(); onImpression();
        resolve({ shown, earned });
      };
      const onEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      });
      const onOpened = ad.addAdEventListener(AdEventType.OPENED, () => {
        recordRewarded('ad_opened');
      });
      const onImpression = ad.addAdEventListener(AdEventType.IMPRESSION, () => {
        recordRewarded('ad_impression');
      });
      const onClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        recordRewarded('ad_dismissed');
        finish(true);
      });
      const onError = ad.addAdEventListener(AdEventType.ERROR, error => {
        recordRewarded('ad_failed', error);
        finish(false);
      });
      const timer = setTimeout(() => {
        recordRewarded('ad_failed', 'AD_TIMEOUT');
        finish(false);
      }, 120000);
      void ad.show().catch(error => {
        recordRewarded('ad_failed', error);
        finish(false);
      });
    });
  } finally {
    rewardInFlight = false;
  }
}
