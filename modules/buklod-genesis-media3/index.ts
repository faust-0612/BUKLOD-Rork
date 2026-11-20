import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

export type CompressedVideo = {
  uri: string; bytes: number; sourceBytes: number;
  smallerThanInput: boolean; mimeType: 'video/mp4'; codec: 'video/avc';
};
type NativeMedia3 = {
  transcodeLocalVideo: (uri: string, height: number, bitrate: number) => Promise<CompressedVideo>;
  cancelTranscode: () => Promise<boolean>;
};

function bridge(): NativeMedia3 | null {
  if (Platform.OS !== 'android' ||
      process.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW !== 'true') return null;
  return requireOptionalNativeModule<NativeMedia3>('BuklodGenesisMedia3');
}
/** Caller MUST preserve original video and choose the smaller valid output. */
export async function compressGenesisVideoForUpload(
  sourceUri: string,
  quality: 'balanced' | 'low-data' | 'high' = 'balanced',
): Promise<CompressedVideo | null> {
  if (!/^(content|file):\/\//.test(sourceUri)) return null;
  const preset = {
    'low-data': [480, 700_000],
    balanced: [720, 1_600_000],
    high: [1080, 3_200_000],
  } as const;
  const settings = preset[quality];
  try {
    const candidate = await bridge()?.transcodeLocalVideo(sourceUri, settings[0], settings[1]);
    return candidate?.smallerThanInput && candidate.bytes > 0 ? candidate : null;
  } catch {
    return null; // existing resumable video upload remains authoritative
  }
}
export async function cancelGenesisVideoCompression(): Promise<boolean> {
  try { return await bridge()?.cancelTranscode() ?? false; } catch { return false; }
}
