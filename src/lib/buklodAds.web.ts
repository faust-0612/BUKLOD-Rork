export function initializeBuklodAds():
  Promise<boolean> {
  return Promise.resolve(false);
}

export async function getBuklodAdsDiagnostics() {
  return {
    testMode: false,
    canRequestAds: false,
    consentStatus: null,
    interstitialConfigured: false,
    fill: null,
  };
}

export function warmBuklodInterstitial() {
  // AdMob is native-only. No-op on web.
}

export async function maybeShowBuklodInterstitial(
  _reason:
    | 'devotional_completed'
    | 'lesson_completed'
    | 'reading_session_completed'
    | 'content_session_completed'
): Promise<boolean> {
  return false;
}
