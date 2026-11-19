/** Build/runtime isolation; source declarations never prove actual Android device support. */
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { isGenesisPreviewBuild } from './genesisContract';
export const GENESIS_NATIVE_RUNTIME = '2.0.0-genesis-preview';
export function resolveGenesisNativeFoundation(preview: boolean, platform: string, runtime: string | null | undefined) {
  const eligible = preview && platform === 'android' && runtime === GENESIS_NATIVE_RUNTIME;
  return { runtime: runtime ?? null, cosmeticHaptics: eligible, documentPicker: eligible,
    riveEligible: eligible, audioEligible: eligible, deviceVerified: false };
}
export function getGenesisNativeFoundation() {
  return resolveGenesisNativeFoundation(isGenesisPreviewBuild(), Platform.OS, Updates.runtimeVersion);
}
