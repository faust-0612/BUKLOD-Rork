import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';

import { AdminGate } from '@/components/AdminGate';
import { Card, shared } from '@/components/UI';
import {
  listFaithPaymentRequests,
  reviewFaithPayment,
  type FaithPaymentRequestRow,
} from '@/lib/buklodScopeFaithAccess';
import {
  listScopeProductPayments,
  reviewScopeProductPayment,
  type BuklodProductPaymentRow,
} from '@/lib/buklodScopeProductAccess';
import { BUKLOD_COMMERCIAL_PRODUCTS } from '@/lib/buklodCommercialCatalog';
import { colors } from '@/lib/theme';

type AdminPaymentRow =
  | ({ source: 'legacy' } & FaithPaymentRequestRow)
  | ({ source: 'product' } & BuklodProductPaymentRow);

function paymentLabel(row: AdminPaymentRow) {
  if (row.source === 'product') {
    const catalog =
      BUKLOD_COMMERCIAL_PRODUCTS[
        row.product_code as keyof typeof BUKLOD_COMMERCIAL_PRODUCTS
      ];
    return catalog?.displayName ?? row.product_code;
  }

  if (row.payment_kind === 'LESSON_STAGE') {
    return `Buklod Lesson ${row.stage_code ?? ''}`;
  }

  if (row.payment_kind === 'DEVOTION_WORD') {
    return 'Devotion (Word)';
  }

  return 'Daily Reading';
}

export default function FaithPaymentsAdminScreen() {
  const [requests, setRequests] = useState<AdminPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [legacy, products] = await Promise.all([
        listFaithPaymentRequests('pending_admin', 100).catch(
          () => [] as FaithPaymentRequestRow[],
        ),
        listScopeProductPayments('pending_admin', 100),
      ]);

      setRequests([
        ...products.map((row) => ({ source: 'product' as const, ...row })),
        ...legacy.map((row) => ({ source: 'legacy' as const, ...row })),
      ]);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not load payments';
      Alert.alert('Payments', message);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReview = async (row: AdminPaymentRow, approve: boolean) => {
    setBusyId(row.id);

    try {
      if (row.source === 'product') {
        await reviewScopeProductPayment(row.id, approve);
      } else {
        await reviewFaithPayment(row.id, approve);
      }
      await load();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Review failed';
      Alert.alert('Payments', message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminGate>
      <Stack.Screen options={{ title: 'Faith & Cluster Payments' }} />

      <View style={shared.screen}>
        <FlatList
          data={requests}
          keyExtractor={(item) => `${item.source}:${item.id}`}
          contentContainerStyle={styles.content}
          refreshing={loading}
          onRefresh={() => {
            void load();
          }}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.green} />
            ) : (
              <Card>
                <Text style={shared.body}>
                  No pending Cluster, lesson, or Organization portal payments
                  right now.
                </Text>
              </Card>
            )
          }
          renderItem={({ item }) => (
            <Card>
              <Text style={styles.kind}>{paymentLabel(item)}</Text>
              <Text style={styles.meta}>
                {item.submitter_name} · ₱{item.amount_php.toFixed(0)}
              </Text>
              {item.scope_name ? (
                <Text style={styles.meta}>Scope: {item.scope_name}</Text>
              ) : null}
              {item.source === 'product' ? (
                <Text style={styles.meta}>Product: {item.product_code}</Text>
              ) : null}
              <Text style={styles.ref}>
                GCash ref: {item.gcash_reference}
              </Text>
              <Text style={styles.meta}>
                Submitted {new Date(item.created_at).toLocaleString()}
              </Text>

              <View style={styles.actions}>
                <Pressable
                  disabled={busyId === item.id}
                  onPress={() => void handleReview(item, false)}
                  style={({ pressed }) => [
                    styles.reject,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={styles.rejectText}>REJECT</Text>
                </Pressable>

                <Pressable
                  disabled={busyId === item.id}
                  onPress={() => void handleReview(item, true)}
                  style={({ pressed }) => [
                    styles.approve,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={styles.approveText}>
                    {busyId === item.id ? 'WORKING...' : 'APPROVE'}
                  </Text>
                </Pressable>
              </View>
            </Card>
          )}
        />
      </View>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
  },
  kind: {
    color: colors.greenDark,
    fontSize: 14,
    fontWeight: '900',
  },
  meta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  ref: {
    marginTop: 6,
    color: '#173B2F',
    fontSize: 13,
    fontWeight: '800',
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  reject: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    paddingVertical: 10,
    alignItems: 'center',
  },
  rejectText: {
    color: '#991B1B',
    fontSize: 11,
    fontWeight: '900',
  },
  approve: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: colors.greenDark,
    paddingVertical: 10,
    alignItems: 'center',
  },
  approveText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
});
