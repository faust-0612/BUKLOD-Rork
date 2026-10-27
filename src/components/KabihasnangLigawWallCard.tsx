import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';

import KlCoverImage from '@/components/kabihasnang-ligaw/KlCoverImage';
import { KL_SEASON_ONE_ID } from '@/lib/kabihasnang-ligaw/catalog';
import { klCopy } from '@/lib/kabihasnang-ligaw/copy';
import { selectReaderSeries } from '@/lib/kabihasnang-ligaw/seriesProgress';
import { isNewKlRelease } from '@/lib/kabihasnang-ligaw/releaseBadge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';

type LatestChapter = { id: string; title: string; season_number: number; episode_number: number; release_at: string };
type ReleaseCard = {
  latest: LatestChapter | null;
  completed_readers: number;
  readers: { name: string }[];
  preferences?: { release_alerts?: boolean; show_completion?: boolean };
  points_per_chapter?: number;
  season_bonus?: number;
};

/** Community Wall KL release doorway. One bounded read per focus window, no DB subscription. */
export default function KabihasnangLigawWallCard() {
  const router = useRouter();
  const { user } = useAuth();
  const { online } = useNetwork();
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const [currentSeriesId, setCurrentSeriesId] = useState<string | null>(null);
  const [card, setCard] = useState<ReleaseCard | null>(null);
  const [seenRelease, setSeenRelease] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const latestFetch = useRef(0);
  const requestSequence = useRef(0);

  const seenKey = `kl.seenRelease.v1.${user?.id ?? 'device'}`;
  const load = useCallback(async (force = false) => {
    const sequence = ++requestSequence.current;
    const [reading, seen] = await Promise.all([
      AsyncStorage.getItem(`kl.reader.v1.${user?.id ?? 'device'}`),
      AsyncStorage.getItem(seenKey),
    ]);
    if (sequence !== requestSequence.current) return;
    try {
      const parsed = reading ? JSON.parse(reading) as { lastEpisodeId?: string | null } : null;
      setCurrentSeriesId(parsed?.lastEpisodeId ? KL_SEASON_ONE_ID : null);
    } catch { setCurrentSeriesId(null); }
    setSeenRelease(seen ?? '');
    if (!online || (!force && Date.now() - latestFetch.current < 60000)) return;
    latestFetch.current = Date.now();
    const { data, error } = await supabase.rpc('kl_latest_release_card_v1');
    if (sequence !== requestSequence.current) return;
    if (error) { setFeedback('Hindi ma-check ang bagong kabanata. Buksan ang library para mag-refresh.'); return; }
    setCard(data as ReleaseCard);
    setFeedback('');
  }, [online, seenKey, user?.id]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { requestSequence.current += 1; };
  }, [load]));

  const seriesId = selectReaderSeries({ currentSeriesId, completedSeriesIds: [] });
  const latest = card?.latest ?? null;
  const newRelease = isNewKlRelease(latest?.id, seenRelease);
  const alertOn = card?.preferences?.release_alerts === true;
  const open = () => {
    router.push((latest ? `/kabihasnang-ligaw?episodeId=${encodeURIComponent(latest.id)}` : '/kabihasnang-ligaw') as never);
  };
  const toggleAlerts = async () => {
    if (busy) return;
    setBusy(true);
    setFeedback('Sine-save ang KL notification preference…');
    try {
      const { data, error } = await supabase.rpc('kl_reader_preferences_v1', { p_release_alerts: !alertOn });
      if (error) throw error;
      const next = data as { release_alerts?: boolean } | null;
      if (typeof next?.release_alerts !== 'boolean') throw new Error('Hindi nakumpirma ang preference.');
      setCard((previous) => previous ? { ...previous,
        preferences: { ...previous.preferences, release_alerts: next.release_alerts },
      } : previous);
      setFeedback(next.release_alerts
        ? 'Naka-on: padadalhan ka ng notification kapag may bagong official release.'
        : 'Naka-off: walang KL release push notifications. Makikita mo pa rin ang BAGONG badge.');
    } catch (error) {
      setFeedback('Hindi na-save: ' + (error instanceof Error ? error.message : 'Try again.'));
    } finally { setBusy(false); }
  };

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={latest ? 'Basahin ang bagong KL kabanata' : klCopy.openLibrary}
      onPress={open} style={[styles.card, compact && styles.cardCompact]}>
      {seriesId === KL_SEASON_ONE_ID ? <KlCoverImage variant="series" lowBandwidth={!online} /> : null}
      <View style={[styles.copy, compact && styles.copyCompact]}>
        <View style={styles.badgeRow}>
          <Text style={styles.identity}>KABIHASNANG LIGAW · ILLUSTRATED STORY</Text>
          {newRelease ? <Text style={styles.newBadge}>✦ BAGONG KABANATA</Text> : null}
        </View>
        <Text style={styles.title}>{latest ? latest.title : 'May mundong naghihintay tuklasin.'}</Text>
        <Text style={styles.subtitle}>{latest
          ? `Serye ${latest.season_number} · Kabanata ${latest.episode_number} · Handa nang basahin`
          : 'Abangan ang unang opisyal na paglabas ng kuwento. Mga eksena, musika, at hiwagang unti-unting mabubunyag.'}</Text>
        <View style={styles.pointRibbon}>
          <Text style={styles.points}>✦ +{card?.points_per_chapter ?? 7} BUKLOD Points</Text>
          <Text style={styles.pointDetail}>Sa unang verified na pagtapos ng isang kabanata · +{card?.season_bonus ?? 10} bonus sa kumpletong 30-kabanatang serye</Text>
        </View>
        {latest ? (
          <View style={styles.readerRow}>
            <Text style={styles.readers}>{card?.completed_readers ?? 0} nakatapos nang bumasa</Text>
            {card?.readers?.length ? <Text style={styles.readerNames}>Kabilang sina {card.readers.map((reader) => reader.name).join(', ')}</Text> : null}
          </View>
        ) : null}
        <View style={styles.actionRow}><Text style={styles.action}>{latest ? 'BASAHIN ANG KABANATA  →' : 'TUKLASIN ANG KL LIBRARY  →'}</Text></View>
        <Pressable accessibilityRole="button" accessibilityState={{disabled:busy,checked:alertOn}}
          disabled={busy} onPress={(event) => { event.stopPropagation(); void toggleAlerts(); }}
          style={[styles.alertButton, alertOn && styles.alertOn]}>
          <Text style={styles.alertText}>{busy ? 'Saving…' : alertOn ? '🔔 Abiso sa bagong release: ON' : '🔔 Abangan ang release · I-on ang notif'}</Text>
        </Pressable>
        {feedback ? <Text accessibilityRole="alert" style={styles.feedback}>{feedback}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 10, marginVertical: 12, borderRadius: 24, backgroundColor: '#142a28',
    borderWidth: 1, borderColor: '#a28b5a', overflow: 'hidden' },
  cardCompact: { marginHorizontal: 8 },
  copy: { paddingHorizontal: 22, paddingVertical: 18, gap: 11 },
  copyCompact: { paddingHorizontal: 16 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  identity: { color: '#c4dfd0', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  newBadge: { backgroundColor: '#f1d39b', color: '#1b342c', fontSize: 11,
    fontWeight: '900', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 40 },
  title: { color: '#fff1cc', fontSize: 23, fontWeight: '900', lineHeight: 28 },
  subtitle: { color: '#d0e3d8', fontSize: 14, lineHeight: 21 },
  pointRibbon: { backgroundColor: '#325749', borderRadius: 13, padding: 12, gap: 4 },
  points: { color: '#ffdc88', fontSize: 16, fontWeight: '900' },
  pointDetail: { color: '#f0ead5', fontSize: 12, lineHeight: 18 },
  readerRow: { gap: 4 },
  readers: { color: '#fff4df', fontWeight: '800', fontSize: 14 },
  readerNames: { color: '#c0dacf', fontSize: 12 },
  actionRow: { backgroundColor: '#e4b65d', borderRadius: 10, alignSelf: 'flex-start', padding: 11 },
  action: { color: '#19372e', fontSize: 13, fontWeight: '900' },
  alertButton: { borderWidth: 1, borderColor: '#74968b', padding: 10, borderRadius: 10, alignSelf: 'flex-start' },
  alertOn: { backgroundColor: '#325749' },
  alertText: { color: '#e5f1e7', fontSize: 13, fontWeight: '700' },
  feedback: { color: '#cce9e0', fontSize: 12 },
});
