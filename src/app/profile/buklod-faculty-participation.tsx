import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

import { FacultyClassHeader, FacultyGate } from '@/components/faculty/FacultyGate';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { supabase } from '@/lib/supabase';

const OBS_TYPES = ['RECITATION', 'PARTICIPATION', 'ENGAGEMENT', 'PROFESSIONAL_CONDUCT', 'CUSTOM'] as const;

type StudentRow = {
  student_user_id: string;
  display_name?: string | null;
  username?: string | null;
};

type Observation = {
  id: string;
  student_user_id: string;
  observation_type: string;
  criterion: string | null;
  score: number | null;
  points_possible: number | null;
  note: string | null;
  observed_at: string;
  released_to_student: boolean;
};

export default function FacultyParticipationScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.id ?? params.classroomId ?? '');
  const classroomName = String(params.name ?? 'Classroom');
  const { theme } = useBuklodPresentation();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [rows, setRows] = useState<Observation[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [obsType, setObsType] = useState<(typeof OBS_TYPES)[number]>('PARTICIPATION');
  const [criterion, setCriterion] = useState('');
  const [score, setScore] = useState('');
  const [points, setPoints] = useState('10');
  const [note, setNote] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const nameFor = (id: string) => {
    const row = students.find(item => item.student_user_id === id);
    return row?.display_name || row?.username || id.slice(0, 8);
  };

  const load = useCallback(async () => {
    if (!classroomId) return;

    const [rosterRes, obsRes] = await Promise.all([
      supabase.rpc('buklod_education_roster_v1', { p_classroom_id: classroomId }),
      supabase
        .from('buklod_education_observations')
        .select('id,student_user_id,observation_type,criterion,score,points_possible,note,observed_at,released_to_student')
        .eq('classroom_id', classroomId)
        .order('observed_at', { ascending: false }),
    ]);

    if (rosterRes.error) Alert.alert('Roster', rosterRes.error.message);
    if (obsRes.error) Alert.alert('Observations', obsRes.error.message);

    setStudents((rosterRes.data ?? []) as StudentRow[]);
    setRows((obsRes.data ?? []) as Observation[]);
  }, [classroomId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const nextScore = Number(score);
    const nextPoints = Number(points);
    if (!selectedStudent || !Number.isFinite(nextScore) || !Number.isFinite(nextPoints) || nextPoints <= 0) {
      return Alert.alert('Observation', 'Select a student and enter a valid score / points.');
    }
    if (!note.trim()) {
      return Alert.alert('Observation', 'Add evidence. Conduct scores require a written observation, not a personality label.');
    }

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;

    const { error } = await supabase.from('buklod_education_observations').insert({
      classroom_id: classroomId,
      student_user_id: selectedStudent,
      observation_type: obsType,
      criterion: criterion.trim() || obsType,
      score: nextScore,
      points_possible: nextPoints,
      note: note.trim(),
      observed_by: uid,
      released_to_student: false,
    });

    if (error) return Alert.alert('Observation', error.message);
    setScore('');
    setNote('');
    setShowForm(false);
    load();
  };

  const release = async (row: Observation) => {
    const { error } = await supabase
      .from('buklod_education_observations')
      .update({ released_to_student: true })
      .eq('id', row.id)
      .eq('classroom_id', classroomId);

    if (error) return Alert.alert('Release', error.message);
    load();
  };

  const selectedName = useMemo(
    () => (selectedStudent ? nameFor(selectedStudent) : 'Select a student'),
    [selectedStudent, students]
  );

  return (
    <FacultyGate>
      <ScrollView
        style={[styles.screen, { backgroundColor: theme.canvas }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }} />
        }
      >
        <FacultyClassHeader
          classroomName={classroomName}
          eyebrow="EVIDENCE-BASED"
          title="Participation & Conduct"
          subtitle="Scores use a written criterion and evidence note. BUKLOD does not infer personality."
        />

        <Pressable
          style={({ pressed }) => [styles.primary, { backgroundColor: theme.buttonPrimary }, pressed && styles.pressed]}
          onPress={() => setShowForm(true)}
        >
          <Text style={styles.primaryText}>Record observation</Text>
        </Pressable>

        {rows.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surface }]}>
            <Text style={{ color: theme.textMuted }}>No observations in this class yet.</Text>
          </View>
        ) : (
          rows.map(row => (
            <View key={row.id} style={[styles.card, { backgroundColor: theme.surface }]}>
              <Text style={{ color: theme.accent, fontWeight: '900', fontSize: 11 }}>
                {row.observation_type} {row.released_to_student ? '• RELEASED' : '• DRAFT'}
              </Text>
              <Text style={[styles.name, { color: theme.textPrimary }]}>{nameFor(row.student_user_id)}</Text>
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                {row.criterion || 'Criterion'} • {row.score ?? '—'} / {row.points_possible ?? '—'}
              </Text>
              {!!row.note && (
                <Text style={{ color: theme.textSecondary, marginTop: 8, lineHeight: 19 }}>{row.note}</Text>
              )}
              {!row.released_to_student && (
                <Pressable style={[styles.release, { backgroundColor: theme.accentSoft }]} onPress={() => release(row)}>
                  <Text style={{ color: theme.accent, fontWeight: '900' }}>Release to student</Text>
                </Pressable>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showForm} transparent animationType="fade" onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalShade}>
          <ScrollView contentContainerStyle={[styles.modalCard, { backgroundColor: theme.surfaceElevated }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>New observation</Text>
            <Text style={{ color: theme.textMuted, marginBottom: 10 }}>{selectedName}</Text>

            {students.map(item => (
              <Pressable
                key={item.student_user_id}
                style={[
                  styles.choice,
                  { backgroundColor: theme.inputSurface, borderColor: selectedStudent === item.student_user_id ? theme.accent : 'transparent' },
                ]}
                onPress={() => setSelectedStudent(item.student_user_id)}
              >
                <Text style={{ color: theme.textPrimary, fontWeight: '800' }}>
                  {item.display_name || item.username || 'Student'}
                </Text>
              </Pressable>
            ))}

            <View style={styles.typeRow}>
              {OBS_TYPES.map(type => (
                <Pressable
                  key={type}
                  style={[
                    styles.typeChip,
                    { backgroundColor: obsType === type ? theme.accentSoft : theme.inputSurface },
                  ]}
                  onPress={() => setObsType(type)}
                >
                  <Text style={{ color: theme.accent, fontWeight: '800', fontSize: 11 }}>{type.replaceAll('_', ' ')}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={criterion}
              onChangeText={setCriterion}
              placeholder="Rubric criterion (e.g. Preparedness)"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { backgroundColor: theme.inputSurface, color: theme.textPrimary }]}
            />
            <TextInput
              value={score}
              onChangeText={setScore}
              placeholder="Score"
              keyboardType="decimal-pad"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { backgroundColor: theme.inputSurface, color: theme.textPrimary }]}
            />
            <TextInput
              value={points}
              onChangeText={setPoints}
              placeholder="Points possible"
              keyboardType="decimal-pad"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { backgroundColor: theme.inputSurface, color: theme.textPrimary }]}
            />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Evidence / observed behavior"
              placeholderTextColor={theme.textMuted}
              multiline
              style={[styles.input, styles.multiline, { backgroundColor: theme.inputSurface, color: theme.textPrimary }]}
            />

            <Pressable style={[styles.primary, { backgroundColor: theme.buttonPrimary }]} onPress={save}>
              <Text style={styles.primaryText}>Save faculty-only draft</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => setShowForm(false)}>
              <Text style={{ color: theme.textMuted, fontWeight: '800' }}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingTop: 42, paddingBottom: 70 },
  primary: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 16 },
  primaryText: { color: '#fff', fontWeight: '900' },
  empty: { borderRadius: 15, padding: 16 },
  card: { borderRadius: 16, padding: 14, marginBottom: 9 },
  name: { fontWeight: '900', marginTop: 4, fontSize: 16 },
  meta: { marginTop: 3, fontSize: 12 },
  release: { marginTop: 10, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  pressed: { opacity: 0.88 },
  modalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 22, padding: 20 },
  modalTitle: { fontSize: 21, fontWeight: '900', marginBottom: 8 },
  choice: { borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 10 },
  typeChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  input: { borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  cancel: { paddingVertical: 12, alignItems: 'center' },
});
