/* Real artwork when verified published; fallback icons for missing or unavailable media. */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collectibleArtworkUri } from '@/lib/buklodCollectibleArtwork';
import type { BuklodCharacterWorldId } from '@/lib/buklodCharacterWorldCatalog';

type Props = { characterId: BuklodCharacterWorldId; level: number; itemIndex: number; size: number; fallbackIcon?: string; locked?: boolean };

export default function BuklodCollectibleArt({ characterId, level, itemIndex, size, fallbackIcon = 'star-circle-outline', locked = false }: Props) {
  const uri = collectibleArtworkUri(characterId, level, itemIndex);
  // Full-screen zoom must decode original bytes; small cards remain inexpensive.
  // This does not create detail absent from the original low-resolution art.
  const expanded = size >= 200;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const frame = { width: size, height: size, alignItems: 'center' as const, justifyContent: 'center' as const };
  if (locked || !uri || failed) return (
    <View style={frame}>
      <MaterialCommunityIcons name={(locked ? 'lock-outline' : fallbackIcon) as never} color="#E8C56B" size={Math.min(34, Math.round(size * 0.58))} />
    </View>
  );
  return (
    <View style={frame}>
      <ExpoImage source={{ uri }} contentFit="contain" cachePolicy="memory-disk" transition={expanded ? 0 : 100}
        allowDownscaling={!expanded} priority={expanded ? 'high' : 'normal'}
        style={{ width: size, height: size }} onError={() => setFailed(true)}
        accessibilityLabel={'Collectible artwork ' + characterId + ' level ' + level + ' item ' + itemIndex} />
    </View>
  );
}
