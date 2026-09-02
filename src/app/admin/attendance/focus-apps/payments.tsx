import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { AdminGate } from '@/components/AdminGate';
import { Card, shared } from '@/components/UI';
import { useBuklodOfflineCache } from '@/hooks/useBuklodOfflineCache';
import {
  listFocusAppPaymentRequests,
  reviewFocusAppPayment,
  type FocusAppPaymentRequestRow,
} from '@/lib/buklodFocusAppSubscription';
import { adminFocusAppPaymentsCacheKey } from '@/lib/buklodOfflineSync';
import { colors } from '@/lib/theme';

const FILTERS = ['pending_admin', 'approved', 'rejected'] as const;

export default function AdminFocusAppPaymentsScreen() {
  const [filter, setFilter] =
    useState<(typeof FILTERS)[number]>('pending_admin');
  const [busyId, setBusyId] = useState<string | null>(null);

  const cacheKey = useMemo(
    () => adminFocusAppPaymentsCacheKey(filter),
    [filter]
  );

  const {
    data: requests,
    loading,
    refreshing,
    refresh,
    error,
  } = useBuklodOfflineCache<FocusAppPaymentRequestRow[]>({
    cacheKey,
    fetcher: () => listFocusAppPaymentRequests(filter, 100),
  });

  const list = requests ?? [];

  const title = useMemo(() => {
    if (filter === 'pending_admin') return 'Pending';
    if (filter === 'approved') return 'Approved';
    return 'Rejected';
  }, [filter]);

  const handleReview = async (
    row: FocusAppPaymentRequestRow,
    approve: boolean
  ) => {
    setBusyId(row.id);

    try {
      await reviewFocusAppPayment(row.id, approve);
      await refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Review failed';
      Alert.alert('Focus app payments', message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminGate>
      <View style={shared.screen}>
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          refreshing={refreshing}
          onRefresh={() => {
            void refresh();
          }}
          ListHeaderComponent={
            <>
              <Pressable onPress={() => router.back()} style={styles.back}>
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={22}
                  color={colors.greenDark}
                />
              </Pressable>

              <Text style={styles.eyebrow}>SYSTEM ADMIN</Text>
              <Text style={shared.h1}>Focus App Payments</Text>
              <Text style={shared.muted}>
                Review annual GCash payments for all BUKLOD Focus Apps.
              </Text>

              <View style={styles.filters}>
                {FILTERS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setFilter(option)}
                    style={[
                      styles.filterChip,
                      filter === option && styles.filterChipOn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        filter === option && styles.filterTextOn,
                      ]}
                    >
                      {option.replaceAll('_', ' ').toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.listTitle}>{title} requests</Text>
            </>
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.greenDark} />
            ) : (
              <Card>
                <Text style={shared.muted}>
                  {error
                    ? error
                    : `No ${title.toLowerCase()} focus app payments right now.`}
                </Text>
              </Card>
            )
          }
          renderItem={({ item }) => (
            <Card>
              <Text style={styles.kind}>
                {item.display_name || item.focus_app_code}
              </Text>
              <Text style={styles.meta}>
                {item.submitter_name} · ₱{item.amount_php.toFixed(0)}
              </Text>
              <Text style={styles.meta}>Scope: {item.scope_name}</Text>
              <Text style={styles.ref}>
                GCash ref: {item.gcash_reference}
              </Text>
              <Text style={styles.meta}>
                Submitted {new Date(item.created_at).toLocaleString()}
              </Text>
              {item.reviewed_at ? (
                <Text style={styles.meta}>
                  Reviewed {new Date(item.reviewed_at).toLocaleString()}
                </Text>
              ) : null}
              {item.admin_note ? (
                <Text style={styles.meta}>Note: {item.admin_note}</Text>
              ) : null}

              {filter === 'pending_admin' ? (
                <View style={styles.actions}>
                  <Pressable
                    disabled={busyId === item.id}
                    onPress={() => void handleReview(item, false)}
                    style={[styles.reject, busyId === item.id && styles.busy]}
                  >
                    <Text style={styles.rejectText}>REJECT</Text>
                  </Pressable>
                  <Pressable
                    disabled={busyId === item.id}
                    onPress={() => void handleReview(item, true)}
                    style={[styles.approve, busyId === item.id && styles.busy]}
                  >
                    {busyId === item.id ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.approveText}>APPROVE</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}
            </Card>
          )}
        />
      </View>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 50,
    gap: 8,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
    marginBottom: 10,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: colors.greenDark,
    marginBottom: 4,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterChipOn: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.green,
  },
  filterText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.muted,
  },
  filterTextOn: {
    color: colors.greenDark,
  },
  listTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 4,
  },
  kind: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  meta: {
    marginTop: 4,
    fontSize: 11,
    color: colors.muted,
  },
  ref: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '800',
    color: colors.greenDark,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  reject: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  rejectText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.muted,
  },
  approve: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenDark,
  },
  approveText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  busy: {
    opacity: 0.6,
  },
});
