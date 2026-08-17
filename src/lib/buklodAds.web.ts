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
  };
}

export function warmBuklodInterstitial() {
  // Google Mobile Ads is native-only in BUKLOD.
  // Web intentionally performs no ad warm-up.
}

export async function maybeShowBuklodInterstitial(
  reason:
    | 'devotional_completed'
    | 'lesson_completed'
    | 'reading_session_completed'
    | 'content_session_completed'
): Promise<boolean> {
  void reason;

  // No native Google Mobile Ads SDK on web.
  return false;
}
