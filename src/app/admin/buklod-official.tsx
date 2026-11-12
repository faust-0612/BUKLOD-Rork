import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AdminGate } from '@/components/AdminGate';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type OfficialStats = {
  is_official: boolean;
  display_name: string;
  points_eligible: boolean;
  qmp_eligible: boolean;
  payout_eligible: boolean;
  official_posts: number;
  official_replies: number;
  published_bulletins: number;
};

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const DOORS: { title: string; subtitle: string; icon: IconName; path: string }[] = [
  { title: 'Official Announcements', subtitle: 'Public Home and profile announcement boards', icon: 'bullhorn-outline', path: '/admin/system-announcement-boards' },
  { title: 'Community Wall', subtitle: 'Publish, comment and react as BUKLOD Official', icon: 'comment-text-multiple-outline', path: '/(tabs)/buklod' },
  { title: 'Spotlight & Bulletins', subtitle: 'Recognize members, clusters and accomplishments', icon: 'star-circle-outline', path: '/admin/mission-bulletins' },
  { title: 'BSOC Live Support', subtitle: 'Official support conversations and escalations', icon: 'headset', path: '/admin/bsoc-support' },
  { title: 'System Administration', subtitle: 'Private platform configuration and finance controls', icon: 'shield-crown-outline', path: '/admin' },
];

export default function BuklodOfficialConsole() {
  const { user } = useAuth();
  const [stats, setStats] = useState<OfficialStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc('get_my_buklod_official_dashboard_v1');
      if (rpcError) throw rpcError;
      if (!data?.is_official) throw new Error('Only the protected BUKLOD Official account can open this console.');
      setStats(data as OfficialStats);
      setError(null);
    } catch (e: any) {
      setStats(null);
      setError(String(e?.message ?? 'Official console is unavailable.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setStats(null);
      setLoading(false);
      return;
    }
    void load();
  }, [load, user?.id]);

  return (
    <AdminGate>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        <View style={styles.hero}>
          <MaterialCommunityIcons name="check-decagram" size={34} color="#26734C" />
          <Text style={styles.eyebrow}>PROTECTED PLATFORM IDENTITY</Text>
          <Text style={styles.title}>BUKLOD Official</Text>
          <Text style={styles.intro}>Official voice and community interaction. This account does not earn member points, QMP or payouts.</Text>
        </View>

        {loading && !stats ? <ActivityIndicator color="#26734C" size="large" /> : null}
        {!!error && (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Official verification unavailable</Text>
            <Text style={styles.subtle}>{error}</Text>
            <Pressable onPress={() => void load()} style={styles.retry}>
              <Text style={styles.retryText}>RETRY VERIFICATION</Text>
            </Pressable>
          </View>
        )}

        {!!stats && (
          <>
            <View style={styles.metrics}>
              <View style={styles.metric}>
                <Text style={styles.number}>{stats.official_posts}</Text>
                <Text style={styles.small}>Official Posts</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.number}>{stats.official_replies}</Text>
                <Text style={styles.small}>Replies</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.number}>{stats.published_bulletins}</Text>
                <Text style={styles.small}>Bulletins</Text>
              </View>
            </View>

            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Community Management</Text>
              <Text style={styles.subtle}>Official interactions continue normally. Member reward ledgers, QMP shares, Kingdom progression and cash payouts are separate.</Text>
            </View>

            {DOORS.map((door) => (
              <Pressable
                accessibilityRole="button"
                key={door.title}
                onPress={() => router.push(door.path as any)}
                style={({ pressed }) => [styles.action, pressed && { opacity: 0.72 }]}
              >
                <MaterialCommunityIcons name={door.icon} size={23} color="#26734C" />
                <View style={styles.actionBody}>
                  <Text style={styles.actionTitle}>{door.title}</Text>
                  <Text style={styles.subtle}>{door.subtitle}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" color="#718078" size={24} />
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F9F7' },
  content: { padding: 18, paddingBottom: 48, gap: 13, maxWidth: 660, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', borderRadius: 20, padding: 22, gap: 9, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE9E0' },
  eyebrow: { fontSize: 10, fontWeight: '900', color: '#26734C', letterSpacing: 1.2 },
  title: { fontSize: 26, fontWeight: '900', color: '#20392A' },
  intro: { fontSize: 13, color: '#587065', lineHeight: 20, textAlign: 'center' },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 4, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE9E0' },
  number: { fontSize: 24, fontWeight: '900', color: '#20392A' },
  small: { fontSize: 11, fontWeight: '700', textAlign: 'center', color: '#587065' },
  notice: { padding: 16, borderRadius: 15, backgroundColor: '#EEF7F1', gap: 6, borderWidth: 1, borderColor: '#DCE9E0' },
  noticeTitle: { fontSize: 15, fontWeight: '900', color: '#20392A' },
  subtle: { fontSize: 12, lineHeight: 18, color: '#587065' },
  retry: { padding: 10, alignSelf: 'flex-start', borderRadius: 9, backgroundColor: '#26734C' },
  retryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  action: { minHeight: 75, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 15, paddingVertical: 11, borderWidth: 1, borderColor: '#DCE9E0', backgroundColor: '#FFFFFF', borderRadius: 15 },
  actionBody: { flex: 1, gap: 4 },
  actionTitle: { fontSize: 15, fontWeight: '800', color: '#20392A' },
});
