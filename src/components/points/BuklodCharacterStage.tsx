import React, { useEffect, useMemo, useRef, useState } from 'react';

import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import BuklodCharacterCelebrationLayer from '@/components/points/BuklodCharacterCelebrationLayer';
import BuklodCharacterRenderer, {
  type BuklodCharacterRendererRef,
} from '@/components/points/BuklodCharacterRenderer';
import { useBuklodReduceMotion } from '@/components/HomeMotion';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { withAlpha } from '@/lib/buklodContrast';
import type { CharacterReactionsMode } from '@/lib/buklodCharacterEvents';
import { getItem } from '@/lib/character-lab-core/catalog';
import { catalogItemGlyph } from '@/lib/character-lab-core/localLooks';
import { MOTION, REACTIONS } from '@/lib/character-lab-core/motion';
import { makeMotes } from '@/lib/character-lab-core/particles';
import { heroHeightFraction } from '@/lib/buklodCharacterRig';
import { BASE_ASPECT } from '@/lib/character-lab-core/assets';
import type { CharacterPoseState } from '@/lib/buklodCharacterEvents';
import type {
  BodyId,
  Equipment,
  ReactionId,
  SlotId,
} from '@/lib/character-lab-core/types';

type Props = {
  body: BodyId;
  equipment: Equipment;
  reactionId?: ReactionId;
  reactionKey?: number;
  pose?: CharacterPoseState;
  celebrating?: boolean;
  onCelebrationComplete?: () => void;
  compact?: boolean;
  /** Override computed stage width (e.g. split-layout preview column). */
  stageWidth?: number;
  showStageLabel?: boolean;
  characterRef?: React.Ref<BuklodCharacterRendererRef>;
  visible?: boolean;
  pointPresent?: boolean;
  entranceActive?: boolean;
  reactionsMode?: CharacterReactionsMode;
  talking?: boolean;
  showBaseOnly?: boolean;
  enabledCategories?: readonly SlotId[] | 'all';
  calibrationMode?: boolean;
  debugSkeleton?: boolean;
};

/** Cinematic stage — local gradient backdrop plus living character. */
export default function BuklodCharacterStage({
  body,
  equipment,
  reactionId = 'neutral',
  reactionKey = 0,
  pose = 'IDLE',
  celebrating = false,
  onCelebrationComplete,
  compact = false,
  stageWidth: stageWidthOverride,
  showStageLabel = true,
  characterRef,
  visible = true,
  pointPresent = false,
  entranceActive = false,
  reactionsMode = 'full',
  talking = false,
  showBaseOnly = false,
  enabledCategories = 'all',
  calibrationMode = false,
  debugSkeleton = false,
}: Props) {
  const { theme } = useBuklodPresentation();
  const reduceMotion = useBuklodReduceMotion();
  const { width: screenWidth } = useWindowDimensions();
  const stageWidth =
    stageWidthOverride ??
    (compact
      ? Math.min(screenWidth - 48, 280)
      : screenWidth - 24);
  const stageHeight = stageWidth * (4 / 3);
  const aspect = BASE_ASPECT[body];
  const heroFraction = heroHeightFraction(stageWidth, compact);
  const characterHeight = stageHeight * heroFraction;
  const characterWidth = characterHeight * aspect;

  const stageItem = getItem(equipment.background);
  const stageSwatch = stageItem?.swatch ?? (['#0B1A14', '#123528'] as const);
  const badgeItem = getItem(equipment.badge);

  const ambientMotes = useMemo(() => makeMotes(14, 23), []);
  const [stageFlash] = useState(
    () => new Animated.Value(REACTIONS[reactionId].stageFlash)
  );
  const bgScale = useRef(new Animated.Value(1.02)).current;
  const fogShift = useRef(new Animated.Value(0)).current;
  const lightSweep = useRef(new Animated.Value(0)).current;
  const shadowOpacity = useRef(new Animated.Value(0.45)).current;
  const moteDrift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(stageFlash, {
      toValue: REACTIONS[reactionId].stageFlash,
      duration: MOTION.unlock.stageFlashMs,
      useNativeDriver: true,
    }).start();
  }, [reactionId, reactionKey, stageFlash]);

  useEffect(() => {
    if (!visible || reduceMotion) {
      bgScale.setValue(1.02);
      fogShift.setValue(0);
      moteDrift.setValue(0);
      return;
    }

    const parallax = Animated.loop(
      Animated.sequence([
        Animated.timing(bgScale, {
          toValue: 1.05,
          duration: 9200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bgScale, {
          toValue: 1.02,
          duration: 9200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const fog = Animated.loop(
      Animated.sequence([
        Animated.timing(fogShift, {
          toValue: 1,
          duration: 6800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(fogShift, {
          toValue: 0,
          duration: 6800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const motes = Animated.loop(
      Animated.sequence([
        Animated.timing(moteDrift, {
          toValue: 1,
          duration: 5400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(moteDrift, {
          toValue: 0,
          duration: 5400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    parallax.start();
    fog.start();
    motes.start();

    return () => {
      parallax.stop();
      fog.stop();
      motes.stop();
    };
  }, [bgScale, fogShift, moteDrift, reduceMotion, visible]);

  useEffect(() => {
    if (!entranceActive || reduceMotion) {
      lightSweep.setValue(0);
      shadowOpacity.setValue(0.65);
      return;
    }

    lightSweep.setValue(0);
    shadowOpacity.setValue(0.2);

    Animated.parallel([
      Animated.timing(lightSweep, {
        toValue: 1,
        duration: MOTION.entrance.lightSweepMs,
        delay: MOTION.entrance.lightSweepDelayMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(shadowOpacity, {
        toValue: 0.65,
        duration: MOTION.entrance.characterMs,
        delay: MOTION.entrance.characterDelayMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [entranceActive, lightSweep, reduceMotion, shadowOpacity]);

  const fogTranslate = fogShift.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 10],
  });

  const sweepOpacity = lightSweep.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0.42, 0],
  });

  const sweepTranslate = lightSweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-stageWidth * 0.45, stageWidth * 0.45],
  });

  const moteLift = moteDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -18],
  });

  return (
    <View
      style={[
        styles.stage,
        {
          width: stageWidth,
          height: stageHeight,
          borderColor: withAlpha(theme.accent, 0.22),
        },
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ scale: bgScale }] },
        ]}
      >
        <LinearGradient
          colors={[stageSwatch[0], stageSwatch[1], '#0A1410']}
          style={styles.background}
        />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.fog,
          { transform: [{ translateX: fogTranslate }] },
        ]}
      >
        <LinearGradient
          colors={[
            'rgba(146,196,178,0)',
            'rgba(146,196,178,0.08)',
            'rgba(31,111,114,0.28)',
          ]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.moteField, { transform: [{ translateY: moteLift }] }]}
      >
        {ambientMotes.map((mote) => (
          <View
            key={mote.id}
            style={[
              styles.ambientMote,
              {
                left: `${mote.x}%`,
                bottom: `${4 + (mote.id % 5) * 3}%`,
                width: mote.size,
                height: mote.size,
                backgroundColor:
                  mote.tone === 'gold'
                    ? 'rgba(245,198,81,0.9)'
                    : mote.tone === 'mint'
                      ? 'rgba(88,168,124,0.85)'
                      : 'rgba(95,200,206,0.85)',
                opacity: 0.62,
              },
            ]}
          />
        ))}
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.reactionLight,
          { opacity: stageFlash },
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.lightSweep,
          {
            opacity: sweepOpacity,
            transform: [{ translateX: sweepTranslate }],
          },
        ]}
      />

      <View
        style={[
          styles.characterDock,
          {
            width: characterWidth,
            height: characterHeight,
            bottom: `${(100 - heroFraction * 100) / 2 + 1.5}%`,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.contactShadow,
            {
              bottom: '2%',
              opacity: shadowOpacity,
            },
          ]}
        />
        <View style={styles.rimLight} pointerEvents="none" />
        <BuklodCharacterRenderer
          ref={characterRef}
          body={body}
          equipment={equipment}
          reactionId={reactionId}
          reactionKey={reactionKey}
          poseState={pose}
          entrance={entranceActive}
          alive
          visible={visible}
          pointPresent={pointPresent}
          reactionsMode={reactionsMode}
          talking={talking}
          showBaseOnly={showBaseOnly}
          enabledCategories={enabledCategories}
          calibrationMode={calibrationMode}
          debugSkeleton={debugSkeleton}
        />
      </View>

      {badgeItem && badgeItem.id !== 'badge_none' ? (
        <View style={styles.badgeWrap}>
          <View style={styles.badge}>
            <MaterialCommunityIcons
              name={catalogItemGlyph(badgeItem) as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
              size={28}
              color={badgeItem.swatch[1]}
            />
          </View>
        </View>
      ) : null}

      <LinearGradient
        colors={[
          'rgba(0,0,0,0)',
          'rgba(4,8,6,0.15)',
          'rgba(4,8,6,0.58)',
        ]}
        style={styles.vignette}
        pointerEvents="none"
      />

      <View pointerEvents="none" style={styles.foregroundGlow} />

      <BuklodCharacterCelebrationLayer
        active={celebrating}
        particleCount={12}
        seed={reactionKey}
        spread={
          reactionId === 'milestone' ? 168 : 118
        }
        onComplete={onCelebrationComplete}
      />

      {showStageLabel && stageItem ? (
        <View
          style={[
            styles.stageLabel,
            {
              backgroundColor: withAlpha(
                theme.surface,
                0.72
              ),
              borderColor: withAlpha(theme.border, 0.5),
            },
          ]}
        >
          <Text
            style={[
              styles.stageLabelText,
              { color: theme.textSecondary },
            ]}
          >
            {stageItem.name}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignSelf: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#060A08',
  },
  background: {
    ...StyleSheet.absoluteFill,
  },
  fog: {
    position: 'absolute',
    left: '-8%',
    right: '-8%',
    bottom: '-4%',
    height: '46%',
  },
  moteField: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  ambientMote: {
    position: 'absolute',
    borderRadius: 999,
  },
  reactionLight: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(245,198,81,0.35)',
  },
  lightSweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '34%',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  characterDock: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  contactShadow: {
    position: 'absolute',
    left: '4%',
    right: '4%',
    height: 26,
    borderRadius: 999,
    backgroundColor: 'rgba(4,8,6,0.78)',
  },
  rimLight: {
    ...StyleSheet.absoluteFill,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(146,196,178,0.12)',
    shadowColor: '#92C4B2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  foregroundGlow: {
    position: 'absolute',
    left: '20%',
    right: '20%',
    bottom: '8%',
    height: '12%',
    borderRadius: 999,
    backgroundColor: 'rgba(88,168,124,0.08)',
  },
  badgeWrap: {
    position: 'absolute',
    right: '5%',
    top: '8%',
    width: '19%',
    zIndex: 30,
  },
  badge: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(4,8,6,0.45)',
  },
  vignette: {
    ...StyleSheet.absoluteFill,
  },
  stageLabel: {
    position: 'absolute',
    left: 14,
    top: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  stageLabelText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
