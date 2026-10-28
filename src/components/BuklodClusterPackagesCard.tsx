import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import BuklodFaithPaymentModal from '@/components/BuklodFaithPaymentModal';
import {
  BUKLOD_PAID_FEATURES_ENABLED,
  BUKLOD_CLUSTER_PACKAGE_CODES,
  BUKLOD_COMMERCIAL_PRODUCTS,
  formatPhp,
} from '@/lib/buklodCommercialCatalog';
import {
  fetchScopeCommercialSnapshotResilient,
  formatEntitlementDate,
  productStatusLabel,
  type BuklodScopeCommercialSnapshot,
  type BuklodScopeProductAccess,
} from '@/lib/buklodScopeProductAccess';
import { colors } from '@/lib/theme';

type PaymentTarget = {
  code: BuklodScopeProductAccess['product_code'];
  title: string;
  description: string;
  amountPhp: number;
};

export default function BuklodClusterPackagesCard({
  scopeId,
  scopeName = 'this Cluster',
}: {
  scopeId: string;
  scopeName?: string;
}) {
  const [snapshot, setSnapshot] =
    useState<BuklodScopeCommercialSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<PaymentTarget | null>(null);

  const load = useCallback(async () => {
    if (!scopeId) {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const next = await fetchScopeCommercialSnapshotResilient(scopeId);
    setSnapshot(next);
    setLoading(false);
  }, [scopeId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const products = useMemo(
    () =>
      (snapshot?.products ?? []).filter((row) =>
        BUKLOD_CLUSTER_PACKAGE_CODES.includes(row.product_code),
      ),
    [snapshot?.products],
  );

  if (!BUKLOD_PAID_FEATURES_ENABLED) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Paid Cluster packages paused</Text>
        <Text style={styles.subtitle}>
          Premium purchases and lesson package payments are unavailable
          pending final approval. Existing learning progress is preserved.
        </Text>
      </View>
    );
  }

  if (!scopeId || loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.green} />
        <Text style={styles.muted}>Loading Cluster packages...</Text>
      </View>
    );
  }

  if (!snapshot?.is_billing_manager) {
    return null;
  }

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>CLUSTER ADMIN / HEAD</Text>
        <Text style={styles.title}>Premium & Lesson Packages</Text>
        <Text style={styles.subtitle}>
          Payment is per Cluster. Eligible members inherit access. Ordinary
          members are not asked to pay.
        </Text>

        {snapshot.needs_organization_link ? (
          <Text style={styles.warn}>
            This Cluster is not linked to an Organization. Link it before
            purchasing. The Cluster record is preserved.
          </Text>
        ) : null}

        {products.map((row) => {
          const catalog = BUKLOD_COMMERCIAL_PRODUCTS[row.product_code];
          const purchased = row.status === 'ACTIVE';
          return (
            <View key={row.product_code} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{catalog.shortLabel}</Text>
                <Text style={styles.hint}>{catalog.adminHint}</Text>
                {catalog.includesDailyBibleReading ? (
                  <Text style={styles.hint}>
                    Daily Bible Reading included with Cluster Premium.
                  </Text>
                ) : null}
                <Text style={styles.status}>
                  {productStatusLabel(row.status)}
                  {row.billing_kind === 'ANNUAL' && row.expires_at
                    ? ` · renews ${formatEntitlementDate(row.expires_at)}`
                    : ''}
                </Text>
              </View>
              {purchased ? (
                <Text style={styles.active}>ACTIVE</Text>
              ) : row.status === 'PENDING' ? (
                <Text style={styles.pending}>PENDING</Text>
              ) : (
                <Pressable
                  onPress={() =>
                    setPayment({
                      code: row.product_code,
                      title: catalog.displayName,
                      description: catalog.adminHint,
                      amountPhp: row.amount_php,
                    })
                  }
                  style={styles.pay}
                >
                  <Text style={styles.payText}>
                    {formatPhp(row.amount_php)}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      <BuklodFaithPaymentModal
        visible={payment != null}
        title={payment?.title ?? 'Cluster package'}
        description={
          payment?.description ??
          `GCash payment for ${scopeName}. System Admin verifies the reference.`
        }
        amountPhp={payment?.amountPhp ?? 0}
        gcashNumber={snapshot.gcash_number}
        scopeId={scopeId}
        productCode={payment?.code}
        paymentKind={
          payment?.code === 'cluster_premium' ? 'DAILY_READING' : 'LESSON_STAGE'
        }
        stageCode={
          payment?.code === 'cluster_lessons_ccp'
            ? 101
            : payment?.code === 'cluster_lessons_discipleship'
              ? 104
              : payment?.code === 'cluster_lessons_mentoring'
                ? 106
                : undefined
        }
        onClose={() => setPayment(null)}
        onSubmitted={() => {
          void load();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  muted: { color: '#6E7E76', fontSize: 12 },
  card: {
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, color: '#61766C' },
  title: { fontSize: 16, fontWeight: '900', color: '#173B2F' },
  subtitle: { fontSize: 11, lineHeight: 16, color: '#697A71' },
  warn: { fontSize: 11, lineHeight: 16, color: '#8A5A12' },
  row: {
    borderTopWidth: 1,
    borderTopColor: '#E8EEEA',
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  name: { fontSize: 13, fontWeight: '900', color: '#173B2F' },
  hint: { marginTop: 3, fontSize: 10, lineHeight: 14, color: '#6E7E76' },
  status: { marginTop: 4, fontSize: 10, fontWeight: '800', color: '#2D6A4F' },
  active: { fontSize: 10, fontWeight: '900', color: '#2D6A4F' },
  pending: { fontSize: 10, fontWeight: '900', color: '#8A5A12' },
  pay: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
});
