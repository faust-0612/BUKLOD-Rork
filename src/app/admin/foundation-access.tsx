import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AdminGate } from '@/components/AdminGate';
import { supabase } from '@/lib/supabase';

type RoleRow = {
  role_key: string;
  label: string;
  description: string | null;
  scope_required: boolean;
  admin_role: boolean;
};

type UserRow = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  mobile: string | null;
  is_active: boolean;
  is_verified: boolean;
};

type AssignmentRow = {
  assignment_id: string;
  role_key: string;
  role_label: string;
  scope_type: string;
  scope_id: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'REVOKED';
  valid_from: string;
  valid_until: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

const DEFAULT_SCOPE: Record<string, string> = {
  FACULTY: 'EDUCATION',
  SCHOOL_ADMIN: 'SCHOOL',
  ATTENDANCE_ADMIN: 'ATTENDANCE',
  GIVING_ADMIN: 'GIVING',
  BUSINESS_ADMIN: 'BUSINESS',
  BARANGAY_ADMIN: 'BARANGAY',
  ORGANIZATION_ADMIN: 'ORGANIZATION',
};

const ADMIN_ROLES = new Set([
  'SCHOOL_ADMIN',
  'ATTENDANCE_ADMIN',
  'GIVING_ADMIN',
  'BUSINESS_ADMIN',
  'BARANGAY_ADMIN',
  'ORGANIZATION_ADMIN',
]);

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function shortId(value: string | null) {
  if (!value) return 'Domain-wide';
  return value.length > 14
    ? `${value.slice(0, 8)}â€¦${value.slice(-4)}`
    : value;
}

function formatDate(value: string | null) {
  if (!value) return 'â€”';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
}

export default function FoundationAccessAdmin() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedUser, setSelectedUser] =
    useState<UserRow | null>(null);
  const [assignments, setAssignments] =
    useState<AssignmentRow[]>([]);

  const [selectedRole, setSelectedRole] =
    useState<string>('FACULTY');
  const [scopeId, setScopeId] = useState('');
  const [reason, setReason] = useState('');

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const selectedRoleRow = useMemo(
    () => roles.find((row) => row.role_key === selectedRole) ?? null,
    [roles, selectedRole]
  );

  const scopeType =
    DEFAULT_SCOPE[selectedRole] ?? 'GLOBAL';

  const loadRoles = useCallback(async () => {
    const { data, error } = await supabase
      .from('buklod_foundation_roles')
      .select(
        'role_key,label,description,scope_required,admin_role'
      )
      .eq('is_active', true)
      .neq('role_key', 'SYSTEM_ADMIN')
      .order('label');

    if (error) throw error;

    const next = (data ?? []) as RoleRow[];
    setRoles(next);

    if (
      next.length &&
      !next.some((row) => row.role_key === selectedRole)
    ) {
      setSelectedRole(next[0].role_key);
    }
  }, [selectedRole]);

  // FOUNDATION_003_R2_ROLE_CATALOG_ON_OPEN
  useEffect(() => {
    void loadRoles().catch((error: any) => {
      console.warn(
        'Foundation role catalog load failed:',
        String(error?.message ?? error)
      );
    });
  }, [loadRoles]);

  const loadAssignments = useCallback(
    async (userId: string) => {
      const { data, error } = await (supabase as any).rpc(
        'buklod_admin_foundation_assignments_v1',
        { p_user_id: userId }
      );

      if (error) throw error;

      setAssignments(
        (Array.isArray(data) ? data : []) as AssignmentRow[]
      );
    },
    []
  );

  const search = useCallback(async () => {
    const q = clean(query);

    if (!q) {
      Alert.alert(
        'Search user',
        'Enter a name, username, or mobile number.'
      );
      return;
    }

    setLoading(true);

    try {
      await loadRoles();

      const { data, error } = await (supabase as any).rpc(
        'buklod_admin_foundation_search_users_v1',
        { p_query: q }
      );

      if (error) throw error;

      setUsers((Array.isArray(data) ? data : []) as UserRow[]);
    } catch (error: any) {
      Alert.alert(
        'Access & Roles',
        clean(error?.message) || 'Could not search BUKLOD accounts.'
      );
    } finally {
      setLoading(false);
    }
  }, [query, loadRoles]);

  const chooseUser = useCallback(
    async (user: UserRow) => {
      setSelectedUser(user);
      setReason('');
      setScopeId('');
      setBusy(true);

      try {
        await Promise.all([
          loadRoles(),
          loadAssignments(user.user_id),
        ]);
      } catch (error: any) {
        Alert.alert(
          'Access & Roles',
          clean(error?.message) || 'Could not load role assignments.'
        );
      } finally {
        setBusy(false);
      }
    },
    [loadRoles, loadAssignments]
  );

  const grant = useCallback(async () => {
    if (!selectedUser) return;

    const reasonText = clean(reason);
    const scopeText = clean(scopeId);

    if (!selectedRoleRow) {
      Alert.alert('Role', 'Select a Foundation role.');
      return;
    }

    if (selectedRole === 'SYSTEM_ADMIN') {
      Alert.alert(
        'Protected role',
        'SYSTEM_ADMIN cannot be assigned from this screen.'
      );
      return;
    }

    if (ADMIN_ROLES.has(selectedRole) && !scopeText) {
      Alert.alert(
        'Exact scope required',
        'This scoped administrator role requires the exact scope UUID.'
      );
      return;
    }

    if (!reasonText) {
      Alert.alert(
        'Reason required',
        'Enter a short reason for this access change.'
      );
      return;
    }

    setBusy(true);

    try {
      const { error } = await (supabase as any).rpc(
        'buklod_admin_set_foundation_role_v1',
        {
          p_user_id: selectedUser.user_id,
          p_role_key: selectedRole,
          p_scope_type: scopeType,
          p_scope_id: scopeText || null,
          p_active: true,
          p_reason: reasonText,
        }
      );

      if (error) throw error;

      await loadAssignments(selectedUser.user_id);
      setReason('');
      setScopeId('');

      Alert.alert(
        'Access granted',
        `${selectedRoleRow.label} was assigned successfully.`
      );
    } catch (error: any) {
      Alert.alert(
        'Could not grant access',
        clean(error?.message) || 'Foundation role assignment failed.'
      );
    } finally {
      setBusy(false);
    }
  }, [
    selectedUser,
    selectedRole,
    selectedRoleRow,
    scopeType,
    scopeId,
    reason,
    loadAssignments,
  ]);

  const revoke = useCallback(
    (assignment: AssignmentRow) => {
      if (!selectedUser) return;

      const reasonText = clean(reason);

      if (!reasonText) {
        Alert.alert(
          'Reason required',
          'Enter a reason above before revoking access.'
        );
        return;
      }

      Alert.alert(
        'Revoke access?',
        `Revoke ${assignment.role_label} at ${assignment.scope_type} / ${shortId(
          assignment.scope_id
        )}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'REVOKE',
            style: 'destructive',
            onPress: async () => {
              setBusy(true);

              try {
                const { error } = await (supabase as any).rpc(
                  'buklod_admin_set_foundation_role_v1',
                  {
                    p_user_id: selectedUser.user_id,
                    p_role_key: assignment.role_key,
                    p_scope_type: assignment.scope_type,
                    p_scope_id: assignment.scope_id,
                    p_active: false,
                    p_reason: reasonText,
                  }
                );

                if (error) throw error;

                await loadAssignments(selectedUser.user_id);
                setReason('');

                Alert.alert(
                  'Access revoked',
                  `${assignment.role_label} was revoked.`
                );
              } catch (error: any) {
                Alert.alert(
                  'Could not revoke access',
                  clean(error?.message) ||
                    'Foundation role revocation failed.'
                );
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      );
    },
    [selectedUser, reason, loadAssignments]
  );

  return (
    <AdminGate>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.back}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={20}
            color="#275D45"
          />
          <Text style={styles.backText}>SYSTEM ADMINISTRATION</Text>
        </Pressable>

        <View style={styles.hero}>
          <MaterialCommunityIcons
            name="shield-account-outline"
            size={30}
            color="#275D45"
          />

          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>
              FOUNDATION ACCESS CONTROL
            </Text>
            <Text style={styles.title}>Access & Roles</Text>
            <Text style={styles.subtitle}>
              Assign or revoke canonical BUKLOD roles. Scoped
              administrators are limited to their exact assigned scope.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>FIND ACCOUNT</Text>

        <View style={styles.card}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Name, username, or mobile"
            autoCapitalize="none"
            style={styles.input}
            returnKeyType="search"
            onSubmitEditing={() => void search()}
          />

          <Pressable
            onPress={() => void search()}
            disabled={loading || busy}
            style={styles.primaryButton}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                SEARCH BUKLOD
              </Text>
            )}
          </Pressable>

          {!!users.length && (
            <View style={styles.results}>
              {users.map((user) => (
                <Pressable
                  key={user.user_id}
                  onPress={() => void chooseUser(user)}
                  style={styles.userRow}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>
                      {user.full_name || 'BUKLOD Member'}
                    </Text>
                    <Text style={styles.meta}>
                      {user.username
                        ? `@${user.username}`
                        : user.mobile || shortId(user.user_id)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      !user.is_active && styles.statusPillDanger,
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {user.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {!!selectedUser && (
          <>
            <Text style={styles.sectionTitle}>SELECTED ACCOUNT</Text>

            <View style={styles.card}>
              <Text style={styles.selectedName}>
                {selectedUser.full_name || 'BUKLOD Member'}
              </Text>
              <Text style={styles.meta}>
                {selectedUser.username
                  ? `@${selectedUser.username}`
                  : shortId(selectedUser.user_id)}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>ASSIGN ROLE</Text>

            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Foundation role</Text>

              <View style={styles.roleWrap}>
                {roles.map((role) => {
                  const active = role.role_key === selectedRole;

                  return (
                    <Pressable
                      key={role.role_key}
                      onPress={() => {
                        setSelectedRole(role.role_key);
                        setScopeId('');
                      }}
                      style={[
                        styles.roleChip,
                        active && styles.roleChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleChipText,
                          active && styles.roleChipTextActive,
                        ]}
                      >
                        {role.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Scope type</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>{scopeType}</Text>
              </View>

              <Text style={styles.fieldLabel}>
                Scope UUID
                {ADMIN_ROLES.has(selectedRole)
                  ? ' (required)'
                  : ' (optional)'}
              </Text>

              <TextInput
                value={scopeId}
                onChangeText={setScopeId}
                placeholder={
                  ADMIN_ROLES.has(selectedRole)
                    ? 'Exact scope UUID'
                    : 'Leave blank for Education domain'
                }
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>
                Reason for access change
              </Text>

              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="Required for grant or revoke"
                multiline
                style={[styles.input, styles.reasonInput]}
              />

              <Pressable
                onPress={() => void grant()}
                disabled={busy || !selectedUser.is_active}
                style={[
                  styles.primaryButton,
                  (busy || !selectedUser.is_active) &&
                    styles.disabled,
                ]}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    GRANT ACCESS
                  </Text>
                )}
              </Pressable>

              <Text style={styles.helper}>
                SYSTEM_ADMIN is protected and is not available here.
                All changes are written to the Foundation audit log.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>ROLE ASSIGNMENTS</Text>

            <View style={styles.card}>
              {!assignments.length ? (
                <Text style={styles.empty}>
                  No Foundation role assignments yet.
                </Text>
              ) : (
                assignments.map((item) => (
                  <View
                    key={item.assignment_id}
                    style={styles.assignment}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assignmentTitle}>
                        {item.role_label}
                      </Text>

                      <Text style={styles.meta}>
                        {item.scope_type} / {shortId(item.scope_id)}
                      </Text>

                      <Text style={styles.meta}>
                        {item.status} Â· updated {formatDate(item.updated_at)}
                      </Text>

                      {!!item.reason && (
                        <Text style={styles.reasonText}>
                          Reason: {item.reason}
                        </Text>
                      )}
                    </View>

                    {item.status === 'ACTIVE' && (
                      <Pressable
                        onPress={() => revoke(item)}
                        disabled={busy}
                        style={styles.revokeButton}
                      >
                        <Text style={styles.revokeText}>REVOKE</Text>
                      </Pressable>
                    )}
                  </View>
                ))
              )}
            </View>
          </>
        )}

        <View style={{ height: 70 }} />
      </ScrollView>
    </AdminGate>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7F5',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 40,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 14,
  },
  backText: {
    color: '#275D45',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  hero: {
    flexDirection: 'row',
    gap: 14,
    padding: 18,
    backgroundColor: '#E8F1EC',
    borderRadius: 18,
    marginBottom: 20,
  },
  eyebrow: {
    color: '#5B7568',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  title: {
    color: '#183A2A',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 3,
  },
  subtitle: {
    color: '#5E6D65',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  sectionTitle: {
    color: '#53675D',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E1E8E4',
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#D7E0DB',
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#1F3128',
    backgroundColor: '#FAFCFB',
    marginBottom: 10,
  },
  reasonInput: {
    minHeight: 82,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#275D45',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  disabled: {
    opacity: 0.45,
  },
  results: {
    marginTop: 10,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: '#EEF2EF',
  },
  userName: {
    color: '#21382D',
    fontSize: 14,
    fontWeight: '800',
  },
  selectedName: {
    color: '#183A2A',
    fontSize: 17,
    fontWeight: '900',
  },
  meta: {
    color: '#75827B',
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 2,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#E5F2EA',
  },
  statusPillDanger: {
    backgroundColor: '#F9E6E6',
  },
  statusText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: '#3D574A',
  },
  fieldLabel: {
    color: '#40544A',
    fontSize: 10.5,
    fontWeight: '800',
    marginBottom: 6,
    marginTop: 5,
  },
  readOnlyField: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#EEF3F0',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  readOnlyText: {
    color: '#365544',
    fontWeight: '900',
    fontSize: 12,
  },
  roleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 10,
  },
  roleChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD8D1',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  roleChipActive: {
    backgroundColor: '#275D45',
    borderColor: '#275D45',
  },
  roleChipText: {
    color: '#496156',
    fontSize: 9.5,
    fontWeight: '800',
  },
  roleChipTextActive: {
    color: '#FFFFFF',
  },
  helper: {
    color: '#7A8780',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 10,
  },
  empty: {
    color: '#7A8780',
    fontSize: 11,
  },
  assignment: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1EF',
  },
  assignmentTitle: {
    color: '#233C30',
    fontSize: 13,
    fontWeight: '900',
  },
  reasonText: {
    color: '#65756D',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },
  revokeButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C45454',
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  revokeText: {
    color: '#A93B3B',
    fontSize: 8.5,
    fontWeight: '900',
  },
});