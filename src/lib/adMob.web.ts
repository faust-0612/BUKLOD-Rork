export type BuklodAdsState = {
  ready: boolean;
  canRequestAds: boolean;
};

const WEB_AD_STATE: BuklodAdsState = {
  ready: false,
  canRequestAds: false,
};

export async function initializeBuklodAds():
  Promise<BuklodAdsState> {
  return WEB_AD_STATE;
}

export async function refreshBuklodAdConsent():
  Promise<BuklodAdsState> {
  return WEB_AD_STATE;
}

export async function getBuklodAdConsentState() {
  return {
    canRequestAds: false,
    status: null,
  };
}
