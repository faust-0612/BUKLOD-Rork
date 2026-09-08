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
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_HIT_SLOP_TIGHT,
} from '@/lib/buklodTouch';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { FacultyClassHeader, FacultyGate } from '@/components/faculty/FacultyGate';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { supabase } from '@/lib/supabase';

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

function rosterHeader(value: unknown) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function readRosterWorkbook(uri: string) {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Could not read the selected roster file.');
    return XLSX.read(await response.arrayBuffer(), { type: 'array' });
  }
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return XLSX.read(base64, { type: 'base64' });
}

function workbookUsernames(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][];
  if (!matrix.length) return [];
  const headers = (matrix[0] ?? []).map(rosterHeader);
  const acceptedHeaders = new Set(['username', 'buklodusername', 'studentusername', 'user']);
  const usernameColumn = headers.findIndex(value => acceptedHeaders.has(value));
  const column = usernameColumn >= 0 ? usernameColumn : 0;
  const rows = usernameColumn >= 0 ? matrix.slice(1) : matrix;
  return Array.from(new Set(rows
    .map(row => String(row?.[column] ?? '').trim().replace(/^@/, ''))
    .filter(value => /^[a-zA-Z0-9._-]{2,80}$/.test(value))))
    .slice(0, 500);
}

export default function FacultyRosterScreen() {
  const params = useLocalSearchParams<{ id?: string; classroomId?: string; name?: string }>();
  const classroomId = String(params.id ?? params.classroomId ?? '');
  const classroomName = String(params.name ?? 'Classroom');
  const { theme } = useBuklodPresentation();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [scores, setScores] = useState<GroupScore[]>([]);
  const [search, setSearch] = useState('');
  const [enrollName, setEnrollName] = useState('');
  const [showEnroll, setShowEnroll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(item =>
      [item.display_name, item.username, item.status]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q))
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

    const [rosterRes, scoreRes] = await Promise.all([
      supabase.rpc('buklod_education_roster_v1', { p_classroom_id: classroomId }),
      supabase
        .from('buklod_education_group_activity_scores')
        .select('id,activity_id,student_user_id,group_name,final_score,status')
        .eq('classroom_id', classroomId),
    ]);

    if (rosterRes.error) Alert.alert('Roster', rosterRes.error.message);
    setStudents((rosterRes.data ?? []) as StudentRow[]);
    setScores((scoreRes.data ?? []) as GroupScore[]);
  }, [classroomId]);

  useEffect(() => {
    load();
  }, [load]);

  const enroll = async () => {
    const username = enrollName.trim();
    if (!username) return Alert.alert('Enroll Student', 'Enter the student BUKLOD username.');

    const { data, error } = await supabase.rpc('buklod_education_enroll_by_username_v1', {
      p_classroom_id: classroomId,
      p_username: username,
    });

    if (error) return Alert.alert('Enroll Student', error.message);
    setEnrollName('');
    setShowEnroll(false);
    Alert.alert('Enrollment', String(data ?? 'Student enrolled.'));
    load();
  };

  const importRoster = async () => {
    if (bulkImporting) return;
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets[0]) return;

    try {
      const usernames = workbookUsernames(await readRosterWorkbook(picked.assets[0].uri));
      if (!usernames.length) {
        return Alert.alert('Bulk Roster', 'No BUKLOD usernames were found. Use a CSV/XLS/XLSX first column or a column named username / BUKLOD username.');
      }

      Alert.alert(
        'Import roster?',
        `BUKLOD found ${usernames.length} unique username${usernames.length === 1 ? '' : 's'}. Existing enrollments will be skipped; no account is created automatically.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            onPress: () => {
              void (async () => {
                setBulkImporting(true);
                let enrolled = 0;
                let skipped = 0;
                const failed: string[] = [];
                try {
                  for (const username of usernames) {
                    const { error } = await supabase.rpc('buklod_education_enroll_by_username_v1', {
                      p_classroom_id: classroomId,
                      p_username: username,
                    });
                    if (!error) {
                      enrolled += 1;
                    } else if (/already|enrolled|duplicate|active/i.test(error.message || '')) {
                      skipped += 1;
                    } else {
                      failed.push(username);
                    }
                  }
                  await load();
                  Alert.alert(
                    'Bulk Roster Complete',
                    `${enrolled} enrolled • ${skipped} already present${failed.length ? ` • ${failed.length} need review: ${failed.slice(0, 8).join(', ')}${failed.length > 8 ? '…' : ''}` : ''}`,
                  );
                } finally {
                  setBulkImporting(false);
                }
              })();
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert('Bulk Roster', error instanceof Error ? error.message : 'Could not import this roster file.');
    }
  };

  const setStatus = async (student: StudentRow, status: 'ACTIVE' | 'DROPPED') => {
    const { error } = await supabase
      .from('buklod_education_enrollments')
      .update({ status })
      .eq('id', student.id)
      .eq('classroom_id', classroomId);

    if (error) return Alert.alert('Enrollment', error.message);
    load();
  };

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
          subtitle="Enrollment stays in this classroom. Group names come from scored group activities."
        />

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Enrolled students</Text>
          <View style={styles.sectionActions}>
            <Pressable
              disabled={bulkImporting}
              style={({ pressed }) => [styles.smallButtonSecondary, { backgroundColor: theme.accentSoft }, pressed && styles.pressed, bulkImporting && styles.disabled]}
              onPress={() => void importRoster()}
            >
              <Text style={[styles.smallButtonSecondaryText, { color: theme.accent }]}>{bulkImporting ? 'Importing…' : 'Import CSV/XLSX'}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.smallButton, { backgroundColor: theme.buttonPrimary }, pressed && styles.pressed]}
              onPress={() => setShowEnroll(true)}
            >
              <Text style={styles.smallButtonText}>+ Enroll</Text>
            </Pressable>
          </View>
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
                <Pressable onPress={() => setStatus(student, 'DROPPED')} hitSlop={BUKLOD_HIT_SLOP}>
                  <Text style={{ color: theme.danger, fontWeight: '800' }}>Drop</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => setStatus(student, 'ACTIVE')} hitSlop={BUKLOD_HIT_SLOP}>
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
          onPress={() =>
            router.push({
              pathname: '/profile/buklod-faculty-groups' as any,
              params: { id: classroomId, name: classroomName },
            })
          }
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
            <Pressable style={[styles.primary, { backgroundColor: theme.buttonPrimary }]} onPress={enroll}>
              <Text style={styles.primaryText}>Enroll student</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => setShowEnroll(false)}>
              <Text style={{ color: theme.textMuted, fontWeight: '800' }}>Cancel</Text>
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
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 17, fontWeight: '900', marginBottom: 10 },
  smallButton: { borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8 },
  smallButtonText: { color: '#fff', fontWeight: '900' },
  smallButtonSecondary: { borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8 },
  smallButtonSecondaryText: { fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.5 },
  search: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  empty: { borderRadius: 16, padding: 16, marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, padding: 13, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: '900' },
  meta: { marginTop: 2, fontSize: 12 },
  primary: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  primaryText: { color: '#fff', fontWeight: '900' },
  pressed: { opacity: 0.88 },
  modalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 20 },
  modalCard: { borderRadius: 22, padding: 20 },
  modalTitle: { fontSize: 21, fontWeight: '900', marginBottom: 14 },
  cancel: { paddingVertical: 12, alignItems: 'center' },
});
