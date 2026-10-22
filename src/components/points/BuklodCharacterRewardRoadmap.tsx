/* BUKLOD_CHARACTER_REWARD_ROADMAP_500K_R1 */
import React, {
  useMemo,
} from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import BuklodCharacterItemThumb
  from '@/components/points/BuklodCharacterItemThumb';

import {
  useBuklodPresentation,
} from '@/hooks/useBuklodPresentation';

import {
  CATALOG,
} from '@/lib/character-lab-core/catalog';

import {
  formatPoints,
} from '@/lib/character-lab-core/tiers';

import type {
  BodyId,
  CatalogItem,
} from '@/lib/character-lab-core/types';

import {
  withAlpha,
} from '@/lib/buklodContrast';

type Props = {
  lifetimePoints: number;
  body: BodyId;
  currentRankName?: string | null;
  nextRankName?: string | null;
  onOpenCustomize?: () => void;
};

const PRESTIGE_MILESTONES = [
  10000,
  25000,
  50000,
  75000,
  100000,
  150000,
  200000,
  250000,
  300000,
  350000,
  400000,
  450000,
  500000,
] as const;

function eligibleForBody(
  item: CatalogItem,
  body: BodyId,
) {
  return (
    !item.bodies ||
    item.bodies.includes(body)
  );
}

export default function
BuklodCharacterRewardRoadmap({
  lifetimePoints,
  body,
  currentRankName,
  nextRankName,
  onOpenCustomize,
}: Props) {
  const { theme } =
    useBuklodPresentation();

  const relevant = useMemo(
    () =>
      CATALOG.filter(
        (item) =>
          item.slot !== 'base' &&
          eligibleForBody(item, body),
      ),
    [body],
  );

  const ownedCount = useMemo(
    () =>
      relevant.filter(
        (item) =>
          lifetimePoints >=
          item.unlockAtLifetime,
      ).length,
    [lifetimePoints, relevant],
  );

  const nextRewards = useMemo(
    () =>
      relevant
        .filter(
          (item) =>
            item.unlockAtLifetime >
            lifetimePoints,
        )
        .sort(
          (a, b) =>
            a.unlockAtLifetime -
              b.unlockAtLifetime ||
            a.name.localeCompare(b.name),
        )
        .slice(0, 6),
    [lifetimePoints, relevant],
  );

  const prestigePreview = useMemo(
    () =>
      relevant
        .filter(
          (item) =>
            item.id.startsWith(
              'prestige_',
            ) &&
            item.unlockAtLifetime >
              lifetimePoints,
        )
        .sort(
          (a, b) =>
            a.unlockAtLifetime -
              b.unlockAtLifetime ||
            a.name.localeCompare(b.name),
        )
        .filter(
          (item, index, rows) =>
            rows.findIndex(
              (other) =>
                other.unlockAtLifetime ===
                item.unlockAtLifetime,
            ) === index,
        )
        .slice(0, 6),
    [lifetimePoints, relevant],
  );

  const styles = StyleSheet.create({
    card: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor:
        withAlpha(theme.accent, 0.18),
      backgroundColor: theme.surface,
      padding: 15,
    },

    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    icon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        theme.accentSoft,
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

    title: {
      marginTop: 2,
      fontSize: 16,
      fontWeight: '900',
      color: theme.textPrimary,
    },

    meta: {
      marginTop: 3,
      fontSize: 10.5,
      lineHeight: 15,
      color: theme.textSecondary,
    },

    count: {
      alignItems: 'flex-end',
    },

    countValue: {
      fontSize: 18,
      fontWeight: '900',
      color: theme.accent,
    },

    countLabel: {
      marginTop: 1,
      fontSize: 8,
      fontWeight: '800',
      color: theme.textMuted,
    },

    sectionTitle: {
      marginTop: 15,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.8,
      color: theme.textPrimary,
    },

    rewardGrid: {
      marginTop: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },

    reward: {
      width: '48%',
      minHeight: 83,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 8,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor:
        theme.surfaceElevated,
    },

    rewardCopy: {
      flex: 1,
      minWidth: 0,
    },

    rewardName: {
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '900',
      color: theme.textPrimary,
    },

    rewardPoints: {
      marginTop: 3,
      fontSize: 8.5,
      fontWeight: '900',
      color: theme.accent,
    },

    milestoneRow: {
      marginTop: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },

    milestone: {
      minWidth: 70,
      flexGrow: 1,
      paddingHorizontal: 8,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
    },

    milestoneText: {
      fontSize: 9,
      fontWeight: '900',
    },

    customize: {
      marginTop: 14,
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: 13,
      backgroundColor:
        theme.buttonPrimary,
    },

    customizeText: {
      fontSize: 10.5,
      fontWeight: '900',
      color: theme.white,
    },

    complete: {
      marginTop: 10,
      padding: 10,
      borderRadius: 12,
      backgroundColor:
        withAlpha(theme.accentSoft, 0.7),
    },

    completeText: {
      fontSize: 10.5,
      lineHeight: 15,
      fontWeight: '800',
      color: theme.accent,
    },
  });

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.icon}>
          <MaterialCommunityIcons
            name="shield-star-outline"
            size={22}
            color={theme.accent}
          />
        </View>

        <View style={styles.copy}>
          <Text style={styles.eyebrow}>
            CHARACTER REWARDS
          </Text>

          <Text style={styles.title}>
            Roadmap to 500,000 pts
          </Text>

          <Text style={styles.meta}>
            {currentRankName ||
              'Current BUKLOD Rank'}
            {nextRankName
              ? ` · next: ${nextRankName}`
              : ''}
          </Text>
        </View>

        <View style={styles.count}>
          <Text style={styles.countValue}>
            {ownedCount}/{relevant.length}
          </Text>
          <Text style={styles.countLabel}>
            UNLOCKED
          </Text>
        </View>
      </View>

      {nextRewards.length ? (
        <>
          <Text style={styles.sectionTitle}>
            NEXT CHARACTER UNLOCKS
          </Text>

          <View style={styles.rewardGrid}>
            {nextRewards.map((item) => (
              <View
                key={item.id}
                style={styles.reward}
              >
                <BuklodCharacterItemThumb
                  item={item}
                  body={body}
                  locked
                  size={44}
                />

                <View style={styles.rewardCopy}>
                  <Text
                    style={styles.rewardName}
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>

                  <Text
                    style={styles.rewardPoints}
                  >
                    {formatPoints(
                      item.unlockAtLifetime,
                    )}{' '}
                    PTS
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.complete}>
          <Text style={styles.completeText}>
            All current Character rewards are unlocked.
          </Text>
        </View>
      )}

      {prestigePreview.length ? (
        <>
          <Text style={styles.sectionTitle}>
            PRESTIGE PREVIEWS
          </Text>

          <View style={styles.rewardGrid}>
            {prestigePreview.map((item) => (
              <View
                key={`prestige:${item.id}`}
                style={styles.reward}
              >
                <BuklodCharacterItemThumb
                  item={item}
                  body={body}
                  locked
                  size={44}
                />

                <View style={styles.rewardCopy}>
                  <Text
                    style={styles.rewardName}
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>

                  <Text
                    style={styles.rewardPoints}
                  >
                    {formatPoints(
                      item.unlockAtLifetime,
                    )}{' '}
                    PTS
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>
        LONG-TERM PRESTIGE MILESTONES
      </Text>

      <View style={styles.milestoneRow}>
        {PRESTIGE_MILESTONES.map(
          (threshold) => {
            const achieved =
              lifetimePoints >= threshold;

            return (
              <View
                key={threshold}
                style={[
                  styles.milestone,
                  {
                    borderColor: achieved
                      ? withAlpha(
                          theme.accent,
                          0.42,
                        )
                      : theme.border,
                    backgroundColor: achieved
                      ? theme.accentSoft
                      : theme.surfaceMuted,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.milestoneText,
                    {
                      color: achieved
                        ? theme.accent
                        : theme.textMuted,
                    },
                  ]}
                >
                  {achieved ? '✓ ' : ''}
                  {formatPoints(threshold)}
                </Text>
              </View>
            );
          },
        )}
      </View>

      {onOpenCustomize ? (
        <Pressable
          onPress={onOpenCustomize}
          style={({ pressed }) => [
            styles.customize,
            pressed && {
              opacity: 0.86,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open full Character wardrobe"
        >
          <MaterialCommunityIcons
            name="palette-outline"
            size={16}
            color={theme.white}
          />

          <Text style={styles.customizeText}>
            VIEW FULL WARDROBE
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
