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
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

export default function BuklodClusterMembershipGate({
  children,
  organizationId,
  title = 'Join a Cluster first',
  allowPublishedCachedPreview = false,
}: {
  children: React.ReactNode;
  organizationId?: string | null;
  title?: string;
  allowPublishedCachedPreview?: boolean;
}) {
  const { selectScope } = useBuklodScope();
  const { user } = useAuth();
  const { isConnected, isInternetReachable } = useNetwork();
  const accountId = user?.id ?? '';
  const online = Boolean(isConnected && isInternetReachable !== false);
  const [state, setState] = useState<{ accountId: string; context: FormationContext | null; loading: boolean }>({ accountId: '', context: null, loading: true });
  const context = state.accountId === accountId ? state.context : null;
  const loading = state.accountId !== accountId || state.loading;

  const load = useCallback(async (isCurrent: () => boolean = () => true) => {
    setState(previous => ({ accountId, context: previous.accountId === accountId ? previous.context : null, loading: true }));
    let next: FormationContext | null = null;
    if (accountId && online) {
      try {
        // Keep canonical personal Cluster/admin rules; a screen route is not an access grant.
        next = await withBuklodTimeout(fetchFormationContextResilient(null), 7000, 'Cluster membership');
      } catch { /* Failed verification is distinct from confirmed non-membership. */ }
    }
    if (isCurrent()) setState({ accountId, context: next, loading: false });
  }, [accountId, online]);

  useFocusEffect(useCallback(() => {
    let current = true;
    void load(() => current);
    return () => { current = false; };
  }, [load]));

  if (!online && accountId && allowPublishedCachedPreview) {
    // Word passes only previously fetched, published titles. No detail/action entitlement is granted.
    return <View style={{ flex: 1 }}><Text style={[styles.body, { margin: 16 }]}>Offline — saved published Word titles. Connect to verify Cluster access and open a devotion.</Text>{children}</View>;
  }

  if (loading && !context && online) {
    return <View style={styles.center}><ActivityIndicator color={colors.green} /></View>;
  }

  if (!online || !context || context.verification_status === 'unavailable') {
    return <View style={styles.wrap}>
      <Text style={styles.title}>Cluster access unavailable</Text>
      <Text style={styles.body}>{accountId ? 'Your Cluster membership could not be verified. Reconnect and retry.' : 'Sign in to verify your Cluster access.'}</Text>
      <Pressable accessibilityRole="button" disabled={!online || loading || !accountId} onPress={() => void load()} style={styles.button}><Text style={styles.buttonText}>RETRY ACCESS CHECK</Text></Pressable>
    </View>;
  }

  if (context.has_active_cluster) return <>{children}</>;

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
          {context.primary_cluster.cluster_name} ·{' '}
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

