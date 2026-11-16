/* 13 × 20 × 5 verified paths; never confuse published art with earned rewards. */
import type { BuklodCharacterWorldId } from '@/lib/buklodCharacterWorldCatalog';

export const BUKLOD_ART_CHARACTER_IDS = [
  'phan', 'quin', 'van', 'christian', 'lhen',
  'ace', 'ellusur', 'jawo', 'mitch', 'niel', 'angel', 'vhen', 'trudice',
] as const;
const ids: ReadonlySet<string> = new Set(BUKLOD_ART_CHARACTER_IDS);
const pad = (value: number) => String(value).padStart(2, '0');

export function collectibleArtworkKey(characterId: BuklodCharacterWorldId, level: number, itemIndex: number): string | null {
  if (!ids.has(characterId) || !Number.isInteger(level) || level < 1 || level > 20
      || !Number.isInteger(itemIndex) || itemIndex < 1 || itemIndex > 5) return null;
  return characterId + ':L' + pad(level) + ':I' + pad(itemIndex);
}

export function collectibleArtworkPath(characterId: BuklodCharacterWorldId, level: number, itemIndex: number): string | null {
  if (!collectibleArtworkKey(characterId, level, itemIndex)) return null;
  return 'character-collectibles/' + characterId + '/l' + pad(level) + '-i' + pad(itemIndex) + '.webp';
}

export function collectibleArtworkUri(characterId: BuklodCharacterWorldId, level: number, itemIndex: number): string | null {
  const path = collectibleArtworkPath(characterId, level, itemIndex);
  // Production remains opt-in; verified public Storage art defaults on for staging only.
  const configuredBase = process.env.EXPO_PUBLIC_BUKLOD_CHARACTER_ART_BASE_URL;
  const base = (typeof configuredBase === 'string' && configuredBase.trim()) ||
    (process.env.EXPO_PUBLIC_APP_ENV === 'staging'
      ? 'https://yhanxndaqbmuzbdqlblu.supabase.co/storage/v1/object/public/buklod-character-art-v1'
      : null);
  if (!path || typeof base !== 'string' || !/^https:\/\/[^?#\s]+$/i.test(base)) return null;
  return base.replace(/\/$/, '') + '/' + path;
}
