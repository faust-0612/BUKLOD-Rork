/* Real artwork when verified published; fallback icons for missing or unavailable media. */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collectibleArtworkUri } from '@/lib/buklodCollectibleArtwork';
import type { BuklodCharacterWorldId } from '@/lib/buklodCharacterWorldCatalog';

type Props = { characterId: BuklodCharacterWorldId; level: number; itemIndex: number; size: number; fallbackIcon?: string };

export default function BuklodCollectibleArt({ characterId, level, itemIndex, size, fallbackIcon = 'star-circle-outline' }: Props) {
  const uri = collectibleArtworkUri(characterId, level, itemIndex);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const frame = { width: size, height: size, alignItems: 'center' as const, justifyContent: 'center' as const };
  if (!uri || failed) return (
    <View style={frame}>
      <MaterialCommunityIcons name={fallbackIcon as never} color="#E8C56B" size={Math.min(34, Math.round(size * 0.58))} />
    </View>
  );
  return (
    <View style={frame}>
      <ExpoImage source={{ uri }} contentFit="contain" cachePolicy="memory-disk" transition={100}
        style={{ width: size, height: size }} onError={() => setFailed(true)}
        accessibilityLabel={'Collectible artwork ' + characterId + ' level ' + level + ' item ' + itemIndex} />
    </View>
  );
}
