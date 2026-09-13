/* BUKLOD_POINTS_STAGE_CHARACTER_500K_R1 */
/* BUKLOD_CHARACTER_VISIBLE_SYNC_R31_R40_V2 */
import React from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import BuklodAmbientSurface
  from '@/components/motion/BuklodAmbientSurface';

import BuklodActiveCharacterArt
  from '@/components/points/BuklodActiveCharacterArt';

import BuklodCharacterNavigator
  from '@/components/points/BuklodCharacterNavigator';

import BuklodCharacterSettingsRow
  from '@/components/points/BuklodCharacterSettingsRow';

import BuklodPointsHud
  from '@/components/points/BuklodPointsHud';

import {
  PointsFocusEnvironment,
} from '@/components/points/PointsMotion';

import {
  useBuklodPresentation,
} from '@/hooks/useBuklodPresentation';

import {
  type BuklodCharacterState,
} from '@/lib/buklodCharacter';

import {
  formatPoints,
} from '@/lib/character-lab-core/tiers';

import {
  withAlpha,
} from '@/lib/buklodContrast';

type Props = {
  character: BuklodCharacterState;
  lifetimePoints: number;
  availablePoints: number;
  claimableCount?: number;
  hudPop?: boolean;
  pointsToNext?: number | null;
  rankName?: string | null;
  nextRankName?: string | null;
  onOpenCustomize?: () => void;
};

export default function BuklodPointsStage({
  character,
  lifetimePoints,
  availablePoints,
  claimableCount = 0,
  hudPop = false,
  pointsToNext = null,
  rankName = null,
  nextRankName = null,
  onOpenCustomize,
}: Props) {
  const { theme } =
    useBuklodPresentation();

  const rankLabel =
    String(rankName ?? '').trim();

  const nextLabel =
    String(nextRankName ?? '').trim();

  const styles = StyleSheet.create({
    stageWrap: {
      marginHorizontal: 12,
      marginBottom: 10,
      alignItems: 'center',
    },

    hero: {
      width: '100%',
      minHeight: 210,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 22,
      borderWidth: 1,
      borderColor:
        withAlpha(theme.accent, 0.18),
      backgroundColor:
        withAlpha(theme.accentSoft, 0.34),
      overflow: 'hidden',
    },

    art: {
      width: 122,
      height: 190,
      alignItems: 'center',
      justifyContent: 'flex-end',
      overflow: 'visible',
    },

    copy: {
      flex: 1,
      minWidth: 0,
    },

    eyebrow: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1,
      color: theme.textMuted,
    },

    rank: {
      marginTop: 4,
      fontSize: 19,
      lineHeight: 23,
      fontWeight: '900',
      color: theme.textPrimary,
    },

    points: {
      marginTop: 5,
      fontSize: 15,
      fontWeight: '900',
      color: theme.accent,
    },

    nextBox: {
      marginTop: 9,
      padding: 9,
      borderRadius: 12,
      backgroundColor:
        withAlpha(theme.surface, 0.82),
      borderWidth: 1,
      borderColor: theme.border,
    },

    nextTitle: {
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
      color: theme.textMuted,
    },

    nextText: {
      marginTop: 3,
      fontSize: 10.5,
      lineHeight: 15,
      fontWeight: '800',
      color: theme.textSecondary,
    },

    customize: {
      alignSelf: 'flex-start',
      marginTop: 10,
      minHeight: 35,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 11,
      borderRadius: 11,
      backgroundColor:
        theme.buttonPrimary,
    },

    customizeText: {
      fontSize: 10,
      fontWeight: '900',
      color: theme.white,
    },

    hudRow: {
      width: '100%',
      alignItems: 'center',
      marginTop: 8,
    },

    settings: {
      width: '100%',
      marginTop: 2,
    },
  });

  return (
    <PointsFocusEnvironment
      style={styles.stageWrap}
    >
      <View style={styles.hero}>
        <BuklodAmbientSurface
          tone="surface"
          intensity={0.72}
        />

        <View style={styles.art}>
          <BuklodActiveCharacterArt
            fallbackCharacter={character}
            height={184}
            viewportWidth={122}
            showStage
            showEffects
          />
        </View>

        <View style={styles.copy}>
          <Text style={styles.eyebrow}>
            MY BUKLOD CHARACTER
          </Text>

          <Text
            style={styles.rank}
            numberOfLines={2}
          >
            {rankLabel || 'BUKLOD Rank'}
          </Text>

          <Text style={styles.points}>
            {formatPoints(lifetimePoints)} pts
          </Text>

          <View style={styles.nextBox}>
            <Text style={styles.nextTitle}>
              {pointsToNext &&
              pointsToNext > 0
                ? 'NEXT RANK'
                : 'CURRENT STATUS'}
            </Text>

            <Text style={styles.nextText}>
              {pointsToNext &&
              pointsToNext > 0
                ? `${formatPoints(
                    pointsToNext,
                  )} pts to ${
                    nextLabel ||
                    'the next rank'
                  }`
                : 'Highest available rank reached'}
            </Text>
          </View>

          {onOpenCustomize ? (
            <Pressable
              onPress={onOpenCustomize}
              accessibilityRole="button"
              accessibilityLabel="Customize BUKLOD Character"
              style={({ pressed }) => [
                styles.customize,
                pressed && {
                  opacity: 0.86,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="palette-outline"
                size={15}
                color={theme.white}
              />

              <Text
                style={styles.customizeText}
              >
                CUSTOMIZE
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.hudRow}>
        <BuklodPointsHud
          lifetimePoints={lifetimePoints}
          availablePoints={availablePoints}
          claimableCount={claimableCount}
          pop={hudPop}
        />
      </View>

      <View style={styles.settings}>
        <BuklodCharacterSettingsRow
          compact
        />
      </View>

      <BuklodCharacterNavigator
        character={character}
        claimableCount={claimableCount}
        lifetimePoints={lifetimePoints}
        pointsToNext={pointsToNext}
        nextRankName={nextRankName}
        onOpenCustomize={onOpenCustomize}
      />
    </PointsFocusEnvironment>
  );
}