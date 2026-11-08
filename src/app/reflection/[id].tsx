import { BuklodFaithRouteBoundary } from '@/components/BuklodFaithRouteBoundary';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Button, shared } from '@/components/UI';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/lib/theme';
import BuklodSubmissionAdSlot from '@/components/BuklodSubmissionAdSlot';
import { warmBuklodAdOpportunity, showBuklodAdOpportunity } from '@/lib/buklodAdOpportunities';

type Privacy = 'private'|'leader'|'group'|'church';

type DevotionalCompletionResult = {
  ok?: boolean;
  submission_id?: string;
  status?: string;
  already_completed?: boolean;
  automatic?: boolean;
};

function ReflectionScreenContent() {
  const { id, submissionId } = useLocalSearchParams<{id:string;submissionId?:string}>();
  const { user } = useAuth();
  const [reflection, setReflection] = useState('');
  const [application, setApplication] = useState('');
  const [privacy, setPrivacy] = useState<Privacy>('private');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [existing, setExisting] = useState<{
    id: string;
    status: string;
    devotional_title_snapshot: string | null;
    reflection_snapshot: string | null;
    application_snapshot: string | null;
    admin_note: string | null;
    reviewed_at: string | null;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError('');
    setExisting(null);
    setReflection('');
    setApplication('');
    setPrivacy('private');

    if (!user?.id || !id) {
      setLoadError('Sign in to open your devotional reflection.');
      setLoading(false);
      return () => { alive = false; };
    }

    void (async () => {
      try {
        const [submitted, saved] = await Promise.all([
          supabase.from('devotional_reward_submissions')
            .select('id,status,devotional_title_snapshot,reflection_snapshot,application_snapshot,admin_note,reviewed_at')
            .eq('user_id', user.id).eq('devotional_id', id).maybeSingle(),
          supabase.from('reflections')
            .select('reflection_text,application_text,privacy')
            .eq('user_id', user.id).eq('devotional_id', id).maybeSingle(),
        ]);
        if (submitted.error) throw submitted.error;
        if (saved.error) throw saved.error;
        if (!alive) return;

        const targetId = typeof submissionId === 'string' ? submissionId.trim() : '';
        if (targetId && submitted.data?.id !== targetId) {
          setLoadError('Hindi tugma ang devotional sa notification. Buksan ang My Devotional Submissions para piliin ang eksaktong record.');
          return;
        }

        const review = submitted.data ?? null;
        setExisting(review);
        // Restore the existing answers from this devotional ONLY. Never copy
        // a reflection from the other devotional with a similar title/date.
        setReflection(review?.reflection_snapshot ?? saved.data?.reflection_text ?? '');
        setApplication(review?.application_snapshot ?? saved.data?.application_text ?? '');
        const originalPrivacy = String(saved.data?.privacy ?? 'private');
        if (['private', 'leader', 'group', 'church'].includes(originalPrivacy)) {
          setPrivacy(originalPrivacy as Privacy);
        }
      } catch {
        if (alive) setLoadError('Unable to verify this devotional. Check your connection and retry before editing.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [user?.id, id, submissionId, reloadToken]);

  const locked = existing?.status === 'approved' || existing?.status === 'pending_admin';

  useEffect(() => {
    warmBuklodAdOpportunity('devotional_reflection_success');
  }, []);

  const complete = async () => {
    if (!user || !id || busy || loading || !!loadError || locked) return;

    const reflectionText = reflection.trim();
    const applicationText = application.trim();

    if (reflectionText.length < 20) {
      return Alert.alert('Reflection', 'Write a reflection with at least 20 characters.');
    }

    if (applicationText.length < 20) {
      return Alert.alert('Application', 'Write one practical application with at least 20 characters.');
    }

    setBusy(true);

    try {
      const { data, error } = await (supabase as any).rpc(
        'complete_my_devotional_v2',
        {
          p_devotional_id: id,
          p_reflection: reflectionText,
          p_application: applicationText,
          p_privacy: privacy,
        }
      );

      if (error) throw error;

      const result = (data ?? {}) as DevotionalCompletionResult;
      if (result.ok !== true || !result.submission_id) {
        throw new Error('Completion was not confirmed by the server. Check your devotional status before trying again.');
      }

      if (!result.already_completed) {
        await showBuklodAdOpportunity('devotional_reflection_success');
      }
      Alert.alert(
        result.already_completed ? 'Devotional already completed' : 'Devotional submitted',
        result.status === 'approved'
          ? 'This specific devotional has been approved.'
          : result.status === 'rejected'
            ? 'The review still requests an improvement. Read the exact note in My Devotional Submissions.'
            : 'Your revised reflection and application were saved together. Check the status of this exact devotional in My Devotional Submissions.'
      );
      router.replace({
        pathname: '/devotional/submissions',
        params: { submissionId: result.submission_id },
      } as any);
    } catch (error: any) {
      Alert.alert(
        'Could not complete devotional',
        error?.message ?? 'The connection may have interrupted the confirmation. Check your devotional status before trying again.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <View style={[shared.screen, styles.center]}>
    <ActivityIndicator color={colors.green} />
    <Text style={shared.muted}>Loading your devotional submission…</Text>
  </View>;

  if (loadError) return <View style={[shared.screen, styles.center]}>
    <Text style={styles.warning}>{loadError}</Text>
    <Button title="RETRY" onPress={() => setReloadToken(n => n + 1)} />
    <Button title="MY DEVOTIONAL SUBMISSIONS" onPress={() => router.push('/devotional/submissions' as any)} />
  </View>;

  return (
    <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
      <Text style={shared.h1}>{existing?.status === 'rejected' ? 'Revise Your Devotional' : 'Your Reflection'}</Text>
      {!!existing?.devotional_title_snapshot && <Text style={styles.devotionalName}>
        {existing.devotional_title_snapshot}
      </Text>}
      {existing?.status === 'rejected' && <View style={styles.revisionBox}>
        <Text style={styles.revisionTitle}>KAILANGANG I-REVISE ANG DEVOTIONAL NA ITO</Text>
        <Text style={styles.revisionText}>
          {existing.admin_note?.trim() || 'Improve your reflection and application, then resubmit.'}
        </Text>
        <Text style={styles.revisionHint}>Naibalik ang dating sagot mo sa ibaba. Maaari mo itong ayusin bago muling isumite.</Text>
      </View>}
      {locked && <View style={styles.lockBox}>
        <Text style={styles.lockTitle}>
          {existing?.status === 'approved' ? 'APPROVED' : 'UNDER REVIEW'}
        </Text>
        <Text style={styles.revisionText}>
          {existing?.status === 'approved'
            ? 'Approved na ang devotional na ito. Hindi na kailangan ng revision.'
            : 'Naisumite na ang devotional na ito at sinusuri pa. Hintayin muna ang resulta bago baguhin.'}
        </Text>
      </View>}
      <Text style={shared.muted}>What spoke to you today?</Text>
      <TextInput multiline editable={!locked} value={reflection} onChangeText={setReflection} style={styles.area} placeholder="Write your reflection..." />
      <Text style={shared.muted}>What will you do today?</Text>
      <TextInput multiline editable={!locked} value={application} onChangeText={setApplication} style={[styles.area,{minHeight:90}]} placeholder="One practical step..." />

      <Text style={shared.h2}>Privacy</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>
        {(['private','leader','group','church'] as Privacy[]).map(p=>(
          <Pressable key={p} disabled={locked} onPress={()=>setPrivacy(p)} style={[styles.chip,privacy===p&&styles.chipOn]}>
            <Text style={{fontWeight:'700'}}>{p}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={shared.muted}>
        Completing this devotional saves it before any optional sponsored break. An unavailable ad will never prevent submission.
      </Text>
      {!locked && <>
        <BuklodSubmissionAdSlot placementId="devotional_reflection_before_submit" />
        <Button title={busy ? 'SAVING...' : existing?.status === 'rejected'
          ? '✓ RESUBMIT REVISED DEVOTIONAL' : '✓ COMPLETE DEVOTIONAL'} onPress={complete} />
      </>}
      <Button title="MY DEVOTIONAL SUBMISSIONS" onPress={() => router.push('/devotional/submissions' as any)} />
    </ScrollView>
  );
}
const styles=StyleSheet.create({
  center: { flex: 1, padding: 20, justifyContent: 'center', gap: 14 },
  devotionalName: { color: colors.greenDark, fontSize: 16, fontWeight: '900', paddingBottom: 8 },
  revisionBox: { backgroundColor: '#FFF0EB', padding: 14, borderRadius: 12, gap: 7,
    borderLeftWidth: 4, borderLeftColor: '#A33E34' },
  revisionTitle: { fontSize: 12, fontWeight: '900', color: '#94372F' },
  revisionText: { fontSize: 13, lineHeight: 20, color: '#68413A' },
  revisionHint: { fontSize: 11, lineHeight: 17, color: '#69564E' },
  lockBox: { padding: 14, borderRadius: 12, backgroundColor: '#EEF7F0', gap: 8 },
  lockTitle: { color: colors.greenDark, fontWeight: '900', fontSize: 13 },
  warning: { color: '#8D362D', fontWeight: '800', lineHeight: 20 },
  area:{minHeight:120,backgroundColor:colors.white,borderColor:colors.line,borderWidth:1,borderRadius:12,padding:12,textAlignVertical:'top'},
  chip:{paddingVertical:8,paddingHorizontal:12,borderWidth:1,borderColor:colors.line,borderRadius:20,backgroundColor:colors.white},
  chipOn:{backgroundColor:colors.greenSoft,borderColor:colors.green},
});

export default function ReflectionScreen() {
  return <BuklodFaithRouteBoundary><ReflectionScreenContent /></BuklodFaithRouteBoundary>;
}
