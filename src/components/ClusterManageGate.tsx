import React, {
  useCallback,
  useEffect,
  useState,
  useRef,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ClusterDetails } from '@/lib/buklodClusters';
import { verifyClusterManageAccess } from '@/lib/buklodCluster';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';

type Props = {
  scopeId: string;
  title?: string;
  children: (cluster: ClusterDetails) => React.ReactNode;
};

export default function ClusterManageGate({
  scopeId,
  title = 'Manage Cluster',
  children,
}: Props) {
  const { user } = useAuth();
  const generation = useRef(0);
  const contextKey = `${user?.id ?? ''}:${scopeId}`;
  const [checkedContext, setCheckedContext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [cluster, setCluster] =
    useState<ClusterDetails | null>(null);

  const verify = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    setAllowed(false);
    setCluster(null);
    if (!scopeId) {
      setAllowed(false);
      setCluster(null);
      setCheckedContext(contextKey);
      setLoading(false);
      return;
    }

    try {
      const result = await withBuklodTimeout(verifyClusterManageAccess(scopeId), 10000, 'Cluster admin access');
      if (request !== generation.current) return;
      setAllowed(result.allowed);
      setCluster(result.cluster);
    } catch {
      if (request !== generation.current) return;
      setError('Could not verify access. Check your connection and retry.');
      setAllowed(false);
      setCluster(null);
    } finally {
      if (request === generation.current) { setCheckedContext(contextKey); setLoading(false); }
    }
  }, [scopeId, contextKey]);

  useEffect(() => {
    void verify();
    return () => { generation.current += 1; };
  }, [verify]);

  if (loading || checkedContext !== contextKey) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.green} />
        <Text style={styles.muted}>Checking admin access...</Text>
      </View>
    );
  }

  if (error) {
    return <View style={styles.center}>
      <Text style={styles.muted}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={() => void verify()}>
        <Text style={styles.deniedTitle}>RETRY</Text>
      </Pressable>
    </View>;
  }

  if (!allowed || !cluster) {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedTitle}>ADMIN ACCESS REQUIRED</Text>
        <Text style={styles.muted}>
          {title} is available only to an authorized admin of this exact
          Cluster. Membership in another Cluster, Organization, or unrelated
          scope does not grant access.
        </Text>
      </View>
    );
  }

  return <>{children(cluster)}</>;
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
  },
  deniedTitle: {
    color: '#173B2F',
    fontSize: 15,
    fontWeight: '900',
  },
});

