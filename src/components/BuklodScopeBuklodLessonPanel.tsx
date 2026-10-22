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
      <View style={styles.art} pointerEvents="none">
        <MaterialCommunityIcons
          name="book-open-page-variant"
          size={72}
          color="#B7E4C7"
        />
        <MaterialCommunityIcons
          name="leaf"
          size={22}
          color="#7DCEA0"
          style={styles.artLeaf}
        />
      </View>

      <View style={styles.cardHead}>
        <View style={styles.headIcon}>
          <MaterialCommunityIcons
            name="school-outline"
            size={26}
            color="#1F8A4C"
          />
        </View>

        <View style={styles.copy}>
          <Text style={styles.eyebrow}>BUKLOD LESSON</Text>
          <Text style={styles.cardTitle}>BUKLOD LESSON</Text>
          <Text style={styles.cardSubtitle}>
            BUKLOD 101–107 learning portal for {scope.name}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        {loading ? (
          <View style={styles.metaRow}>
            <ActivityIndicator size="small" color={colors.green} />
            <Text style={styles.metaText}>Opening lesson portal...</Text>
          </View>
        ) : (
          <Text style={styles.metaText}>
            {mzbExempt
              ? 'MZB — all BUKLOD 101–107 lesson stages are FREE for this scope.'
              : `${unlockedCount} of ${stageCount} scope stages unlocked · tap to open lessons`}
          </Text>
        )}

        <View style={styles.openButton}>
          <Text style={styles.openButtonText}>Open</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={18}
            color="#FFFFFF"
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 14,
    overflow: 'hidden',
    shadowColor: '#16324A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.94,
  },
  art: {
    position: 'absolute',
    right: 8,
    top: 8,
    opacity: 0.95,
  },
  artLeaf: {
    position: 'absolute',
    right: 4,
    top: 6,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingRight: 64,
  },
  headIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#E5F6EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: '#1F8A4C',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  cardTitle: {
    marginTop: 2,
    color: '#17324A',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
  },
  cardSubtitle: {
    marginTop: 4,
    color: '#6A7B90',
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    flex: 1,
    color: '#6A7B90',
    fontSize: 12,
    lineHeight: 17,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 999,
    backgroundColor: '#1F9D55',
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 10,
  },
  openButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
