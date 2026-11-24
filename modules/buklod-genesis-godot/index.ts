import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { GENESIS_GODOT_OTA_PACK } from '../../src/features/season2/genesis/godotPackManifest.generated';

type GodotWorld = 'arena' | 'kingdom' | 'community' | 'house';
type GodotNative = {
  openApprovedPack: (privateFileUri: string, expectedSha256: string) => Promise<boolean>;
  openApprovedWorldPack?: (privateFileUri: string, expectedSha256: string, world: GodotWorld) => Promise<boolean>;
  getGodotCapabilities?: () => Promise<{ engine: string; format: string; packUpdate: boolean; bootstrapProtocol?: number; worlds: string[] }>;
  getGodotLaunchStatus?: () => Promise<GenesisLaunchStatus>;
  openBundledArena: () => Promise<boolean>;
  openBundledWorld: (world: string) => Promise<boolean>;
};

export type GenesisLaunchStatus = { state: string; world?: string; pack?: string; reason?: string; token?: string };
export async function getGenesisLaunchStatus(): Promise<GenesisLaunchStatus> {
  try { return (await nativeApi()?.getGodotLaunchStatus?.()) ?? {state:'unavailable'}; }
  catch { return {state:'unavailable'}; }
}
export function isGenesisBootstrapEnabled(): boolean {
  return nativeGodotEnabled() && process.env.EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V207 === 'true' &&
    process.env.EXPO_PUBLIC_APP_ENV === 'staging';
}
function nativeGodotEnabled(): boolean {
  return Platform.OS === 'android' &&
    process.env.EXPO_PUBLIC_APP_ENV === 'staging' &&
    process.env.EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V207 === 'true' &&
    process.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW === 'true' &&
    process.env.EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED === 'true';
}

function nativeApi(): GodotNative | null {
  try { return requireOptionalNativeModule<GodotNative>('BuklodGenesisGodot'); }
  catch { return null; }
}

async function tryOtaMainPack(world: GodotWorld, api: GodotNative): Promise<boolean> {
  // Fails closed on all pre-2.0.6 runtimes; never fetches arbitrary URLs.
  if (process.env.EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V206 !== 'true' ||
      !api.openApprovedWorldPack || !api.getGodotCapabilities ||
      GENESIS_GODOT_OTA_PACK.engine !== '4.7.2' ||
      !/^[a-f0-9]{64}$/.test(GENESIS_GODOT_OTA_PACK.sha256) ||
      GENESIS_GODOT_OTA_PACK.bytes < 500 ||
      GENESIS_GODOT_OTA_PACK.bytes > 256 * 1024 * 1024) return false;
  try {
    const capability = await api.getGodotCapabilities();
    if (capability.bootstrapProtocol !== 1 || capability.engine !== GENESIS_GODOT_OTA_PACK.engine ||
        capability.format !== 'zip' || capability.packUpdate !== true ||
        !capability.worlds.includes(world)) return false;
    // Statically packaged, release-controlled binary asset from this OTA update.
    // No user-supplied URL, CDN host, arbitrary hash, or external file picker.
    const asset = Asset.fromModule(require('../../assets/season2/genesis/ota/empire-arena.zip'));
    await asset.downloadAsync();
    const uri = asset.localUri;
    if (!uri || !uri.startsWith('file://')) return false;
    return await api.openApprovedWorldPack(uri, GENESIS_GODOT_OTA_PACK.sha256, world);
  } catch { return false; }
}

export async function openVerifiedGenesisKingdomPack(privateFileUri: string, expectedSha256: string): Promise<boolean> {
  if (!isGenesisBootstrapEnabled() || !/^file:\/\//.test(privateFileUri) ||
      !/^[a-f0-9]{64}$/.test(expectedSha256)) return false;
  try { return (await nativeApi()?.openApprovedPack(privateFileUri, expectedSha256)) ?? false; }
  catch { return false; }
}

/** One native engine: OTA content first, signed-APK embedded pack fallback. */
export async function openBundledEmpireArena(): Promise<boolean> {
  if (!nativeGodotEnabled()) return false;
  const api = nativeApi();
  if (!api) return false;
  if (await tryOtaMainPack('arena', api)) return true;
  try { return await api.openBundledArena(); }
  catch { return false; }
}

export type BuklodGodotWorld = 'kingdom' | 'community' | 'house';
export async function openBundledBuklodWorld(world: BuklodGodotWorld): Promise<boolean> {
  if (!nativeGodotEnabled() ||
      process.env.EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS !== 'true' ||
      !(['kingdom', 'community', 'house'] as string[]).includes(world)) return false;
  const api = nativeApi();
  if (!api) return false;
  if (await tryOtaMainPack(world, api)) return true;
  try { return await api.openBundledWorld(world); }
  catch { return false; }
}
