import type { NativeAd } from 'react-native-google-mobile-ads';

// Type-safe non-Android compatibility exports. Metro resolves the Android
// implementation on Android, while web/iOS have no native AdMob inventory.
type State = 'none' | 'loading' | 'ready' | 'failed';
export function clearBuklodDashboardAdPreloads(): void {}
export function subscribeBuklodDashboardAdPreload(_id: string, _fn: () => void): () => void {
  return () => {};
}
export function getBuklodDashboardAdPreloadState(_id: string, _unitId: string): State {
  return 'none';
}
export function noteBuklodDashboardNativeAdOwned(_id: string): void {}
export function releaseBuklodDashboardNativeAdOwned(_id: string): void {}
export function takeBuklodDashboardAdPreload(_id: string, _unitId: string): NativeAd | null {
  return null;
}
export default function BuklodDashboardAdWarmup() { return null; }
