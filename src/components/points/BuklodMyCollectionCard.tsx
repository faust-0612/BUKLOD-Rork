import React, { useMemo } from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import { PointsFocusCard } from '@/components/points/PointsMotion';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import {
  buildUnlockContext,
  defaultCharacterState,
  type BuklodCharacterState,
} from '@/lib/buklodCharacter';
import { collectionTally, resolveAll } from '@/lib/character-lab-core/unlock';
import type { BodyId, Equipment } from '@/lib/character-lab-core/types';

type Props = {
  index?: number;
  onPress?: () => void;
  lifetimePoints?: number;
  body?: BodyId;
  equipment?: Equipment;
};

export default function BuklodMyCollectionCard({
  index = 0,
  onPress,
  lifetimePoints = 0,
  body = 'female',
  equipment,
}: Props) {
  const { theme } = useBuklodPresentation();

  const resolved = useMemo(() => {
    const baseState = defaultCharacterState(body);
    const state: BuklodCharacterState = {
      ...baseState,
      equipment: equipment ?? baseState.equipment,
    };
    const ctx = buildUnlockContext(lifetimePoints, state);

    return resolveAll(body, ctx).filter(
      (row) =>
        row.item.slot !== 'background' && row.item.slot !== 'base'
    );
  }, [body, equipment, lifetimePoints]);

  const tally = collectionTally(body, lifetimePoints);
  const owned = resolved.filter((row) => row.isUnlocked);
  const preview = resolved.slice(0, 8);

  const styles = StyleSheet.create({
    card: {
      padding: 16,
      borderRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    icon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentSoft,
    },
    title: {
      fontSize: 14,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    subtitle: {
      marginTop: 3,
      fontSize: 11,
      color: theme.textMuted,
    },
    empty: {
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.surfaceMuted,
    },
    emptyText: {
      fontSize: 11,
      lineHeight: 16,
      color: theme.textSecondary,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 10,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
    },
    chipText: {
      fontSize: 10,
      fontWeight: '800',
    },
  });

  return (
    <PointsFocusCard index={index}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [
          styles.card,
          pressed && onPress && { opacity: 0.9 },
        ]}
      >
        <View style={styles.row}>
          <View style={styles.icon}>
            <MaterialCommunityIcons
              name="treasure-chest"
              size={22}
              color={theme.accent}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>My Collection</Text>
            <Text style={styles.subtitle}>
              {tally.owned}/{tally.total} unlocked
              {owned.length > 0
                ? ` · ${owned.length} owned`
                : ''}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={theme.textMuted}
          />
        </View>

        {preview.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Earn lifetime BUKLOD Points to unlock character
              pieces. Locked items show their point threshold.
            </Text>
          </View>
        ) : (
          <View style={styles.chipRow}>
            {preview.map((row) => {
              const locked = row.state === 'locked';
              const equipped = row.state === 'equipped';
              const newly = row.state === 'newly_unlocked';

              return (
                <View
                  key={row.item.id}
                  style={[
                    styles.chip,
                    {
                      borderColor: equipped
                        ? theme.accent
                        : locked
                          ? theme.border
                          : theme.border,
                      backgroundColor: equipped
                        ? theme.accentSoft
                        : locked
                          ? theme.surfaceMuted
                          : theme.surface,
                      opacity: locked ? 0.72 : 1,
                    },
                  ]}
                >
                  {locked ? (
                    <MaterialCommunityIcons
                      name="lock-outline"
                      size={11}
                      color={theme.textMuted}
                    />
                  ) : equipped ? (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={11}
                      color={theme.accent}
                    />
                  ) : newly ? (
                    <MaterialCommunityIcons
                      name="star-circle"
                      size={11}
                      color={theme.warning}
                    />
                  ) : null}
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: locked
                          ? theme.textMuted
                          : theme.textSecondary,
                      },
                    ]}
                  >
                    {row.item.name}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </Pressable>
    </PointsFocusCard>
  );
}
