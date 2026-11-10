import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View, useWindowDimensions } from 'react-native';

import BuklodActiveCharacterArt from '@/components/points/BuklodActiveCharacterArt';
import BuklodCharacterMotion, {
  type BuklodCharacterReactionSignal,
} from '@/components/points/BuklodCharacterMotion';
import { DEFAULT_CHARACTER } from '@/lib/buklodCharacter';
import { subscribeBuklodGameCharacterMotion } from './characterMotionBus';

export default function BuklodGameCharacterCompanion({ gameId }: { gameId?: string }) {
  const [reaction, setReaction] = useState<BuklodCharacterReactionSignal | null>(null);
  const { width, height } = useWindowDimensions();
  const position = useRef({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const translation = useRef(new Animated.ValueXY()).current;
  // Move the companion without replacing any approved R31/R40 art.
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) =>
      Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
    onPanResponderGrant: () => { dragStart.current = { ...position.current }; },
    onPanResponderMove: (_, gesture) => {
      const next = {
        x: Math.max(-8, Math.min(width - 88, dragStart.current.x + gesture.dx)),
        y: Math.max(-(height - 170), Math.min(35, dragStart.current.y + gesture.dy)),
      };
      position.current = next;
      translation.setValue(next);
    },
    onPanResponderTerminationRequest: () => true,
  }), [height, translation, width]);

  useEffect(() => subscribeBuklodGameCharacterMotion((event) => {
    setReaction({ id: event.id, type: event.type });
  }), []);

  if (!gameId) return null;

  return (
    <Animated.View {...responder.panHandlers} accessibilityLabel="Drag Kingdom character companion" style={[styles.anchor, { transform: translation.getTranslateTransform() }]}>
      <View style={styles.glow} />
      <BuklodCharacterMotion mode="game" reaction={reaction}>
        <BuklodActiveCharacterArt
          fallbackCharacter={DEFAULT_CHARACTER}
          height={84}
          viewportWidth={62}
        />
      </BuklodCharacterMotion>
      <View pointerEvents="none" style={styles.dragHint} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 10,
    bottom: 62,
    width: 72,
    height: 96,
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'flex-end',
    opacity: 0.94,
  },
  dragHint: {
    position: 'absolute', top: 0, right: 0, width: 20, height: 4,
    borderRadius: 3, backgroundColor: 'rgba(245,222,163,0.8)',
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
