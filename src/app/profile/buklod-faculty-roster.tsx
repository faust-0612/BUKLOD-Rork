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
import * as DocumentPicker from 'expo-document-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { FacultyClassHeader, FacultyGate } from '@/components/faculty/FacultyGate';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { uploadClassroomObject } from '@/lib/education/classroomTransfer';
import { BUKLOD_HIT_SLOP } from '@/lib/buklodTouch';
import { supabase } from '@/lib/supabase';

const ROSTER_BUCKET = 'buklod-classroom';
const MAX_ROSTER_BYTES = 20 * 1024 * 1024;

type StudentRow = {
  id: string;
  student_user_id: string;
  status: string;
  display_name?: string | null;
  username?: string | null;
};

type GroupScore = {
  id: string;
  activity_id: string;
  student_user_id: string;
  group_name: string | null;
  final_score: number | null;
  status: string;
};

type MatchCandidate = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  confidence?: number | null;
};

type RosterIntent = {
  id: string;
  source_name: string;
  status: 'WAITING' | 'NEEDS_REVIEW' | 'MATCHED' | 'ENROLLED' | 'IGNORED' | string;
  matched_user_id?: string | null;
  matched_username?: string | null;
  match_score?: number | null;
  match_method?: string | null;
  suggestions?: MatchCandidate[] | null;
  source_file_name?: string | null;
};

type RosterImportResponse = {
  count?: number;
  warning?: string;
  error?: string;
  result?: {
    imported?: number;
    enrolled?: number;
    needs_review?: number;
    waiting?: number;
  };
};

function rosterStatusLabel(status: string) {
  if (status === 'ENROLLED') return 'Enrolled';
  if (status === 'NEEDS_REVIEW' || status === 'MATCHED') return 'Needs review';
  if (status === 'WAITING') return 'Waiting for BUKLOD account';
  return status.replace(/_/g, ' ').toLowerCase();
}

function statusIcon(status: string) {
  if (status === 'ENROLLED') return 'check-circle-outline' as const;
  if (status === 'NEEDS_REVIEW' || status === 'MATCHED') return 'account-question-outline' as const;
  return 'clock-outline' as const;
}

export default function FacultyRosterScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.id ?? params.classroomId ?? '');
  const classroomName = String(params.name ?? 'Classroom');
  const { theme } = useBuklodPresentation();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [scores, setScores] = useState<GroupScore[]>([]);
  const [importedNames, setImportedNames] = useState<RosterIntent[]>([]);
  const [search, setSearch] = useState('');
  const [enrollName, setEnrollName] = useState('');
  const [showEnroll, setShowEnroll] = useState(false);
  const [reviewIntent, setReviewIntent] = useState<RosterIntent | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(item =>
      [item.display_name, item.username, item.status]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q)),
    );
  }, [search, students]);

  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of scores) {
      const label = row.group_name?.trim();
      if (!label) continue;
      const student = students.find(item => item.student_user_id === row.student_user_id);
      const name = student?.display_name || student?.username || 'Student';
      const list = map.get(label) ?? [];
      if (!list.includes(name)) list.push(name);
      map.set(label, list);
    }
    return Array.from(map.entries());
  }, [scores, students]);

  const load = useCallback(async () => {
    if (!classroomId) return;

    const [rosterRes, scoreRes, importedRes] = await Promise.all([
      supabase.rpc('buklod_education_roster_v1', { p_classroom_id: classroomId }),
      supabase
        .from('buklod_education_group_activity_scores')
        .select('id,activity_id,student_user_id,group_name,final_score,status')
        .eq('classroom_id', classroomId),
      supabase.rpc('buklod_classroom_roster_pending_v1', { p_classroom_id: classroomId }),
    ]);

    if (rosterRes.error) Alert.alert('Roster', rosterRes.error.message);
    if (importedRes.error) Alert.alert('Imported Roster', importedRes.error.message);
    setStudents((rosterRes.data ?? []) as StudentRow[]);
    setScores((scoreRes.data ?? []) as GroupScore[]);
    setImportedNames((importedRes.data ?? []) as RosterIntent[]);
  }, [classroomId]);

  useEffect(() => {
    void load();
  }, [load]);

  const enroll = async () => {
    const username = enrollName.trim().replace(/^@/, '');
    if (!username) return Alert.alert('Enroll Student', 'Enter the student BUKLOD username.');

    const { data, error } = await supabase.rpc('buklod_education_enroll_by_username_v1', {
      p_classroom_id: classroomId,
      p_username: username,
    });

    if (error) return Alert.alert('Enroll Student', error.message);
    setEnrollName('');
    setShowEnroll(false);
    Alert.alert('Enrollment', String(data ?? 'Student enrolled.'));
    await load();
  };

  const importRoster = async () => {
    if (bulkImporting) return;
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/pdf',
      ],
      multiple: false,
      copyToCacheDirectory: true,
    });
    const asset = picked.canceled ? null : picked.assets[0];
    if (!asset) return;

    const extension = asset.name.toLowerCase().split('.').pop() ?? '';
    if (!['csv', 'xls', 'xlsx', 'doc', 'docx', 'pdf'].includes(extension)) {
      return Alert.alert('Import Student List', 'Choose CSV, Excel (XLS/XLSX), Word (DOC/DOCX), or PDF.');
    }
    if (Number(asset.size ?? 0) > MAX_ROSTER_BYTES) {
      return Alert.alert('Import Student List', 'Roster files are limited to 20 MB.');
    }

    setBulkImporting(true);
    setImportProgress(0);
    let storagePath = '';
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const uid = auth.user?.id;
      if (!uid) throw new Error('Please sign in again before importing a roster.');

      const safeName = asset.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120) || `roster.${extension}`;
      storagePath = `${classroomId}/${uid}/roster-import/${Date.now()}_${safeName}`;
      await uploadClassroomObject({
        uri: asset.uri,
        bucket: ROSTER_BUCKET,
        path: storagePath,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
        cacheControl: '60',
        onProgress: progress => setImportProgress(progress.percent),
      });

      const { data, error } = await supabase.functions.invoke('buklod-classroom-roster-import', {
        body: {
          classroom_id: classroomId,
          bucket: ROSTER_BUCKET,
          path: storagePath,
          name: asset.name,
          mime_type: asset.mimeType ?? '',
        },
      });
      if (error) throw error;
      const payload = (data ?? {}) as RosterImportResponse;
      if (payload.error) throw new Error(payload.error);
      if (payload.warning && !payload.count) {
        await load();
        return Alert.alert('Import Student List', payload.warning);
      }

      await load();
      const result = payload.result ?? {};
      Alert.alert(
        'Student List Imported',
        `${result.imported ?? payload.count ?? 0} student name${(result.imported ?? payload.count ?? 0) === 1 ? '' : 's'} listed • ${result.enrolled ?? 0} enrolled automatically • ${result.waiting ?? 0} waiting for a BUKLOD account • ${result.needs_review ?? 0} need review.`,
      );
    } catch (error) {
      if (storagePath) await supabase.storage.from(ROSTER_BUCKET).remove([storagePath]).catch(() => undefined);
      Alert.alert('Import Student List', error instanceof Error ? error.message : 'Could not import this roster file.');
    } finally {
      setBulkImporting(false);
      setImportProgress(0);
    }
  };

  const confirmMatch = async (intent: RosterIntent, candidate: MatchCandidate) => {
    if (!candidate.id) return;
    const { data, error } = await supabase.rpc('buklod_classroom_roster_confirm_match_v1', {
      p_intent_id: intent.id,
      p_user_id: candidate.id,
    });
    if (error) return Alert.alert('Roster Match', error.message);
    setReviewIntent(null);
    await load();
    Alert.alert('Roster Match', String(data ?? 'Student matched and enrolled.'));
  };

  const setStatus = async (student: StudentRow, status: 'ACTIVE' | 'DROPPED') => {
    const { error } = await supabase
      .from('buklod_education_enrollments')
      .update({ status })
      .eq('id', student.id)
      .eq('classroom_id', classroomId);

    if (error) return Alert.alert('Enrollment', error.message);
    await load();
  };

  const reviewCandidates = useMemo(() => {
    if (!reviewIntent) return [];
    const candidates = [...(reviewIntent.suggestions ?? [])];
    if (reviewIntent.matched_user_id && !candidates.some(candidate => candidate.id === reviewIntent.matched_user_id)) {
      candidates.unshift({
        id: reviewIntent.matched_user_id,
        username: reviewIntent.matched_username,
        display_name: reviewIntent.matched_username ? `@${reviewIntent.matched_username}` : 'Suggested BUKLOD account',
        confidence: reviewIntent.match_score,
      });
    }
    return candidates.slice(0, 3);
  }, [reviewIntent]);

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
          eyebrow="CLASS ROSTER"
          title="Roster & Groups"
          subtitle="Import student-name lists, synchronize BUKLOD accounts, and keep enrollment scoped to this classroom."
        />

        <View style={[styles.importPanel, { backgroundColor: theme.surface }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.importTitle, { color: theme.textPrimary }]}>Enroll students from a file</Text>
            <Text style={[styles.help, { color: theme.textMuted }]}>CSV • Excel • Word • PDF. BUKLOD extracts only probable student names, removes duplicates, sorts the list, then safely matches existing or future BUKLOD accounts.</Text>
          </View>
          <Pressable
            disabled={bulkImporting}
            style={({ pressed }) => [styles.importButton, { backgroundColor: theme.buttonPrimary }, pressed && styles.pressed, bulkImporting && styles.disabled]}
            onPress={() => void importRoster()}
          >
            <MaterialCommunityIcons name="file-account-outline" size={19} color="#fff" />
            <Text style={styles.smallButtonText}>{bulkImporting ? `Importing ${importProgress}%` : 'Import List'}</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Imported student names</Text>
          <Text style={[styles.countText, { color: theme.textMuted }]}>{importedNames.length}</Text>
        </View>
        {importedNames.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surface }]}>
            <Text style={{ color: theme.textMuted }}>No imported student-name list yet.</Text>
          </View>
        ) : (
          importedNames.map(intent => (
            <View key={intent.id} style={[styles.card, { backgroundColor: theme.surface }]}>
              <View style={[styles.avatar, { backgroundColor: theme.accentSoft }]}>
                <MaterialCommunityIcons name={statusIcon(intent.status)} size={21} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.textPrimary }]}>{intent.source_name}</Text>
                <Text style={[styles.meta, { color: theme.textMuted }]}>{rosterStatusLabel(intent.status)}</Text>
              </View>
              {(intent.status === 'NEEDS_REVIEW' || intent.status === 'MATCHED') && (
                <Pressable onPress={() => setReviewIntent(intent)} hitSlop={BUKLOD_HIT_SLOP}>
                  <Text style={{ color: theme.accent, fontWeight: '900' }}>Review</Text>
                </Pressable>
              )}
            </View>
          ))
        )}

        <View style={[styles.sectionHeader, { marginTop: 18 }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Enrolled students</Text>
          <Pressable
            style={({ pressed }) => [styles.smallButton, { backgroundColor: theme.buttonPrimary }, pressed && styles.pressed]}
            onPress={() => setShowEnroll(true)}
          >
            <Text style={styles.smallButtonText}>+ Enroll</Text>
          </Pressable>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search enrolled students"
          placeholderTextColor={theme.textMuted}
          style={[styles.search, { backgroundColor: theme.surface, color: theme.textPrimary }]}
        />

        {filtered.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surface }]}>
            <Text style={{ color: theme.textMuted }}>No students in this class yet.</Text>
          </View>
        ) : (
          filtered.map(student => (
            <View key={student.id} style={[styles.card, { backgroundColor: theme.surface }]}>
              <View style={[styles.avatar, { backgroundColor: theme.accentSoft }]}>
                <MaterialCommunityIcons name="account" size={22} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.textPrimary }]}>
                  {student.display_name || student.username || 'BUKLOD Student'}
                </Text>
                <Text style={[styles.meta, { color: theme.textMuted }]}>
                  {student.username ? `@${student.username}` : student.student_user_id.slice(0, 8)} • {student.status}
                </Text>
              </View>
              {student.status === 'ACTIVE' ? (
                <Pressable onPress={() => void setStatus(student, 'DROPPED')} hitSlop={BUKLOD_HIT_SLOP}>
                  <Text style={{ color: theme.danger, fontWeight: '800' }}>Drop</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => void setStatus(student, 'ACTIVE')} hitSlop={BUKLOD_HIT_SLOP}>
                  <Text style={{ color: theme.accent, fontWeight: '800' }}>Restore</Text>
                </Pressable>
              )}
            </View>
          ))
        )}

        <Text style={[styles.sectionTitle, { color: theme.textPrimary, marginTop: 18 }]}>Groups from activities</Text>
        {groups.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surface }]}>
            <Text style={{ color: theme.textMuted, lineHeight: 19 }}>
              Standing group membership is not stored separately. Assign a group name when scoring a group activity.
            </Text>
          </View>
        ) : (
          groups.map(([groupName, members]) => (
            <View key={groupName} style={[styles.card, { backgroundColor: theme.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.textPrimary }]}>{groupName}</Text>
                <Text style={[styles.meta, { color: theme.textMuted }]}>{members.join(' • ')}</Text>
              </View>
            </View>
          ))
        )}

        <Pressable
          style={({ pressed }) => [styles.primary, { backgroundColor: theme.buttonPrimary }, pressed && styles.pressed]}
          onPress={() => router.push({
            pathname: '/profile/buklod-faculty-groups' as any,
            params: { id: classroomId, name: classroomName },
          })}
        >
          <Text style={styles.primaryText}>Open group scores & individual contribution</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={showEnroll} transparent animationType="fade" onRequestClose={() => setShowEnroll(false)}>
        <View style={styles.modalShade}>
          <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Enroll by BUKLOD username</Text>
            <TextInput
              value={enrollName}
              onChangeText={setEnrollName}
              placeholder="student.username"
              autoCapitalize="none"
              placeholderTextColor={theme.textMuted}
              style={[styles.search, { backgroundColor: theme.inputSurface, color: theme.textPrimary }]}
            />
            <Pressable style={[styles.primary, { backgroundColor: theme.buttonPrimary }]} onPress={() => void enroll()}>
              <Text style={styles.primaryText}>Enroll student</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => setShowEnroll(false)}>
              <Text style={{ color: theme.textMuted, fontWeight: '800' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!reviewIntent} transparent animationType="fade" onRequestClose={() => setReviewIntent(null)}>
        <View style={styles.modalShade}>
          <View style={[styles.modalCard, { backgroundColor: theme.surfaceElevated }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Review student match</Text>
            <Text style={[styles.reviewSource, { color: theme.textPrimary }]}>{reviewIntent?.source_name}</Text>
            <Text style={[styles.help, { color: theme.textMuted, marginBottom: 12 }]}>BUKLOD will never silently enroll an ambiguous fuzzy match. Confirm only the correct account.</Text>
            {reviewCandidates.length === 0 ? (
              <Text style={{ color: theme.textMuted }}>No reliable account suggestion yet. The name will keep waiting and will be checked again when BUKLOD profiles arrive or change.</Text>
            ) : (
              reviewCandidates.map(candidate => (
                <Pressable
                  key={candidate.id}
                  style={[styles.candidate, { backgroundColor: theme.inputSurface }]}
                  onPress={() => reviewIntent && void confirmMatch(reviewIntent, candidate)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: theme.textPrimary }]}>{candidate.display_name || candidate.username || 'BUKLOD User'}</Text>
                    {!!candidate.username && <Text style={[styles.meta, { color: theme.textMuted }]}>@{candidate.username}</Text>}
                  </View>
                  {typeof candidate.confidence === 'number' && (
                    <Text style={[styles.confidence, { color: theme.accent }]}>{Math.round(candidate.confidence * 100)}%</Text>
                  )}
                </Pressable>
              ))
            )}
            <Pressable style={styles.cancel} onPress={() => setReviewIntent(null)}>
              <Text style={{ color: theme.textMuted, fontWeight: '800' }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingTop: 42, paddingBottom: 60 },
  importPanel: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 15, marginBottom: 18 },
  importTitle: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  importButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  help: { fontSize: 11, lineHeight: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 17, fontWeight: '900', marginBottom: 10 },
  countText: { fontSize: 12, fontWeight: '800', marginBottom: 10 },
  smallButton: { borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8 },
  smallButtonText: { color: '#fff', fontWeight: '900' },
  disabled: { opacity: 0.5 },
  search: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  empty: { borderRadius: 16, padding: 16, marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, padding: 13, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, fontWeight: '900' },
  meta: { fontSize: 11, marginTop: 3 },
  primary: { borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 13 },
  primaryText: { color: '#fff', fontWeight: '900', textAlign: 'center' },
  pressed: { opacity: 0.78 },
  modalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 20, padding: 18, maxHeight: '82%' },
  modalTitle: { fontSize: 18, fontWeight: '900', marginBottom: 12 },
  reviewSource: { fontSize: 16, fontWeight: '900', marginBottom: 5 },
  candidate: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 13, padding: 12, marginBottom: 8 },
  confidence: { fontSize: 12, fontWeight: '900' },
  cancel: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
});
