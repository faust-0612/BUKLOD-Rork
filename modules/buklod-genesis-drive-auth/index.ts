import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export type UnverifiedDriveConsent = {
  accessToken: string;
  expectedBuklodUserId: string;
  requiresIdentityVerification: true;
  scopes: string[];
};
type NativeDrive = {
  beginUserDriveConsent: (buklodUserId: string) => Promise<UnverifiedDriveConsent>;
  disconnectDriveAuth: () => Promise<boolean>;
};
function native(): NativeDrive | null {
  if (Platform.OS !== 'android' ||
      process.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW !== 'true') return null;
  return requireOptionalNativeModule<NativeDrive>('BuklodGenesisDriveAuth');
}
/**
 * Never call this from app startup. An explicit signed-in user's action must
 * initiate consent; any returned token is UNVERIFIED and may not access Drive
 * until Google subject and the BUKLOD account are independently bound.
 * Do not log, save, or transmit tokens to BUKLOD services.
 */
export async function beginUnverifiedGenesisDriveConsent(
  currentAuthenticatedBuklodUserId: string,
): Promise<UnverifiedDriveConsent | null> {
  if (!/^[0-9a-fA-F-]{36}$/.test(currentAuthenticatedBuklodUserId)) return null;
  try {
    const result = await native()?.beginUserDriveConsent(currentAuthenticatedBuklodUserId);
    if (!result?.requiresIdentityVerification ||
        result.expectedBuklodUserId !== currentAuthenticatedBuklodUserId) return null;
    return result;
  } catch { return null; }
}
export async function disconnectGenesisDriveAuth(): Promise<boolean> {
  try { return (await native()?.disconnectDriveAuth()) ?? false; }
  catch { return false; }
}
