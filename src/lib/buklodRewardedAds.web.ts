/** Web bundle cannot use Android native rewarded-ad SDK. */
export type BuklodRewardedAdResult = { shown: boolean; earned: boolean; reward: null };
export function warmBuklodRewardedAd(): void {}
export async function showBuklodRewardedAd(): Promise<BuklodRewardedAdResult> {
  return { shown: false, earned: false, reward: null };
}
