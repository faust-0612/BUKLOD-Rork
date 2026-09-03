import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import * as XLSX from 'xlsx';

import { FacultyGate } from '@/components/faculty/FacultyGate';
import { supabase } from '@/lib/supabase';

type CanonicalRow = {
  row_no: number;
  source_name: string;
  student_no: string;
  username: string;
  email: string;
  mobile: string;
  first_name: string;
  middle_name: string;
  surname: string;
  full_name: string;
  section: string;
};

type PreviewRow = {
  row_no: number;
  match_status: 'MATCHED' | 'UNRESOLVED' | 'CONFLICT' | string;
  matched_user_id: string | null;
  display_name: string | null;
  username: string | null;
  match_method: string | null;
};

type ImportSummary = {
  requested?: number;
  valid?: number;
  enrolled_or_restored?: number;
  invalid_or_inactive?: number;
};

const ALIASES: Record<keyof Omit<CanonicalRow, 'row_no' | 'source_name'>, string[]> = {
  student_no: ['student no', 'student number', 'student id', 'studentid', 'id number', 'lrn', 'student_no'],
  username: ['username', 'buklod username', 'user name', 'user_name'],
  email: ['email', 'e-mail', 'email address', 'email_address'],
  mobile: ['mobile', 'mobile number', 'phone', 'phone number', 'contact', 'contact number', 'cellphone'],
  first_name: ['first name', 'firstname', 'given name', 'given_name'],
  middle_name: ['middle name', 'middlename', 'middle initial', 'middle_name'],
  surname: ['surname', 'last name', 'lastname', 'family name', 'family_name', 'last_name'],
  full_name: ['full name', 'student name', 'name', 'complete name', 'full_name'],
  section: ['section', 'class section', 'block', 'group'],
};

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function clean(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

function findValue(row: Record<string, unknown>, aliases: string[]) {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const target = normalizeHeader(alias);
    const found = entries.find(([key]) => normalizeHeader(key) === target);
    if (found) return clean(found[1]);
  }
  return '';
}

function toCanonical(rows: Record<string, unknown>[]) {
  return rows
    .map((row, index): CanonicalRow => {
      const firstName = findValue(row, ALIASES.first_name);
      const middleName = findValue(row, ALIASES.middle_name);
      const surname = findValue(row, ALIASES.surname);
      const fullName = findValue(row, ALIASES.full_name);
      const builtName = [firstName, middleName, surname].filter(Boolean).join(' ');
      const sourceName = fullName || builtName || findValue(row, ALIASES.username) || `Row ${index + 2}`;

      return {
        row_no: index + 1,
        source_name: sourceName,
        student_no: findValue(row, ALIASES.student_no),
        username: findValue(row, ALIASES.username),
        email: findValue(row, ALIASES.email),
        mobile: findValue(row, ALIASES.mobile),
        first_name: firstName,
        middle_name: middleName,
        surname,
        full_name: fullName || builtName,
        section: findValue(row, ALIASES.section),
      };
    })
    .filter(row =>
      Boolean(row.username || row.email || row.mobile || row.full_name || (row.first_name && row.surname))
    );
}

export default function BuklodFacultyImportRosterScreen() {
  const params = useLocalSearchParams<{ classroomId?: string; id?: string; name?: string }>();
  const classroomId = String(params.classroomId ?? params.id ?? '');
  const className = String(params.name ?? 'Class');

  const [fileName, setFileName] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CanonicalRow[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [busy, setBusy] = useState(false);

  const merged = useMemo(
    () =>
      rows.map(row => ({
        source: row,
        match: preview.find(item => Number(item.row_no) === row.row_no) ?? null,
      })),
    [preview, rows]
  );

  const matched = useMemo(
    () => preview.filter(item => item.match_status === 'MATCHED' && item.matched_user_id),
    [preview]
  );
  const unresolved = preview.filter(item => item.match_status === 'UNRESOLVED').length;
  const conflicts = preview.filter(item => item.match_status === 'CONFLICT').length;

  const chooseFile = async () => {
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const lower = asset.name.toLowerCase();
      if (!/\.(xlsx|xls|csv|txt)$/i.test(lower)) {
        Alert.alert('Student List', 'Use an Excel (.xlsx/.xls), CSV, or text roster file.');
        return;
      }

      const base64 = asset.base64 ||
        (await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        }));

      const workbook = XLSX.read(base64, { type: 'base64', cellDates: false });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) throw new Error('No worksheet was found in the selected file.');

      const worksheet = workbook.Sheets[firstSheet];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: '',
        raw: false,
      });

      if (raw.length === 0) throw new Error('The selected roster has no student rows.');
      if (raw.length > 1000) throw new Error('Import is limited to 1000 rows per batch.');

      const nextHeaders = Object.keys(raw[0] ?? {});
      const canonical = toCanonical(raw);
      if (canonical.length === 0) {
        throw new Error('No usable student identity column was detected. Include username, email, mobile, or student name.');
      }

      setFileName(asset.name);
      setSheetName(firstSheet);
      setHeaders(nextHeaders);
      setRows(canonical);
      setPreview([]);
    } catch (error: any) {
      Alert.alert('Student List', String(error?.message ?? error));
    } finally {
      setBusy(false);
    }
  };

  const previewMatch = async () => {
    if (!classroomId) return Alert.alert('Student List', 'Classroom is missing.');
    if (rows.length === 0) return Alert.alert('Student List', 'Choose a roster file first.');

    setBusy(true);
    try {
      const payload = rows.map(row => ({
        username: row.username || null,
        email: row.email || null,
        mobile: row.mobile || null,
        first_name: row.first_name || null,
        surname: row.surname || null,
        full_name: row.full_name || null,
      }));

      const { data, error } = await supabase.rpc('buklod_education_preview_roster_import_v2', {
        p_classroom_id: classroomId,
        p_rows: payload,
      });
      if (error) throw error;
      setPreview((data ?? []) as PreviewRow[]);
    } catch (error: any) {
      Alert.alert('Auto-Match', String(error?.message ?? error));
    } finally {
      setBusy(false);
    }
  };

  const commit = () => {
    const userIds = Array.from(new Set(matched.map(item => String(item.matched_user_id))));
    if (userIds.length === 0) {
      Alert.alert('Import Students', 'No safely matched BUKLOD accounts are ready to import.');
      return;
    }

    Alert.alert(
      'Import Matched Students',
      `Enroll or restore ${userIds.length} safely matched student(s) in ${className}? Unresolved and conflicting rows will not be imported.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            setBusy(true);
            try {
              const { data, error } = await supabase.rpc('buklod_education_commit_roster_import_v2', {
                p_classroom_id: classroomId,
                p_student_user_ids: userIds,
              });
              if (error) throw error;
              const summary = (data ?? {}) as ImportSummary;
              Alert.alert(
                'Roster Imported',
                `Matched/valid: ${Number(summary.valid ?? userIds.length)}\nEnrolled or restored: ${Number(summary.enrolled_or_restored ?? 0)}\nInvalid/inactive: ${Number(summary.invalid_or_inactive ?? 0)}`,
                [
                  {
                    text: 'Open Roster',
                    onPress: () =>
                      router.replace({
                        pathname: '/profile/buklod-faculty-roster' as any,
                        params: { id: classroomId, name: className },
                      }),
                  },
                ]
              );
            } catch (error: any) {
              Alert.alert('Import Students', String(error?.message ?? error));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <FacultyGate>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#17311f" />
          <Text style={styles.backText}>{className}</Text>
        </Pressable>

        <Text style={styles.eyebrow}>SMART ROSTER IMPORT</Text>
        <Text style={styles.title}>Upload Student List</Text>
        <Text style={styles.subtitle}>
          Import Excel, CSV, or a roster-style text file. Nothing is enrolled immediately: BUKLOD first previews and auto-matches each row to an existing BUKLOD account.
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Auto-match priority</Text>
          <Text style={styles.infoText}>1. BUKLOD username → 2. Email → 3. Mobile → 4. Unique student name.</Text>
          <Text style={styles.infoText}>Conflicts and unresolved rows are never auto-enrolled. Fix them manually or enroll by username from the normal roster screen.</Text>
        </View>

        <Pressable style={styles.primary} disabled={busy} onPress={() => void chooseFile()}>
          <MaterialCommunityIcons name="file-excel-outline" size={20} color="#fff" />
          <Text style={styles.primaryText}>{busy ? 'Reading file…' : 'Choose Excel / CSV / Roster File'}</Text>
        </Pressable>

        {!!fileName && (
          <View style={styles.fileCard}>
            <Text style={styles.fileName}>{fileName}</Text>
            <Text style={styles.meta}>Sheet: {sheetName} · Parsed students: {rows.length}</Text>
            <Text style={styles.meta}>Detected columns: {headers.join(' · ') || 'None'}</Text>
          </View>
        )}

        {rows.length > 0 && preview.length === 0 && (
          <Pressable style={styles.secondary} disabled={busy} onPress={() => void previewMatch()}>
            <MaterialCommunityIcons name="account-search-outline" size={20} color="#1f7a3f" />
            <Text style={styles.secondaryText}>Preview & Auto-Match Students</Text>
          </Pressable>
        )}

        {preview.length > 0 && (
          <>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, styles.good]}>
                <Text style={styles.summaryValue}>{matched.length}</Text>
                <Text style={styles.summaryLabel}>Matched</Text>
              </View>
              <View style={[styles.summaryCard, styles.warn]}>
                <Text style={styles.summaryValue}>{unresolved}</Text>
                <Text style={styles.summaryLabel}>Unresolved</Text>
              </View>
              <View style={[styles.summaryCard, styles.bad]}>
                <Text style={styles.summaryValue}>{conflicts}</Text>
                <Text style={styles.summaryLabel}>Conflict</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Preview</Text>
            {merged.slice(0, 250).map(({ source, match }) => {
              const status = match?.match_status ?? 'UNRESOLVED';
              return (
                <View key={source.row_no} style={styles.rowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{source.source_name}</Text>
                    <Text style={styles.meta}>
                      {[source.student_no && `ID ${source.student_no}`, source.section, source.username && `@${source.username}`]
                        .filter(Boolean)
                        .join(' · ') || `Source row ${source.row_no}`}
                    </Text>
                    {status === 'MATCHED' && (
                      <Text style={styles.matchText}>
                        Matched: {match?.display_name || match?.username || 'BUKLOD user'} · {match?.match_method}
                      </Text>
                    )}
                    {status === 'UNRESOLVED' && (
                      <Text style={styles.warnText}>No safe unique BUKLOD match. Enroll manually after review.</Text>
                    )}
                    {status === 'CONFLICT' && (
                      <Text style={styles.badText}>Multiple possible accounts matched. Manual verification required.</Text>
                    )}
                  </View>
                  <View style={[styles.status, status === 'MATCHED' ? styles.statusGood : status === 'CONFLICT' ? styles.statusBad : styles.statusWarn]}>
                    <Text style={styles.statusText}>{status}</Text>
                  </View>
                </View>
              );
            })}

            {merged.length > 250 && (
              <Text style={styles.limitNote}>Showing first 250 preview rows. All matched rows are included when you import.</Text>
            )}

            <Pressable style={styles.primary} disabled={busy || matched.length === 0} onPress={commit}>
              <MaterialCommunityIcons name="account-multiple-check-outline" size={20} color="#fff" />
              <Text style={styles.primaryText}>Import {matched.length} Safely Matched Student(s)</Text>
            </Pressable>

            {(unresolved > 0 || conflicts > 0) && (
              <Pressable
                style={styles.secondary}
                onPress={() =>
                  router.push({
                    pathname: '/profile/buklod-faculty-roster' as any,
                    params: { id: classroomId, name: className },
                  })
                }
              >
                <Text style={styles.secondaryText}>Open Roster for Manual Enrollment</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </FacultyGate>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f7f2' },
  content: { padding: 20, paddingTop: 42, paddingBottom: 80 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 18 },
  backText: { color: '#17311f', fontWeight: '900' },
  eyebrow: { color: '#1f7a3f', fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: '#17311f', fontSize: 28, fontWeight: '900', marginTop: 2 },
  subtitle: { color: '#667169', marginTop: 6, lineHeight: 20, marginBottom: 16 },
  infoCard: { backgroundColor: '#e8f4ea', borderRadius: 16, padding: 14, marginBottom: 14 },
  infoTitle: { color: '#17311f', fontWeight: '900' },
  infoText: { color: '#52645a', marginTop: 5, lineHeight: 18, fontSize: 12 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1f7a3f', borderRadius: 13, paddingVertical: 13, paddingHorizontal: 14, marginTop: 9 },
  primaryText: { color: '#fff', fontWeight: '900', textAlign: 'center' },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 13, paddingVertical: 12, paddingHorizontal: 14, marginTop: 9, borderWidth: 1, borderColor: '#cfe0d2' },
  secondaryText: { color: '#1f7a3f', fontWeight: '900', textAlign: 'center' },
  fileCard: { backgroundColor: '#fff', borderRadius: 15, padding: 14, marginTop: 12 },
  fileName: { color: '#203328', fontWeight: '900' },
  meta: { color: '#748078', fontSize: 11, lineHeight: 17, marginTop: 3 },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  summaryCard: { flex: 1, borderRadius: 14, padding: 12 },
  good: { backgroundColor: '#e8f4ea' },
  warn: { backgroundColor: '#fff3d9' },
  bad: { backgroundColor: '#fae9e6' },
  summaryValue: { color: '#203328', fontWeight: '900', fontSize: 22 },
  summaryLabel: { color: '#667169', fontSize: 11, marginTop: 2 },
  sectionTitle: { color: '#203328', fontWeight: '900', fontSize: 17, marginTop: 17, marginBottom: 9 },
  rowCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 14, padding: 13, marginBottom: 8 },
  rowName: { color: '#203328', fontWeight: '900' },
  matchText: { color: '#1f7a3f', fontSize: 11, fontWeight: '800', marginTop: 5 },
  warnText: { color: '#8a6422', fontSize: 11, fontWeight: '700', marginTop: 5 },
  badText: { color: '#9b4b40', fontSize: 11, fontWeight: '700', marginTop: 5 },
  status: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statusGood: { backgroundColor: '#dff1e3' },
  statusWarn: { backgroundColor: '#fff0c7' },
  statusBad: { backgroundColor: '#f6deda' },
  statusText: { color: '#38483e', fontSize: 9, fontWeight: '900' },
  limitNote: { color: '#748078', fontSize: 11, textAlign: 'center', marginVertical: 10 },
});