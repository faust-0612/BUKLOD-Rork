import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import BuklodCharacterMotion from '@/components/points/BuklodCharacterMotion';
import {
  SPECIAL_CHARACTER_HERO,
  getBuklodSpecialLevelAsset,
  type BuklodSpecialCharacterId,
} from '@/lib/buklodSpecialCharacterAssets';

type Props = {
  characterId: BuklodSpecialCharacterId;
  name: string;
  domain: string;
  level: number;
  active: boolean;
  unlocked: boolean;
  compact?: boolean;
};

export default function BuklodSpecialCharacterLayerStage({
  characterId,
  name,
  domain,
  level,
  active,
  unlocked,
  compact = false,
}: Props) {
  const safeLevel = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
  const art = active
    ? getBuklodSpecialLevelAsset(characterId, safeLevel)
    : SPECIAL_CHARACTER_HERO[characterId];

  return (
    <View style={[styles.stage, compact && styles.stageCompact]}>
      <LinearGradient
        colors={['#07150f', '#123d28', '#1d6c43']}
        locations={[0, 0.58, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.auraOuter} />
      <View pointerEvents="none" style={styles.auraMiddle} />
      <View pointerEvents="none" style={styles.auraCore} />
      <View pointerEvents="none" style={styles.lightBeamA} />
      <View pointerEvents="none" style={styles.lightBeamB} />

      <View style={styles.artLayer}>
        <BuklodCharacterMotion
          interactive
          mode="home"
          accessibilityLabel={`${name} Special Character`}
        >
          <Image
            source={art}
            resizeMode="contain"
            fadeDuration={0}
            style={[styles.art, compact && styles.artCompact]}
          />
        </BuklodCharacterMotion>
      </View>

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0)', 'rgba(4,15,10,0.08)', 'rgba(4,15,10,0.78)']}
        locations={[0.35, 0.64, 1]}
        style={styles.vignette}
      />

      <View pointerEvents="none" style={styles.topBadge}>
        <MaterialCommunityIcons name="star-four-points" size={12} color="#f1d681" />
        <Text style={styles.topBadgeText}>R40 SPECIAL</Text>
      </View>

      <View pointerEvents="none" style={styles.levelBadge}>
        <Text style={styles.levelKicker}>
          {active ? 'ACTIVE LEVEL' : unlocked ? 'PREVIEW' : 'LOCKED'}
        </Text>
        <Text style={styles.levelValue}>{active ? safeLevel : 1}</Text>
      </View>

      <View pointerEvents="none" style={styles.caption}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.domain} numberOfLines={2}>{domain}</Text>
        <Text style={styles.gestureHint}>Tap • double tap • hold • swipe</Text>
      </View>

      <View pointerEvents="none" style={styles.foregroundFrame} />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: 'relative',
    width: '100%',
    minHeight: 260,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#0b2217',
    borderWidth: 1,
    borderColor: 'rgba(224,191,102,0.55)',
  },
  stageCompact: {
    minHeight: 300,
  },
  auraOuter: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    top: '6%',
    height: '78%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(225,193,104,0.20)',
    backgroundColor: 'rgba(215,177,74,0.04)',
  },
  auraMiddle: {
    position: 'absolute',
    left: '20%',
    right: '20%',
    top: '14%',
    height: '62%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(164,228,183,0.24)',
    backgroundColor: 'rgba(112,193,139,0.06)',
  },
  auraCore: {
    position: 'absolute',
    left: '31%',
    right: '31%',
    top: '21%',
    height: '47%',
    borderRadius: 999,
    backgroundColor: 'rgba(237,205,112,0.10)',
  },
  lightBeamA: {
    position: 'absolute',
    width: 54,
    height: '130%',
    top: '-12%',
    left: '28%',
    borderRadius: 30,
    backgroundColor: 'rgba(248,225,158,0.07)',
    transform: [{ rotate: '12deg' }],
  },
  lightBeamB: {
    position: 'absolute',
    width: 34,
    height: '115%',
    top: '-8%',
    right: '26%',
    borderRadius: 30,
    backgroundColor: 'rgba(163,233,188,0.05)',
    transform: [{ rotate: '-10deg' }],
  },
  artLayer: {
    flex: 1,
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 12,
    paddingBottom: 16,
  },
  art: {
    width: 310,
    height: 248,
  },
  artCompact: {
    width: 280,
    height: 278,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
  },
  topBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(5,18,12,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(241,214,129,0.34)',
  },
  topBadgeText: {
    color: '#f4df9b',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  levelBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    minWidth: 58,
    minHeight: 48,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,18,12,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(160,220,178,0.28)',
  },
  levelKicker: {
    color: 'rgba(222,239,228,0.72)',
    fontSize: 6.5,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  levelValue: {
    marginTop: 1,
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '900',
  },
  caption: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 12,
    alignItems: 'center',
  },
  name: {
    color: '#fff2bf',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 6,
  },
  domain: {
    marginTop: 1,
    color: 'rgba(235,244,239,0.88)',
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  gestureHint: {
    marginTop: 4,
    color: 'rgba(228,236,231,0.60)',
    fontSize: 6.8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  foregroundFrame: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.04)',
  },
});
