/* Canonical public Character collectible art: 13 characters x 20 levels x 5 items.
 * Visuals never grant ownership; equipped pins come from authenticated server state. */
import React, { memo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import {
  BUKLOD_CHARACTER_WORLD_IDS,
  type BuklodCharacterWorldId,
} from '@/lib/buklodCharacterWorldCatalog';
import {
  characterTokenIcon,
  type CharacterCollectiblePin,
} from '@/lib/buklodCharacterCollectibles';
import type { ProgressiveCharacterId } from '@/lib/buklodProgressiveCharacter';

const PUBLIC_BUCKET = 'buklod-character-art-v1';
const WORLD_IDS = new Set<string>(BUKLOD_CHARACTER_WORLD_IDS);
const CORE_IDS = new Set<string>(['phan', 'quin', 'van', 'christian', 'lhen']);

export function getBuklodCharacterCollectibleArtworkUrl(
  characterId: BuklodCharacterWorldId | string,
  level: number,
  itemIndex: number,
): string | null {
  if (!WORLD_IDS.has(characterId) || !Number.isInteger(level) || level < 1 || level > 20
    || !Number.isInteger(itemIndex) || itemIndex < 1 || itemIndex > 5) return null;
  const path = `character-collectibles/${characterId}/l${String(level).padStart(2, '0')}-i${String(itemIndex).padStart(2, '0')}.webp`;
  return supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl;
}

type ArtworkProps = {
  characterId: BuklodCharacterWorldId | string;
  level: number;
  itemIndex: number;
  size: number;
};

/** On weak connections image failure degrades to a readable static glyph. */
export const BuklodCharacterCollectibleArtwork = memo(function BuklodCharacterCollectibleArtwork({
  characterId, level, itemIndex, size,
}: ArtworkProps) {
  const uri = getBuklodCharacterCollectibleArtworkUrl(characterId, level, itemIndex);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const icon = CORE_IDS.has(characterId)
    ? characterTokenIcon(characterId as ProgressiveCharacterId, itemIndex)
    : 'star-circle-outline';
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: Math.max(4, Math.round(size / 5)) }]}>
      {uri && failedUri !== uri ? (
        <Image
          key={uri}
          source={{ uri }}
          resizeMode="contain"
          onError={() => setFailedUri(uri)}
          style={styles.artwork}
        />
      ) : (
        <MaterialCommunityIcons name={icon as never} size={Math.max(10, Math.round(size * 0.65))} color="#E8C56B" />
      )}
    </View>
  );
});

export function getBuklodEquipRailWidth(height: number): number {
  return Math.max(17, Math.min(27, Math.round(height / 5.2)));
}

type RailProps = { pins: readonly CharacterCollectiblePin[]; height: number };

/** Bounded five-item side rail, shared by Customize and all active Character cards. */
export const BuklodEquippedCollectibleRail = memo(function BuklodEquippedCollectibleRail({
  pins, height,
}: RailProps) {
  if (!pins.length) return null;
  const visible = pins.slice(0, 5);
  const width = getBuklodEquipRailWidth(height);
  const size = Math.max(12, Math.min(width - 2, Math.floor((height - 2 * visible.length) / visible.length)));
  return (
    <View pointerEvents="none" style={[styles.rail, { width, height }]}>
      {visible.map((pin) => (
        <BuklodCharacterCollectibleArtwork
          key={pin.key}
          characterId={pin.characterId}
          level={pin.level}
          itemIndex={pin.itemIndex}
          size={size}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  rail: {
    position: 'absolute', top: 0, left: 0,
    justifyContent: 'center', alignItems: 'center', gap: 2,
  },
  tile: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#DAB95C',
    backgroundColor: '#121A2B', overflow: 'hidden',
  },
  artwork: { width: '100%', height: '100%' },
});
