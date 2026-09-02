import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/lib/theme';
import {
  readScopeIdFromParams,
  verifyScopeManageAccess,
} from '@/lib/buklodScopeManage';

type Props = {
  scopeId?: string;
  scopeType?: string | null;
  title?: string;
  children: React.ReactNode;
};

export default function ScopeManageGate({
  scopeId: scopeIdProp,
  scopeType,
  title = 'Manage Scope',
  children,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const verify = useCallback(async () => {
    const scopeId = String(scopeIdProp ?? '').trim();

    if (!scopeId) {
      setAllowed(false);
      setLoading(false);
      return;
    }

    try {
      const result = await verifyScopeManageAccess(scopeId, scopeType);
      setAllowed(result.allowed);
    } catch {
      setAllowed(false);
    } finally {
      setLoading(false);
    }
  }, [scopeIdProp, scopeType]);

  useEffect(() => {
    void verify();
  }, [verify]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.green} />
        <Text style={styles.muted}>Checking admin access...</Text>
      </View>
    );
  }

  if (!allowed) {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedTitle}>ADMIN ACCESS REQUIRED</Text>
        <Text style={styles.muted}>
          {title} is available only to an authorized admin of this exact scope.
          Membership or admin authority in another Organization, Sub-organization,
          or Cluster does not grant access here.
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

export function useScopeManageParams(
  params: Record<string, unknown>
) {
  const scopeId = readScopeIdFromParams(params);
  const scopeType = String(params.scopeType ?? params.scope_type ?? '').trim();

  return { scopeId, scopeType };
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 28,
    backgroundColor: '#F4F7F5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  muted: {
    color: '#6E7E76',
    textAlign: 'center',
    lineHeight: 18,
    fontSize: 12,
  },
  deniedTitle: {
    color: '#173B2F',
    fontSize: 15,
    fontWeight: '900',
  },
});
