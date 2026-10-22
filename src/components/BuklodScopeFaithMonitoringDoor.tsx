/* BUKLOD_V28_R3_FAITH_MONITORING_DOOR: scoped data loads only after opening. */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { BuklodScope } from '@/lib/buklodScope';
import { scopeRouteParams } from '@/lib/buklodScopeManage';

export default function BuklodScopeFaithMonitoringDoor({ scope }: { scope: BuklodScope }) {
  if (!scope.show_faith_content) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open Faith Monitoring"
      onPress={() => router.push({
        pathname: '/scope/faith-monitoring' as any,
        params: scopeRouteParams(scope.scope_id),
      } as any)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.icon}>
        <MaterialCommunityIcons name="book-check-outline" color="#0874DE" size={26} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Faith Monitoring</Text>
        <Text style={styles.subtitle}>Daily Reading, Devotion, BUKLOD Lesson and member progress</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color="#0874DE" />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: { width: '100%', minHeight: 92, padding: 13, borderRadius: 16, borderWidth: 1,
    borderColor: '#DBE9F8', backgroundColor: '#FFFFFF', flexDirection: 'row',
    alignItems: 'center', gap: 10 },
  icon: { width: 48, height: 48, borderRadius: 13, backgroundColor: '#EAF4FF',
    justifyContent: 'center', alignItems: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 14, fontWeight: '900', color: '#113C72' },
  subtitle: { fontSize: 11, lineHeight: 17, color: '#596F8D' },
});
