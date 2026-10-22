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
import {
  clusterScopeParams,
  readClusterScopeId,
} from '@/lib/buklodCluster';

export default function ClusterMembersRequestsScreen() {
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

  return (
    <>
      <Stack.Screen options={{ title: 'Members / Join Requests' }} />
      <BuklodPortalScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        <Pressable
          onPress={() => open('/clusters/members')}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <Text style={styles.title}>Members</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable
          onPress={() => open('/clusters/join-requests')}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <Text style={styles.title}>Join Requests</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
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
  card: {
    minHeight: 64,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    color: '#173B2F',
    fontSize: 13,
    fontWeight: '900',
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
