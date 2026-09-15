import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import { useAuth } from '@/providers/AuthProvider';

type IgpatInfo = {
  id: string;
  user_id: string;
  body?: string | null;
  author_name?: string | null;
};
type FeedbackKind = 'not_interested' | 'show_fewer' | 'dont_recommend_creator' | 'hide';
type ReportReason = 'spam' | 'harassment' | 'privacy' | 'misinformation' | 'inappropriate' | 'other';

const FEEDBACKS: Array<{
  key: FeedbackKind;
  title: string;
  helper: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}> = [
  { key: 'not_interested', title: 'Not Interested', helper: 'Remove this IGPAT from your recommendations.', icon: 'eye-off-outline' },
  { key: 'show_fewer', title: 'Show Fewer Like This', helper: 'Reduce similar recommendations without blocking the creator.', icon: 'tune-variant' },
  { key: 'dont_recommend_creator', title: "Don't Recommend This Creator", helper: 'Stop recommending this creator in IGPAT.', icon: 'account-minus-outline' },
  { key: 'hide', title: 'Hide This IGPAT', helper: 'Hide this specific IGPAT from your feed.', icon: 'eye-remove-outline' },
];

const REPORTS: Array<{ key: ReportReason; label: string }> = [
  { key: 'spam', label: 'Spam' },
  { key: 'harassment', label: 'Harassment' },
  { key: 'privacy', label: 'Privacy' },
  { key: 'misinformation', label: 'Misinformation' },
  { key: 'inappropriate', label: 'Inappropriate' },
  { key: 'other', label: 'Other' },
];

export default function IgpatOptionsScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const postId = String(params.id ?? '').trim();
  const [post, setPost] = useState<IgpatInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportMode, setReportMode] = useState(false);
  const [reason, setReason] = useState<ReportReason>('inappropriate');
  const [details, setDetails] = useState('');

  const load = useCallback(async () => {
    if (!postId) {
      setError('IGPAT is unavailable.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: postError } = await supabase
        .from('community_posts')
        .select('id,user_id,body')
        .eq('id', postId)
        .eq('is_reel', true)
        .eq('is_hidden', false)
        .is('deleted_at', null)
        .maybeSingle();
      if (postError) throw postError;
      if (!data) throw new Error('This IGPAT is no longer available.');

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name,first_name,username')
        .eq('id', data.user_id)
        .maybeSingle();
      const rawName = profile?.full_name || profile?.first_name || profile?.username || 'BUKLOD Member';
      setPost({ ...data, author_name: resolvePersonDisplayName(String(rawName), String(data.user_id)) } as IgpatInfo);
    } catch (loadError: any) {
      console.warn('BUKLOD IGPAT controls:', String(loadError?.message ?? loadError));
      setPost(null);
      setError(loadError?.message ?? 'IGPAT controls are unavailable.');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { void load(); }, [load]);

  const applyFeedback = async (kind: FeedbackKind) => {
    if (!post || busy) return;
    setBusy(true);
    try {
      const creatorId = kind === 'show_fewer' || kind === 'dont_recommend_creator'
        ? post.user_id
        : kind === 'not_interested' || kind === 'hide'
          ? post.user_id
          : null;
      const { error: rpcError } = await (supabase as any).rpc('igpat_set_feedback_v2', {
        p_feedback_kind: kind,
        p_post_id: kind === 'dont_recommend_creator' ? null : post.id,
        p_creator_id: creatorId,
      });
      if (rpcError) throw rpcError;
      router.replace('/igpat' as any);
    } catch (actionError: any) {
      Alert.alert('Could Not Update Feed', actionError?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitReport = async () => {
    if (!post || busy) return;
    setBusy(true);
    try {
      const { error: rpcError } = await (supabase as any).rpc('submit_buklod_igpat_report_v1', {
        p_post_id: post.id,
        p_reason: reason,
        p_details: details.trim() || null,
      });
      if (rpcError) throw rpcError;
      Alert.alert('Report Sent', 'This report was sent to the existing BUKLOD Main moderation queue.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (actionError: any) {
      Alert.alert('Could Not Send Report', actionError?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT</Text>
          <Text style={styles.title}>{reportMode ? 'Report IGPAT' : 'Feed Controls'}</Text>
          <Text style={styles.subtitle}>{reportMode ? 'Safety reports go to BUKLOD Main moderation.' : 'Tune recommendations without changing the creator’s content.'}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}><ActivityIndicator color="#FFFFFF" /><Text style={styles.stateText}>Loading controls…</Text></View>
      ) : error || !post ? (
        <View style={styles.stateCard}><Text style={styles.stateText}>{error ?? 'IGPAT unavailable.'}</Text></View>
      ) : reportMode ? (
        <>
          <View style={styles.subjectCard}>
            <Text style={styles.subjectLabel}>REPORTING</Text>
            <Text style={styles.subjectName}>{post.author_name || 'BUKLOD Member'}</Text>
            {post.body?.trim() ? <Text style={styles.subjectBody} numberOfLines={2}>{post.body.trim()}</Text> : null}
          </View>

          <Text style={styles.label}>REASON</Text>
          <View style={styles.reasonGrid}>
            {REPORTS.map(option => {
              const selected = option.key === reason;
              return (
                <Pressable key={option.key} style={[styles.reasonChip, selected && styles.reasonSelected]} onPress={() => setReason(option.key)} disabled={busy}>
                  <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>{option.label.toUpperCase()}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>DETAILS · OPTIONAL</Text>
          <TextInput
            value={details}
            onChangeText={value => setDetails(value.slice(0, 1200))}
            placeholder="Add context for the moderation team"
            placeholderTextColor="rgba(255,255,255,0.34)"
            multiline
            maxLength={1200}
            style={styles.details}
            editable={!busy}
          />
          <Pressable style={[styles.reportSubmit, busy && styles.disabled]} disabled={busy} onPress={() => void submitReport()}>
            {busy ? <ActivityIndicator color="#07100B" /> : <MaterialCommunityIcons name="flag-outline" size={18} color="#07100B" />}
            <Text style={styles.reportSubmitText}>{busy ? 'SENDING…' : 'SEND REPORT'}</Text>
          </Pressable>
          <Pressable style={styles.cancelReport} disabled={busy} onPress={() => setReportMode(false)}><Text style={styles.cancelReportText}>BACK TO FEED CONTROLS</Text></Pressable>
        </>
      ) : (
        <>
          <View style={styles.subjectCard}>
            <Text style={styles.subjectLabel}>IGPAT BY</Text>
            <Text style={styles.subjectName}>{post.author_name || 'BUKLOD Member'}</Text>
            {post.body?.trim() ? <Text style={styles.subjectBody} numberOfLines={2}>{post.body.trim()}</Text> : null}
          </View>

          <View style={styles.optionList}>
            {FEEDBACKS.filter(option => !(option.key === 'dont_recommend_creator' && post.user_id === user?.id)).map(option => (
              <Pressable key={option.key} style={styles.optionCard} disabled={busy} onPress={() => void applyFeedback(option.key)}>
                <View style={styles.optionIcon}><MaterialCommunityIcons name={option.icon} size={19} color="#FFFFFF" /></View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionHelper}>{option.helper}</Text>
                </View>
                {busy ? null : <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(255,255,255,0.55)" />}
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.reportButton} disabled={busy} onPress={() => setReportMode(true)}>
            <MaterialCommunityIcons name="flag-outline" size={17} color="#FFFFFF" />
            <View style={styles.reportCopy}>
              <Text style={styles.reportTitle}>REPORT</Text>
              <Text style={styles.reportHelper}>Send a safety or policy concern to BUKLOD Main moderation.</Text>
            </View>
          </Pressable>

          <View style={styles.noteCard}>
            <MaterialCommunityIcons name="information-outline" size={17} color="#D9FF69" />
            <Text style={styles.note}>Recommendation controls affect only your IGPAT experience. They do not delete, punish, or publicly label another member.</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050807' },
  content: { padding: 18, paddingTop: 54, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#0D120F' },
  headerCopy: { flex: 1 },
  eyebrow: { color: 'rgba(255,255,255,0.42)', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 4, color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 5, color: 'rgba(255,255,255,0.54)', fontSize: 10, lineHeight: 16 },
  centerState: { marginTop: 44, alignItems: 'center', gap: 10 },
  stateCard: { marginTop: 26, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 18 },
  stateText: { color: 'rgba(255,255,255,0.56)', fontSize: 10, lineHeight: 16, textAlign: 'center' },
  subjectCard: { marginTop: 24, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 14 },
  subjectLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.7 },
  subjectName: { marginTop: 4, color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  subjectBody: { marginTop: 7, color: 'rgba(255,255,255,0.52)', fontSize: 9, lineHeight: 14 },
  optionList: { marginTop: 14, gap: 8 },
  optionCard: { minHeight: 70, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)', backgroundColor: '#0D120F', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  optionCopy: { flex: 1 },
  optionTitle: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  optionHelper: { marginTop: 3, color: 'rgba(255,255,255,0.42)', fontSize: 8.5, lineHeight: 13 },
  reportButton: { marginTop: 12, minHeight: 64, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  reportCopy: { flex: 1 },
  reportTitle: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  reportHelper: { marginTop: 3, color: 'rgba(255,255,255,0.40)', fontSize: 8.3, lineHeight: 12 },
  noteCard: { marginTop: 14, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(217,255,105,0.15)', backgroundColor: '#10150D', padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  note: { flex: 1, color: 'rgba(255,255,255,0.44)', fontSize: 8.4, lineHeight: 13 },
  label: { marginTop: 20, marginBottom: 8, color: 'rgba(255,255,255,0.42)', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  reasonChip: { minHeight: 38, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', alignItems: 'center', justifyContent: 'center' },
  reasonSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  reasonText: { color: 'rgba(255,255,255,0.62)', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  reasonTextSelected: { color: '#07100B' },
  details: { minHeight: 100, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', backgroundColor: '#0D120F', color: '#FFFFFF', padding: 13, textAlignVertical: 'top', fontSize: 9.5 },
  reportSubmit: { marginTop: 14, minHeight: 50, borderRadius: 15, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  reportSubmitText: { color: '#07100B', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  cancelReport: { marginTop: 10, alignItems: 'center', padding: 9 },
  cancelReportText: { color: 'rgba(255,255,255,0.50)', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  disabled: { opacity: 0.4 },
});
