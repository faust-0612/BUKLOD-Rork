import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import {
  Stack,
  useLocalSearchParams,
} from 'expo-router';
import ClusterManageGate from '@/components/ClusterManageGate';
import {
  inviteClusterMember,
  searchClusterInviteCandidates,
  type ClusterPerson,
} from '@/lib/buklodClusters';
import { readClusterScopeId } from '@/lib/buklodCluster';

export default function ClusterInvitationsScreen() {
  const params = useLocalSearchParams();
  const scopeId = readClusterScopeId(
    params as Record<string, unknown>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Invitations' }} />
      <ClusterManageGate scopeId={scopeId}>
        {() => <InvitePanel scopeId={scopeId} />}
      </ClusterManageGate>
    </>
  );
}

function InvitePanel({ scopeId }: { scopeId: string }) {
  const [inviteSearch, setInviteSearch] = useState('');
  const [candidates, setCandidates] = useState<ClusterPerson[]>([]);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    try {
      const rows = await searchClusterInviteCandidates(
        scopeId,
        inviteSearch
      );
      setCandidates(rows);
    } catch (error: any) {
      Alert.alert('Invite members', error?.message || 'Search failed.');
    }
  };

  const invite = async (userId: string) => {
    setBusy(true);
    try {
      await inviteClusterMember(scopeId, userId);
      setCandidates((current) =>
        current.filter((item) => item.user_id !== userId)
      );
      Alert.alert('Invitations', 'Invitation sent.');
    } catch (error: any) {
      Alert.alert('Invitations', error?.message || 'Invite failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BuklodPortalScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.help}>
        Search BUKLOD members to invite. Accepting an invite remains on the
        member-facing Join Cluster flow.
      </Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search member name..."
          value={inviteSearch}
          onChangeText={setInviteSearch}
          returnKeyType="search"
          onSubmitEditing={() => void search()}
        />
        <Pressable onPress={() => void search()} style={styles.searchBtn}>
          <Text style={styles.searchBtnText}>SEARCH</Text>
        </Pressable>
      </View>

      {candidates.map((candidate) => (
        <View key={candidate.user_id} style={styles.row}>
          <Text style={styles.name}>{candidate.full_name}</Text>
          <Pressable
            disabled={busy}
            onPress={() => void invite(candidate.user_id)}
            style={styles.inviteBtn}
          >
            <Text style={styles.inviteText}>INVITE</Text>
          </Pressable>
        </View>
      ))}
    </BuklodPortalScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    gap: 10,
    backgroundColor: '#F4F7F5',
  },
  help: {
    color: '#6E7E76',
    fontSize: 11,
    lineHeight: 16,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D8E1DC',
    borderRadius: 11,
    paddingHorizontal: 11,
    backgroundColor: '#FFFFFF',
    color: '#1C362B',
  },
  searchBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 11,
    backgroundColor: '#2D6A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  row: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 14,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    color: '#243C31',
    fontWeight: '900',
  },
  inviteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#2D6A4F',
  },
  inviteText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
});
