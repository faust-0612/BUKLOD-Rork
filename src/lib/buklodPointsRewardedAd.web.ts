/** Browsers cannot use Android native AdMob; never fake a rewarded credit. */
export async function showBuklodPointsVerifiedAd(
  _userId: string, _nonce: string,
): Promise<{ shown: boolean; earned: boolean }> {
  return { shown: false, earned: false };
}
