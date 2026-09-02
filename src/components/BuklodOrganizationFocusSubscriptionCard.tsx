import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';

import BuklodFaithPaymentModal from '@/components/BuklodFaithPaymentModal';
import {
  BUKLOD_COMMERCIAL_PRODUCTS,
  BUKLOD_PRODUCT_ORG_FOCUS_APPS_ANNUAL,
  BUKLOD_PRODUCT_ORG_FOCUS_APPS_MONTHLY,
  formatPhp,
  type BuklodCommercialProductCode,
} from '@/lib/buklodCommercialCatalog';
import {
  fetchScopeCommercialSnapshotResilient,
  formatEntitlementDate,
  productStatusLabel,
  type BuklodScopeCommercialSnapshot,
  type BuklodScopeProductAccess,
} from '@/lib/buklodScopeProductAccess';
import { colors } from '@/lib/theme';

export default function BuklodOrganizationFocusSubscriptionCard({
  organizationId,
  organizationName = 'this Organization',
}: {
  organizationId: string;
  organizationName?: string;
}) {
  const [snapshot, setSnapshot] =
    useState<BuklodScopeCommercialSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<BuklodCommercialProductCode | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!organizationId) {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const next = await fetchScopeCommercialSnapshotResilient(organizationId);
    setSnapshot(next);
    setLoading(false);
  }, [organizationId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const monthly = useMemo(
    () =>
      snapshot?.products.find(
        (row) => row.product_code === BUKLOD_PRODUCT_ORG_FOCUS_APPS_MONTHLY,
      ) ?? null,
    [snapshot?.products],
  );
  const annual = useMemo(
    () =>
      snapshot?.products.find(
        (row) => row.product_code === BUKLOD_PRODUCT_ORG_FOCUS_APPS_ANNUAL,
      ) ?? null,
    [snapshot?.products],
  );

  const active =
    monthly?.status === 'ACTIVE' || annual?.status === 'ACTIVE';

  if (!organizationId || loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.green} />
        <Text style={styles.muted}>Loading Focus Apps subscription...</Text>
      </View>
    );
  }

  if (!snapshot?.is_billing_manager && !active) {
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>BUKLOD FOCUS APPS</Text>
        <Text style={styles.title}>Locked until Organization subscription</Text>
        <Text style={styles.subtitle}>
          ₱59/month or ₱499/year per Organization. Cluster Premium and lesson
          packages stay separate. Ask an Organization Admin to subscribe.
        </Text>
      </View>
    );
  }

  const payingProduct = paying
    ? BUKLOD_COMMERCIAL_PRODUCTS[paying]
    : null;

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>ORGANIZATION ADMIN</Text>
        <Text style={styles.title}>BUKLOD Focus Apps</Text>
        <Text style={styles.price}>₱59/month or ₱499/year per Organization</Text>
        <Text style={styles.subtitle}>
          Organization creation stays free. This subscription unlocks
          Organization Focus App portals only. It does not unlock Cluster
          Premium or BUKLOD Lessons.
        </Text>
        {active ? (
          <Text style={styles.active}>SUBSCRIPTION ACTIVE</Text>
        ) : null}

        <PlanRow
          product={monthly}
          label="₱59 / month"
          onPay={() => setPaying(BUKLOD_PRODUCT_ORG_FOCUS_APPS_MONTHLY)}
          canPurchase={snapshot?.is_billing_manager === true}
        />
        <PlanRow
          product={annual}
          label="₱499 / year"
          onPay={() => setPaying(BUKLOD_PRODUCT_ORG_FOCUS_APPS_ANNUAL)}
          canPurchase={snapshot?.is_billing_manager === true}
        />
      </View>

      {payingProduct && snapshot ? (
        <BuklodFaithPaymentModal
          visible
          title={payingProduct.displayName}
          description={`${formatPhp(payingProduct.amountPhp)}${
            payingProduct.billingKind === 'MONTHLY' ? '/month' : '/year'
          } per Organization for ${organizationName}. Not a registration fee.`}
          amountPhp={payingProduct.amountPhp}
          gcashNumber={snapshot.gcash_number}
          scopeId={organizationId}
          paymentKind="DAILY_READING"
          productCode={payingProduct.code}
          onClose={() => setPaying(null)}
          onSubmitted={() => {
            setPaying(null);
            void load();
          }}
        />
      ) : null}
    </>
  );
}

function PlanRow({
  product,
  label,
  onPay,
  canPurchase,
}: {
  product: BuklodScopeProductAccess | null;
  label: string;
  onPay: () => void;
  canPurchase: boolean;
}) {
  if (!product) return null;
  return (
    <View style={styles.plan}>
      <View style={{ flex: 1 }}>
        <Text style={styles.planTitle}>{label}</Text>
        <Text style={styles.status}>
          {productStatusLabel(product.status)}
          {product.expires_at
            ? ` · until ${formatEntitlementDate(product.expires_at)}`
            : ''}
        </Text>
      </View>
      {product.status === 'ACTIVE' ? (
        <Text style={styles.active}>ACTIVE</Text>
      ) : product.status === 'PENDING' ? (
        <Text style={styles.pending}>PENDING</Text>
      ) : canPurchase ? (
        <Pressable onPress={onPay} style={styles.pay}>
          <Text style={styles.payText}>
            {product.status === 'EXPIRED' ? 'RENEW' : 'SUBSCRIBE'}
          </Text>
        </Pressable>
      ) : null}
    </View>
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
    gap: 8,
  },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, color: '#61766C' },
  title: { fontSize: 16, fontWeight: '900', color: '#173B2F' },
  price: { fontSize: 13, fontWeight: '900', color: '#2D6A4F' },
  subtitle: { fontSize: 11, lineHeight: 16, color: '#697A71' },
  status: { fontSize: 11, fontWeight: '800', color: '#2D6A4F' },
  active: { fontSize: 11, fontWeight: '900', color: '#2D6A4F' },
  pending: { fontSize: 11, fontWeight: '900', color: '#8A5A12' },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E6EEE9',
    borderRadius: 12,
    padding: 10,
  },
  planTitle: { fontSize: 13, fontWeight: '900', color: '#173B2F' },
  pay: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payText: { color: '#FFFFFF', fontWeight: '900', fontSize: 10 },
});
