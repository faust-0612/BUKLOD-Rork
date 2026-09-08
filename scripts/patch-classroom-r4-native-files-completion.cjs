const fs = require('fs');

function patchFile(target, edits) {
  let source = fs.readFileSync(target, 'utf8');
  for (const [label, before, after] of edits) {
    const first = source.indexOf(before);
    if (first < 0) throw new Error(`${target} / ${label}: anchor not found`);
    if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${target} / ${label}: anchor is not unique`);
    source = source.slice(0, first) + after + source.slice(first + before.length);
  }
  fs.writeFileSync(target, source);
  console.log(`Patched ${target}`);
}

patchFile('src/app/profile/buklod-faculty-roster.tsx', [
  [
    'native roster imports',
    "  TextInput,\n  View,\n} from 'react-native';\n",
    "  TextInput,\n  View,\n  Platform,\n} from 'react-native';\nimport * as DocumentPicker from 'expo-document-picker';\nimport * as FileSystem from 'expo-file-system/legacy';\nimport * as XLSX from 'xlsx';\n"
  ],
  [
    'bulk roster helpers',
    "type GroupScore = {\n  id: string;\n  activity_id: string;\n  student_user_id: string;\n  group_name: string | null;\n  final_score: number | null;\n  status: string;\n};\n\nexport default function FacultyRosterScreen() {",
    "type GroupScore = {\n  id: string;\n  activity_id: string;\n  student_user_id: string;\n  group_name: string | null;\n  final_score: number | null;\n  status: string;\n};\n\nfunction rosterHeader(value: unknown) {\n  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');\n}\n\nasync function readRosterWorkbook(uri: string) {\n  if (Platform.OS === 'web') {\n    const response = await fetch(uri);\n    if (!response.ok) throw new Error('Could not read the selected roster file.');\n    return XLSX.read(await response.arrayBuffer(), { type: 'array' });\n  }\n  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });\n  return XLSX.read(base64, { type: 'base64' });\n}\n\nfunction workbookUsernames(workbook: XLSX.WorkBook) {\n  const sheet = workbook.Sheets[workbook.SheetNames[0]];\n  if (!sheet) return [];\n  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }) as unknown[][];\n  if (!matrix.length) return [];\n  const headers = (matrix[0] ?? []).map(rosterHeader);\n  const acceptedHeaders = new Set(['username', 'buklodusername', 'studentusername', 'user']);\n  const usernameColumn = headers.findIndex(value => acceptedHeaders.has(value));\n  const column = usernameColumn >= 0 ? usernameColumn : 0;\n  const rows = usernameColumn >= 0 ? matrix.slice(1) : matrix;\n  return Array.from(new Set(rows\n    .map(row => String(row?.[column] ?? '').trim().replace(/^@/, ''))\n    .filter(value => /^[a-zA-Z0-9._-]{2,80}$/.test(value))))\n    .slice(0, 500);\n}\n\nexport default function FacultyRosterScreen() {"
  ],
  [
    'bulk roster state',
    "  const [showEnroll, setShowEnroll] = useState(false);\n  const [refreshing, setRefreshing] = useState(false);\n",
    "  const [showEnroll, setShowEnroll] = useState(false);\n  const [refreshing, setRefreshing] = useState(false);\n  const [bulkImporting, setBulkImporting] = useState(false);\n"
  ],
  [
    'bulk roster function',
    "  const setStatus = async (student: StudentRow, status: 'ACTIVE' | 'DROPPED') => {",
    "  const importRoster = async () => {\n    if (bulkImporting) return;\n    const picked = await DocumentPicker.getDocumentAsync({\n      type: [\n        'text/csv',\n        'application/vnd.ms-excel',\n        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',\n      ],\n      multiple: false,\n      copyToCacheDirectory: true,\n    });\n    if (picked.canceled || !picked.assets[0]) return;\n\n    try {\n      const usernames = workbookUsernames(await readRosterWorkbook(picked.assets[0].uri));\n      if (!usernames.length) {\n        return Alert.alert('Bulk Roster', 'No BUKLOD usernames were found. Use a CSV/XLS/XLSX first column or a column named username / BUKLOD username.');\n      }\n\n      Alert.alert(\n        'Import roster?',\n        `BUKLOD found ${usernames.length} unique username${usernames.length === 1 ? '' : 's'}. Existing enrollments will be skipped; no account is created automatically.`,\n        [\n          { text: 'Cancel', style: 'cancel' },\n          {\n            text: 'Import',\n            onPress: () => {\n              void (async () => {\n                setBulkImporting(true);\n                let enrolled = 0;\n                let skipped = 0;\n                const failed: string[] = [];\n                try {\n                  for (const username of usernames) {\n                    const { error } = await supabase.rpc('buklod_education_enroll_by_username_v1', {\n                      p_classroom_id: classroomId,\n                      p_username: username,\n                    });\n                    if (!error) {\n                      enrolled += 1;\n                    } else if (/already|enrolled|duplicate|active/i.test(error.message || '')) {\n                      skipped += 1;\n                    } else {\n                      failed.push(username);\n                    }\n                  }\n                  await load();\n                  Alert.alert(\n                    'Bulk Roster Complete',\n                    `${enrolled} enrolled • ${skipped} already present${failed.length ? ` • ${failed.length} need review: ${failed.slice(0, 8).join(', ')}${failed.length > 8 ? '…' : ''}` : ''}`,\n                  );\n                } finally {\n                  setBulkImporting(false);\n                }\n              })();\n            },\n          },\n        ],\n      );\n    } catch (error) {\n      Alert.alert('Bulk Roster', error instanceof Error ? error.message : 'Could not import this roster file.');\n    }\n  };\n\n  const setStatus = async (student: StudentRow, status: 'ACTIVE' | 'DROPPED') => {"
  ],
  [
    'bulk roster buttons',
    "        <View style={styles.sectionHeader}>\n          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Enrolled students</Text>\n          <Pressable\n            style={({ pressed }) => [styles.smallButton, { backgroundColor: theme.buttonPrimary }, pressed && styles.pressed]}\n            onPress={() => setShowEnroll(true)}\n          >\n            <Text style={styles.smallButtonText}>+ Enroll</Text>\n          </Pressable>\n        </View>\n",
    "        <View style={styles.sectionHeader}>\n          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Enrolled students</Text>\n          <View style={styles.sectionActions}>\n            <Pressable\n              disabled={bulkImporting}\n              style={({ pressed }) => [styles.smallButtonSecondary, { backgroundColor: theme.accentSoft }, pressed && styles.pressed, bulkImporting && styles.disabled]}\n              onPress={() => void importRoster()}\n            >\n              <Text style={[styles.smallButtonSecondaryText, { color: theme.accent }]}>{bulkImporting ? 'Importing…' : 'Import CSV/XLSX'}</Text>\n            </Pressable>\n            <Pressable\n              style={({ pressed }) => [styles.smallButton, { backgroundColor: theme.buttonPrimary }, pressed && styles.pressed]}\n              onPress={() => setShowEnroll(true)}\n            >\n              <Text style={styles.smallButtonText}>+ Enroll</Text>\n            </Pressable>\n          </View>\n        </View>\n"
  ],
  [
    'bulk roster styles',
    "  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },\n  sectionTitle: { fontSize: 17, fontWeight: '900', marginBottom: 10 },\n  smallButton: { borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8 },\n  smallButtonText: { color: '#fff', fontWeight: '900' },\n",
    "  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },\n  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },\n  sectionTitle: { fontSize: 17, fontWeight: '900', marginBottom: 10 },\n  smallButton: { borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8 },\n  smallButtonText: { color: '#fff', fontWeight: '900' },\n  smallButtonSecondary: { borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8 },\n  smallButtonSecondaryText: { fontSize: 11, fontWeight: '900' },\n  disabled: { opacity: 0.5 },\n"
  ],
]);

patchFile('src/app/profile/buklod-faculty-materials.tsx', [
  [
    'shared transfer imports',
    "import * as DocumentPicker from 'expo-document-picker';\nimport * as FileSystem from 'expo-file-system/legacy';\nimport { decode } from 'base64-arraybuffer';\nimport { router, useLocalSearchParams } from 'expo-router';\n\nimport { supabase } from '@/lib/supabase';\n",
    "import * as DocumentPicker from 'expo-document-picker';\nimport { router, useLocalSearchParams } from 'expo-router';\n\nimport { uploadClassroomObject } from '@/lib/education/classroomTransfer';\nimport { supabase } from '@/lib/supabase';\n"
  ],
  [
    'large material limit',
    "const MAX_BYTES = 25 * 1024 * 1024;",
    "const MAX_BYTES = 1024 * 1024 * 1024;"
  ],
  [
    'material progress state',
    "  const [releaseNow, setReleaseNow] = useState(true);\n  const [uploading, setUploading] = useState(false);\n",
    "  const [releaseNow, setReleaseNow] = useState(true);\n  const [uploading, setUploading] = useState(false);\n  const [uploadProgress, setUploadProgress] = useState(0);\n"
  ],
  [
    'material limit message',
    "      return Alert.alert('Material Too Large', 'Phase 5 upload limit is 25 MB per file.');",
    "      return Alert.alert('Material Too Large', 'BUKLOD Classroom accepts up to 1 GB per material file when the storage bucket permits it.');"
  ],
  [
    'resumable material upload',
    "      const base64 = await FileSystem.readAsStringAsync(asset.uri, {\n        encoding: FileSystem.EncodingType.Base64,\n      });\n\n      const safeName = asset.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120);\n      const storagePath = `${classroomId}/${Date.now()}_${safeName}`;\n\n      const { error: uploadError } = await supabase.storage\n        .from(BUCKET)\n        .upload(storagePath, decode(base64), {\n          contentType: asset.mimeType ?? 'application/octet-stream',\n          cacheControl: '3600',\n          upsert: false,\n        });\n\n      if (uploadError) throw uploadError;\n",
    "      const safeName = asset.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120);\n      const storagePath = `${classroomId}/${Date.now()}_${safeName}`;\n      const transfer = await uploadClassroomObject({\n        uri: asset.uri,\n        bucket: BUCKET,\n        path: storagePath,\n        name: asset.name,\n        mimeType: asset.mimeType,\n        size: asset.size,\n        onProgress: progress => setUploadProgress(progress.percent),\n      });\n"
  ],
  [
    'material metadata size',
    "          file_size: asset.size ?? null,",
    "          file_size: transfer.size,"
  ],
  [
    'material progress reset',
    "    } finally {\n      setUploading(false);\n    }\n",
    "    } finally {\n      setUploading(false);\n      setUploadProgress(0);\n    }\n"
  ],
  [
    'material progress display',
    "          <Text style={styles.primaryText}>{uploading ? 'Uploading…' : 'Choose & Upload File'}</Text>\n        </Pressable>\n        <Text style={styles.help}>PDF, Office files, images, videos and other classroom files • 25 MB Phase 5 limit.</Text>\n",
    "          <Text style={styles.primaryText}>{uploading ? `Uploading… ${uploadProgress}%` : 'Choose & Upload File'}</Text>\n        </Pressable>\n        <Text style={styles.help}>PDF, Office files, images, videos and other classroom files • up to 1 GB • larger uploads use resumable chunks and can retry from the saved offset.</Text>\n"
  ],
]);
