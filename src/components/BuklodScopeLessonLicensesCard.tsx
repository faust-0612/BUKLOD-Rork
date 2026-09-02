import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import BuklodClusterPackagesCard from '@/components/BuklodClusterPackagesCard';
import BuklodMemberEntitlementNotice from '@/components/BuklodMemberEntitlementNotice';
import {
  BUKLOD_CLUSTER_PACKAGE_CODES,
  BUKLOD_COMMERCIAL_PRODUCTS,
  productForLessonStage,
} from '@/lib/buklodCommercialCatalog';
import {
  fetchScopeCommercialSnapshotResilient,
  type BuklodScopeCommercialSnapshot,
} from '@/lib/buklodScopeProductAccess';
import { colors } from '@/lib/theme';

type Props = {
  scopeId: string;
  scopeName?: string;
  defaultExpanded?: boolean;
};

export default function BuklodScopeLessonLicensesCard({
  scopeId,
  scopeName = 'this Cluster',
  defaultExpanded = true,
}: Props) {
  const [snapshot, setSnapshot] =
    useState<BuklodScopeCommercialSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(defaultExpanded);

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

  const packages = useMemo(
    () =>
      (snapshot?.products ?? []).filter((row) =>
        BUKLOD_CLUSTER_PACKAGE_CODES.includes(row.product_code),
      ),
    [snapshot?.products],
  );

  if (!scopeId) return null;

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={colors.green} />
        <Text style={styles.loadingText}>Loading lesson access...</Text>
      </View>
    );
  }

  if (snapshot?.is_billing_manager) {
    return (
      <BuklodClusterPackagesCard scopeId={scopeId} scopeName={scopeName} />
    );
  }

  return (
    <View style={styles.licenseBox}>
      <Pressable
        onPress={() => setExpanded((open) => !open)}
        style={styles.licenseHead}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.licenseTitle}>CLUSTER LESSON ACCESS</Text>
          <Text style={styles.licenseMeta}>
            Your Cluster administrator manages these packages for {scopeName}.
          </Text>
        </View>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.greenDark}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.licenseList}>
          {packages.map((row) => {
            const catalog = BUKLOD_COMMERCIAL_PRODUCTS[row.product_code];
            const unlocked = row.status === 'ACTIVE';
            return (
              <View key={row.product_code} style={styles.licenseRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.licenseCode}>{catalog.displayName}</Text>
                  {unlocked ? (
                    <Text style={styles.licenseOpen}>AVAILABLE</Text>
                  ) : (
                    <BuklodMemberEntitlementNotice
                      message={
                        row.product_code === 'cluster_premium'
                          ? catalog.memberLockedCopy
                          : productForLessonStage(catalog.lessonStages[0] ?? 0)
                              ?.memberLockedCopy ?? catalog.memberLockedCopy
                      }
                    />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: { color: colors.muted, fontSize: 12 },
  licenseBox: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  licenseHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  licenseTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: colors.greenDark,
  },
  licenseMeta: { marginTop: 3, fontSize: 11, color: colors.muted },
  licenseList: { marginTop: 10, gap: 10 },
  licenseRow: { gap: 6 },
  licenseCode: { fontSize: 13, fontWeight: '900', color: colors.text },
  licenseOpen: { fontSize: 10, fontWeight: '900', color: colors.greenDark },
});
