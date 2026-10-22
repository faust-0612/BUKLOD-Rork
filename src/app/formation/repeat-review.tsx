import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Button, Card, SectionTitle, shared } from '@/components/UI';
import { formationCopy, STAGE_PHASES } from '@/lib/formationCopy';
import { requestFormationRepeat } from '@/lib/buklodFormationProgress';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import type { FormationRepeatScope } from '@/types/buklodFormation';

const SCOPES: { value: FormationRepeatScope; label: string }[] = [
  { value: 'LESSON', label: 'This Lesson' },
  { value: 'ASSESSMENT', label: 'Assessment Only' },
  { value: 'SELECTED_LESSONS', label: 'Selected Lessons' },
  { value: 'MODULE', label: 'Module' },
  { value: 'STAGE', label: 'Entire Stage' },
];

type RepeatRow = {
  id: string;
  stage_code: number;
  repeat_scope: string;
  reason: string;
  status: string;
  requested_at: string;
  metadata: Record<string, unknown> | null;
};

export default function FormationRepeatReviewScreen() {
  const { stage, mode, memberId } = useLocalSearchParams<{
    stage?: string;
    mode?: string;
    memberId?: string;
  }>();
  const stageCode = Number(stage ?? 0);
  const isMemberView = mode === 'member';
  const { user, hasRole } = useAuth();
  const canReview =
    hasRole('pastor') || hasRole('system_admin') || hasRole('mentor');

  const targetMemberId = memberId ?? user?.id ?? '';

  const [activeRepeats, setActiveRepeats] = useState<RepeatRow[]>([]);
  const [scope, setScope] = useState<FormationRepeatScope>('STAGE');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!targetMemberId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const query = supabase
      .from('buklod_formation_repeat_requests')
      .select('*')
      .eq('member_id', targetMemberId)
      .eq('status', 'ACTIVE')
      .order('requested_at', { ascending: false });

    if (stageCode >= 101 && stageCode <= 107) {
      query.eq('stage_code', stageCode);
    }

    const { data, error } = await query;
    if (error) {
      Alert.alert('Repeat Status', error.message);
      setActiveRepeats([]);
    } else {
      setActiveRepeats((data ?? []) as RepeatRow[]);
    }
    setLoading(false);
  }, [stageCode, targetMemberId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stageLabel = useMemo(() => {
    if (stageCode >= 101 && stageCode <= 107) {
      return `BUKLOD ${stageCode} · ${STAGE_PHASES[stageCode] ?? ''}`;
    }
    return 'Formation Stage';
  }, [stageCode]);

  const requireRepeat = async () => {
    if (!canReview || isMemberView) return;
    if (reason.trim().length < 3) {
      return Alert.alert('Reason Required', 'Enter a reason for requiring repeat.');
    }

    setBusy(true);
    try {
      await requestFormationRepeat({
        memberId: targetMemberId,
        stageCode,
        repeatScope: scope,
        reason: reason.trim(),
      });

      Alert.alert(
        'Repeat Required',
        `Repeat request recorded for ${stageLabel}. Previous progress is preserved.`,
      );
      setReason('');
      await load();
    } catch (e: unknown) {
      Alert.alert(
        'Could not require repeat',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (isMemberView) {
    return (
      <ScrollView style={shared.screen} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>REPEAT REQUIRED</Text>
        <Text style={shared.h1}>{stageLabel}</Text>
        <Card>
          <Text style={shared.body}>
            Your previous completion is preserved. Complete the required lesson(s)
            again before continuing.
          </Text>
        </Card>

        {loading && <Text style={shared.muted}>Loading repeat requirements...</Text>}

        {!loading && activeRepeats.length === 0 && (
          <Card>
            <Text style={shared.muted}>No active repeat requirement found.</Text>
          </Card>
        )}

        {activeRepeats.map((row) => (
          <Card key={row.id}>
            <Text style={styles.scope}>{row.repeat_scope.replace(/_/g, ' ')}</Text>
            <Text style={shared.muted}>{row.reason}</Text>
            <Text style={styles.meta}>Requested {new Date(row.requested_at).toLocaleDateString()}</Text>
          </Card>
        ))}

        <View style={{ marginTop: 12 }}>
          <Button
            title={formationCopy.continueLearning}
            onPress={() => router.back()}
          />
        </View>
      </ScrollView>
    );
  }

  if (!canReview) {
    return (
      <View style={[shared.screen, shared.content]}>
        <Text style={shared.h1}>Require Repeat</Text>
        <Card>
          <Text>Pastor, Mentor, or System Admin access is required.</Text>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={shared.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>PASTOR / MENTOR ACTION</Text>
      <Text style={shared.h1}>Require Repeat</Text>
      <Text style={shared.muted}>{stageLabel}</Text>

      <Card>
        <Text style={shared.body}>
          Require this member to repeat part of their formation? Previous progress,
          answers, documents, Points, and Bayanihan history will be preserved.
        </Text>
      </Card>

      <SectionTitle>REPEAT SCOPE</SectionTitle>
      {SCOPES.map((item) => (
        <Button
          key={item.value}
          title={item.label}
          onPress={() => setScope(item.value)}
        />
      ))}
      <Text style={styles.selectedScope}>Selected: {scope.replace(/_/g, ' ')}</Text>

      <SectionTitle>REASON (REQUIRED)</SectionTitle>
      <TextInput
        style={styles.reason}
        multiline
        value={reason}
        onChangeText={setReason}
        placeholder="Why is repeat required?"
      />

      <View style={styles.actions}>
        <Button title="CANCEL" onPress={() => setReason('')} />
        <Button
          title={busy ? 'SUBMITTING...' : 'REQUIRE REPEAT'}
          onPress={requireRepeat}
        />
      </View>

      <SectionTitle>ACTIVE REPEATS</SectionTitle>
      {activeRepeats.map((row) => (
        <Card key={row.id}>
          <Text style={styles.scope}>{row.repeat_scope}</Text>
          <Text style={shared.muted}>{row.reason}</Text>
        </Card>
      ))}
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
  scope: { fontSize: 13, fontWeight: '900', color: colors.text },
  meta: { marginTop: 6, fontSize: 11, color: colors.muted },
  selectedScope: { marginVertical: 8, fontSize: 12, fontWeight: '800' },
  reason: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    textAlignVertical: 'top',
    backgroundColor: colors.white,
  },
  actions: { marginTop: 16, gap: 8 },
});
