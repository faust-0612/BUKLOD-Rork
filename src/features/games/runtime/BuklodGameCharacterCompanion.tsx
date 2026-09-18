import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import BuklodActiveCharacterArt from '@/components/points/BuklodActiveCharacterArt';
import BuklodCharacterMotion, {
  type BuklodCharacterReactionSignal,
} from '@/components/points/BuklodCharacterMotion';
import { DEFAULT_CHARACTER } from '@/lib/buklodCharacter';
import { subscribeBuklodGameCharacterMotion } from './characterMotionBus';

export default function BuklodGameCharacterCompanion({ gameId }: { gameId?: string }) {
  const [reaction, setReaction] = useState<BuklodCharacterReactionSignal | null>(null);

  useEffect(() => subscribeBuklodGameCharacterMotion((event) => {
    setReaction({ id: event.id, type: event.type });
  }), []);

  if (!gameId) return null;

  return (
    <View pointerEvents="none" style={styles.anchor}>
      <View style={styles.glow} />
      <BuklodCharacterMotion mode="game" reaction={reaction}>
        <BuklodActiveCharacterArt
          fallbackCharacter={DEFAULT_CHARACTER}
          height={84}
          viewportWidth={62}
        />
      </BuklodCharacterMotion>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 10,
    bottom: 62,
    width: 72,
    height: 96,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    opacity: 0.94,
  },
  glow: {
    position: 'absolute',
    bottom: 2,
    width: 58,
    height: 18,
    borderRadius: 29,
    backgroundColor: 'rgba(255,238,170,0.14)',
  },
});
