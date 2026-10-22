import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import BuklodScopedWorkspaceScrollView from '@/components/BuklodScopedWorkspaceScrollView';
import BuklodScopeMemberRow from '@/components/BuklodScopeMemberRow';
import { loadMyCommunityContribution } from '@/lib/buklodCommunityContributionEconomy';
import { isPastorOrMentorRoleName } from '@/lib/buklodChurchFinder';
import {
  fetchScopeFunctionalRoles,
  fetchScopeHomeSummary,
  fetchScopeMembers,
  setMemberFunctionalRoles,
  type ScopeFunctionalRoleRow,
  type ScopeMemberRow,
} from '@/lib/buklodScopeMembers';
import { readScopeIdFromParams } from '@/lib/buklodScopeManage';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

const PAGE_SIZE = 30;

type Recognition = {
  id: string;
  title: string;
  recipient_name: string | null;
};

export default function ScopeMembersScreen() {
  const params = useLocalSearchParams();
  const scopeId = readScopeIdFromParams(params as Record<string, unknown>);
  const scopeType = String(params.scopeType ?? '').toUpperCase();
  const scopeName = String(params.scopeName ?? '').trim();
  const { session } = useAuth();
  const viewerId = session?.user?.id ?? null;

  const [members, setMembers] = useState<ScopeMemberRow[]>([]);
  const [roles, setRoles] = useState<ScopeFunctionalRoleRow[]>([]);
  const [ranks, setRanks] = useState<Record<string, string>>({});
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [postCounts, setPostCounts] = useState<Record<string, number>>({});
  const [myShare, setMyShare] = useState<string | null>(null);
  const [canChangeRoles, setCanChangeRoles] = useState(false);
  const [query, setQuery] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [roleTarget, setRoleTarget] = useState<ScopeMemberRow | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  const loadMembers = useCallback(
    async (reset = false, currentCount = 0) => {
      if (!scopeId) {
        setLoading(false);
        return;
      }

      if (reset) setLoading(true);
      else setLoadingMore(true);

      try {
        const rows = await fetchScopeMembers({
          scopeId,
          status: 'ACTIVE',
          limit: PAGE_SIZE,
          offset: reset ? 0 : currentCount,
          query,
        });
        setMembers((current) => (reset ? rows : [...current, ...rows]));
        setHasMore(rows.length >= PAGE_SIZE);
        void loadSignals(reset ? rows : rows);
      } catch (error: unknown) {
        Alert.alert(
          'Members',
          error instanceof Error ? error.message : 'Could not load members.',
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query, scopeId],
  );

  const loadSignals = useCallback(async (rows: ScopeMemberRow[]) => {
    const ids = rows.map((row) => row.user_id).filter(Boolean);
    if (!ids.length) return;

    const [rankResult, recognitionResult, feedResult] = await Promise.all([
      (supabase as any).rpc('get_member_circle_ranks_v1', { p_user_ids: ids }),
      supabase
        .from('buklod_cluster_recognitions')
        .select('id,title,recipient_name')
        .eq('scope_id', scopeId)
        .order('created_at', { ascending: false })
        .limit(40),
      (supabase as any).rpc('buklod_scope_social_feed_v1', {
        p_scope_id: scopeId,
        p_limit: 120,
      }),
    ]);

    if (!rankResult.error && Array.isArray(rankResult.data)) {
      const next: Record<string, string> = {};
      for (const row of rankResult.data as Array<{ user_id?: string; rank_name?: string }>) {
        const userId = String(row.user_id ?? '').trim();
        const rankName = String(row.rank_name ?? '').trim();
        if (userId && rankName) next[userId] = rankName;
      }
      setRanks((current) => ({ ...current, ...next }));
    }

    if (!recognitionResult.error) {
      setRecognitions((recognitionResult.data ?? []) as Recognition[]);
    }

    if (!feedResult.error && Array.isArray(feedResult.data)) {
      const counts: Record<string, number> = {};
      for (const post of feedResult.data as Array<{ user_id?: string }>) {
        const userId = String(post.user_id ?? '').trim();
        if (!userId) continue;
        counts[userId] = (counts[userId] ?? 0) + 1;
      }
      setPostCounts(counts);
    }
  }, [scopeId]);

  useEffect(() => {
    if (!scopeId) return;
    void fetchScopeHomeSummary(scopeId)
      .then((summary) => setCanChangeRoles(summary.my_is_admin))
      .catch(() => setCanChangeRoles(false));
    void fetchScopeFunctionalRoles(scopeId, false)
      .then((rows) => setRoles(rows.filter((row) => row.is_active)))
      .catch(() => setRoles([]));
  }, [scopeId]);

  useEffect(() => {
    void loadMembers(true, 0);
  }, [loadMembers]);

  useEffect(() => {
    if (!viewerId) return;
    void loadMyCommunityContribution()
      .then((data) => {
        const weight = Number(data.share_weight ?? 0) * 100;
        setMyShare(
          `${data.contribution_level} · ${weight.toFixed(weight < 0.01 ? 4 : 2)}% share this month`,
        );
      })
      .catch(() => setMyShare(null));
  }, [viewerId]);

  const openRoleEditor = (member: ScopeMemberRow) => {
    setRoleTarget(member);
    setSelectedRoleIds(member.functional_roles.map((role) => role.id));
  };

  const saveRoles = async () => {
    if (!roleTarget || !canChangeRoles) return;

    const pastorMentorRoleIds = new Set(
      roles.filter((role) => isPastorOrMentorRoleName(role.name)).map((role) => role.id),
    );
    const currentlyHas = roleTarget.functional_roles.some((role) => pastorMentorRoleIds.has(role.id));
    const willHave = selectedRoleIds.some((id) => pastorMentorRoleIds.has(id));
    const othersHave = members.some(
      (member) =>
        member.user_id !== roleTarget.user_id &&
        member.functional_roles.some((role) => pastorMentorRoleIds.has(role.id)),
    );
    const removingLastChurchLeader =
      scopeType === 'CHURCH' && currentlyHas && !willHave && !othersHave;

    const persist = async () => {
      setBusyUserId(roleTarget.user_id);
      try {
        await setMemberFunctionalRoles(scopeId, roleTarget.user_id, selectedRoleIds);
        setRoleTarget(null);
        await loadMembers(true, 0);
      } catch (error: unknown) {
        Alert.alert(
          'Change role',
          error instanceof Error ? error.message : 'Could not save this role.',
        );
      } finally {
        setBusyUserId(null);
      }
    };

    if (removingLastChurchLeader) {
      Alert.alert(
        'Accountability',
        'This church will no longer be accountability-ready.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', style: 'destructive', onPress: () => void persist() },
        ],
      );
      return;
    }

    await persist();
  };

  const roleOptions = useMemo(
    () => roles.filter((role) => role.is_active),
    [roles],
  );

  const recognitionFor = (name: string) =>
    recognitions
      .filter((row) => String(row.recipient_name ?? '').trim().toLowerCase() === name.trim().toLowerCase())
      .map((row) => row.title)
      .filter(Boolean);

  if (!scopeId) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Open Members from a cluster or organization home.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: scopeName ? `Members · ${scopeName}` : 'Members' }} />
      {loading && !members.length ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : (
        <BuklodScopedWorkspaceScrollView contentContainerStyle={styles.content}>
          <Text style={styles.intro}>
            This is the member list. It is not Connect. A leader of this place can change each member's role. Circle Rank and recognitions are the achievements. Recent posts show contribution here. Your own share appears only on your row.
          </Text>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search members"
            placeholderTextColor={colors.muted}
            style={styles.search}
            clearButtonMode="while-editing"
          />

          {members.map((member) => {
            const awards = recognitionFor(member.full_name);
            const rank = ranks[member.user_id];
            const posts = postCounts[member.user_id] ?? 0;
            const mine = viewerId === member.user_id;
            return (
              <View key={member.user_id} style={styles.card}>
                <BuklodScopeMemberRow member={member} />
                <Text style={styles.detail}>
                  Achievement: {rank || 'Circle Rank not loaded'}
                  {awards.length ? ` · ${awards.join(', ')}` : ''}
                </Text>
                <Text style={styles.detail}>
                  Contribution: {posts} recent {posts === 1 ? 'post' : 'posts'} here
                  {mine && myShare ? ` · ${myShare}` : ''}
                </Text>
                {canChangeRoles ? (
                  <Pressable
                    disabled={busyUserId === member.user_id}
                    onPress={() => openRoleEditor(member)}
                    style={styles.roleButton}
                  >
                    <Text style={styles.roleButtonText}>
                      {busyUserId === member.user_id ? 'Saving...' : 'Change role'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}

          {!members.length ? (
            <Text style={styles.empty}>No members matched that search.</Text>
          ) : null}

          {hasMore ? (
            <Pressable
              disabled={loadingMore}
              onPress={() => void loadMembers(false, members.length)}
              style={styles.more}
            >
              <Text style={styles.moreText}>{loadingMore ? 'Loading...' : 'Load more'}</Text>
            </Pressable>
          ) : null}
        </BuklodScopedWorkspaceScrollView>
      )}

      <Modal visible={Boolean(roleTarget)} transparent animationType="slide" onRequestClose={() => setRoleTarget(null)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Roles for {roleTarget?.full_name}</Text>
            <Text style={styles.sheetHint}>
              Choose what this member does here. Saving does not make them an admin, and it does not change Circle Points.
            </Text>
            <ScrollView style={styles.roleList}>
              {roleOptions.map((role) => {
                const selected = selectedRoleIds.includes(role.id);
                return (
                  <Pressable
                    key={role.id}
                    onPress={() =>
                      setSelectedRoleIds((current) =>
                        selected ? current.filter((id) => id !== role.id) : [...current, role.id],
                      )
                    }
                    style={[styles.roleRow, selected && styles.roleRowOn]}
                  >
                    <Text style={[styles.roleName, selected && styles.roleNameOn]}>{role.name}</Text>
                  </Pressable>
                );
              })}
              {!roleOptions.length ? (
                <Text style={styles.empty}>No roles are set up here yet.</Text>
              ) : null}
            </ScrollView>
            <View style={styles.sheetActions}>
              <Pressable onPress={() => setRoleTarget(null)} style={styles.cancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={() => void saveRoles()} style={styles.save}>
                <Text style={styles.saveText}>Save role</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, backgroundColor: '#F4F7F5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F7F5', padding: 24 },
  intro: { color: '#4B5D54', fontSize: 12, lineHeight: 18 },
  search: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#173B2F',
    fontSize: 14,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  detail: { marginTop: 4, color: '#4B5D54', fontSize: 12, lineHeight: 17 },
  roleButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#E7F8EE',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roleButtonText: { color: '#176B4A', fontSize: 12, fontWeight: '800' },
  empty: { color: '#6E7E76', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  more: { alignSelf: 'center', paddingVertical: 10 },
  moreText: { color: colors.greenDark, fontSize: 12, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    maxHeight: '78%',
    gap: 10,
  },
  sheetTitle: { color: '#173B2F', fontSize: 16, fontWeight: '900' },
  sheetHint: { color: '#6E7E76', fontSize: 12, lineHeight: 17 },
  roleList: { maxHeight: 320 },
  roleRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  roleRowOn: { borderColor: '#176B4A', backgroundColor: '#E7F8EE' },
  roleName: { color: '#173B2F', fontSize: 14, fontWeight: '700' },
  roleNameOn: { color: '#176B4A' },
  sheetActions: { flexDirection: 'row', gap: 8 },
  cancel: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: '#6E7E76', fontWeight: '800' },
  save: { flex: 1, alignItems: 'center', borderRadius: 12, backgroundColor: '#176B4A', paddingVertical: 12 },
  saveText: { color: '#FFFFFF', fontWeight: '800' },
});
