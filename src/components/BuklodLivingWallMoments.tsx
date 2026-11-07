import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import {
  buildBuklodLivingMoments,
  type BuklodLivingMoment,
} from '@/lib/buklodLivingMoments';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodTheme } from '@/providers/BuklodThemeProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { useNotifications } from '@/providers/NotificationProvider';

const HIDE_PREFIX = 'buklod:living-moments:seen:v1:';
const REMOTE_TIMEOUT_MS = 4500;

function seenKey(userId: string, key: string) {
  return HIDE_PREFIX + userId + ':' + key;
}

/**
 * One quiet, actionable Wall/Home moment at a time.
 * No wall-post inserts, point rewards, permissions changes, or push spam.
 * Birthday is read ONLY from the signed-in person's own profile.
 */
export default function BuklodLivingWallMoments() {
  const { user, profile } = useAuth();
  const { activeScope } = useBuklodScope();
  const { theme } = useBuklodTheme();
  const { online } = useNetwork();
  const { unreadCount } = useNotifications();
  const [moment, setMoment] = useState<BuklodLivingMoment | null>(null);
  const userId = user?.id ?? null;
  const firstName = profile?.first_name ?? profile?.full_name ?? null;
  const faithEnabled = activeScope?.show_faith_content === true;

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!userId) {
      setMoment(null);
      return () => { active = false; };
    }
    const load = async () => {
      let joinedAt = user?.created_at ?? null;
      let birthDate: string | null = null;
      let latestKl: {
        id: string;
        title: string;
        episode_number: number;
        release_at: string;
      } | null = null;

      if (online) {
        try {
          const [ownProfile, release] = await withBuklodTimeout(
            Promise.all([
              supabase.from('profiles')
                .select('birth_date,created_at')
                .eq('id', userId)
                .maybeSingle(),
              supabase.from('kl_episodes')
                .select('id,title,episode_number,release_at')
                .eq('status', 'approved')
                .lte('release_at', new Date().toISOString())
                .order('release_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
            ]),
            REMOTE_TIMEOUT_MS,
            'BUKLOD living moments'
          );
          if (!ownProfile.error) {
            birthDate = ownProfile.data?.birth_date ?? null;
            joinedAt = ownProfile.data?.created_at ?? joinedAt;
          }
          if (!release.error && release.data?.release_at) {
            latestKl = release.data as typeof latestKl;
          }
        } catch {
          // The user may be on 3G/offline: keep the lightweight local welcome/suggestion.
        }
      }
      const candidates = buildBuklodLivingMoments({
        now: new Date(),
        userId,
        firstName,
        joinedAt,
        birthDate,
        latestKl,
        faithEnabled,
        unreadCount,
      });
      try {
        const seen = await AsyncStorage.multiGet(
          candidates.map(item => seenKey(userId, item.key))
        );
        const hidden = new Set(seen.filter(([, value]) => value === '1').map(([key]) => key));
        if (active) setMoment(
          candidates.find(item => !hidden.has(seenKey(userId, item.key))) ?? null
        );
      } catch {
        if (active) setMoment(candidates[0] ?? null);
      }
    };
    void load();
    return () => { active = false; };
  }, [userId, user?.created_at, firstName, faithEnabled, online, unreadCount]));

  const dismiss = useCallback(() => {
    if (!userId || !moment) return;
    const key = seenKey(userId, moment.key);
    setMoment(null);
    void AsyncStorage.setItem(key, '1').catch(() => undefined);
  }, [userId, moment]);

  if (!userId || !moment) return null;

  return (
    <View
      style={[styles.card, {
        backgroundColor: theme.surface,
        borderColor: theme.border,
      }]}
      accessibilityLabel={'Mensahe mula sa BUKLOD: ' + moment.title}
    >
      <View style={styles.heading}>
        <View style={[styles.iconCircle, { backgroundColor: theme.accentSoft }]}>
          <MaterialCommunityIcons name="heart-multiple-outline" color={theme.accent} size={23} />
        </View>
        <Text style={[styles.kicker, { color: theme.accent }]}>MULA SA BUKLOD</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Huwag munang ipakita ang pagbating ito"
          hitSlop={12}
          onPress={dismiss}
          style={styles.dismiss}
        >
          <MaterialCommunityIcons name="close" size={21} color={theme.textMuted} />
        </Pressable>
      </View>
      <Text style={[styles.title, { color: theme.textPrimary }]}>{moment.title}</Text>
      <Text style={[styles.message, { color: theme.textMuted }]}>{moment.message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={moment.actionLabel}
        style={[styles.action, { backgroundColor: theme.accentSoft }]}
        onPress={() => {
          dismiss();
          router.push(moment.route as any);
        }}
      >
        <Text style={[styles.actionText, { color: theme.accent }]}>{moment.actionLabel}</Text>
        <MaterialCommunityIcons name="arrow-right" size={19} color={theme.accent} />
      </Pressable>
      {moment.kind === 'welcome' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ipakilala ang sarili sa Community Wall"
          style={styles.welcomeLink}
          onPress={() => {
            dismiss();
            router.push({
              pathname: '/buklod' as any,
              params: {
                homeTodayIntent: String(Date.now()),
                homeTodayDraft: 'Kumusta! Bago ako sa BUKLOD. Masaya akong makilala kayo! 💚',
              },
            } as any);
          }}
        >
          <Text style={[styles.welcomeLinkText, { color: theme.accent }]}>Ipakilala ako sa Wall (ikaw ang magpo-post)</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 10, marginTop: 10, marginBottom: 12, padding: 17,
    borderRadius: 20, borderWidth: 1,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  iconCircle: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 1, flex: 1 },
  dismiss: { padding: 8, minHeight: 40, minWidth: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  message: { fontSize: 13, lineHeight: 20, marginTop: 6 },
  action: {
    marginTop: 14, alignSelf: 'flex-start', paddingHorizontal: 14,
    paddingVertical: 11, borderRadius: 12, flexDirection: 'row',
    alignItems: 'center', gap: 8, minHeight: 44,
  },
  actionText: { fontWeight: '800', fontSize: 13 },
  welcomeLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingVertical: 9 },
  welcomeLinkText: { fontSize: 12, fontWeight: '700' },
});
