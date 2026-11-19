import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type Status = {
  supported: boolean;
  available: boolean;
  immediateAllowed: boolean;
  availableVersionCode: number;
  updateAvailability?: number;
};
type PlayUpdatesNative = {
  checkPlayUpdate: () => Promise<Status>;
  startImmediateUpdate: (requiredVersionCode: number) => Promise<boolean>;
};

const unavailable: Status = {
  supported: false, available: false, immediateAllowed: false, availableVersionCode: 0,
};
/**
 * Staging APK bundles the module so future compatible JS can use it.
 * Play prompts are NOT automatically initiated and never block sideloaded staging.
 */
function api(): PlayUpdatesNative | null {
  if (Platform.OS !== 'android') return null;
  return requireOptionalNativeModule<PlayUpdatesNative>('BuklodGenesisPlayUpdates');
}
export async function getPlayNativeUpdateStatus(): Promise<Status> {
  try { return (await api()?.checkPlayUpdate()) ?? unavailable; }
  catch { return unavailable; }
}
export async function requestPlayImmediateUpdate(requiredVersionCode: number): Promise<boolean> {
  if (!Number.isSafeInteger(requiredVersionCode) || requiredVersionCode < 1) return false;
  try { return (await api()?.startImmediateUpdate(requiredVersionCode)) ?? false; }
  catch { return false; }
}
