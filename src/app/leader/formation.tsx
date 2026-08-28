import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

type LessonRow = {
  progress_id: string;
  user_id: string;
  member_name: string;
  church_id: string;
  church_name: string;
  enrollment_id: string;
  lesson_id: string;
  lesson_number: number;
  lesson_title: string;
  track_title: string;
  studied_at: string;
};

type BayanihanRow = {
  id: string;
  member_id: string;
  stage_code: number;
  action_category: string;
  description: string | null;
  verification_status: string;
  created_at: string;
  profiles?: { full_name: string | null };
};

const date = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
};

export default function PastorFormationValidationScreen() {
  const { hasRole } = useAuth();
  const { activeScope } = useBuklodScope();
  const allowed =
    hasRole('pastor') || hasRole('system_admin') || hasRole('mentor');

  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [bayanihan, setBayanihan] = useState<BayanihanRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [section, setSection] = useState<
    'LESSONS' | 'REFLECTIONS' | 'DOCUMENTS' | 'BAYANIHAN' | 'MISSION' | 'REPEAT'
  >('LESSONS');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [approverSetup, setApproverSetup] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const [{ data: lessonData, error: lessonError }, { data: actionData }] =
      await Promise.all([
        (supabase as any).rpc('pastor_get_learning_validation_queue_v2'),
        supabase
          .from('buklod_formation_bayanihan_actions')
          .select('*, profiles(full_name)')
          .eq('verification_status', 'pending')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

    if (
      activeScope?.scope_type === 'CLUSTER' &&
      activeScope.scope_id
    ) {
      const setup = await (supabase as any).rpc(
        'buklod_cluster_approval_setup_status_v1',
        { p_cluster_id: activeScope.scope_id },
      );
      if (!setup.error && setup.data?.has_authorized_approver === false) {
        setApproverSetup(
          String(
            setup.data?.message ??
              'This Cluster has no authorized Cluster Head, Mentor, or Pastor yet. Official completion cannot be approved until one is assigned.',
          ),
        );
      } else {
        setApproverSetup(null);
      }
    } else {
      setApproverSetup(null);
    }

    if (lessonError) {
      Alert.alert('Formation Review', lessonError.message);
      setLessons([]);
    } else {
      setLessons((lessonData ?? []) as LessonRow[]);
    }

    setBayanihan((actionData ?? []) as BayanihanRow[]);
    setLoading(false);
  }, [allowed, activeScope?.scope_id, activeScope?.scope_type]);

  useEffect(() => {
    void load();
  }, [load]);

  const q = search.trim().toLowerCase();
  const visibleLessons = useMemo(
    () =>
      !q
        ? lessons
        : lessons.filter((r) =>
            [r.member_name, r.church_name, r.lesson_title, r.track_title].some(
              (x) => x.toLowerCase().includes(q),
            ),
          ),
    [lessons, q],
  );

  const validateLesson = (r: LessonRow) =>
    Alert.alert(
      'Pastor Validation',
      `Confirm that ${r.member_name} studied "${r.lesson_title}"?`,
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'VALIDATE',
          onPress: async () => {
            setBusyId(r.progress_id);
            const { error } = await (supabase as any).rpc(
              'pastor_validate_learning_progress_v2',
              {
                p_progress_id: r.progress_id,
                p_pastor_note: notes[r.progress_id]?.trim() || null,
              },
            );
            if (
              !error &&
              activeScope?.scope_type === 'CLUSTER' &&
              activeScope.scope_id
            ) {
              await (supabase as any).rpc(
                'buklod_approve_cluster_formation_item_v1',
                {
                  p_cluster_id: activeScope.scope_id,
                  p_learner_id: r.user_id,
                  p_item_kind: 'LESSON',
                  p_item_id: r.lesson_id,
                  p_approve: true,
                  p_remarks: notes[r.progress_id]?.trim() || null,
                },
              );
            }
            setBusyId(null);
            if (error) return Alert.alert('Validation failed', error.message);
            Alert.alert('Pastor Validated', 'Waiting for System Admin approval.');
            await load();
          },
        },
      ],
    );

  const verifyBayanihan = (row: BayanihanRow, approve: boolean) =>
    Alert.alert(
      approve ? 'Verify Action' : 'Needs Revision',
      row.description ?? row.action_category,
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: approve ? 'VERIFY' : 'NEEDS REVISION',
          onPress: async () => {
            setBusyId(row.id);
            const { error } = await (supabase as any).rpc(
              'verify_formation_bayanihan_action_v1',
              {
                p_action_id: row.id,
                p_approve: approve,
                p_verifier_note: notes[row.id]?.trim() || null,
              },
            );
            setBusyId(null);
            if (error) return Alert.alert('Verification failed', error.message);
            await load();
          },
        },
      ],
    );

  if (!allowed) {
    return (
      <View style={[shared.screen, shared.content]}>
        <Text style={shared.h1}>Formation Review</Text>
        <Card>
          <Text>Pastor, Mentor, or System Admin access is required.</Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={s.eyebrow}>FORMATION REVIEW</Text>
      <Text style={shared.h1}>Learning & Formation Queue</Text>
      <Text style={shared.muted}>
        Official credit is approved inside the member's Cluster by a Cluster
        Head, Mentor, or Pastor of that same Cluster.
      </Text>
      {approverSetup ? (
        <Card>
          <Text style={shared.body}>{approverSetup}</Text>
        </Card>
      ) : null}

      <View style={s.tabs}>
        {(['LESSONS', 'REFLECTIONS', 'DOCUMENTS', 'BAYANIHAN', 'MISSION', 'REPEAT'] as const).map(
          (tab) => (
            <Pressable
              key={tab}
              style={[s.tab, section === tab && s.tabActive]}
              onPress={() => setSection(tab)}
            >
              <Text style={s.tabText}>{tab}</Text>
            </Pressable>
          ),
        )}
      </View>

      <TextInput
        style={s.search}
        placeholder="Search member, local, track..."
        value={search}
        onChangeText={setSearch}
      />

      {loading && <ActivityIndicator color={colors.green} />}

      {section === 'LESSONS' && (
        <>
          <SectionTitle>NEEDS REVIEW · LESSONS</SectionTitle>
          {!loading && visibleLessons.length === 0 && (
            <Card>
              <Text style={shared.muted}>
                No studied lesson is waiting for Pastor validation.
              </Text>
            </Card>
          )}
          {visibleLessons.map((r) => (
            <Card key={r.progress_id}>
              <Text style={s.member}>{r.member_name}</Text>
              <Text style={s.local}>{r.church_name}</Text>
              <Text style={s.track}>{r.track_title}</Text>
              <Text style={s.lesson}>
                Lesson {r.lesson_number}: {r.lesson_title}
              </Text>
              <Text style={s.meta}>Study saved: {date(r.studied_at)}</Text>
              <TextInput
                style={s.note}
                multiline
                placeholder="Pastor note (optional)"
                value={notes[r.progress_id] ?? ''}
                onChangeText={(v) =>
                  setNotes((x) => ({ ...x, [r.progress_id]: v }))
                }
              />
              <Button
                title={
                  busyId === r.progress_id ? 'VALIDATING...' : 'APPROVE / VALIDATE'
                }
                onPress={() => validateLesson(r)}
              />
            </Card>
          ))}
        </>
      )}

      {section === 'BAYANIHAN' && (
        <>
          <SectionTitle>BAYANIHAN / MISSION ACTIONS</SectionTitle>
          {bayanihan.length === 0 && (
            <Card>
              <Text style={shared.muted}>No pending Bayanihan actions.</Text>
            </Card>
          )}
          {bayanihan.map((row) => (
            <Card key={row.id}>
              <Text style={s.member}>
                {row.profiles?.full_name ?? row.member_id.slice(0, 8)}
              </Text>
              <Text style={s.track}>
                BUKLOD {row.stage_code} · {row.action_category}
              </Text>
              <Text style={shared.body}>{row.description}</Text>
              <TextInput
                style={s.note}
                multiline
                placeholder="Verifier note"
                value={notes[row.id] ?? ''}
                onChangeText={(v) => setNotes((x) => ({ ...x, [row.id]: v }))}
              />
              <Button
                title={busyId === row.id ? 'WORKING...' : 'VERIFY'}
                onPress={() => verifyBayanihan(row, true)}
              />
              <View style={{ marginTop: 8 }}>
                <Button
                  title="NEEDS REVISION"
                  onPress={() => verifyBayanihan(row, false)}
                />
              </View>
            </Card>
          ))}
        </>
      )}

      {section === 'REFLECTIONS' && (
        <>
          <SectionTitle>REFLECTIONS</SectionTitle>
          <Card>
            <Text style={shared.muted}>
              Reflection review continues through the lesson validation queue.
              Private reflection text remains pastor-gated.
            </Text>
          </Card>
        </>
      )}

      {section === 'MISSION' && (
        <>
          <SectionTitle>MISSION JOURNAL / MILESTONES</SectionTitle>
          <Card>
            <Text style={shared.muted}>
              Mission journal entries and church planting milestones appear here
              once members submit them for verification.
            </Text>
          </Card>
        </>
      )}

      {section === 'DOCUMENTS' && (
        <>
          <SectionTitle>DOCUMENTS & COVENANTS</SectionTitle>
          <Card>
            <Text style={shared.muted}>
              Document verification continues through System Admin approvals and
              existing stage requirement review flows.
            </Text>
          </Card>
        </>
      )}

      {section === 'REPEAT' && (
        <>
          <SectionTitle>REPEAT REQUESTS</SectionTitle>
          <Card>
            <Text style={shared.muted}>
              Require a member to repeat lessons or an entire stage. Previous
              progress is preserved.
            </Text>
            <View style={{ marginTop: 10 }}>
              <Button
                title="OPEN REQUIRE REPEAT"
                onPress={() =>
                  router.push({
                    pathname: '/formation/repeat-review',
                    params: { stage: '103' },
                  } as any)
                }
              />
            </View>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 18, paddingBottom: 40 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.greenDark,
    marginBottom: 4,
  },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabActive: { borderColor: colors.green, backgroundColor: '#EEF7F0' },
  tabText: { fontSize: 10, fontWeight: '900' },
  search: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.white,
  },
  member: { fontSize: 17, fontWeight: '900', color: colors.text },
  local: { marginTop: 3, fontSize: 12, fontWeight: '900', color: colors.greenDark },
  track: { marginTop: 10, fontSize: 12, fontWeight: '800', color: colors.muted },
  lesson: { marginTop: 3, fontSize: 14, fontWeight: '900', color: colors.text },
  meta: { marginTop: 6, fontSize: 11, color: colors.muted },
  note: {
    marginTop: 10,
    marginBottom: 8,
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 11,
    textAlignVertical: 'top',
    backgroundColor: colors.white,
  },
});
