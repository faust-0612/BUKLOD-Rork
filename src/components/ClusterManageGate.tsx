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
import type { ClusterDetails } from '@/lib/buklodClusters';
import { verifyClusterManageAccess } from '@/lib/buklodCluster';
import { colors } from '@/lib/theme';

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
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [cluster, setCluster] =
    useState<ClusterDetails | null>(null);

  const verify = useCallback(async () => {
    if (!scopeId) {
      setAllowed(false);
      setCluster(null);
      setLoading(false);
      return;
    }

    try {
      const result = await verifyClusterManageAccess(scopeId);
      setAllowed(result.allowed);
      setCluster(result.cluster);
    } catch {
      setAllowed(false);
      setCluster(null);
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

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
