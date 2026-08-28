import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
  useRouter,
} from 'expo-router';
import { supabase } from '../../lib/supabase';
import { organizationScopeParams } from '@/lib/buklodOrganization';
import {
  createSuborganization,
  listSuborganizations,
  readParentOrganizationType,
  roleTemplateGroupLabel,
  suggestedFunctionalRolesForParent,
  type SuborganizationRow,
} from '@/lib/buklodSuborganization';
import {
  inferScopeRoleTemplateGroup,
} from '@/lib/buklodScopeRoleTemplates';
import { useBuklodScope } from '@/providers/BuklodScopeProvider';
import {
  enterScopedWorkspace,
} from '@/lib/buklodScopeRoute';

type ScopeRow = {
  id: string;
  name?: string | null;
  parent_scope_id?: string | null;
  scope_type?: string | null;
  visibility?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  description?: string | null;
};

const LIST_LIMIT = 50;

function firstString(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0].trim();
  }

  return '';
}

function upper(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

function Choice({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
}) {
  return (
    <View style={styles.choices}>
      {options.map((option) => {
        const selected = value === option;

        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.choice, selected && styles.choiceSelected]}
          >
            <Text
              style={[
                styles.choiceText,
                selected && styles.choiceTextSelected,
              ]}
            >
              {option.replaceAll('_', ' ')}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SuborganizationsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { selectScope } = useBuklodScope();

  const mode = firstString(params.mode) || 'units';

  const parentScopeId =
    firstString(params.parentScopeId) ||
    firstString(params.parent_scope_id) ||
    firstString(params.organization) ||
    firstString(params.organizationId) ||
    firstString(params.organization_id) ||
    firstString(params.id);

  const routeParentName = firstString(params.parentName);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [parent, setParent] = useState<ScopeRow | null>(null);
  const [children, setChildren] = useState<SuborganizationRow[]>([]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [joinPolicy, setJoinPolicy] = useState('APPROVAL_REQUIRED');
  const [organizationType, setOrganizationType] = useState('');

  const parentMetadata = parent?.metadata ?? null;
  const inheritedType = readParentOrganizationType(parentMetadata);
  const templateGroup = inferScopeRoleTemplateGroup({
    scope_type: 'ORGANIZATION',
    metadata: {
      ...parentMetadata,
      organization_type: organizationType.trim() || inheritedType,
    },
  });
  const suggestedRoles = useMemo(
    () => suggestedFunctionalRolesForParent(parentMetadata),
    [parentMetadata]
  );

  const load = useCallback(async () => {
    if (!parentScopeId) {
      setLoading(false);
      Alert.alert(
        'Units & Structure',
        'No parent Organization was selected. Open this from the parent Organization Manage area.'
      );
      return;
    }

    setLoading(true);

    try {
      const [parentResult, manageableResult] = await Promise.all([
        (supabase as any)
          .from('buklod_scopes')
          .select('*')
          .eq('id', parentScopeId)
          .maybeSingle(),
        (supabase as any).rpc('buklod_my_manageable_organizations_v2'),
      ]);

      if (parentResult.error) {
        throw parentResult.error;
      }

      if (!parentResult.data) {
        throw new Error('Parent Organization was not found.');
      }

      const parentRow = parentResult.data as ScopeRow;

      if (parentRow.parent_scope_id) {
        throw new Error(
          'Units & Structure is only available on a root Organization.'
        );
      }

      const canManage =
        !manageableResult.error &&
        (manageableResult.data || []).some(
          (row: { scope_id?: string; id?: string }) =>
            String(row.scope_id || row.id || '').trim() === parentScopeId
        );

      setAllowed(canManage);
      setParent(parentRow);
      setOrganizationType(readParentOrganizationType(parentRow.metadata));
      setVisibility(upper(parentRow.visibility || 'PUBLIC'));

      const rows = await listSuborganizations(parentScopeId, LIST_LIMIT, 0);
      setChildren(rows);
    } catch (error: unknown) {
      Alert.alert(
        'Units & Structure',
        error instanceof Error
          ? error.message
          : 'Could not load Sub-organization information.'
      );
    } finally {
      setLoading(false);
    }
  }, [parentScopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openChildWorkspace = async (childScopeId: string) => {
    try {
      await enterScopedWorkspace(
        selectScope,
        childScopeId,
        { fromPortal: true }
      );
    } catch (error: unknown) {
      Alert.alert(
        'Open Sub-organization',
        error instanceof Error
          ? error.message
          : 'Could not open this workspace.'
      );
    }
  };

  const handleCreate = async () => {
    if (!parentScopeId || !parent) return;

    if (!allowed) {
      Alert.alert(
        'Admin access required',
        'Only an authorized admin of the parent Organization can create a Sub-organization.'
      );
      return;
    }

    const cleanName = name.trim();

    if (!cleanName) {
      Alert.alert('Sub-organization name', 'Enter a Sub-organization name.');
      return;
    }

    setSaving(true);

    try {
      const createdId = await createSuborganization({
        parentScopeId,
        name: cleanName,
        description,
        visibility,
        joinPolicy,
        organizationType: organizationType.trim() || inheritedType,
      });

      Alert.alert(
        'Sub-organization created',
        `${cleanName} was created under ${
          parent.name || routeParentName || 'the parent Organization'
        }.`,
        [
          {
            text: 'Open workspace',
            onPress: () => void openChildWorkspace(createdId),
          },
          { text: 'Stay here', style: 'cancel' },
        ]
      );

      setName('');
      setDescription('');
      setVisibility(upper(parent.visibility || 'PUBLIC'));
      setJoinPolicy('APPROVAL_REQUIRED');
      setOrganizationType(inheritedType);

      await load();
    } catch (error: unknown) {
      Alert.alert(
        'Could not create Sub-organization',
        error instanceof Error
          ? error.message
          : 'The Sub-organization was not created.'
      );
    } finally {
      setSaving(false);
    }
  };

  const requestSuborganization = () => {
    Alert.alert(
      'Request new Sub-organization',
      'If you manage a lower unit but are not authorized to create directly under this Organization, you may request a new Sub-organization for parent admin review.\n\nApproval workflow is being prepared. No child scope is created until a parent Organization admin approves the request.'
    );
  };

  const screenTitle =
    mode === 'create'
      ? 'Create Sub-organization'
      : mode === 'list'
        ? 'Sub-organizations'
        : 'Units & Structure';

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: screenTitle }} />
        <View style={styles.center}>
          <Text style={styles.muted}>Loading...</Text>
        </View>
      </>
    );
  }

  if (!parent) {
    return (
      <>
        <Stack.Screen options={{ title: screenTitle }} />
        <View style={styles.center}>
          <Text style={styles.muted}>Parent Organization unavailable.</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: screenTitle }} />

      <BuklodPortalScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.parentLabel}>PARENT ORGANIZATION</Text>
          <Text style={styles.parentName}>
            {parent.name || routeParentName || 'Organization'}
          </Text>
          <Text style={styles.parentHint}>
            Structural Sub-organizations are created here under this exact parent
            scope. Identity is always the canonical scope_id — not the display
            name.
          </Text>
        </View>

        {mode === 'units' ? (
          <>
            <View style={styles.card}>
              <Text style={styles.section}>UNITS & STRUCTURE</Text>
              <Text style={styles.helper}>
                Choose a structural action for this Organization.
              </Text>

              {allowed ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/organizations/suborganizations' as any,
                      params: {
                        ...organizationScopeParams(parentScopeId, {
                          parentName: parent.name ?? '',
                          mode: 'create',
                        }),
                        parentScopeId,
                      },
                    } as any)
                  }
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.actionPrimary,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.actionPrimaryText}>
                    CREATE SUB-ORGANIZATION
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={requestSuborganization}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.actionOutline,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.actionOutlineText}>
                    REQUEST NEW SUB-ORGANIZATION
                  </Text>
                </Pressable>
              )}

              <Pressable
                disabled
                style={[styles.actionButton, styles.actionDisabled]}
              >
                <Text style={styles.actionDisabledText}>
                  LINK EXISTING CLUSTER / UNIT
                </Text>
                <Text style={styles.actionDisabledHint}>
                  Phase 1B — relationship-linked units (not structural children)
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/organizations/suborganizations' as any,
                    params: {
                      ...organizationScopeParams(parentScopeId, {
                        parentName: parent.name ?? '',
                        mode: 'list',
                      }),
                      parentScopeId,
                    },
                  } as any)
                }
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.actionOutline,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.actionOutlineText}>
                  VIEW SUB-ORGANIZATIONS / UNITS
                </Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.section}>IMMEDIATE CHILDREN</Text>
              {children.length === 0 ? (
                <Text style={styles.muted}>No Sub-organizations yet.</Text>
              ) : (
                children.slice(0, 8).map((child) => (
                  <Pressable
                    key={child.scope_id}
                    onPress={() => void openChildWorkspace(child.scope_id)}
                    style={styles.childRow}
                  >
                    <Text style={styles.childEmoji}>🧩</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.childName}>{child.name}</Text>
                      <Text style={styles.childMeta}>
                        {child.member_count} members · scope {child.scope_id.slice(0, 8)}…
                      </Text>
                    </View>
                  </Pressable>
                ))
              )}
              {children.length > 8 ? (
                <Text style={styles.muted}>
                  Showing 8 of {children.length}. Open the full list for more.
                </Text>
              ) : null}
            </View>
          </>
        ) : null}

        {mode === 'create' ? (
          <>
            {!allowed ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>ADMIN ACCESS REQUIRED</Text>
                <Text style={styles.warningText}>
                  Only an admin of this exact parent Organization can create a
                  structural Sub-organization.
                </Text>
                <Pressable
                  onPress={requestSuborganization}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.actionOutline,
                    pressed && styles.pressed,
                    { marginTop: 8 },
                  ]}
                >
                  <Text style={styles.actionOutlineText}>
                    REQUEST NEW SUB-ORGANIZATION
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.card}>
                  <Text style={styles.section}>NEW SUB-ORGANIZATION</Text>
                  <Text style={styles.helper}>
                    Parent scope: {parentScopeId}
                  </Text>

                  <View style={styles.fieldBlock}>
                    <Text style={styles.label}>NAME</Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      style={styles.input}
                      placeholder="e.g. MZB Sta. Ines"
                    />
                  </View>

                  <View style={styles.fieldBlock}>
                    <Text style={styles.label}>ORGANIZATION TYPE</Text>
                    <TextInput
                      value={organizationType}
                      onChangeText={setOrganizationType}
                      style={styles.input}
                      placeholder={inheritedType}
                    />
                    <Text style={styles.helper}>
                      Inherited default from parent: {inheritedType}
                    </Text>
                  </View>

                  <View style={styles.fieldBlock}>
                    <Text style={styles.label}>DESCRIPTION</Text>
                    <TextInput
                      value={description}
                      onChangeText={setDescription}
                      multiline
                      textAlignVertical="top"
                      style={[styles.input, styles.multiline]}
                      placeholder="Description"
                    />
                  </View>

                  <View style={styles.fieldBlock}>
                    <Text style={styles.label}>VISIBILITY</Text>
                    <Choice
                      value={visibility}
                      options={['PUBLIC', 'PRIVATE']}
                      onChange={setVisibility}
                    />
                  </View>

                  <View style={styles.fieldBlock}>
                    <Text style={styles.label}>JOIN POLICY</Text>
                    <Choice
                      value={joinPolicy}
                      options={['OPEN', 'APPROVAL_REQUIRED', 'INVITE_ONLY']}
                      onChange={setJoinPolicy}
                    />
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.section}>SUGGESTED FUNCTIONAL ROLES</Text>
                  <Text style={styles.helper}>
                    Template group: {roleTemplateGroupLabel(templateGroup)}.
                    Inherited defaults — editable after creation in Members &
                    Roles.
                  </Text>
                  <Text style={styles.rolePreview}>
                    {suggestedRoles.join(' · ')}
                  </Text>
                </View>

                <Pressable
                  disabled={saving}
                  onPress={() => void handleCreate()}
                  style={({ pressed }) => [
                    styles.createButton,
                    (pressed || saving) && styles.pressed,
                  ]}
                >
                  <Text style={styles.createText}>
                    {saving ? 'CREATING...' : 'CREATE SUB-ORGANIZATION'}
                  </Text>
                </Pressable>
              </>
            )}
          </>
        ) : null}

        {mode === 'list' ? (
          <View style={styles.card}>
            <Text style={styles.section}>SUB-ORGANIZATIONS</Text>
            {children.length === 0 ? (
              <Text style={styles.muted}>No Sub-organizations yet.</Text>
            ) : (
              children.map((child) => (
                <Pressable
                  key={child.scope_id}
                  onPress={() => void openChildWorkspace(child.scope_id)}
                  style={styles.childRow}
                >
                  <Text style={styles.childEmoji}>🧩</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.childName}>{child.name}</Text>
                    <Text style={styles.childMeta}>
                      {child.member_count} members · {child.visibility}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
            {children.length >= LIST_LIMIT ? (
              <Text style={styles.muted}>
                List capped at {LIST_LIMIT} immediate children.
              </Text>
            ) : null}
          </View>
        ) : null}
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 12,
    backgroundColor: '#F4F7F5',
  },
  center: {
    flex: 1,
    backgroundColor: '#F4F7F5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  muted: {
    color: '#6E7E76',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  header: {
    gap: 4,
    marginBottom: 3,
  },
  parentLabel: {
    color: '#61766C',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  parentName: {
    color: '#173B2F',
    fontSize: 22,
    fontWeight: '900',
  },
  parentHint: {
    color: '#6E7E76',
    fontSize: 11,
    lineHeight: 17,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FFFFFF',
    padding: 15,
    gap: 14,
  },
  section: {
    color: '#173B2F',
    fontSize: 12,
    fontWeight: '900',
  },
  helper: {
    color: '#6E7E76',
    fontSize: 11,
    lineHeight: 17,
  },
  fieldBlock: {
    gap: 6,
  },
  label: {
    color: '#5F7168',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6E0DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1B2A23',
  },
  multiline: {
    minHeight: 96,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6E0DB',
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  choiceSelected: {
    borderColor: '#176B4A',
    backgroundColor: '#E8F3ED',
  },
  choiceText: {
    color: '#66776E',
    fontSize: 10,
    fontWeight: '800',
  },
  choiceTextSelected: {
    color: '#176B4A',
  },
  createButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#176B4A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  createText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  warningCard: {
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6DDD5',
    padding: 16,
    gap: 5,
  },
  warningTitle: {
    color: '#7B4E29',
    fontSize: 12,
    fontWeight: '900',
  },
  warningText: {
    color: '#76685D',
    fontSize: 11,
    lineHeight: 17,
  },
  childRow: {
    minHeight: 52,
    borderRadius: 10,
    backgroundColor: '#F6F9F7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  childEmoji: {
    fontSize: 16,
  },
  childName: {
    color: '#24483A',
    fontSize: 12,
    fontWeight: '800',
  },
  childMeta: {
    color: '#6E7E76',
    fontSize: 10,
    marginTop: 2,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 4,
  },
  actionPrimary: {
    backgroundColor: '#176B4A',
  },
  actionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  actionOutline: {
    borderWidth: 1,
    borderColor: '#C7D8CE',
    backgroundColor: '#FFFFFF',
  },
  actionOutlineText: {
    color: '#176B4A',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  actionDisabled: {
    backgroundColor: '#F3F6F4',
    borderWidth: 1,
    borderColor: '#E2E9E5',
  },
  actionDisabledText: {
    color: '#8A9A92',
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  actionDisabledHint: {
    color: '#9AA8A0',
    fontSize: 10,
    textAlign: 'center',
  },
  rolePreview: {
    color: '#3D564B',
    fontSize: 11,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.7,
  },
});
