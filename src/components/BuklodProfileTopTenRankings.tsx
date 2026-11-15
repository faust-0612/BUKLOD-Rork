import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Pressable, Text, View} from 'react-native';
import {router, useFocusEffect} from 'expo-router';
import {resolvePersonDisplayName} from '@/lib/buklodPersonDisplay';
import {parseBuklodProfileTopTen, type BuklodProfileTopRank} from '@/lib/buklodProfileRankings';
import {supabase} from '@/lib/supabase';
import {useAuth} from '@/providers/AuthProvider';
import {useBuklodTheme} from '@/providers/BuklodThemeProvider';

type Period = 'monthly' | 'all_time';
type RankingState = {
  userId: string;
  period: Period;
  status: 'loading' | 'ready' | 'error';
  rows: BuklodProfileTopRank[];
};

/** Visible, bounded Top 10 for the authenticated Profile, not a navigation-only badge. */
export default function BuklodProfileTopTenRankings({userId}: {userId: string}) {
  const {user} = useAuth();
  const viewerId = user?.id ?? null;
  const {theme} = useBuklodTheme();
  const [period, setPeriod] = useState<Period>('monthly');
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<RankingState | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    if (!viewerId || viewerId !== userId) return () => {active = false;};
    setResult({userId, period, status: 'loading', rows: []});

    // Reuse the same authenticated, capped RPC as the existing Points screen.
    // A slow network cannot keep this card spinning indefinitely.
    const query = Promise.resolve((supabase as any).rpc('get_buklod_points_leaderboard', {
      p_period: period,
      p_limit: 10,
      p_church_id: null,
    }));
    const deadline = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('ranking_timeout')), 12000);
    });

    void Promise.race([query, deadline])
      .then((response: any) => {
        if (!active) return;
        const rows = !response?.error ? parseBuklodProfileTopTen(response?.data) : null;
        setResult({userId, period, status: rows === null ? 'error' : 'ready', rows: rows ?? []});
      })
      .catch(() => {
        if (active) setResult({userId, period, status: 'error', rows: []});
      })
      .finally(() => {if (timeout) clearTimeout(timeout);});

    return () => {
      active = false;
      if (timeout) clearTimeout(timeout);
    };
  }, [viewerId, userId, period, retry]));

  if (!viewerId || viewerId !== userId) return null;
  const current = result?.userId === userId && result.period === period ? result : null;
  const status = current?.status ?? 'loading';
  const rows = current?.rows ?? [];

  return (
    <View style={{marginHorizontal: 16, marginTop: 8, padding: 10,
      borderRadius: 15, borderWidth: 1, borderColor: theme.border,
      backgroundColor: theme.cardSurface, gap: 6}}>
      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8}}>
        <Text allowFontScaling style={{fontSize: 15, fontWeight: '900', color: theme.textPrimary}}>
          TOP 10 RANKINGS
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="See full Points leaderboard"
          style={{minHeight: 44, justifyContent: 'center'}}
          onPress={() => router.push('/points' as any)}>
          <Text allowFontScaling style={{color: theme.accent, fontWeight: '800'}}>See all</Text>
        </Pressable>
      </View>
      <View style={{flexDirection: 'row', gap: 6}}>
        {(['monthly', 'all_time'] as const).map(next => (
          <Pressable key={next} accessibilityRole="button"
            accessibilityLabel={next === 'monthly' ? 'Monthly Top 10 ranking' : 'All-Time Top 10 ranking'}
            accessibilityState={{selected: period === next}}
            onPress={() => setPeriod(next)}
            style={{flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center',
              justifyContent: 'center', borderWidth: 1, borderColor: theme.border,
              backgroundColor: period === next ? theme.accentSoft : theme.cardSurface}}>
            <Text allowFontScaling style={{fontSize: 13, fontWeight: '900',
              color: period === next ? theme.accent : theme.textSecondary}}>
              {next === 'monthly' ? 'MONTHLY' : 'ALL-TIME'}
            </Text>
          </Pressable>
        ))}
      </View>
      {status === 'loading' ? (
        <View style={{minHeight: 72, justifyContent: 'center'}}>
          <ActivityIndicator color={theme.accent}/>
          <Text allowFontScaling style={{color: theme.textMuted, textAlign: 'center', fontSize: 12}}>
            Loading Top 10…
          </Text>
        </View>
      ) : status === 'error' ? (
        <View style={{gap: 6}}>
          <Text allowFontScaling style={{color: theme.textMuted, fontSize: 13}}>
            Hindi makuha ang ranking ngayon. Hindi papalitan ng gawa-gawang puwesto.
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry Top 10 ranking"
            onPress={() => setRetry(value => value + 1)}
            style={{minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start'}}>
            <Text allowFontScaling style={{color: theme.accent, fontWeight: '800'}}>Retry ranking</Text>
          </Pressable>
        </View>
      ) : rows.length === 0 ? (
        <Text allowFontScaling style={{color: theme.textMuted, fontSize: 13}}>
          Wala pang eligible na Points ranking sa panahong ito.
        </Text>
      ) : rows.map(item => {
        const mine = item.user_id === viewerId;
        return (
          <View key={period + ':' + item.user_id} style={{flexDirection: 'row', alignItems: 'center',
            minHeight: 38, borderRadius: 9, gap: 7, paddingHorizontal: 6, paddingVertical: 3,
            backgroundColor: mine ? theme.accentSoft : theme.cardSurface}}>
            <Text allowFontScaling style={{width: 26, textAlign: 'center',
              color: theme.accent, fontSize: 17, fontWeight: '900'}}>
              {item.rank_position}
            </Text>
            <Text allowFontScaling numberOfLines={1}
              style={{flex: 1, minWidth: 0, fontSize: 13, fontWeight: mine ? '900' : '700',
                color: theme.textPrimary}}>
              {mine ? 'Ikaw · ' : ''}{resolvePersonDisplayName(item.full_name, item.user_id)}
            </Text>
            <Text allowFontScaling style={{fontSize: 12, fontWeight: '800', color: theme.textSecondary}}>
              {item.total_points.toLocaleString('en-PH')} pts
            </Text>
          </View>
        );
      })}
      <Text allowFontScaling style={{fontSize: 11, color: theme.textMuted}}>
        {period === 'monthly' ? 'Current calendar month (Philippine time).' : 'All-time recorded Points.'}
        {' '}Only server-qualified members appear; earnings and payouts are separate.
      </Text>
    </View>
  );
}
