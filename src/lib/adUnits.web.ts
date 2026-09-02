export const BUKLOD_AD_TEST_MODE = false;

export const BUKLOD_AD_UNITS = {
  banner: '',
  interstitial: '',
  rewarded: '',
  appOpen: '',
} as const;

export function hasProductionAdUnits() {
  return false;
}
