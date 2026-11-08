import { BuklodFaithRouteBoundary } from '@/components/BuklodFaithRouteBoundary';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';

type Submission = {
  id: string;
  devotional_id: string;
  devotional_title_snapshot: string | null;
  status: string;
  admin_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};
const COLUMNS = 'id,devotional_id,devotional_title_snapshot,status,admin_note,submitted_at,reviewed_at';

function dateLabel(value: string | null) {
  if (!value) return 'Walang petsa';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'Walang petsa'
    : parsed.toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
      });
}

function priority(row: Submission) {
  return row.status === 'rejected' ? 0 : row.status === 'pending_admin' ? 1 : 2;
}

function MyDevotionalSubmissionsContent() {
  const { submissionId } = useLocalSearchParams<{ submissionId?: string }>();
  const requestedId = typeof submissionId === 'string' ? submissionId.trim() : '';
  const { user } = useAuth();
  const uid = user?.id ?? '';
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  // Refresh whenever a notification opens this screen or the user returns
  // from a revision. Never cache someone's private reflection/review history.
  useFocusEffect(useCallback(() => {
    let alive = true;
    if (!uid) {
      setRows([]);
      setLoading(false);
      return () => { alive = false; };
    }
    // Do not retain another session's private submission cards while changing
    // account, refocusing, or retrying a stale network request.
    setRows([]);
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const list = supabase.from('devotional_reward_submissions')
          .select(COLUMNS)
          .eq('user_id', uid)
          .order('submitted_at', { ascending: false })
          .limit(150);
        // Old notifications can refer to submissions older than the recent
        // list. Fetch that exact id independently, still under own-user RLS.
        const [recent, focused] = await Promise.all([
          list,
          requestedId
            ? supabase.from('devotional_reward_submissions')
                .select(COLUMNS).eq('user_id', uid).eq('id', requestedId).maybeSingle()
            : Promise.resolve(null),
        ]);
        if (recent.error) throw recent.error;
        if (focused?.error) throw focused.error;
        const unique = new Map<string, Submission>();
        for (const row of (recent.data ?? []) as Submission[]) unique.set(row.id, row);
        if (focused?.data) {
          const row = focused.data as Submission;
          unique.set(row.id, row);
        }
        if (alive) {
          setRows(Array.from(unique.values()).sort((a, b) => {
            if (a.id === requestedId) return -1;
            if (b.id === requestedId) return 1;
            const order = priority(a) - priority(b);
            if (order) return order;
            return (b.submitted_at ?? '').localeCompare(a.submitted_at ?? '');
          }));
        }
      } catch {
        if (alive) setError('Hindi ma-load ang iyong devotional submissions. Suriin ang koneksyon at subukan muli.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [uid, requestedId, refreshToken]));

  const revisionCount = rows.filter(x => x.status === 'rejected').length;
  const focusedFound = !requestedId || rows.some(x => x.id === requestedId);

  return <ScrollView style={styles.page} contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={() => setRefreshToken(v => v + 1)}/>}>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
      <MaterialCommunityIcons name="arrow-left" size={18} color={colors.green}/>
      <Text style={styles.link}>Back</Text>
    </Pressable>
    <Text style={styles.title}>My Devotional Submissions</Text>
    <Text style={styles.subtitle}>
      Bawat devotional ay may sariling title, submission date, review status at feedback.
      Piliin lamang ang may markang Kailangang I-revise.
    </Text>

    {!!uid && !loading && <View style={styles.summary}>
      <Text style={styles.summaryTitle}>
        {revisionCount > 0 ? `${revisionCount} devotional(s) need revision` : 'No devotional currently needs revision'}
      </Text>
      <Text style={styles.summaryText}>
        Hindi kailangang hulaan kung alin sa mga devotional ang irerevise.
      </Text>
    </View>}
    {!uid && <Pressable onPress={() => router.push('/(auth)/login' as any)} style={styles.actionButton}>
      <Text style={styles.actionText}>Sign in to see your submissions</Text>
    </Pressable>}
    {!!error && <View style={styles.errorBox}>
      <Text style={styles.errorText}>{error}</Text>
      <Pressable onPress={() => setRefreshToken(v => v + 1)}>
        <Text style={styles.link}>Retry</Text>
      </Pressable>
    </View>}
    {!loading && !error && !focusedFound && <View style={styles.errorBox}>
      <Text style={styles.errorText}>
        Hindi nakita ang eksaktong submission mula sa notification. Hindi kami pipili ng ibang devotional para sa iyo.
      </Text>
    </View>}
    {loading && rows.length === 0 && <ActivityIndicator color={colors.green} size="large"/>}
    {!loading && !error && uid && rows.length === 0 && <Text style={styles.subtitle}>
      Wala ka pang devotional na naisumite.
    </Text>}
    {rows.map(row => {
      const rejected = row.status === 'rejected';
      const pending = row.status === 'pending_admin';
      const focused = !!requestedId && row.id === requestedId;
      return <View key={row.id} style={[styles.card,focused && styles.focusCard,rejected && styles.revisionCard]}>
        {focused && <Text style={styles.current}>MULA SA IYONG NOTIFICATION</Text>}
        <View style={styles.statusRow}>
          <MaterialCommunityIcons name={rejected ? 'alert-circle-outline' : pending ? 'clock-outline' : 'check-circle-outline'}
            color={rejected ? '#A3322B' : pending ? '#8D6718' : '#207148'} size={22}/>
          <Text style={[styles.status,rejected && styles.urgent]}>
            {rejected ? 'KAILANGANG I-REVISE' : pending ? 'KASALUKUYANG SINUSURI'
              : row.status === 'approved' ? 'APPROVED' : row.status.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.devotionalTitle}>
          {row.devotional_title_snapshot?.trim() || 'Daily Devotion'}
        </Text>
        <Text style={styles.date}>Submitted: {dateLabel(row.submitted_at)}</Text>
        {!!row.reviewed_at && <Text style={styles.date}>Reviewed: {dateLabel(row.reviewed_at)}</Text>}
        <Text style={styles.reference}>Submission #{row.id.slice(0, 8).toUpperCase()}</Text>
        {rejected && <View style={styles.feedback}>
          <Text style={styles.feedbackTitle}>Bakit kailangang i-revise?</Text>
          <Text style={styles.feedbackBody}>
            {row.admin_note?.trim() || 'Pakibasa muli at pagandahin ang reflection at application bago mag-resubmit.'}
          </Text>
        </View>}
        {rejected && <Pressable accessibilityRole="button"
          accessibilityLabel={`Revise ${row.devotional_title_snapshot || 'Daily Devotion'}`}
          style={styles.actionButton}
          onPress={() => router.push({
            pathname: '/reflection/[id]',
            params: { id: row.devotional_id, submissionId: row.id },
          } as any)}>
          <Text style={styles.actionText}>REVISE THIS DEVOTIONAL</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color="#FFF"/>
        </Pressable>}
        {!rejected && <Pressable accessibilityRole="button"
          style={styles.secondaryButton}
          onPress={() => router.push(`/devotional/${encodeURIComponent(row.devotional_id)}` as any)}>
          <Text style={styles.link}>View devotional</Text>
        </Pressable>}
      </View>;
    })}
  </ScrollView>;
}

export default function MyDevotionalSubmissionsScreen() {
  const { user } = useAuth();
  return <BuklodFaithRouteBoundary>
    <MyDevotionalSubmissionsContent key={user?.id ?? 'signed-out'}/>
  </BuklodFaithRouteBoundary>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 100, gap: 12 },
  back: { alignSelf: 'flex-start', flexDirection: 'row', gap: 6, alignItems: 'center', padding: 8 },
  link: { color: colors.green, fontWeight: '800', fontSize: 13 },
  title: { fontSize: 25, fontWeight: '900', color: colors.greenDark },
  subtitle: { fontSize: 13, lineHeight: 20, color: colors.muted },
  summary: { padding: 14, borderWidth: 1, borderColor: '#C5E3D0', backgroundColor: '#F0FAF3', borderRadius: 12 },
  summaryTitle: { fontSize: 15, fontWeight: '900', color: '#185F37' },
  summaryText: { fontSize: 12, color: '#577362', marginTop: 4 },
  errorBox: { backgroundColor: '#FFF0EC', padding: 13, borderRadius: 10, gap: 8 },
  errorText: { color: '#8A352D', lineHeight: 19 },
  card: { padding: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 12, gap: 9 },
  focusCard: { borderWidth: 2, borderColor: '#187E4A' },
  revisionCard: { backgroundColor: '#FFFDFB' },
  current: { color: '#0E6E42', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  statusRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  status: { fontSize: 12, fontWeight: '900', color: '#246D4A', flex: 1 },
  urgent: { color: '#A3322B' },
  devotionalTitle: { fontSize: 18, fontWeight: '900', lineHeight: 24, color: colors.text },
  date: { fontSize: 11, color: colors.muted },
  reference: { fontSize: 10, fontWeight: '800', color: colors.muted },
  feedback: { backgroundColor: '#FFF0EB', borderLeftWidth: 3, borderLeftColor: '#B34337', padding: 12, gap: 5 },
  feedbackTitle: { color: '#8B352F', fontWeight: '900', fontSize: 12 },
  feedbackBody: { color: '#5C3D35', fontSize: 13, lineHeight: 20 },
  actionButton: { padding: 13, borderRadius: 10, backgroundColor: '#147344', flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 8 },
  actionText: { color: '#FFF', fontWeight: '900', fontSize: 12 },
  secondaryButton: { alignSelf: 'flex-start', paddingVertical: 7 },
});
