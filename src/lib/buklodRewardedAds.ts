import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
  type RewardedAdReward,
} from 'react-native-google-mobile-ads';

import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { isBuklodRewardedAdAllowed, getBuklodGlobalAdSafetySnapshot, acquireBuklodAdSafetyLock } from '@/lib/buklodGlobalAdController';
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

  if (showing || !ready || !warmedAd || !warmedLoaded) {
    return {
      shown: false,
      earned: false,
      reward: null,
    };
  }

  const ad = warmedAd;
  let earnedReward: RewardedAdReward | null = null;
  let earnedHandled = false;
  showing = true;

  return await new Promise<BuklodRewardedAdResult>((resolve) => {
    let settled = false;

    const finish = (shown: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
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

/** Dedicated opt-in placement. Never grant a cosmetic from EARNED_REWARD alone. */
const NO_RANK_BONUS_AD: BuklodRewardedAdResult={shown:false,earned:false,reward:null};
function rankBonusAdAllowed(){
 const safety=getBuklodGlobalAdSafetySnapshot();
 return !buklodAdsTestMode && safety.pathname==='/points/progression' &&
  safety.remoteFeatures.rank_bonus_redemption===true &&
  !safety.fullScreenReserved && !safety.fullScreenCadenceCheckInFlight &&
  isBuklodRewardedAdAllowed('rank_bonus_collection');
}
export async function showBuklodRankBonusAd(userId:string,bonusKey:string):Promise<BuklodRewardedAdResult>{
 if(showing||!rankBonusAdAllowed()||!/^rank-frame-(0[1-9]|[1-3][0-9]|40)$/.test(bonusKey))return NO_RANK_BONUS_AD;
 const unit=clean(process.env.EXPO_PUBLIC_ADMOB_RANK_BONUS_UNIT_ID);
 if(!/^ca-app-pub-\d+\/\d+$/.test(unit))return NO_RANK_BONUS_AD;
 showing=true;
 try{
  const {data:auth}=await supabase.auth.getSession();
  if(auth.session?.user.id!==userId||!await initializeBuklodAds()||!rankBonusAdAllowed())return NO_RANK_BONUS_AD;
  const response=await withBuklodTimeout(supabase.functions.invoke('buklod-rank-bonus-ssv',{body:{bonusKey}}),10000,'Rank bonus session');
  const data=response.data;
  if(response.error||typeof data?.sessionId!=='string'||!/^\d+$/.test(String(data?.adUnitNumber))||
    !unit.endsWith('/'+data.adUnitNumber)||!rankBonusAdAllowed())return NO_RANK_BONUS_AD;
  const ad=RewardedAd.createForAdRequest(unit,{serverSideVerificationOptions:{userId:data.sessionId,customData:data.sessionId}});
  const loaded=await new Promise<boolean>(resolve=>{
    let settled=false,offLoad=()=>{},offError=()=>{};
    const timer=setTimeout(()=>finish(false),LOAD_TIMEOUT_MS);
    function finish(ok:boolean){if(settled)return;settled=true;clearTimeout(timer);offLoad();offError();resolve(ok);}
    try{
      offLoad=ad.addAdEventListener(RewardedAdEventType.LOADED,()=>finish(true));
      offError=ad.addAdEventListener(AdEventType.ERROR,()=>finish(false));
      ad.load();
    }catch{finish(false);}
  });
  const {data:current}=await supabase.auth.getSession();
  if(!loaded||current.session?.user.id!==userId||!rankBonusAdAllowed())return NO_RANK_BONUS_AD;
  const release=acquireBuklodAdSafetyLock('transaction');
  try{
    return await new Promise<BuklodRewardedAdResult>(resolve=>{
      let settled=false,reward:RewardedAdReward|null=null,offEarned=()=>{},offClose=()=>{},offError=()=>{};
      const timer=setTimeout(()=>finish(false),SHOW_FAILSAFE_TIMEOUT_MS);
      function finish(shown:boolean){if(settled)return;settled=true;clearTimeout(timer);offEarned();offClose();offError();resolve({shown,earned:!!reward,reward});}
      try{
        offEarned=ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD,r=>{reward=r;});
        offClose=ad.addAdEventListener(AdEventType.CLOSED,()=>finish(true));
        offError=ad.addAdEventListener(AdEventType.ERROR,()=>finish(false));
        void ad.show().catch(()=>finish(false));
      }catch{finish(false);}
    });
  }finally{release();}
 }catch{return NO_RANK_BONUS_AD;}
 finally{showing=false;}
}
