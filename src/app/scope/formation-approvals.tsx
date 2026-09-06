import { useCallback, useMemo, useState } from 'react';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { Card, shared } from '@/components/UI';
import { useBuklodAccess } from '@/hooks/useBuklodAccess';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

type ApprovalRow = {
  approval_id: string;
  scope_id: string;
  item_kind: 'DAILY_READING' | 'DAILY_DEVOTION' | 'LESSON';
  item_id: string;
  learner_id: string;
  learner_name: string;
  title: string;
  subtitle: string;
  submitted_at: string;
  status: 'PENDING';
};

function itemLabel(kind: ApprovalRow['item_kind']) {
  if (kind === 'DAILY_READING') return 'DAILY READING';
  if (kind === 'DAILY_DEVOTION') return 'DAILY DEVOTION';
  return 'BUKLOD LESSON';
}

export default function ScopeFormationApprovalsScreen() {
  const { activeScope } = useBuklodScope();
  const { isExactScopeAdmin, isSystemAdmin } = useBuklodAccess();
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isAdmin =
    Boolean(activeScope?.is_admin) || isExactScopeAdmin || isSystemAdmin;

  const load = useCallback(async () => {
    if (!activeScope?.scope_id) {
      setRows([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data, error } = await (supabase as any).rpc(
      'buklod_scope_formation_approval_queue_v2',
      { p_scope_id: activeScope.scope_id }
    );

    if (error) {
      setRows([]);
      setLoading(false);
      setRefreshing(false);
      Alert.alert('Formation Approvals', error.message);
      return;
    }

    setRows(Array.isArray(data) ? (data as ApprovalRow[]) : []);
    setLoading(false);
    setRefreshing(false);
  }, [activeScope?.scope_id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const grouped = useMemo(
    () => ({
      DAILY_READING: rows.filter((row) => row.item_kind === 'DAILY_READING'),
      DAILY_DEVOTION: rows.filter((row) => row.item_kind === 'DAILY_DEVOTION'),
      LESSON: rows.filter((row) => row.item_kind === 'LESSON'),
    }),
    [rows]
  );

  const review = useCallback(
    (row: ApprovalRow, approve: boolean) => {
      Alert.alert(
        approve ? 'Approve submission?' : 'Reject submission?',
        `${row.learner_name}\n${row.title}`,
        [
          { text: 'CANCEL', style: 'cancel' },
          {
            text: approve ? 'APPROVE' : 'REJECT',
            style: approve ? 'default' : 'destructive',
            onPress: async () => {
              setBusyId(row.approval_id);

              const { error } = await (supabase as any).rpc(
                'buklod_review_scope_formation_approval_v2',
                {
                  p_approval_id: row.approval_id,
                  p_approve: approve,
                  p_remarks: notes[row.approval_id]?.trim() || null,
                }
              );

              setBusyId(null);

              if (error) {
                Alert.alert('Review failed', error.message);
                return;
              }

              Alert.alert(
                approve ? 'Approved' : 'Rejected',
                `${itemLabel(row.item_kind)} was ${
                  approve ? 'approved' : 'returned for revision'
                } in ${activeScope?.name ?? 'this scope'}.`
              );

              await load();
            },
          },
        ]
      );
    },
    [activeScope?.name, load, notes]
  );

  if (!activeScope?.scope_id) {
    return (
      <View style={[shared.screen, styles.center]}>
        <Text style={shared.h2}>Open a workspace first.</Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={[shared.screen, styles.center]}>
        <Text style={shared.h2}>Admin access required</Text>
        <Text style={shared.muted}>
          Only the authorized admin of this exact scope can review these
          submissions.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={shared.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={colors.greenDark}
          />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={shared.h1}>Formation Approvals</Text>
          <Text style={shared.muted}>{activeScope.name}</Text>
        </View>
      </View>

      <Card>
        <Text style={styles.ruleTitle}>EXACT-SCOPE RULE</Text>
        <Text style={shared.muted}>
          Only submissions entered from this exact Organization,
          Sub-organization, or Cluster appear here. Other scopes are not mixed
          into this queue.
        </Text>
      </Card>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green} />
          <Text style={shared.muted}>Loading approvals...</Text>
        </View>
      ) : rows.length === 0 ? (
        <Card>
          <Text style={shared.h2}>No pending approvals</Text>
          <Text style={shared.muted}>
            This exact scope has no Daily Reading, Daily Devotion, or BUKLOD
            Lesson submissions waiting for review.
          </Text>
        </Card>
      ) : (
        (['DAILY_READING', 'DAILY_DEVOTION', 'LESSON'] as const).map((kind) =>
          grouped[kind].length ? (
            <View key={kind} style={styles.section}>
              <Text style={styles.sectionTitle}>{itemLabel(kind)}</Text>
              {grouped[kind].map((row) => (
                <Card key={row.approval_id}>
                  <Text style={styles.member}>{row.learner_name}</Text>
                  <Text style={shared.h2}>{row.title}</Text>
                  {!!row.subtitle && (
                    <Text style={shared.muted}>{row.subtitle}</Text>
                  )}
                  <Text style={styles.dateText}>
                    Submitted {new Date(row.submitted_at).toLocaleString()}
                  </Text>
                  <TextInput
                    value={notes[row.approval_id] ?? ''}
                    onChangeText={(value) =>
                      setNotes((current) => ({
                        ...current,
                        [row.approval_id]: value,
                      }))
                    }
                    multiline
                    placeholder="Review note (optional)"
                    style={styles.note}
                  />
                  <View style={styles.actions}>
                    <Pressable
                      disabled={busyId === row.approval_id}
                      onPress={() => review(row, true)}
                      style={[styles.action, styles.approve]}
                    >
                      <Text style={styles.approveText}>
                        {busyId === row.approval_id ? 'PROCESSING...' : 'APPROVE'}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={busyId === row.approval_id}
                      onPress={() => review(row, false)}
                      style={[styles.action, styles.reject]}
                    >
                      <Text style={styles.rejectText}>REJECT</Text>
                    </Pressable>
                  </View>
                </Card>
              ))}
            </View>
          ) : null
        )
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  ruleTitle: {
    color: colors.greenDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  member: {
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },
  dateText: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 10,
  },
  note: {
    minHeight: 72,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 10,
    textAlignVertical: 'top',
    backgroundColor: colors.white,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  action: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  approve: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  approveText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  reject: {
    backgroundColor: colors.white,
    borderColor: '#B91C1C',
  },
  rejectText: {
    color: '#B91C1C',
    fontSize: 10,
    fontWeight: '900',
  },
});
