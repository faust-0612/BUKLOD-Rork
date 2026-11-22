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

/**
 * Play the real Godot 4.7.2 Arena scene bundled INSIDE this signed staging APK.
 * Never loads a remote PCK or grants match/leaderboard/financial rewards.
 * Production, web and existing staging runtimes fail closed.
 */
export async function openBundledEmpireArena(): Promise<boolean> {
  if (Platform.OS !== 'android' ||
      process.env.EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED !== 'true' ||
      process.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW !== 'true') return false;
  try {
    const api = requireOptionalNativeModule<{openBundledArena: () => Promise<boolean>}>('BuklodGenesisGodot');
    return (await api?.openBundledArena()) ?? false;
  } catch {
    return false;
  }
}

/** Native only, additional guarded worlds in the same BUKLOD MAIN APK.
 * Never accepts a server URL, script source, path, or economy mutation.
 */
export type BuklodGodotWorld = 'kingdom' | 'community' | 'house';
export async function openBundledBuklodWorld(world: BuklodGodotWorld): Promise<boolean> {
  if (Platform.OS !== 'android' ||
      process.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW !== 'true' ||
      process.env.EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED !== 'true' ||
      process.env.EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS !== 'true' ||
      !(['kingdom','community','house'] as string[]).includes(world)) return false;
  try {
    const api = requireOptionalNativeModule<{openBundledWorld: (w: string) => Promise<boolean>}>('BuklodGenesisGodot');
    return (await api?.openBundledWorld(world)) ?? false;
  } catch {
    return false;
  }
}
