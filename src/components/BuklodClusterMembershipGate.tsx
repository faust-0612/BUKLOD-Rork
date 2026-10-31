import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import {
  clusterRoleLabel,
  fetchFormationContextResilient,
  type FormationContext,
} from '@/lib/buklodClusterFormationGate';
import { enterScopedWorkspace } from '@/lib/buklodScopeRoute';
import { colors } from '@/lib/theme';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import { useNetwork } from '@/providers/NetworkProvider';

export default function BuklodClusterMembershipGate({
  children,
  organizationId,
  title = 'Join a Cluster first',
}: {
  children: React.ReactNode;
  organizationId?: string | null;
  title?: string;
}) {
  const { selectScope, scopes } = useBuklodScope();
  const { online } = useNetwork();
  const offlineMember = scopes.some(scope => scope.scope_type === 'CLUSTER' && scope.membership_status === 'ACTIVE');
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<FormationContext | null>(null);

  const load = useCallback(async () => {
    if (!online) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // Formation access follows the user's single personal Cluster membership.
    // Organization context must not create a false "Join a Cluster" result.
    const next = await fetchFormationContextResilient(null);
    setContext(next);
    setLoading(false);
  }, [organizationId, online]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (online && loading && !context) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  if (online ? context?.has_active_cluster : offlineMember) {
    return <>{children}</>;
  }

  if (!online) {
    return <View style={styles.wrap}>
      <Text style={styles.title}>Offline membership unavailable</Text>
      <Text style={styles.body}>No saved active Cluster membership for this account. Reconnect to verify access; this does not mean you were removed.</Text>
    </View>;
  }

  const pending = context?.pending_clusters[0] ?? null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>
        Daily Bible Reading, Daily Devotion, and BUKLOD Lessons belong to a
        Cluster. Being in an Organization is not enough. Join or request to
        join a Cluster from Organization Home.
      </Text>
      {pending ? (
        <Text style={styles.pending}>
          Your request to join {pending.cluster_name} is still pending.
        </Text>
      ) : null}
      {context?.primary_cluster ? (
        <Text style={styles.meta}>
          {context.primary_cluster.cluster_name} Â·{' '}
          {clusterRoleLabel(context.primary_cluster.role_keys)}
        </Text>
      ) : null}
      <Pressable
        onPress={() => router.push('/clusters' as any)}
        style={styles.button}
      >
        <Text style={styles.buttonText}>FIND A CLUSTER</Text>
      </Pressable>
      {organizationId ? (
        <Pressable
          onPress={() =>
            void enterScopedWorkspace(selectScope, organizationId, {
              section: 'home',
            })
          }
          style={styles.secondary}
        >
          <Text style={styles.secondaryText}>OPEN ORGANIZATION HOME</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  wrap: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#173B2F',
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    color: '#5F6F67',
  },
  pending: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A5A12',
  },
  meta: {
    fontSize: 12,
    color: '#2D6A4F',
    fontWeight: '700',
  },
  button: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  secondary: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: '#2D6A4F',
    fontWeight: '900',
    fontSize: 12,
  },
});

