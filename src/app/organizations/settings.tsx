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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import {
  Stack,
  useLocalSearchParams,
} from 'expo-router';
import { supabase } from '../../lib/supabase';
import { readOrganizationScopeId } from '@/lib/buklodOrganization';

type Primitive = string | number | boolean | null;

type ScopeRow = {
  id: string;
  name?: string | null;
  description?: string | null;
  visibility?: string | null;
  status?: string | null;
  scope_type?: string | null;
  parent_scope_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_by?: string | null;
  [key: string]: unknown;
};

type MetaField = {
  path: string[];
  label: string;
  value: Primitive;
};

function upper(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

function titleize(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function isPrimitive(value: unknown): value is Primitive {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function flattenMetadata(
  value: unknown,
  path: string[] = [],
  depth = 0,
): MetaField[] {
  if (depth > 4) return [];

  if (isPrimitive(value)) {
    if (!path.length) return [];

    return [
      {
        path,
        label: path.map(titleize).join(' • '),
        value,
      },
    ];
  }

  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return [];
  }

  const output: MetaField[] = [];

  Object.entries(
    value as Record<string, unknown>,
  ).forEach(([key, child]) => {
    if (key.startsWith('_')) return;

    if (
      key === 'join_policy' ||
      key === 'joinPolicy'
    ) {
      return;
    }

    output.push(
      ...flattenMetadata(
        child,
        [...path, key],
        depth + 1,
      ),
    );
  });

  return output;
}

function setAtPath(
  source: Record<string, unknown>,
  path: string[],
  value: Primitive,
) {
  const clone: Record<string, unknown> =
    JSON.parse(JSON.stringify(source || {}));

  let cursor = clone;

  path.forEach((key, index) => {
    if (index === path.length - 1) {
      cursor[key] = value;
      return;
    }

    const current = cursor[key];

    if (
      !current ||
      typeof current !== 'object' ||
      Array.isArray(current)
    ) {
      cursor[key] = {};
    }

    cursor =
      cursor[key] as Record<string, unknown>;
  });

  return clone;
}

function readJoinPolicy(
  metadata: Record<string, unknown>,
) {
  const membership =
    metadata.membership &&
    typeof metadata.membership === 'object' &&
    !Array.isArray(metadata.membership)
      ? (metadata.membership as Record<
          string,
          unknown
        >)
      : {};

  return upper(
    metadata.join_policy ??
      metadata.joinPolicy ??
      metadata.membership_policy ??
      metadata.membershipPolicy ??
      membership.join_policy ??
      membership.joinPolicy ??
      'APPROVAL_REQUIRED',
  );
}

function withJoinPolicy(
  metadata: Record<string, unknown>,
  policy: string,
) {
  return {
    ...metadata,
    join_policy: policy,
  };
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (next: string) => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>

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
    </View>
  );
}

export default function OrganizationalSettingsScreen() {
  const params = useLocalSearchParams();

  const scopeId = readOrganizationScopeId(params as Record<string, unknown>);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(false);

  const [scope, setScope] =
    useState<ScopeRow | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] =
    useState('');
  const [visibility, setVisibility] =
    useState('PUBLIC');
  const [status, setStatus] =
    useState('ACTIVE');
  const [joinPolicy, setJoinPolicy] =
    useState('APPROVAL_REQUIRED');
  const [metadata, setMetadata] =
    useState<Record<string, unknown>>({});

  const load = useCallback(async () => {
    if (!scopeId) {
      setLoading(false);
      Alert.alert(
        'Organizational Settings',
        'No Organization was selected.',
      );
      return;
    }

    setLoading(true);

    try {
      const [
        manageableResult,
        scopeResult,
      ] = await Promise.all([
        (supabase as any).rpc(
          'buklod_my_manageable_organizations_v2',
        ),

        (supabase as any)
          .from('buklod_scopes')
          .select('*')
          .eq('id', scopeId)
          .maybeSingle(),
      ]);

      if (scopeResult.error) {
        throw scopeResult.error;
      }

      if (!scopeResult.data) {
        throw new Error(
          'Organization record was not found.',
        );
      }

      const canManage =
        !manageableResult.error &&
        (manageableResult.data || []).some(
          (row: any) =>
            String(
              row.scope_id || row.id || '',
            ).trim() === scopeId,
        );

      setAllowed(canManage);

      const row = scopeResult.data as ScopeRow;
      const currentMetadata =
        row.metadata &&
        typeof row.metadata === 'object' &&
        !Array.isArray(row.metadata)
          ? row.metadata
          : {};

      setScope(row);
      setName(String(row.name || ''));
      setDescription(
        String(row.description || ''),
      );
      setVisibility(
        upper(row.visibility || 'PUBLIC'),
      );
      setStatus(
        upper(row.status || 'ACTIVE'),
      );
      setJoinPolicy(
        readJoinPolicy(currentMetadata),
      );
      setMetadata(currentMetadata);
    } catch (error: any) {
      Alert.alert(
        'Organizational Settings',
        error?.message ||
          'Could not load Organization settings.',
      );
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const metadataFields = useMemo(
    () => flattenMetadata(metadata),
    [metadata],
  );

  const save = async () => {
    if (!scopeId || !scope) return;

    if (!allowed) {
      Alert.alert(
        'Admin access required',
        'Only an authorized admin of this exact Organization can save changes.',
      );
      return;
    }

    if (!name.trim()) {
      Alert.alert(
        'Organization name',
        'Organization name is required.',
      );
      return;
    }

    setSaving(true);

    try {
      const nextMetadata = withJoinPolicy(
        metadata,
        joinPolicy,
      );

      const { error } = await (supabase as any)
        .from('buklod_scopes')
        .update({
          name: name.trim(),
          description:
            description.trim() || null,
          visibility,
          status,
          metadata: nextMetadata,
        })
        .eq('id', scopeId);

      if (error) throw error;

      setMetadata(nextMetadata);

      Alert.alert(
        'Saved',
        'Organizational Settings updated.',
      );
    } catch (error: any) {
      Alert.alert(
        'Could not save',
        error?.message ||
          'Organization settings were not saved.',
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
            title: 'Organizational Settings',
          }}
        />
        <View style={styles.center}>
          <Text style={styles.muted}>
            Loading Organization information...
          </Text>
        </View>
      </>
    );
  }

  if (!scope) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Organizational Settings',
          }}
        />
        <View style={styles.center}>
          <Text style={styles.muted}>
            Organization information is unavailable.
          </Text>
        </View>
      </>
    );
  }

  if (!allowed) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Organizational Settings',
          }}
        />
        <View style={styles.center}>
          <Text style={styles.denied}>
            ADMIN ACCESS REQUIRED
          </Text>
          <Text style={styles.muted}>
            This exact Organization can only be edited
            by its authorized admin.
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Organizational Settings',
        }}
      />

      <BuklodPortalScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.scopeType}>
            {scope.parent_scope_id
              ? '🧩 SUB-ORGANIZATION'
              : '🏛️ ORGANIZATION'}
          </Text>
          <Text style={styles.title}>
            Organizational Settings
          </Text>
          <Text style={styles.subtitle}>
            Existing information from the created
            Organization is loaded directly into the
            fields below.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>
            BASIC INFORMATION
          </Text>

          <View style={styles.fieldBlock}>
            <Text style={styles.label}>
              ORGANIZATION NAME
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder="Organization name"
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
              placeholder="Organization description"
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>
            ACCESS & MEMBERSHIP
          </Text>

          <Choice
            label="VISIBILITY"
            value={visibility}
            options={['PUBLIC', 'PRIVATE']}
            onChange={setVisibility}
          />

          <Choice
            label="JOIN POLICY"
            value={joinPolicy}
            options={[
              'OPEN',
              'APPROVAL_REQUIRED',
              'INVITE_ONLY',
            ]}
            onChange={setJoinPolicy}
          />

          <Choice
            label="STATUS"
            value={status}
            options={[
              'ACTIVE',
              'RESTRICTED',
            ]}
            onChange={setStatus}
          />
        </View>

        {metadataFields.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.section}>
              SAVED ORGANIZATION DETAILS
            </Text>

            {metadataFields.map(field => {
              const key = field.path.join('.');

              if (
                typeof field.value === 'boolean'
              ) {
                return (
                  <View
                    key={key}
                    style={styles.switchRow}>
                    <Text style={styles.switchLabel}>
                      {field.label}
                    </Text>
                    <Switch
                      value={field.value}
                      onValueChange={next =>
                        setMetadata(current =>
                          setAtPath(
                            current,
                            field.path,
                            next,
                          ),
                        )
                      }
                    />
                  </View>
                );
              }

              return (
                <View
                  key={key}
                  style={styles.fieldBlock}>
                  <Text style={styles.label}>
                    {field.label}
                  </Text>
                  <TextInput
                    value={
                      field.value === null
                        ? ''
                        : String(field.value)
                    }
                    onChangeText={next => {
                      const nextValue =
                        typeof field.value === 'number'
                          ? Number(next) || 0
                          : next;

                      setMetadata(current =>
                        setAtPath(
                          current,
                          field.path,
                          nextValue,
                        ),
                      );
                    }}
                    style={styles.input}
                    keyboardType={
                      typeof field.value === 'number'
                        ? 'decimal-pad'
                        : 'default'
                    }
                  />
                </View>
              );
            })}
          </View>
        ) : null}

        <Pressable
          disabled={saving}
          onPress={save}
          style={({ pressed }) => [
            styles.saveButton,
            (pressed || saving) &&
              styles.pressed,
          ]}>
          <Text style={styles.saveText}>
            {saving
              ? 'SAVING...'
              : 'SAVE ORGANIZATIONAL SETTINGS'}
          </Text>
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
    gap: 12,
    backgroundColor: '#F4F7F5',
  },
  center: {
    flex: 1,
    padding: 24,
    backgroundColor: '#F4F7F5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  muted: {
    color: '#6D7D75',
    textAlign: 'center',
    lineHeight: 18,
  },
  denied: {
    color: '#173B2F',
    fontSize: 14,
    fontWeight: '900',
  },
  header: {
    gap: 5,
  },
  scopeType: {
    color: '#5F746A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  title: {
    color: '#173B2F',
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: '#687970',
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
    letterSpacing: 0.5,
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
  switchRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    borderBottomColor: '#E3E9E6',
  },
  switchLabel: {
    flex: 1,
    color: '#5F7168',
    fontSize: 10,
    fontWeight: '900',
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#176B4A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.7,
  },
});