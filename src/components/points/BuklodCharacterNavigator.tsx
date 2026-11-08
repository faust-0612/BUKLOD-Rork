/* BUKLOD_CHARACTER_VISIBLE_SYNC_R31_R40_V2 */
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import BuklodActiveCharacterArt from '@/components/points/BuklodActiveCharacterArt';
import { useBuklodCharacterEventsOptional } from '@/components/character/BuklodCharacterEventProvider';
import { useBuklodReduceMotion } from '@/components/HomeMotion';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { withAlpha } from '@/lib/buklodContrast';
import type { BuklodCharacterState } from '@/lib/buklodCharacter';

type Props = {
  character: BuklodCharacterState;
  claimableCount?: number;
  lifetimePoints?: number;
  pointsToNext?: number | null;
  nextRankName?: string | null;
  onOpenCustomize?: () => void;
};

/** Mini circular stage — synchronized to the same V2 active Character as Profile/Points. */
export default function BuklodCharacterNavigator({
  character,
  claimableCount = 0,
  lifetimePoints = 0,
  pointsToNext = null,
  nextRankName = null,
}: Props) {
  const { theme } = useBuklodPresentation();
  const reduceMotion = useBuklodReduceMotion();
  const events = useBuklodCharacterEventsOptional();
  const presentation = events?.presentation;

  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [bubbleMounted, setBubbleMounted] = useState(false);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const entryOpacity = useRef(new Animated.Value(0)).current;
  const entryY = useRef(new Animated.Value(12)).current;
  const shownUnlockRef = useRef<string | null>(null);

  const clearBubble = useCallback(() => {
    if (bubbleTimer.current) {
      clearTimeout(bubbleTimer.current);
      bubbleTimer.current = null;
    }
  }, []);

  const showBubble = useCallback(
    (text: string, duration = 3600) => {
      clearBubble();
      setBubbleText(text);
      setBubbleMounted(true);

      if (reduceMotion) {
        bubbleOpacity.setValue(1);
      } else {
        bubbleOpacity.setValue(0);
        Animated.timing(bubbleOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }

      bubbleTimer.current = setTimeout(() => {
        if (reduceMotion) {
          bubbleOpacity.setValue(0);
          setBubbleMounted(false);
          return;
        }

        Animated.timing(bubbleOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) setBubbleMounted(false);
        });
      }, duration);
    },
    [bubbleOpacity, clearBubble, reduceMotion]
  );

  useEffect(() => {
    if (reduceMotion) {
      entryOpacity.setValue(1);
      entryY.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(entryOpacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(entryY, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [entryOpacity, entryY, reduceMotion]);

  useEffect(() => {
    if (claimableCount <= 0) return;
    showBubble('May Points kang ready to claim!', 4200);
  }, [claimableCount, showBubble]);

  useEffect(() => {
    if (presentation?.pose !== 'ITEM_REVEAL') return;
    if (!presentation.dialogue) return;
    showBubble(presentation.dialogue, 4200);
  }, [
    presentation?.dialogue,
    presentation?.pose,
    presentation?.reactionKey,
    showBubble,
  ]);

  useEffect(() => {
    const unlockKey = character.newlyUnlocked[0] ?? null;
    if (!unlockKey || unlockKey === shownUnlockRef.current) return;
    shownUnlockRef.current = unlockKey;
    showBubble('Bagong item unlocked — tingnan mo!', 3800);
  }, [character.newlyUnlocked, showBubble]);

  useEffect(() => {
    if (claimableCount > 0) return;
    if (!nextRankName || !pointsToNext || pointsToNext <= 0) return;
    if (pointsToNext > 120) return;

    showBubble(
      `${pointsToNext.toLocaleString('en-PH')} pts na lang to ${nextRankName}!`,
      3200
    );
  }, [
    claimableCount,
    nextRankName,
    pointsToNext,
    showBubble,
  ]);

  useEffect(() => {
    if (claimableCount <= 0 || reduceMotion) {
      pulse.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 680,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 680,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [claimableCount, pulse, reduceMotion]);

  useEffect(
    () => () => {
      clearBubble();
    },
    [clearBubble]
  );

  const onPress = useCallback(() => {
    if (claimableCount > 0) {
      router.push('/points' as any);
      return;
    }
    showBubble(nextRankName && pointsToNext!=null && pointsToNext>0
      ? pointsToNext.toLocaleString('en-PH')+' pts to '+nextRankName
      : 'Open BUKLOD Points to explore your Circle Rank.', 3200);
  }, [claimableCount, showBubble, nextRankName, pointsToNext]);

  const avatarSize = 48;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.root,
        {
          opacity: entryOpacity,
          transform: [{ translateY: entryY }],
        },
      ]}
    >
      {bubbleMounted && bubbleText ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bubble,
            {
              backgroundColor: theme.surface,
              borderColor: withAlpha(theme.border, 0.55),
              opacity: bubbleOpacity,
            },
          ]}
        >
          <Text style={[styles.bubbleEyebrow, { color: theme.accent }]}>
            BUKLOD
          </Text>
          <Text style={[styles.bubbleText, { color: theme.textPrimary }]}>
            {bubbleText}
          </Text>
          <View
            style={[
              styles.bubbleTail,
              {
                backgroundColor: theme.surface,
                borderColor: withAlpha(theme.border, 0.55),
              },
            ]}
          />
        </Animated.View>
      ) : null}

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          claimableCount > 0
            ? 'Open claimable rewards'
            : 'Show Circle Rank progression information'
        }
        style={({ pressed }) => [
          styles.row,
          pressed && { opacity: 0.9 },
        ]}
      >
        <View
          style={[
            styles.pointsPill,
            {
              backgroundColor: withAlpha(theme.accentSoft, 0.85),
              borderColor: withAlpha(theme.accent, 0.22),
            },
          ]}
        >
          <Text style={[styles.pointsEyebrow, { color: theme.textMuted }]}>
            BUKLOD POINTS
          </Text>
          <Text style={[styles.pointsValue, { color: theme.accent }]}>
            {lifetimePoints.toLocaleString('en-PH')} pts
          </Text>
        </View>

        <View style={styles.avatarWrap}>
          <Animated.View
            style={[
              styles.ring,
              {
                borderColor: withAlpha(
                  claimableCount > 0 ? theme.warning : theme.accent,
                  0.55
                ),
                width: avatarSize + 6,
                height: avatarSize + 6,
                borderRadius: (avatarSize + 6) / 2,
                transform: [{ scale: pulse }],
              },
            ]}
          />

          <View style={styles.avatarClip}>
            <BuklodActiveCharacterArt
              fallbackCharacter={character}
              height={avatarSize}
              viewportWidth={avatarSize}
              showStage={false}
              showEffects={false}
            />
          </View>

          {claimableCount > 0 ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: theme.warning },
              ]}
            >
              <Text style={styles.badgeText}>{claimableCount}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    right: 10,
    bottom: 88,
    zIndex: 998,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointsPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'flex-end',
  },
  pointsEyebrow: {
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  pointsValue: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: '900',
  },
  avatarWrap: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarClip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  badge: {
    position: 'absolute',
    right: -2,
    top: -2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  bubble: {
    position: 'absolute',
    right: 0,
    bottom: 58,
    width: 196,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#0F2F22',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  bubbleEyebrow: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  bubbleText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  bubbleTail: {
    position: 'absolute',
    right: -6,
    bottom: 14,
    width: 12,
    height: 12,
    borderRightWidth: 1,
    borderTopWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
});