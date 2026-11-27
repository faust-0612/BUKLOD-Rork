
import { isGenesisPreviewBuild } from '@/features/season2/genesis/genesisContract';

export function wallStylePersistenceEnabled(): boolean {
  return isGenesisPreviewBuild() &&
    process.env.EXPO_PUBLIC_BUKLOD_WALL_STYLES_ENABLED === 'true';
}

export function wallAudioMixEnabled(): boolean {
  return isGenesisPreviewBuild() &&
    process.env.EXPO_PUBLIC_BUKLOD_WALL_AUDIO_MIX_ENABLED === 'true';
}
