import React, { useCallback, useEffect, useState } from 'react';
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

import BuklodScopedWorkspaceScrollView from '@/components/BuklodScopedWorkspaceScrollView';
import { Stack, useLocalSearchParams } from 'expo-router';

import { useScopeManageParams } from '@/components/ScopeManageGate';
import ClusterManageGate from '@/components/ClusterManageGate';
import OrganizationManageGate from '@/components/OrganizationManageGate';
import ScopeManageGate from '@/components/ScopeManageGate';
import {
  archiveScopeFunctionalRole,
  fetchScopeFunctionalRoles,
  upsertScopeFunctionalRole,
  type ScopeFunctionalRoleRow,
} from '@/lib/buklodScopeMembers';
import {
  FUNCTIONAL_ROLE_TEMPLATES,
  inferScopeRoleTemplateGroup,
} from '@/lib/buklodScopeRoleTemplates';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function ScopeFunctionalRolesScreen() {
  const params = useLocalSearchParams();
  const { scopeId, scopeType } = useScopeManageParams(
    params as Record<string, unknown>
  );

  const type = scopeType.toUpperCase();

  return (
    <>
      <Stack.Screen options={{ title: 'Functional Roles' }} />
      {type === 'CLUSTER' ? (
        <ClusterManageGate scopeId={scopeId} title="Functional Roles">
          {() => <RolesPanel scopeId={scopeId} />}
        </ClusterManageGate>
      ) : type === 'CHURCH' ? (
        <ScopeManageGate
          scopeId={scopeId}
          scopeType="CHURCH"
          title="Functional Roles"
        >
          <RolesPanel scopeId={scopeId} />
        </ScopeManageGate>
      ) : (
        <OrganizationManageGate scopeId={scopeId} title="Functional Roles">
          <RolesPanel scopeId={scopeId} />
        </OrganizationManageGate>
      )}
    </>
  );
}

function RolesPanel({ scopeId }: { scopeId: string }) {
  const [roles, setRoles] = useState<ScopeFunctionalRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [{ data: scopeRow }, nextRoles] = await Promise.all([
        (supabase as any)
          .from('buklod_scopes')
          .select('scope_type, geo_level, metadata')
          .eq('id', scopeId)
          .maybeSingle(),
        fetchScopeFunctionalRoles(scopeId, true),
      ]);

      setRoles(nextRoles);

      const group = inferScopeRoleTemplateGroup({
        scope_type: scopeRow?.scope_type,
        geo_level: scopeRow?.geo_level,
        metadata: scopeRow?.metadata ?? null,
      });

      setTemplates(FUNCTIONAL_ROLE_TEMPLATES[group]);
    } catch (error: unknown) {
      Alert.alert(
        'Functional Roles',
        error instanceof Error ? error.message : 'Could not load roles.'
      );
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setSortOrder('0');
  };

  const startEdit = (role: ScopeFunctionalRoleRow) => {
    setEditingId(role.id);
    setName(role.name);
    setDescription(role.description ?? '');
    setSortOrder(String(role.sort_order ?? 0));
  };

  const save = async () => {
    const cleanName = name.trim();

    if (!cleanName) {
      Alert.alert('Functional Roles', 'Role name is required.');
      return;
    }

    setBusy(true);

    try {
      await upsertScopeFunctionalRole({
        scopeId,
        roleId: editingId,
        name: cleanName,
        description,
        sortOrder: Number(sortOrder) || 0,
      });

      resetForm();
      await load();
    } catch (error: unknown) {
      Alert.alert(
        'Functional Roles',
        error instanceof Error ? error.message : 'Could not save role.'
      );
    } finally {
      setBusy(false);
    }
  };

  const archive = (role: ScopeFunctionalRoleRow) => {
    Alert.alert(
      role.is_active ? 'Archive Role' : 'Restore Role',
      role.is_active
        ? `Archive "${role.name}"? Members keep historical assignments, but the role will be hidden from new assignments.`
        : `Restore "${role.name}" for new assignments?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: role.is_active ? 'Archive' : 'Restore',
          onPress: () =>
            void (async () => {
              setBusy(true);

              try {
                await archiveScopeFunctionalRole(
                  scopeId,
                  role.id,
                  role.is_active
                );
                await load();
              } catch (error: unknown) {
                Alert.alert(
                  'Functional Roles',
                  error instanceof Error ? error.message : 'Update failed.'
                );
              } finally {
                setBusy(false);
              }
            })(),
        },
      ]
    );
  };

  const addTemplate = (label: string) => {
    setEditingId(null);
    setName(label);
    setDescription('');
    setSortOrder(String(roles.length));
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <BuklodScopedWorkspaceScrollView contentContainerStyle={styles.content}>
      <Text style={styles.section}>SUGGESTED ROLES</Text>
      <View style={styles.templateRow}>
        {templates.map((label) => (
          <Pressable
            key={label}
            onPress={() => addTemplate(label)}
            style={styles.templateChip}
          >
            <Text style={styles.templateText}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>
        {editingId ? 'EDIT ROLE' : 'ADD ROLE'}
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Role name"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Description (optional)"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
      <TextInput
        value={sortOrder}
        onChangeText={setSortOrder}
        placeholder="Sort order"
        placeholderTextColor={colors.muted}
        keyboardType="number-pad"
        style={styles.input}
      />

      <View style={styles.formActions}>
        {editingId ? (
          <Pressable onPress={resetForm} style={styles.ghostBtn}>
            <Text style={styles.ghostBtnText}>CANCEL EDIT</Text>
          </Pressable>
        ) : null}
        <Pressable
          disabled={busy}
          onPress={() => void save()}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>
            {editingId ? 'SAVE CHANGES' : 'ADD ROLE'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.section}>ROLE CATALOG</Text>
      {roles.map((role) => (
        <View key={role.id} style={styles.roleCard}>
          <View style={styles.roleHead}>
            <Text style={styles.roleName}>{role.name}</Text>
            <Text
              style={[
                styles.roleStatus,
                !role.is_active && styles.roleArchived,
              ]}
            >
              {role.is_active ? 'ACTIVE' : 'ARCHIVED'}
            </Text>
          </View>
          {role.description ? (
            <Text style={styles.roleDesc}>{role.description}</Text>
          ) : null}
          <Text style={styles.roleMeta}>
            Assigned to {role.member_count} member(s)
          </Text>
          <View style={styles.roleActions}>
            <Pressable onPress={() => startEdit(role)} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>EDIT</Text>
            </Pressable>
            <Pressable onPress={() => archive(role)} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>
                {role.is_active ? 'ARCHIVE' : 'RESTORE'}
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
    </BuklodScopedWorkspaceScrollView>
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
  section: {
    color: '#173B2F',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  templateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  templateChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  templateText: {
    color: '#176B4A',
    fontSize: 11,
    fontWeight: '700',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#173B2F',
    fontSize: 14,
  },
  formActions: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: colors.greenDark,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  ghostBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ghostBtnText: {
    color: '#173B2F',
    fontSize: 11,
    fontWeight: '900',
  },
  roleCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 6,
  },
  roleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  roleName: {
    flex: 1,
    color: '#173B2F',
    fontSize: 14,
    fontWeight: '800',
  },
  roleStatus: {
    color: '#176B4A',
    fontSize: 9,
    fontWeight: '900',
  },
  roleArchived: {
    color: '#B45309',
  },
  roleDesc: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  roleMeta: {
    color: colors.muted,
    fontSize: 10,
  },
  roleActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  smallBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallBtnText: {
    color: '#173B2F',
    fontSize: 10,
    fontWeight: '900',
  },
});
