import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import {
  buildScopeBuklodLessonHubPath,
} from '@/lib/buklodLessonStages';
import type { BuklodScope } from '@/lib/buklodScope';

type Props = {
  scope: BuklodScope;
};

export default function BuklodScopeBuklodLessonPanel({
  scope,
}: Props) {
  // R3: this is a doorway, not a dashboard data dependency.
  // The destination performs the real stage/access check after the user opens it.

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
            color="#FFFFFF"
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
            color="#FFFFFF"
          />
        </View>
      </View>

      <Text style={styles.metaText}>BUKLOD 101–107 • Tap to open lessons and view available stages.</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#6754D9',
    backgroundColor: '#5845C5',
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
    backgroundColor: '#E39B17',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  cardSubtitle: {
    marginTop: 2,
    color: '#F0ECFF',
    fontSize: 10,
    lineHeight: 14,
  },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 999,
    backgroundColor: '#246B53',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  openBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    color: '#F0ECFF',
    fontSize: 11,
    lineHeight: 16,
  },
});

