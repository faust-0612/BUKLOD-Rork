import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
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

import BuklodScopedWorkspaceScrollView from '@/components/BuklodScopedWorkspaceScrollView';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import BuklodScopeMemberRow from '@/components/BuklodScopeMemberRow';
import ClusterManageGate from '@/components/ClusterManageGate';
import OrganizationManageGate from '@/components/OrganizationManageGate';
import ScopeManageGate, { useScopeManageParams } from '@/components/ScopeManageGate';
import {
  fetchScopeFunctionalRoles,
  fetchScopeMembers,
  setMemberFunctionalRoles,
  setScopeAdmin,
  type ScopeFunctionalRoleRow,
  type ScopeMemberRow,
} from '@/lib/buklodScopeMembers';
import { isPastorOrMentorRoleName } from '@/lib/buklodChurchFinder';
import { scopeFunctionalRolesRoute } from '@/lib/buklodScopeManage';
import { colors } from '@/lib/theme';

const PAGE_SIZE = 30;

export default function ScopeManageMembersScreen() {
  const params = useLocalSearchParams();
  const { scopeId, scopeType } = useScopeManageParams(
    params as Record<string, unknown>
  );

  const type = scopeType.toUpperCase();

  return (
    <>
      <Stack.Screen options={{ title: 'Members & Roles' }} />
      {type === 'CLUSTER' ? (
        <ClusterManageGate scopeId={scopeId} title="Members & Roles">
          {() => <MembersPanel scopeId={scopeId} scopeType={type} />}
        </ClusterManageGate>
      ) : type === 'CHURCH' ? (
        <ScopeManageGate
          scopeId={scopeId}
          scopeType="CHURCH"
          title="Members & Roles"
        >
          <MembersPanel scopeId={scopeId} scopeType={type} />
        </ScopeManageGate>
      ) : (
        <OrganizationManageGate scopeId={scopeId} title="Members & Roles">
          <MembersPanel scopeId={scopeId} scopeType={type} />
        </OrganizationManageGate>
      )}
    </>
  );
}

function MembersPanel({
  scopeId,
  scopeType,
}: {
  scopeId: string;
  scopeType: string;
}) {
  const [members, setMembers] = useState<ScopeMemberRow[]>([]);
  const [roles, setRoles] = useState<ScopeFunctionalRoleRow[]>([]);
  const [query, setQuery] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [roleTarget, setRoleTarget] = useState<ScopeMemberRow | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  const loadRoles = useCallback(async () => {
    try {
      const rows = await fetchScopeFunctionalRoles(scopeId, false);
      setRoles(rows.filter((row) => row.is_active));
    } catch (error: unknown) {
      console.warn('[members] functional roles load failed:', error);
      setRoles([]);
      Alert.alert(
        'Functional Roles',
        error instanceof Error
          ? error.message
          : 'Could not load functional roles.'
      );
    }
  }, [scopeId]);

  const loadMembers = useCallback(
    async (reset = false, currentCount = 0) => {
      const nextOffset = reset ? 0 : currentCount;

      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const rows = await fetchScopeMembers({
          scopeId,
          status: 'ACTIVE',
          limit: PAGE_SIZE,
          offset: nextOffset,
          query,
        });

        setMembers((current) =>
          reset ? rows : [...current, ...rows]
        );
        setHasMore(rows.length >= PAGE_SIZE);
      } catch (error: unknown) {
        Alert.alert(
          'Members',
          error instanceof Error ? error.message : 'Could not load members.'
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [scopeId, query]
  );

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    void loadMembers(true, 0);
  }, [scopeId, query, loadMembers]);

  const openRoleEditor = (member: ScopeMemberRow) => {
    setRoleTarget(member);
    setSelectedRoleIds(member.functional_roles.map((role) => role.id));
  };

  const saveRoles = async () => {
    if (!roleTarget) return;

    const pastorMentorRoleIds = new Set(
      roles
        .filter((role) => isPastorOrMentorRoleName(role.name))
        .map((role) => role.id)
    );
    const currentlyHas = roleTarget.functional_roles.some((role) =>
      pastorMentorRoleIds.has(role.id)
    );
    const willHave = selectedRoleIds.some((id) => pastorMentorRoleIds.has(id));
    const othersHave = members.some(
      (member) =>
        member.user_id !== roleTarget.user_id &&
        member.functional_roles.some((role) => pastorMentorRoleIds.has(role.id))
    );
    const removingLastChurchLeader =
      scopeType.toUpperCase() === 'CHURCH' &&
      currentlyHas &&
      !willHave &&
      !othersHave;

    const persist = async () => {
      setBusyUserId(roleTarget.user_id);

      try {
        await setMemberFunctionalRoles(
          scopeId,
          roleTarget.user_id,
          selectedRoleIds
        );
        setRoleTarget(null);
        await loadMembers(true, 0);
      } catch (error: unknown) {
        Alert.alert(
          'Assign Roles',
          error instanceof Error ? error.message : 'Could not save roles.'
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
          {
            text: 'Continue',
            style: 'destructive',
            onPress: () => void persist(),
          },
        ]
      );
      return;
    }

    await persist();
  };

  const toggleAdmin = (member: ScopeMemberRow) => {
    const next = !member.is_admin;
    const action = next ? 'grant scoped ADMIN' : 'remove scoped ADMIN';

    Alert.alert(
      next ? 'Add Admin' : 'Remove Admin',
      `${member.full_name}: ${action} for this exact scope only? System Admin, parent scope, and sibling scope authority are never granted implicitly.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: next ? 'Add Admin' : 'Remove Admin',
          style: next ? 'default' : 'destructive',
          onPress: () =>
            void (async () => {
              setBusyUserId(member.user_id);

              try {
                await setScopeAdmin(scopeId, member.user_id, next);
                await loadMembers(true, 0);
              } catch (error: unknown) {
                Alert.alert(
                  'Admin',
                  error instanceof Error
                    ? error.message
                    : 'Admin update failed.'
                );
              } finally {
                setBusyUserId(null);
              }
            })(),
        },
      ]
    );
  };

  const roleOptions = useMemo(
    () => roles.filter((role) => role.is_active),
    [roles]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <>
      <BuklodScopedWorkspaceScrollView contentContainerStyle={styles.content}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search members..."
          placeholderTextColor={colors.muted}
          style={styles.search}
          clearButtonMode="while-editing"
        />

        <Pressable
          onPress={() =>
            router.push(
              scopeFunctionalRolesRoute(scopeId, {
                scopeType,
              }) as any
            )
          }
          style={styles.catalogLink}
        >
          <MaterialCommunityIcons
            name="badge-account-outline"
            size={18}
            color={colors.greenDark}
          />
          <Text style={styles.catalogText}>Manage Functional Role Catalog</Text>
        </Pressable>

        {members.map((member) => (
          <View key={member.user_id} style={styles.memberCard}>
            <BuklodScopeMemberRow member={member} />
            <View style={styles.actions}>
              <Pressable
                disabled={busyUserId === member.user_id}
                onPress={() => openRoleEditor(member)}
                style={styles.actionBtn}
              >
                <Text style={styles.actionText}>ASSIGN ROLES</Text>
              </Pressable>
              <Pressable
                disabled={busyUserId === member.user_id}
                onPress={() => toggleAdmin(member)}
                style={[
                  styles.actionBtn,
                  member.is_admin ? styles.actionDanger : styles.actionAdmin,
                ]}
              >
                <Text
                  style={[
                    styles.actionText,
                    member.is_admin ? styles.actionDangerText : styles.actionAdminText,
                  ]}
                >
                  {member.is_admin ? 'REMOVE ADMIN' : '+ ADD ADMIN'}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}

        {hasMore ? (
          <Pressable
            disabled={loadingMore}
            onPress={() => void loadMembers(false, members.length)}
            style={styles.loadMore}
          >
            <Text style={styles.loadMoreText}>
              {loadingMore ? 'Loading...' : 'LOAD MORE'}
            </Text>
          </Pressable>
        ) : null}
      </BuklodScopedWorkspaceScrollView>

      <Modal visible={Boolean(roleTarget)} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Functional Roles · {roleTarget?.full_name}
            </Text>
            <Text style={styles.modalHint}>
              Functional roles describe responsibility. They do not grant admin
              access.
            </Text>

            <ScrollView style={styles.roleList}>
              {roleOptions.map((role) => {
                const selected = selectedRoleIds.includes(role.id);

                return (
                  <Pressable
                    key={role.id}
                    onPress={() =>
                      setSelectedRoleIds((current) =>
                        selected
                          ? current.filter((id) => id !== role.id)
                          : [...current, role.id]
                      )
                    }
                    style={[styles.roleRow, selected && styles.roleRowOn]}
                  >
                    <Text
                      style={[
                        styles.roleName,
                        selected && styles.roleNameOn,
                      ]}
                    >
                      {role.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setRoleTarget(null)}
                style={styles.modalBtnGhost}
              >
                <Text style={styles.modalBtnGhostText}>CANCEL</Text>
              </Pressable>
              <Pressable onPress={() => void saveRoles()} style={styles.modalBtn}>
                <Text style={styles.modalBtnText}>SAVE</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 10,
    backgroundColor: '#F4F7F5',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F7F5',
  },
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
  catalogLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  catalogText: {
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: '800',
  },
  memberCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    paddingVertical: 8,
    alignItems: 'center',
  },
  actionAdmin: {
    borderColor: '#B7E4C7',
    backgroundColor: '#F0FFF4',
  },
  actionDanger: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  actionText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
    color: '#173B2F',
  },
  actionAdminText: {
    color: '#176B4A',
  },
  actionDangerText: {
    color: '#B42318',
  },
  loadMore: {
    alignSelf: 'center',
    paddingVertical: 10,
  },
  loadMoreText: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: '900',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    maxHeight: '78%',
    gap: 10,
  },
  modalTitle: {
    color: '#173B2F',
    fontSize: 16,
    fontWeight: '900',
  },
  modalHint: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  roleList: {
    maxHeight: 320,
  },
  roleRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  roleRowOn: {
    borderColor: '#176B4A',
    backgroundColor: '#E8F5EE',
  },
  roleName: {
    color: '#173B2F',
    fontSize: 13,
    fontWeight: '700',
  },
  roleNameOn: {
    color: '#176B4A',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: colors.greenDark,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  modalBtnGhost: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalBtnGhostText: {
    color: '#173B2F',
    fontSize: 12,
    fontWeight: '900',
  },
});
