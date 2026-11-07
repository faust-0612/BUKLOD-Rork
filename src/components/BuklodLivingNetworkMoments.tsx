import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { openMemberConnect, openMemberProfile } from '@/lib/buklodMemberProfile';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';

type NetworkCelebration = {
  event_id: number;
  event_kind: 'new_member' | 'birthday';
  subject_user_id: string;
  subject_name: string;
  scope_label: string | null;
  occurred_at: string;
};

/**
 * BUKLOD R1: celebratory community cards for consented followers,
 * active Cluster members, and active Organization members.
 * The RPC alone decides authorized audience, not device-side filtering.
 */
export default function BuklodLivingNetworkMoments() {
  const { user } = useAuth();
  const { online } = useNetwork();
  const { theme } = useBuklodTheme();
  const [items, setItems] = useState<NetworkCelebration[]>([]);
  const userId = user?.id ?? null;

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!userId) {
      setItems([]);
      return () => { active = false; };
    }
    if (!online) return () => { active = false; };

    void withBuklodTimeout(
      supabase.rpc('buklod_living_network_celebrations' as any),
      4500, 'BUKLOD network celebrations'
    ).then(({ data, error }: any) => {
      if (!active || error) return;
      const seen = new Set<string>();
      const valid: NetworkCelebration[] = [];
      for (const row of data ?? []) {
        if (!row || (row.event_kind !== 'new_member' && row.event_kind !== 'birthday')
          || typeof row.subject_user_id !== 'string'
          || row.subject_user_id === userId
          || typeof row.event_id !== 'number') continue;
        const key = row.event_kind + ':' + row.subject_user_id;
        if (seen.has(key)) continue;
        seen.add(key);
        valid.push({
          event_id: row.event_id,
          event_kind: row.event_kind,
          subject_user_id: row.subject_user_id,
          subject_name: String(row.subject_name || 'BUKLOD member').slice(0, 80),
          scope_label: row.scope_label ? String(row.scope_label).slice(0, 80) : null,
          occurred_at: String(row.occurred_at || ''),
        });
      }
      if (active) setItems(valid.slice(0, 3));
    }).catch(() => {
      // Existing Wall, posts and native interactions are unaffected.
    });
    return () => { active = false; };
  }, [userId, online]));

  if (!userId || items.length === 0) return null;

  return (
    <View style={[styles.section, { borderColor: theme.border }]}
      accessibilityLabel="Mga pagbati at bagong kasama sa BUKLOD">
      <View style={styles.header}>
        <MaterialCommunityIcons name="party-popper" size={19} color={theme.accent} />
        <Text style={[styles.heading, { color: theme.textPrimary }]}>
          BUKLOD Celebrates
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Mga kakilala sa Cluster, Organization at followers
        </Text>
      </View>
      {items.map(item => {
        const birthday = item.event_kind === 'birthday';
        return (
          <View key={item.event_id}
            style={[styles.event, { backgroundColor: theme.inputSurface, borderColor: theme.border }]}>
            <View style={[styles.circle, { backgroundColor: theme.accentSoft }]}>
              <MaterialCommunityIcons
                name={birthday ? 'cake-variant-outline' : 'account-heart-outline'}
                size={23} color={theme.accent}
              />
            </View>
            <View style={styles.content}>
              <Text style={[styles.name, { color: theme.textPrimary }]}>
                {birthday ? '🎉 Maligayang kaarawan!' : '💚 May bagong kasama tayo!'}
              </Text>
              <Text style={[styles.message, { color: theme.textMuted }]}>
                {birthday
                  ? item.subject_name + ' ay may kaarawan. Batiin natin!'
                  : 'I-welcome natin si ' + item.subject_name +
                    (item.scope_label ? ' sa ' + item.scope_label : ' sa BUKLOD') + '!'}
              </Text>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={'Batiin si ' + item.subject_name}
                  onPress={() => openMemberConnect(item.subject_user_id, item.subject_name)}
                  style={[styles.action, { backgroundColor: theme.accentSoft }]}
                >
                  <MaterialCommunityIcons name="message-text-outline"
                    color={theme.accent} size={16} />
                  <Text style={[styles.actionText, { color: theme.accent }]}>Batiin</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={'Tingnan ang profile ni ' + item.subject_name}
                  onPress={() => openMemberProfile(item.subject_user_id, item.subject_name)}
                  style={styles.profileAction}
                >
                  <Text style={[styles.profileText, { color: theme.textMuted }]}>Profile</Text>
                </Pressable>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 10, marginBottom: 12,
    borderWidth: 1, borderRadius: 18, padding: 13,
  },
  header: {
    gap: 8, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 10,
  },
  heading: { fontSize: 13, fontWeight: '900' },
  subtitle: { fontSize: 10, flexBasis: '100%' },
  event: {
    padding: 12, borderWidth: 1, borderRadius: 14,
    flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start',
  },
  circle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { flex: 1, gap: 5 },
  name: { fontSize: 14, fontWeight: '900' },
  message: { fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  action: {
    borderRadius: 10, minHeight: 38, paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
  },
  actionText: { fontSize: 12, fontWeight: '800' },
  profileAction: { minHeight: 38, paddingHorizontal: 10, justifyContent: 'center' },
  profileText: { fontSize: 12, fontWeight: '700' },
});
