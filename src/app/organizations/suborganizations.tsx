import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { supabase } from '../../lib/supabase';

type ScopeRow = {
  id: string;
  name?: string | null;
  parent_scope_id?: string | null;
  scope_type?: string | null;
  visibility?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  created_by?: string | null;
  description?: string | null;
};

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
      {options.map(option => {
        const selected = value === option;

        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[
              styles.choice,
              selected && styles.choiceSelected,
            ]}>
            <Text
              style={[
                styles.choiceText,
                selected &&
                  styles.choiceTextSelected,
              ]}>
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

  const mode =
    firstString(params.mode) || 'list';

  const parentScopeId =
    firstString(params.parentScopeId) ||
    firstString(params.parent_scope_id) ||
    firstString(params.organizationId) ||
    firstString(params.organization_id) ||
    firstString(params.id);

  const routeParentName =
    firstString(params.parentName);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(false);

  const [parent, setParent] =
    useState<ScopeRow | null>(null);
  const [children, setChildren] =
    useState<ScopeRow[]>([]);

  const [name, setName] = useState('');
  const [description, setDescription] =
    useState('');
  const [visibility, setVisibility] =
    useState('PUBLIC');
  const [joinPolicy, setJoinPolicy] =
    useState('APPROVAL_REQUIRED');

  const load = useCallback(async () => {
    if (!parentScopeId) {
      setLoading(false);
      Alert.alert(
        'Sub-organization',
        'No parent Organization was selected.',
      );
      return;
    }

    setLoading(true);

    try {
      const [
        parentResult,
        manageableResult,
        childrenResult,
      ] = await Promise.all([
        (supabase as any)
          .from('buklod_scopes')
          .select('*')
          .eq('id', parentScopeId)
          .maybeSingle(),

        (supabase as any).rpc(
          'buklod_my_manageable_organizations_v2',
        ),

        (supabase as any)
          .from('buklod_scopes')
          .select('*')
          .eq('parent_scope_id', parentScopeId),
      ]);

      if (parentResult.error) {
        throw parentResult.error;
      }

      if (!parentResult.data) {
        throw new Error(
          'Parent Organization was not found.',
        );
      }

      const canManage =
        !manageableResult.error &&
        (manageableResult.data || []).some(
          (row: any) =>
            String(
              row.scope_id || row.id || '',
            ).trim() === parentScopeId,
        );

      setAllowed(canManage);
      setParent(parentResult.data as ScopeRow);

      const rows = (
        childrenResult.data || []
      ) as ScopeRow[];

      setChildren(
        rows
          .filter(
            row =>
              upper(row.scope_type) ===
                'ORGANIZATION' &&
              upper(row.status || 'ACTIVE') !==
                'DELETED',
          )
          .sort((a, b) =>
            String(a.name || '').localeCompare(
              String(b.name || ''),
            ),
          ),
      );
    } catch (error: any) {
      Alert.alert(
        'Sub-organization',
        error?.message ||
          'Could not load Sub-organization information.',
      );
    } finally {
      setLoading(false);
    }
  }, [parentScopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!parentScopeId || !parent) return;

    if (!allowed) {
      Alert.alert(
        'Admin access required',
        'Only an authorized admin of the parent Organization can create a Sub-organization.',
      );
      return;
    }

    const cleanName = name.trim();

    if (!cleanName) {
      Alert.alert(
        'Sub-organization name',
        'Enter a Sub-organization name.',
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      const userId = authData.user?.id;

      if (!userId) {
        throw new Error(
          'Signed-in user was not found.',
        );
      }

      let createdId = '';

      const rpcResult = await (supabase as any)
        .rpc(
          'buklod_create_suborganization_v1',
          {
            p_parent_scope_id: parentScopeId,
            p_name: cleanName,
            p_description:
              description.trim() || null,
            p_visibility: visibility,
            p_join_policy: joinPolicy,
          },
        );

      if (!rpcResult.error) {
        createdId = String(
          rpcResult.data?.scope_id ||
            rpcResult.data?.id ||
            '',
        );
      } else {
        const message = String(
          rpcResult.error?.message || '',
        );

        const missingRpc =
          /could not find the function/i.test(
            message,
          ) ||
          /function .* does not exist/i.test(
            message,
          ) ||
          /PGRST202/i.test(message);

        if (!missingRpc) {
          throw rpcResult.error;
        }

        const insertResult = await (
          supabase as any
        )
          .from('buklod_scopes')
          .insert({
            name: cleanName,
            description:
              description.trim() || null,
            scope_type: 'ORGANIZATION',
            parent_scope_id: parentScopeId,
            visibility,
            status: 'ACTIVE',
            metadata: {
              organization_level:
                'SUB_ORGANIZATION',
              join_policy: joinPolicy,
              parent_scope_id:
                parentScopeId,
              created_via:
                'suborganizations_screen',
            },
            created_by: userId,
          })
          .select('*')
          .single();

        if (insertResult.error) {
          throw insertResult.error;
        }

        createdId = String(
          insertResult.data?.id || '',
        );
      }

      Alert.alert(
        'Sub-organization created',
        `${cleanName} was created under ${
          parent.name || routeParentName ||
          'the selected Organization'
        }.`,
      );

      setName('');
      setDescription('');
      setVisibility('PUBLIC');
      setJoinPolicy('APPROVAL_REQUIRED');

      await load();

      if (createdId) {
        router.replace({
          pathname:
            '/organizations/manage' as any,
        } as any);
      }
    } catch (error: any) {
      Alert.alert(
        'Could not create Sub-organization',
        error?.message ||
          'The Sub-organization was not created.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Sub Organization',
          }}
        />
        <View style={styles.center}>
          <Text style={styles.muted}>
            Loading...
          </Text>
        </View>
      </>
    );
  }

  if (!parent) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Sub Organization',
          }}
        />
        <View style={styles.center}>
          <Text style={styles.muted}>
            Parent Organization unavailable.
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title:
            mode === 'create'
              ? 'Create Sub-organization'
              : 'Sub Organizations',
        }}
      />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.parentLabel}>
            🏛️ PARENT ORGANIZATION
          </Text>
          <Text style={styles.parentName}>
            {parent.name ||
              routeParentName ||
              'Organization'}
          </Text>
        </View>

        {mode === 'create' ? (
          <>
            {!allowed ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>
                  ADMIN ACCESS REQUIRED
                </Text>
                <Text style={styles.warningText}>
                  Only an admin of this exact parent
                  Organization can create a
                  Sub-organization.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.card}>
                  <Text style={styles.section}>
                    🧩 NEW SUB-ORGANIZATION
                  </Text>

                  <View style={styles.fieldBlock}>
                    <Text style={styles.label}>
                      SUB-ORGANIZATION NAME
                    </Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      style={styles.input}
                      placeholder="Sub-organization name"
                    />
                  </View>

                  <View style={styles.fieldBlock}>
                    <Text style={styles.label}>
                      DESCRIPTION
                    </Text>
                    <TextInput
                      value={description}
                      onChangeText={setDescription}
                      multiline
                      textAlignVertical="top"
                      style={[
                        styles.input,
                        styles.multiline,
                      ]}
                      placeholder="Description"
                    />
                  </View>

                  <View style={styles.fieldBlock}>
                    <Text style={styles.label}>
                      VISIBILITY
                    </Text>
                    <Choice
                      value={visibility}
                      options={[
                        'PUBLIC',
                        'PRIVATE',
                      ]}
                      onChange={setVisibility}
                    />
                  </View>

                  <View style={styles.fieldBlock}>
                    <Text style={styles.label}>
                      JOIN POLICY
                    </Text>
                    <Choice
                      value={joinPolicy}
                      options={[
                        'OPEN',
                        'APPROVAL_REQUIRED',
                        'INVITE_ONLY',
                      ]}
                      onChange={setJoinPolicy}
                    />
                  </View>
                </View>

                <Pressable
                  disabled={saving}
                  onPress={create}
                  style={({ pressed }) => [
                    styles.createButton,
                    (pressed || saving) &&
                      styles.pressed,
                  ]}>
                  <Text
                    style={styles.createText}>
                    {saving
                      ? 'CREATING...'
                      : 'CREATE SUB-ORGANIZATION'}
                  </Text>
                </Pressable>
              </>
            )}
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.section}>
              🧩 SUB-ORGANIZATIONS
            </Text>

            {children.length === 0 ? (
              <Text style={styles.muted}>
                No Sub-organizations yet.
              </Text>
            ) : (
              children.map(child => (
                <View
                  key={child.id}
                  style={styles.childRow}>
                  <Text style={styles.childEmoji}>
                    🧩
                  </Text>
                  <Text style={styles.childName}>
                    {child.name}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 46,
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
  },
  header: {
    gap: 3,
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
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: '#F6F9F7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 11,
  },
  childEmoji: {
    fontSize: 16,
  },
  childName: {
    color: '#24483A',
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
});