import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';

import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { formationCopy, STAGE_PHASES } from '@/lib/formationCopy';
import { submitMemberStageRequirement, getFormationDocumentPath } from '@/lib/buklodFormationProgress';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

type Requirement = {
  requirement_code: string;
  stage_code: number;
  requirement_order: number;
  requirement_type: string;
  requirement_mode: string;
  title_fil: string;
  title_en: string;
};

type MemberRecord = {
  id: string;
  requirement_code: string;
  status: string;
  signed_or_completed_date: string | null;
  witness_name: string | null;
  document_url: string | null;
  record_details: Record<string, unknown> | null;
  version_number: number;
};

const COVENANT_UNAVAILABLE = new Set(['BUKLOD_CARE_COVENANT']);

const statusLabel = (status: string | undefined) => {
  switch (status) {
    case 'verified':
      return 'Verified';
    case 'pending_admin':
      return 'Awaiting Verification';
    case 'rejected':
      return 'Needs Revision';
    default:
      return 'Not Submitted';
  }
};

export default function FormationDocumentsScreen() {
  const { stage } = useLocalSearchParams<{ stage?: string }>();
  const stageCode = Number(stage ?? 0);
  const { user } = useAuth();

  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [records, setRecords] = useState<MemberRecord[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [mode, setMode] = useState<'digital' | 'paper'>('digital');
  const [ackName, setAckName] = useState('');
  const [witness, setWitness] = useState('');
  const [completedDate, setCompletedDate] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const reqQuery = supabase
      .from('buklod_stage_requirements')
      .select('*')
      .eq('is_active', true)
      .order('requirement_order');

    if (stageCode >= 101 && stageCode <= 107) {
      reqQuery.eq('stage_code', stageCode);
    }

    const [{ data: reqs }, { data: recs }] = await Promise.all([
      reqQuery,
      supabase
        .from('member_stage_requirement_records')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    setRequirements((reqs ?? []) as Requirement[]);
    setRecords((recs ?? []) as MemberRecord[]);
    setLoading(false);
  }, [stageCode, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const latestByCode = useMemo(() => {
    const map = new Map<string, MemberRecord>();
    records.forEach((row) => {
      if (!map.has(row.requirement_code)) {
        map.set(row.requirement_code, row);
      }
    });
    return map;
  }, [records]);

  const selected = requirements.find((r) => r.requirement_code === selectedCode);

  const pickDocument = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled || !user?.id) return;

    const asset = result.assets[0];
    if (!asset?.uri) return;

    setBusy(true);
    try {
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      const filename = `${Date.now()}.${ext}`;
      const stageForPath = stageCode >= 101 && stageCode <= 107 ? stageCode : 101;
      const reqCode = selectedCode ?? 'DOCUMENT';
      const path = await getFormationDocumentPath({
        stageCode: stageForPath,
        requirementCode: reqCode,
        filename,
      });
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('member-documents')
        .upload(path, blob, { upsert: true, contentType: asset.mimeType ?? 'image/jpeg' });

      if (uploadError) throw uploadError;

      setDocumentUrl(path);
    } catch (e: unknown) {
      Alert.alert(
        'Upload failed',
        e instanceof Error ? e.message : 'Could not upload document.',
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!selected) return;

    if (COVENANT_UNAVAILABLE.has(selected.requirement_code)) {
      return Alert.alert(
        'Awaiting Official Template',
        'This covenant is awaiting official template setup by System Admin.',
      );
    }

    if (selected.requirement_mode === 'ASSIGNMENT') {
      return Alert.alert(
        'Pastor Assignment Required',
        'Department assignment is recorded by your Pastor or Admin.',
      );
    }

    if (mode === 'digital' && ackName.trim().length < 3) {
      return Alert.alert('Acknowledgment', 'Enter your full name to acknowledge this covenant.');
    }

    if (mode === 'paper' && !documentUrl.trim()) {
      return Alert.alert('Document', 'Upload your signed document or enter a document link.');
    }

    setBusy(true);
    try {
      await submitMemberStageRequirement({
        requirementCode: selected.requirement_code,
        date: completedDate.trim() || null,
        witnessName: witness.trim() || null,
        documentUrl: documentUrl.trim() || null,
        acknowledgmentName: mode === 'digital' ? ackName.trim() : null,
        recordDetails: {
          submission_mode: mode,
        },
      });

      Alert.alert('Submitted', 'Your document was submitted for verification.');
      setAckName('');
      setWitness('');
      setCompletedDate('');
      setDocumentUrl('');
      setSelectedCode(null);
      await load();
    } catch (e: unknown) {
      Alert.alert(
        'Submission failed',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={shared.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>FORMATION DOCUMENTS</Text>
      <Text style={shared.h1}>
        {stageCode >= 101 && stageCode <= 107
          ? `BUKLOD ${stageCode} · ${STAGE_PHASES[stageCode] ?? ''}`
          : formationCopy.documents}
      </Text>
      <Text style={shared.muted}>
        Submit required records, covenants, and milestones for your formation stage.
      </Text>

      {loading && (
        <Card>
          <Text style={shared.muted}>Loading requirements...</Text>
        </Card>
      )}

      {!loading &&
        requirements.map((req) => {
          const latest = latestByCode.get(req.requirement_code);
          const isAssignment = req.requirement_mode === 'ASSIGNMENT';
          const awaitingTemplate = COVENANT_UNAVAILABLE.has(req.requirement_code);

          return (
            <Pressable
              key={req.requirement_code}
              onPress={() => setSelectedCode(req.requirement_code)}
            >
              <Card style={selectedCode === req.requirement_code ? styles.selected : undefined}>
                <Text style={styles.reqTitle}>{req.title_fil}</Text>
                <Text style={shared.muted}>{req.title_en}</Text>
                <Text style={styles.status}>{statusLabel(latest?.status)}</Text>

                {isAssignment && (
                  <View style={styles.assignmentBox}>
                    <Text style={styles.assignmentTitle}>DEPARTMENT ASSIGNMENT</Text>
                    <Text style={styles.assignmentRow}>
                      Ministry/Department:{' '}
                      {String(latest?.record_details?.department ?? 'Awaiting assignment')}
                    </Text>
                    <Text style={styles.assignmentRow}>
                      Role: {String(latest?.record_details?.role ?? '—')}
                    </Text>
                    <Text style={styles.assignmentRow}>
                      Assigned by: {String(latest?.record_details?.assigned_by_name ?? 'Pastor')}
                    </Text>
                    <Text style={styles.assignmentRow}>
                      Assigned date: {String(latest?.record_details?.assigned_date ?? '—')}
                    </Text>
                  </View>
                )}

                {awaitingTemplate && (
                  <Text style={styles.awaiting}>
                    Awaiting official template / admin setup.
                  </Text>
                )}
              </Card>
            </Pressable>
          );
        })}

      {selected && selected.requirement_mode !== 'ASSIGNMENT' && (
        <>
          <SectionTitle>SUBMIT · {selected.title_fil}</SectionTitle>

          {COVENANT_UNAVAILABLE.has(selected.requirement_code) ? (
            <Card>
              <Text style={shared.muted}>
                The official BUKLOD Care Covenant body is not yet available in the app.
                This requirement will open once System Admin publishes the template.
              </Text>
            </Card>
          ) : (
            <Card>
              <View style={styles.modeRow}>
                <Pressable
                  onPress={() => setMode('digital')}
                  style={[styles.modeBtn, mode === 'digital' && styles.modeActive]}
                >
                  <Text style={styles.modeText}>Digital Acknowledgment</Text>
                </Pressable>
                <Pressable
                  onPress={() => setMode('paper')}
                  style={[styles.modeBtn, mode === 'paper' && styles.modeActive]}
                >
                  <Text style={styles.modeText}>Existing Paper Document</Text>
                </Pressable>
              </View>

              {mode === 'digital' && (
                <>
                  <Text style={shared.muted}>
                    Read the covenant carefully. Type your full name below as voluntary acknowledgment.
                  </Text>
                  <Text style={styles.fieldLabel}>Your Full Name</Text>
                  <TextInput
                    style={styles.input}
                    value={ackName}
                    onChangeText={setAckName}
                    placeholder="Full name"
                  />
                </>
              )}

              {mode === 'paper' && (
                <>
                  <Text style={styles.fieldLabel}>Document URL (optional if uploading)</Text>
                  <TextInput
                    style={styles.input}
                    value={documentUrl}
                    onChangeText={setDocumentUrl}
                    placeholder="https://..."
                    autoCapitalize="none"
                  />
                  <Button title="UPLOAD PHOTO / SCAN" onPress={pickDocument} />
                </>
              )}

              <Text style={styles.fieldLabel}>Signing / Completion Date</Text>
              <TextInput
                style={styles.input}
                value={completedDate}
                onChangeText={setCompletedDate}
                placeholder="YYYY-MM-DD"
              />

              <Text style={styles.fieldLabel}>Witness (if required)</Text>
              <TextInput
                style={styles.input}
                value={witness}
                onChangeText={setWitness}
                placeholder="Witness name"
              />

              <View style={{ marginTop: 12 }}>
                <Button
                  title={busy ? 'SUBMITTING...' : 'SUBMIT FOR VERIFICATION'}
                  onPress={submit}
                />
              </View>
            </Card>
          )}
        </>
      )}

      <View style={{ marginTop: 8 }}>
        <Button title="BACK TO LEARNING" onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 48 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.greenDark,
    marginBottom: 4,
  },
  selected: { borderColor: colors.green, borderWidth: 1 },
  reqTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  status: { marginTop: 8, fontSize: 12, fontWeight: '800', color: colors.greenDark },
  awaiting: { marginTop: 8, fontSize: 12, color: '#B45309' },
  assignmentBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F2F6F3',
  },
  assignmentTitle: { fontSize: 10, fontWeight: '900', color: colors.greenDark },
  assignmentRow: { marginTop: 4, fontSize: 12, color: colors.text },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  modeActive: { borderColor: colors.green, backgroundColor: '#EEF7F0' },
  modeText: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  fieldLabel: { marginTop: 10, fontSize: 11, fontWeight: '800', color: colors.muted },
  input: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.white,
  },
});
