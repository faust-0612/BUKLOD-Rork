import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { supabase } from '../../lib/supabase';
import {
  clusterScopeParams,
  readClusterScopeId,
  verifyClusterManageAccess,
} from '@/lib/buklodCluster';

function firstString(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (
    Array.isArray(value) &&
    typeof value[0] === 'string'
  ) {
    return value[0].trim();
  }

  return '';
}

export default function ClusterScopeManageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const scopeId = readClusterScopeId(
    params as Record<string, unknown>
  );

  const routeName = firstString(params.clusterName);

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [scopeName, setScopeName] =
    useState(routeName || 'Cluster');

  const verify = useCallback(async () => {
    if (!scopeId) {
      setAllowed(false);
      setLoading(false);
      return;
    }

    try {
      const [manageResult, scopeResult] = await Promise.all([
        verifyClusterManageAccess(scopeId),
        (supabase as any)
          .from('buklod_scopes')
          .select('name')
          .eq('id', scopeId)
          .maybeSingle(),
      ]);

      setAllowed(manageResult.allowed);

      if (scopeResult.data?.name) {
        setScopeName(scopeResult.data.name);
      } else if (manageResult.cluster?.name) {
        setScopeName(manageResult.cluster.name);
      }
    } catch (error: any) {
      setAllowed(false);
      Alert.alert(
        'Manage Cluster',
        error?.message || 'Could not verify admin access.'
      );
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    void verify();
  }, [verify]);

  const open = (
    pathname: string,
    extra: Record<string, string> = {}
  ) => {
    router.push({
      pathname: pathname as any,
      params: clusterScopeParams(scopeId, {
        clusterName: scopeName,
        ...extra,
      }),
    } as any);
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Manage Cluster' }} />
        <View style={styles.center}>
          <Text style={styles.muted}>Checking admin access...</Text>
        </View>
      </>
    );
  }

  if (!allowed) {
    return (
      <>
        <Stack.Screen options={{ title: 'Manage Cluster' }} />
        <View style={styles.center}>
          <Text style={styles.deniedTitle}>ADMIN ACCESS REQUIRED</Text>
          <Text style={styles.muted}>
            Management controls are visible only to an authorized admin of
            this exact Cluster.
          </Text>
        </View>
      </>
    );
  }

  const buttons = [
    {
      title: 'Members & Roles (Unified)',
      subtitle:
        'Exact-scope member directory, functional roles, and admin assignment.',
      onPress: () =>
        router.push({
          pathname: '/scope/manage/members' as any,
          params: clusterScopeParams(scopeId, {
            clusterName: scopeName,
            scopeType: 'CLUSTER',
          }),
        } as any),
    },
    {
      title: 'Premium & Lesson Packages',
      subtitle:
        'Cluster Premium ₱49, CCP ₱49, Discipleship ₱59, Mentoring ₱69. Paid by Cluster Admin/Head only.',
      onPress: () => open('/clusters/packages'),
    },
    {
      title: 'Edit Cluster',
      subtitle:
        'Name, description, category, visibility, and Cluster profile settings.',
      onPress: () => open('/clusters/settings'),
    },
    {
      title: 'Members / Join Requests',
      subtitle:
        'Active members, pending requests, approvals, and membership administration.',
      onPress: () => open('/clusters/members-requests'),
    },
    {
      title: 'Invitations',
      subtitle:
        'Invite members and manage pending Cluster invitations.',
      onPress: () => open('/clusters/invitations'),
    },
    {
      title: 'Cluster Admins / Roles',
      subtitle:
        'View scoped Cluster admins and transfer admin authority for this Cluster only.',
      onPress: () => open('/clusters/admins'),
    },
    {
      title: 'Announcements / Home Content',
      subtitle:
        'Notices, events, tasks, polls, resources, and Cluster Home layout.',
      onPress: () => open('/clusters/home-content'),
    },
    {
      title: 'Events & Attendance',
      subtitle:
        'Open attendance tools for this exact Cluster scope.',
      onPress: () => open('/organizations/events-attendance'),
    },
    {
      title: 'More Admin Controls',
      subtitle:
        'Lifecycle, moderation, and remaining Cluster admin controls.',
      onPress: () => open('/clusters/manage-feature'),
    },
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'Manage Cluster' }} />

      <BuklodPortalScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>EXACT-SCOPE ADMIN</Text>
          <Text style={styles.title}>{scopeName}</Text>
          <Text style={styles.subtitle}>Manage this Cluster only.</Text>
        </View>

        {buttons.map((button) => (
          <Pressable
            key={button.title}
            onPress={button.onPress}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{button.title}</Text>
              <Text style={styles.cardSubtitle}>{button.subtitle}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 11,
    backgroundColor: '#F4F7F5',
  },
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
  header: {
    gap: 4,
    marginBottom: 5,
  },
  eyebrow: {
    color: '#61766C',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    color: '#173B2F',
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: '#697A71',
    fontSize: 11,
  },
  card: {
    minHeight: 82,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: '#173B2F',
    fontSize: 13,
    fontWeight: '900',
  },
  cardSubtitle: {
    color: '#6E7E76',
    fontSize: 10,
    lineHeight: 15,
  },
  chevron: {
    color: '#176B4A',
    fontSize: 26,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
