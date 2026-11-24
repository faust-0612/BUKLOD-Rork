import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { GENESIS_GODOT_OTA_PACK } from '../../src/features/season2/genesis/godotPackManifest.generated';

export type GodotWorld = 'arena' | 'kingdom' | 'community' | 'house';
type GodotNative = {
  openApprovedPack: (privateFileUri: string, expectedSha256: string) => Promise<boolean>;
  openApprovedWorldPack?: (privateFileUri: string, expectedSha256: string, world: GodotWorld) => Promise<boolean>;
  getGodotCapabilities?: () => Promise<{ engine: string; format: string; packUpdate: boolean; worlds: string[] }>;
  openBundledArena: () => Promise<boolean>;
  openBundledWorld: (world: string) => Promise<boolean>;
};

function nativeGodotEnabled(): boolean {
  return Platform.OS === 'android' &&
    process.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW === 'true' &&
    process.env.EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED === 'true';
}

function nativeApi(): GodotNative | null {
  try { return requireOptionalNativeModule<GodotNative>('BuklodGenesisGodot'); }
  catch { return null; }
}

export type GenesisOtaLaunchStage = 'disabled' | 'native_missing' | 'invalid_manifest' |
  'incompatible_native' | 'asset_unavailable' | 'cancelled' | 'native_rejected' | 'dispatched';
export type GenesisOtaLaunchResult = { stage: GenesisOtaLaunchStage; packSha256: string };
const report = (stage: GenesisOtaLaunchStage): GenesisOtaLaunchResult => ({
  stage, packSha256: GENESIS_GODOT_OTA_PACK.sha256,
});
async function inspectAndLaunchOtaPack(world: GodotWorld, api: GodotNative,
  canLaunch: () => boolean): Promise<GenesisOtaLaunchResult> {
  if (process.env.EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V206 !== 'true') return report('disabled');
  if (!api.openApprovedWorldPack || !api.getGodotCapabilities) return report('incompatible_native');
  if (GENESIS_GODOT_OTA_PACK.engine !== '4.7.2' ||
      !/^[a-f0-9]{64}$/.test(GENESIS_GODOT_OTA_PACK.sha256) ||
      GENESIS_GODOT_OTA_PACK.bytes < 500 ||
      GENESIS_GODOT_OTA_PACK.bytes > 256 * 1024 * 1024) return report('invalid_manifest');
  if (!canLaunch()) return report('cancelled');
  try {
    const capability = await api.getGodotCapabilities();
    if (capability.engine !== GENESIS_GODOT_OTA_PACK.engine ||
        capability.format !== 'zip' || capability.packUpdate !== true ||
        !capability.worlds.includes(world)) return report('incompatible_native');
  } catch { return report('incompatible_native'); }
  if (!canLaunch()) return report('cancelled');
  let uri: string | null = null;
  try {
    // Only the release-controlled bundled asset; never accept external URLs.
    const asset = Asset.fromModule(require('../../assets/season2/genesis/ota/empire-arena.zip'));
    await asset.downloadAsync();
    uri = asset.localUri;
    if (!uri || !uri.startsWith('file://')) return report('asset_unavailable');
  } catch { return report('asset_unavailable'); }
  if (!canLaunch()) return report('cancelled');
  try {
    const dispatched = await api.openApprovedWorldPack(uri, GENESIS_GODOT_OTA_PACK.sha256, world);
    // Activity dispatch is not engine-ready. Native readiness needs Android evidence.
    return report(dispatched ? 'dispatched' : 'native_rejected');
  } catch { return report('native_rejected'); }
}

/** Strict 206 preview entry; never silently open an older embedded game. */
export async function launchGenesisOtaWorld(world: GodotWorld,
  canLaunch: () => boolean = () => true): Promise<GenesisOtaLaunchResult> {
  if (!nativeGodotEnabled() || process.env.EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_V206 !== 'true' ||
      !['staging','preview','development','dev'].includes((process.env.EXPO_PUBLIC_APP_ENV || '').toLowerCase()) ||
      (world !== 'arena' && process.env.EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS !== 'true')) return report('disabled');
  const api = nativeApi();
  return api ? inspectAndLaunchOtaPack(world, api, canLaunch) : report('native_missing');
}

// Legacy explicit launchers retain their existing offline fallback. The strict
// 206 world entry above never uses these fallback wrappers.
async function tryOtaMainPack(world: GodotWorld, api: GodotNative): Promise<boolean> {
  return (await inspectAndLaunchOtaPack(world, api, () => true)).stage === 'dispatched';
}

export async function openVerifiedGenesisKingdomPack(privateFileUri: string, expectedSha256: string): Promise<boolean> {
  if (!nativeGodotEnabled() || !/^file:\/\//.test(privateFileUri) ||
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
