import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type GodotNative = { openApprovedPack: (privateFileUri: string, expectedSha256: string) => Promise<boolean> };
/**
 * Native engine ships with Genesis APK but no 3D artwork or game is enabled.
 * Future approved manifest must provide the expected SHA-256 and pack asset.
 */
export async function openVerifiedGenesisKingdomPack(
  privateFileUri: string, expectedSha256: string,
): Promise<boolean> {
  if (Platform.OS !== 'android' || process.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW !== 'true')
    return false;
  if (!/^file:\/\//.test(privateFileUri) || !/^[a-f0-9]{64}$/.test(expectedSha256)) return false;
  try {
    const api = requireOptionalNativeModule<GodotNative>('BuklodGenesisGodot');
    return (await api?.openApprovedPack(privateFileUri, expectedSha256)) ?? false;
  } catch { return false; }
}
