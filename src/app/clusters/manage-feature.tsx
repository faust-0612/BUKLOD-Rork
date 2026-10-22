import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import ClusterManageGate from '@/components/ClusterManageGate';
import {
  clusterScopeParams,
  readClusterScopeId,
} from '@/lib/buklodCluster';

export default function ClusterManageFeatureScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const scopeId = readClusterScopeId(
    params as Record<string, unknown>
  );

  const open = (pathname: string) => {
    router.push({
      pathname: pathname as any,
      params: clusterScopeParams(scopeId),
    } as any);
  };

  const buttons = [
    {
      title: 'Cluster Lifecycle',
      subtitle: 'Archive or restore this Cluster.',
      path: '/clusters/lifecycle',
    },
    {
      title: 'Delete Managed Scope',
      subtitle:
        'Destructive delete preview and action for this exact Cluster.',
      path: '/scope/delete',
    },
    {
      title: 'Giving / GCash Settings',
      subtitle: 'Configure the Giving receiver for this Cluster scope.',
      path: '/scope-giving-settings',
    },
  ];

  return (
    <>
      <Stack.Screen options={{ title: 'More Admin Controls' }} />
      <ClusterManageGate scopeId={scopeId}>
        {() => (
          <BuklodPortalScrollView contentContainerStyle={styles.content}>
            {buttons.map((button) => (
              <Pressable
                key={button.title}
                onPress={() => open(button.path)}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.title}>{button.title}</Text>
                <Text style={styles.subtitle}>{button.subtitle}</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </BuklodPortalScrollView>
        )}
      </ClusterManageGate>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    gap: 11,
    backgroundColor: '#F4F7F5',
  },
  card: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    padding: 15,
    gap: 4,
  },
  title: {
    color: '#173B2F',
    fontSize: 13,
    fontWeight: '900',
  },
  subtitle: {
    color: '#6E7E76',
    fontSize: 10,
    lineHeight: 15,
  },
  chevron: {
    alignSelf: 'flex-end',
    color: '#176B4A',
    fontSize: 22,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
