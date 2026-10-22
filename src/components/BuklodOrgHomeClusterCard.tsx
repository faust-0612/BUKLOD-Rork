import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import BuklodReportDoorCard from '@/components/BuklodReportDoorCard';
import {
  clusterRoleLabel,
  fetchFormationContextResilient,
  type FormationContext,
} from '@/lib/buklodClusterFormationGate';
import { enterScopedWorkspace } from '@/lib/buklodScopeRoute';
import { canViewClusterProgress } from '@/lib/buklodOrgGovernance';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';

export default function BuklodOrgHomeClusterCard({
  organizationId,
}: {
  organizationId: string;
}) {
  const { selectScope } = useBuklodScope();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [context, setContext] = useState<FormationContext | null>(null);
  const [canReport, setCanReport] = useState(false);
  const [organizationName, setOrganizationName] = useState('Current Organization');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      // R3: bound the optional formation widget; never leave this card spinning.
      const withDeadline = <T,>(work: Promise<T>): Promise<T> =>
        new Promise<T>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Connection timed out')), 7000);
          work.then(value => { clearTimeout(timer); resolve(value); },
                    error => { clearTimeout(timer); reject(error); });
        });
      const [next, scopeResult] = await withDeadline(Promise.all([
        fetchFormationContextResilient(organizationId),
        (supabase as any).from('buklod_scopes').select('name')
          .eq('id', organizationId).maybeSingle(),
      ]));
      setContext(next);
      if (scopeResult.data?.name) setOrganizationName(String(scopeResult.data.name));
      if (next.primary_cluster?.cluster_id) {
        setCanReport(await withDeadline(canViewClusterProgress(next.primary_cluster.cluster_id)));
      } else {
        setCanReport(false);
      }
    } catch (error) {
      console.warn('Organization My Cluster load:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const cluster = context?.primary_cluster ?? null;

  return (
    <View style={styles.stack}>
      <BuklodReportDoorCard
        compact
        scopeId={organizationId}
        scopeName={organizationName}
        scopeType="ORGANIZATION"
      />

      <View style={styles.card}>
        <Text style={styles.eyebrow}>MY CLUSTER</Text>
        {loading ? (
          <View style={{flexDirection:'row',alignItems:'center',gap:9}}>
            <ActivityIndicator size="small" color={colors.green} />
            <Text style={styles.body}>Checking Cluster...</Text>
          </View>
        ) : loadError ? (
          <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.secondary}>
            <Text style={styles.secondaryText}>Cluster unavailable on this connection — RETRY</Text>
          </Pressable>
        ) : cluster && context?.has_active_cluster ? (
          <>
            <Text style={styles.title}>{cluster.cluster_name}</Text>
            <Text style={styles.meta}>
              Role: {clusterRoleLabel(cluster.role_keys)}
            </Text>
            <Pressable
              onPress={() =>
                void enterScopedWorkspace(selectScope, cluster.cluster_id, {
                  section: 'home',
                })
              }
              style={styles.button}
            >
              <Text style={styles.buttonText}>OPEN CLUSTER HOME</Text>
            </Pressable>
            {canReport ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/clusters/progress' as any,
                    params: { id: cluster.cluster_id },
                  } as any)
                }
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>CLUSTER PROGRESS REPORT</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.title}>You are not in a Cluster yet</Text>
            <Text style={styles.body}>
              Daily Bible Reading, Daily Devotion, and BUKLOD Lessons are
              Cluster features. Join or request to join a Cluster to continue.
            </Text>
            {context?.pending_clusters[0] ? (
              <Text style={styles.pending}>
                Request pending: {context.pending_clusters[0].cluster_name}
              </Text>
            ) : null}
            <Pressable
              onPress={() => router.push('/clusters' as any)}
              style={styles.button}
            >
              <Text style={styles.buttonText}>JOIN A CLUSTER</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 8,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#61766C',
  },
  title: { fontSize: 16, fontWeight: '900', color: '#173B2F' },
  meta: { fontSize: 12, fontWeight: '700', color: '#2D6A4F' },
  body: { fontSize: 12, lineHeight: 18, color: '#5F6F67' },
  pending: { fontSize: 12, fontWeight: '700', color: '#8A5A12' },
  button: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
  secondary: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: '#2D6A4F', fontWeight: '900', fontSize: 11 },
});
