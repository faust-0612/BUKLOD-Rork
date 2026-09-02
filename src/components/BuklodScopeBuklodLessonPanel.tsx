import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import {
  buildScopeBuklodLessonHubPath,
} from '@/lib/buklodLessonStages';
import { fetchScopeFaithAccessStatusResilient } from '@/lib/buklodScopeFaithAccess';
import type { BuklodScope } from '@/lib/buklodScope';
import { colors } from '@/lib/theme';

type Props = {
  scope: BuklodScope;
};

export default function BuklodScopeBuklodLessonPanel({
  scope,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [stageCount] = useState(7);
  const [mzbExempt, setMzbExempt] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    const access = await fetchScopeFaithAccessStatusResilient(
      scope.scope_id,
    );

    setMzbExempt(access.is_mzb_scope_exempt);
    setUnlockedCount(
      access.lesson_stages.filter((stage) => stage.scope_unlocked)
        .length,
    );
    setLoading(false);
  }, [scope.scope_id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!scope.show_faith_content) {
    return null;
  }

  const openPortal = () => {
    router.push(
      buildScopeBuklodLessonHubPath(scope.scope_id) as any,
    );
  };

  return (
    <Pressable
      onPress={openPortal}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardHead}>
        <View style={styles.headIcon}>
          <MaterialCommunityIcons
            name="school-outline"
            size={22}
            color={colors.greenDark}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>BUKLOD LESSON</Text>
          <Text style={styles.cardSubtitle}>
            BUKLOD 101–107 learning portal for {scope.name}
          </Text>
        </View>

        <View style={styles.openBadge}>
          <Text style={styles.openBadgeText}>OPEN</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={18}
            color={colors.greenDark}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.metaRow}>
          <ActivityIndicator size="small" color={colors.green} />
          <Text style={styles.metaText}>Opening lesson portal...</Text>
        </View>
      ) : mzbExempt ? (
        <Text style={styles.metaText}>
          MZB — all BUKLOD 101–107 lesson stages are FREE for this scope.
        </Text>
      ) : (
        <Text style={styles.metaText}>
          {unlockedCount} of {stageCount} scope stages unlocked · tap to open
          lessons
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 10,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#173B2F',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  cardSubtitle: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 14,
  },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 999,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  openBadgeText: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '900',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    color: '#5F6F67',
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
});
