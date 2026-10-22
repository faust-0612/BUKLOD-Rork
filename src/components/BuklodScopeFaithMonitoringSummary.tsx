import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { useBuklodAccess } from '@/hooks/useBuklodAccess';
import type { BuklodScope } from '@/lib/buklodScope';
import { scopeRouteParams } from '@/lib/buklodScopeManage';
import { canViewClusterProgress } from '@/lib/buklodOrgGovernance';
import { colors } from '@/lib/theme';

type Props = {
  scope: BuklodScope;
};

export default function BuklodScopeFaithMonitoringSummary({
  scope,
}: Props) {
  const { isExactScopeAdmin, isSystemAdmin } = useBuklodAccess();
  const [canLeadership, setCanLeadership] = useState(false);
  const isAdmin =
    Boolean(scope.is_admin) ||
    isExactScopeAdmin ||
    isSystemAdmin ||
    canLeadership;

  useFocusEffect(
    useCallback(() => {
      let alive = true;

      if (scope.scope_type !== 'CLUSTER') {
        setCanLeadership(false);
        return () => {
          alive = false;
        };
      }

      void canViewClusterProgress(scope.scope_id).then((allowed) => {
        if (alive) setCanLeadership(allowed);
      });

      return () => {
        alive = false;
      };
    }, [scope.scope_id, scope.scope_type])
  );

  if (!scope.show_faith_content || !isAdmin) {
    return null;
  }

  return (
    <Pressable
      style={styles.reportLink}
      onPress={() =>
        router.push({
          pathname: '/scope/faith-monitoring/report',
          params: scopeRouteParams(scope.scope_id),
        } as any)
      }
    >
      <MaterialCommunityIcons
        name="chart-box-outline"
        size={16}
        color={colors.greenDark}
      />
      <Text style={styles.reportLinkText}>Report</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  reportLink: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#F4F8F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reportLinkText: {
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
