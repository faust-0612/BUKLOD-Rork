import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { AdminGate } from '@/components/AdminGate';
import { supabase } from '@/lib/supabase';

type Tab = 'WORKSPACES' | 'FEATURES' | 'CONTENT' | 'DESIGN';

type WorkspaceRow = {
  workspace_key: string;
  title: string;
  subtitle: string | null;
  route: string;
  icon: string;
  sort_order: number;
  required_permission_key: string | null;
  scope_type_hint: string | null;
  is_active: boolean;
  visibility_mode: string;
  is_core: boolean;
};

type FeatureRow = {
  id: string;
  flag_key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  scope_type: string | null;
  scope_id: string | null;
  is_core: boolean;
};

type ConfigRow = {
  id: string;
  item_type: string;
  item_key: string;
  label: string;
  description: string | null;
  scope_type: string | null;
  scope_id: string | null;
  locale: string;
  value: Record<string, unknown>;
  enabled: boolean;
  sort_order: number;
  is_core: boolean;
};

const clean = (value: unknown) =>
  String(value ?? '').trim();

const CONFIG_TYPES = [
  'MODULE',
  'FIELD',
  'OPTION',
  'WORKFLOW',
  'LABEL',
  'LINK',
  'STRING',
  'FORMAT',
] as const;

const VISIBILITY = [
  'ALL',
  'PERMISSION',
  'SYSTEM_ADMIN',
  'HIDDEN',
] as const;

function parseJson(text: string) {
  const value = clean(text);

  if (!value) return {};

  const parsed = JSON.parse(value);

  if (
    parsed === null ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      'Value must be a JSON object, e.g. {"string":"Hello"}'
    );
  }

  return parsed;
}

export default function ConfigurationCenterScreen() {
  const [tab, setTab] = useState<Tab>('WORKSPACES');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');

  const [workspaces, setWorkspaces] =
    useState<WorkspaceRow[]>([]);
  const [features, setFeatures] =
    useState<FeatureRow[]>([]);
  const [configs, setConfigs] =
    useState<ConfigRow[]>([]);

  const [wOriginalKey, setWOriginalKey] =
    useState<string | null>(null);
  const [wKey, setWKey] = useState('');
  const [wTitle, setWTitle] = useState('');
  const [wSubtitle, setWSubtitle] = useState('');
  const [wRoute, setWRoute] = useState('');
  const [wIcon, setWIcon] = useState('apps');
  const [wOrder, setWOrder] = useState('500');
  const [wPermission, setWPermission] = useState('');
  const [wScope, setWScope] = useState('');
  const [wVisibility, setWVisibility] =
    useState('ALL');
  const [wActive, setWActive] = useState(true);
  const [wCore, setWCore] = useState(false);

  const [fId, setFId] = useState<string | null>(null);
  const [fKey, setFKey] = useState('');
  const [fLabel, setFLabel] = useState('');
  const [fDescription, setFDescription] = useState('');
  const [fScopeType, setFScopeType] = useState('');
  const [fScopeId, setFScopeId] = useState('');
  const [fEnabled, setFEnabled] = useState(true);
  const [fCore, setFCore] = useState(false);

  const [cId, setCId] = useState<string | null>(null);
  const [cType, setCType] = useState('STRING');
  const [cKey, setCKey] = useState('');
  const [cLabel, setCLabel] = useState('');
  const [cDescription, setCDescription] = useState('');
  const [cScopeType, setCScopeType] = useState('');
  const [cScopeId, setCScopeId] = useState('');
  const [cLocale, setCLocale] = useState('default');
  const [cValue, setCValue] =
    useState('{"string":""}');
  const [cEnabled, setCEnabled] = useState(true);
  const [cOrder, setCOrder] = useState('500');
  const [cCore, setCCore] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);

    try {
      const [w, f, c] = await Promise.all([
        (supabase as any).rpc(
          'buklod_admin_workspace_buttons_v1'
        ),
        (supabase as any).rpc(
          'buklod_admin_feature_flags_v1'
        ),
        (supabase as any).rpc(
          'buklod_admin_config_items_v1'
        ),
      ]);

      if (w.error) throw w.error;
      if (f.error) throw f.error;
      if (c.error) throw c.error;

      setWorkspaces(
        Array.isArray(w.data) ? w.data : []
      );
      setFeatures(
        Array.isArray(f.data) ? f.data : []
      );
      setConfigs(
        Array.isArray(c.data) ? c.data : []
      );
    } catch (error: any) {
      Alert.alert(
        'Configuration Center',
        clean(error?.message) ||
          'Could not load configuration.'
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const requireReason = useCallback(() => {
    const value = clean(reason);

    if (!value) {
      Alert.alert(
        'Reason required',
        'Enter a reason before saving or deleting.'
      );
      return null;
    }

    return value;
  }, [reason]);

  const resetWorkspace = useCallback(() => {
    setWOriginalKey(null);
    setWKey('');
    setWTitle('');
    setWSubtitle('');
    setWRoute('');
    setWIcon('apps');
    setWOrder('500');
    setWPermission('');
    setWScope('');
    setWVisibility('ALL');
    setWActive(true);
    setWCore(false);
  }, []);

  const editWorkspace = useCallback(
    (item: WorkspaceRow) => {
      setWOriginalKey(item.workspace_key);
      setWKey(item.workspace_key);
      setWTitle(item.title);
      setWSubtitle(item.subtitle ?? '');
      setWRoute(item.route);
      setWIcon(item.icon || 'apps');
      setWOrder(String(item.sort_order ?? 500));
      setWPermission(
        item.required_permission_key ?? ''
      );
      setWScope(item.scope_type_hint ?? '');
      setWVisibility(
        item.visibility_mode || 'ALL'
      );
      setWActive(item.is_active !== false);
      setWCore(item.is_core === true);
    },
    []
  );

  const saveWorkspace = useCallback(async () => {
    const why = requireReason();
    if (!why) return;

    if (!clean(wKey) || !clean(wTitle) || !clean(wRoute)) {
      Alert.alert(
        'Workspace button',
        'Key, title and route/link are required.'
      );
      return;
    }

    if (
      wOriginalKey &&
      clean(wOriginalKey).toUpperCase() !==
        clean(wKey).toUpperCase()
    ) {
      Alert.alert(
        'Workspace key',
        'To rename a key, create the new button first, then delete the old one.'
      );
      return;
    }

    setBusy(true);

    try {
      const { error } = await (supabase as any).rpc(
        'buklod_admin_upsert_workspace_button_v1',
        {
          p_workspace_key: clean(wKey).toUpperCase(),
          p_title: clean(wTitle),
          p_subtitle: clean(wSubtitle) || null,
          p_route: clean(wRoute),
          p_icon: clean(wIcon) || 'apps',
          p_sort_order:
            Number.parseInt(wOrder, 10) || 500,
          p_required_permission_key:
            clean(wPermission) || null,
          p_scope_type_hint:
            clean(wScope) || null,
          p_is_active: wActive,
          p_visibility_mode: wVisibility,
          p_is_core: wCore,
          p_reason: why,
        }
      );

      if (error) throw error;

      await load();
      resetWorkspace();
      setReason('');

      Alert.alert(
        'Saved',
        'Workspace button updated.'
      );
    } catch (error: any) {
      Alert.alert(
        'Could not save button',
        clean(error?.message) ||
          'Workspace update failed.'
      );
    } finally {
      setBusy(false);
    }
  }, [
    requireReason,
    wKey,
    wTitle,
    wSubtitle,
    wRoute,
    wIcon,
    wOrder,
    wPermission,
    wScope,
    wVisibility,
    wActive,
    wCore,
    wOriginalKey,
    load,
    resetWorkspace,
  ]);

  const deleteWorkspace = useCallback(
    (item: WorkspaceRow) => {
      const why = requireReason();
      if (!why) return;

      Alert.alert(
        item.is_core
          ? 'Hide protected button?'
          : 'Delete workspace button?',
        item.is_core
          ? `${item.title} is protected. It will be hidden/deactivated, not physically deleted.`
          : `Delete ${item.title} from the workspace registry? This does not delete the portal data.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: item.is_core ? 'HIDE' : 'DELETE',
            style: 'destructive',
            onPress: async () => {
              setBusy(true);

              try {
                const { error } =
                  await (supabase as any).rpc(
                    'buklod_admin_delete_workspace_button_v1',
                    {
                      p_workspace_key:
                        item.workspace_key,
                      p_reason: why,
                    }
                  );

                if (error) throw error;

                await load();
                resetWorkspace();
                setReason('');
              } catch (error: any) {
                Alert.alert(
                  'Could not remove button',
                  clean(error?.message) ||
                    'Workspace delete failed.'
                );
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      );
    },
    [requireReason, load, resetWorkspace]
  );

  const resetFeature = useCallback(() => {
    setFId(null);
    setFKey('');
    setFLabel('');
    setFDescription('');
    setFScopeType('');
    setFScopeId('');
    setFEnabled(true);
    setFCore(false);
  }, []);

  const editFeature = useCallback(
    (item: FeatureRow) => {
      setFId(item.id);
      setFKey(item.flag_key);
      setFLabel(item.label);
      setFDescription(item.description ?? '');
      setFScopeType(item.scope_type ?? '');
      setFScopeId(item.scope_id ?? '');
      setFEnabled(item.enabled !== false);
      setFCore(item.is_core === true);
    },
    []
  );

  const saveFeature = useCallback(async () => {
    const why = requireReason();
    if (!why) return;

    if (!clean(fKey) || !clean(fLabel)) {
      Alert.alert(
        'Feature flag',
        'Flag key and label are required.'
      );
      return;
    }

    setBusy(true);

    try {
      const { error } = await (supabase as any).rpc(
        'buklod_admin_upsert_feature_flag_v1',
        {
          p_id: fId,
          p_flag_key: clean(fKey).toUpperCase(),
          p_label: clean(fLabel),
          p_description:
            clean(fDescription) || null,
          p_enabled: fEnabled,
          p_scope_type:
            clean(fScopeType) || null,
          p_scope_id: clean(fScopeId) || null,
          p_is_core: fCore,
          p_reason: why,
        }
      );

      if (error) throw error;

      await load();
      resetFeature();
      setReason('');
    } catch (error: any) {
      Alert.alert(
        'Could not save feature',
        clean(error?.message) ||
          'Feature update failed.'
      );
    } finally {
      setBusy(false);
    }
  }, [
    requireReason,
    fId,
    fKey,
    fLabel,
    fDescription,
    fEnabled,
    fScopeType,
    fScopeId,
    fCore,
    load,
    resetFeature,
  ]);

  const deleteFeature = useCallback(
    (item: FeatureRow) => {
      const why = requireReason();
      if (!why) return;

      Alert.alert(
        item.is_core
          ? 'Disable protected feature?'
          : 'Delete feature flag?',
        item.is_core
          ? `${item.label} will be disabled.`
          : `Delete ${item.label}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: item.is_core ? 'DISABLE' : 'DELETE',
            style: 'destructive',
            onPress: async () => {
              setBusy(true);
              try {
                const { error } =
                  await (supabase as any).rpc(
                    'buklod_admin_delete_feature_flag_v1',
                    {
                      p_id: item.id,
                      p_reason: why,
                    }
                  );
                if (error) throw error;
                await load();
                resetFeature();
                setReason('');
              } catch (error: any) {
                Alert.alert(
                  'Could not remove feature',
                  clean(error?.message) ||
                    'Feature delete failed.'
                );
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      );
    },
    [requireReason, load, resetFeature]
  );

  const resetConfig = useCallback(
    (type = 'STRING') => {
      setCId(null);
      setCType(type);
      setCKey('');
      setCLabel('');
      setCDescription('');
      setCScopeType('');
      setCScopeId('');
      setCLocale('default');
      setCValue(
        type === 'DESIGN_TOKEN'
          ? '{"number":12}'
          : '{"string":""}'
      );
      setCEnabled(true);
      setCOrder('500');
      setCCore(false);
    },
    []
  );

  const editConfig = useCallback(
    (item: ConfigRow) => {
      setCId(item.id);
      setCType(item.item_type);
      setCKey(item.item_key);
      setCLabel(item.label);
      setCDescription(item.description ?? '');
      setCScopeType(item.scope_type ?? '');
      setCScopeId(item.scope_id ?? '');
      setCLocale(item.locale || 'default');
      setCValue(
        JSON.stringify(item.value ?? {}, null, 2)
      );
      setCEnabled(item.enabled !== false);
      setCOrder(String(item.sort_order ?? 500));
      setCCore(item.is_core === true);
    },
    []
  );

  const saveConfig = useCallback(async () => {
    const why = requireReason();
    if (!why) return;

    if (!clean(cKey) || !clean(cLabel)) {
      Alert.alert(
        'Configuration',
        'Key and label are required.'
      );
      return;
    }

    let value: Record<string, unknown>;

    try {
      value = parseJson(cValue);
    } catch (error: any) {
      Alert.alert(
        'Invalid JSON value',
        clean(error?.message) ||
          'Enter a valid JSON object.'
      );
      return;
    }

    setBusy(true);

    try {
      const { error } = await (supabase as any).rpc(
        'buklod_admin_upsert_config_item_v1',
        {
          p_id: cId,
          p_item_type: cType,
          p_item_key: clean(cKey).toUpperCase(),
          p_label: clean(cLabel),
          p_description:
            clean(cDescription) || null,
          p_scope_type:
            clean(cScopeType) || null,
          p_scope_id: clean(cScopeId) || null,
          p_locale: clean(cLocale) || 'default',
          p_value: value,
          p_enabled: cEnabled,
          p_sort_order:
            Number.parseInt(cOrder, 10) || 500,
          p_is_core: cCore,
          p_reason: why,
        }
      );

      if (error) throw error;

      await load();
      resetConfig(cType);
      setReason('');
    } catch (error: any) {
      Alert.alert(
        'Could not save configuration',
        clean(error?.message) ||
          'Configuration update failed.'
      );
    } finally {
      setBusy(false);
    }
  }, [
    requireReason,
    cId,
    cType,
    cKey,
    cLabel,
    cDescription,
    cScopeType,
    cScopeId,
    cLocale,
    cValue,
    cEnabled,
    cOrder,
    cCore,
    load,
    resetConfig,
  ]);

  const deleteConfig = useCallback(
    (item: ConfigRow) => {
      const why = requireReason();
      if (!why) return;

      Alert.alert(
        item.is_core
          ? 'Disable protected configuration?'
          : 'Delete configuration?',
        item.is_core
          ? `${item.label} will be disabled, not physically deleted.`
          : `Delete ${item.label}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: item.is_core ? 'DISABLE' : 'DELETE',
            style: 'destructive',
            onPress: async () => {
              setBusy(true);
              try {
                const { error } =
                  await (supabase as any).rpc(
                    'buklod_admin_delete_config_item_v1',
                    {
                      p_id: item.id,
                      p_reason: why,
                    }
                  );
                if (error) throw error;
                await load();
                resetConfig(item.item_type);
                setReason('');
              } catch (error: any) {
                Alert.alert(
                  'Could not remove configuration',
                  clean(error?.message) ||
                    'Configuration delete failed.'
                );
              } finally {
                setBusy(false);
              }
            },
          },
        ]
      );
    },
    [requireReason, load, resetConfig]
  );

  const designRows = useMemo(
    () =>
      configs.filter(
        item => item.item_type === 'DESIGN_TOKEN'
      ),
    [configs]
  );

  const contentRows = useMemo(
    () =>
      configs.filter(
        item => item.item_type !== 'DESIGN_TOKEN'
      ),
    [configs]
  );

  return (
    <AdminGate>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.back}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={24}
            color="#275D45"
          />
          <Text style={styles.backText}>
            System Administration
          </Text>
        </Pressable>

        <Text style={styles.eyebrow}>
          SYSTEM ADMIN
        </Text>

        <Text style={styles.title}>
          BUKLOD Configuration Center
        </Text>

        <Text style={styles.subtitle}>
          Actual controls for workspace buttons, routes,
          links, strings, feature flags, modules, forms,
          workflows and design values.
        </Text>

        <View style={styles.tabs}>
          {(
            [
              ['WORKSPACES', 'Buttons'],
              ['FEATURES', 'Features'],
              ['CONTENT', 'Content'],
              ['DESIGN', 'Design'],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[
                styles.tab,
                tab === key && styles.tabActive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === key && styles.tabTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>
          Reason for this change
        </Text>

        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Required before Save/Delete"
          style={styles.input}
        />

        {busy && (
          <ActivityIndicator
            color="#275D45"
            style={{ marginVertical: 12 }}
          />
        )}

        {tab === 'WORKSPACES' && (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>
                WORKSPACE BUTTONS
              </Text>
              <Pressable
                onPress={resetWorkspace}
                style={styles.smallButton}
              >
                <Text style={styles.smallButtonText}>
                  + NEW BUTTON
                </Text>
              </Pressable>
            </View>

            <View style={styles.editor}>
              <Text style={styles.editorTitle}>
                {wOriginalKey
                  ? `Edit ${wOriginalKey}`
                  : 'Add workspace button'}
              </Text>

              <Text style={styles.fieldLabel}>Key</Text>
              <TextInput
                value={wKey}
                onChangeText={setWKey}
                autoCapitalize="characters"
                placeholder="e.g. LOCAL"
                editable={!wOriginalKey}
                style={[
                  styles.input,
                  !!wOriginalKey && styles.inputLocked,
                ]}
              />

              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                value={wTitle}
                onChangeText={setWTitle}
                placeholder="BUKLOD Local"
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>Subtitle</Text>
              <TextInput
                value={wSubtitle}
                onChangeText={setWSubtitle}
                placeholder="Short description"
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>
                Route / Link
              </Text>
              <TextInput
                value={wRoute}
                onChangeText={setWRoute}
                placeholder="/profile/..."
                autoCapitalize="none"
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>Icon name</Text>
              <TextInput
                value={wIcon}
                onChangeText={setWIcon}
                placeholder="apps"
                autoCapitalize="none"
                style={styles.input}
              />

              <View style={styles.twoCol}>
                <View style={styles.flex}>
                  <Text style={styles.fieldLabel}>Order</Text>
                  <TextInput
                    value={wOrder}
                    onChangeText={setWOrder}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </View>

                <View style={styles.flex}>
                  <Text style={styles.fieldLabel}>
                    Scope hint
                  </Text>
                  <TextInput
                    value={wScope}
                    onChangeText={setWScope}
                    placeholder="LOCAL"
                    autoCapitalize="characters"
                    style={styles.input}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>
                Permission key (optional)
              </Text>
              <TextInput
                value={wPermission}
                onChangeText={setWPermission}
                placeholder="leave blank for all users"
                autoCapitalize="none"
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>
                Visibility
              </Text>
              <View style={styles.choiceWrap}>
                {VISIBILITY.map(value => (
                  <Pressable
                    key={value}
                    onPress={() => setWVisibility(value)}
                    style={[
                      styles.choice,
                      wVisibility === value &&
                        styles.choiceActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        wVisibility === value &&
                          styles.choiceTextActive,
                      ]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <SwitchRow
                label="Active"
                value={wActive}
                onValueChange={setWActive}
              />

              <SwitchRow
                label="Protected core button"
                value={wCore}
                onValueChange={setWCore}
              />

              <Pressable
                onPress={() => void saveWorkspace()}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>
                  SAVE BUTTON
                </Text>
              </Pressable>
            </View>

            {workspaces.map(item => (
              <View
                key={item.workspace_key}
                style={styles.card}
              >
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>
                      {item.title}
                    </Text>
                    <Text style={styles.meta}>
                      {item.workspace_key}
                    </Text>
                    <Text style={styles.meta}>
                      {item.route}
                    </Text>
                    <Text style={styles.meta}>
                      Order {item.sort_order} Â·{' '}
                      {item.visibility_mode} Â·{' '}
                      {item.is_active ? 'ON' : 'OFF'}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => editWorkspace(item)}
                    style={styles.editButton}
                  >
                    <Text style={styles.editText}>
                      EDIT
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => deleteWorkspace(item)}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteText}>
                      {item.is_core ? 'HIDE' : 'DELETE'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        {tab === 'FEATURES' && (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>
                FEATURE FLAGS
              </Text>
              <Pressable
                onPress={resetFeature}
                style={styles.smallButton}
              >
                <Text style={styles.smallButtonText}>
                  + NEW FLAG
                </Text>
              </Pressable>
            </View>

            <View style={styles.editor}>
              <Text style={styles.editorTitle}>
                {fId ? 'Edit feature flag' : 'Add feature flag'}
              </Text>

              <Text style={styles.fieldLabel}>Flag key</Text>
              <TextInput
                value={fKey}
                onChangeText={setFKey}
                placeholder="LOCAL.NEW_FEATURE"
                autoCapitalize="characters"
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>Label</Text>
              <TextInput
                value={fLabel}
                onChangeText={setFLabel}
                placeholder="New Feature"
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>
                Description
              </Text>
              <TextInput
                value={fDescription}
                onChangeText={setFDescription}
                placeholder="What this controls"
                style={styles.input}
              />

              <View style={styles.twoCol}>
                <View style={styles.flex}>
                  <Text style={styles.fieldLabel}>
                    Scope type
                  </Text>
                  <TextInput
                    value={fScopeType}
                    onChangeText={setFScopeType}
                    placeholder="optional"
                    style={styles.input}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.fieldLabel}>
                    Scope UUID
                  </Text>
                  <TextInput
                    value={fScopeId}
                    onChangeText={setFScopeId}
                    placeholder="optional"
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </View>
              </View>

              <SwitchRow
                label="Enabled"
                value={fEnabled}
                onValueChange={setFEnabled}
              />

              <SwitchRow
                label="Protected core flag"
                value={fCore}
                onValueChange={setFCore}
              />

              <Pressable
                onPress={() => void saveFeature()}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>
                  SAVE FEATURE FLAG
                </Text>
              </Pressable>
            </View>

            {features.map(item => (
              <View key={item.id} style={styles.card}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>
                      {item.label}
                    </Text>
                    <Text style={styles.meta}>
                      {item.flag_key} Â·{' '}
                      {item.enabled ? 'ON' : 'OFF'}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => editFeature(item)}
                    style={styles.editButton}
                  >
                    <Text style={styles.editText}>EDIT</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => deleteFeature(item)}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteText}>
                      {item.is_core ? 'DISABLE' : 'DELETE'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        {(tab === 'CONTENT' || tab === 'DESIGN') && (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>
                {tab === 'DESIGN'
                  ? 'DESIGN TOKENS'
                  : 'LINKS / STRINGS / MODULES / FORMS'}
              </Text>

              <Pressable
                onPress={() =>
                  resetConfig(
                    tab === 'DESIGN'
                      ? 'DESIGN_TOKEN'
                      : 'STRING'
                  )
                }
                style={styles.smallButton}
              >
                <Text style={styles.smallButtonText}>
                  + NEW
                </Text>
              </Pressable>
            </View>

            <View style={styles.editor}>
              <Text style={styles.editorTitle}>
                {cId ? 'Edit configuration' : 'Add configuration'}
              </Text>

              {tab === 'CONTENT' ? (
                <>
                  <Text style={styles.fieldLabel}>Type</Text>
                  <View style={styles.choiceWrap}>
                    {CONFIG_TYPES.map(value => (
                      <Pressable
                        key={value}
                        onPress={() => setCType(value)}
                        style={[
                          styles.choice,
                          cType === value &&
                            styles.choiceActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.choiceText,
                            cType === value &&
                              styles.choiceTextActive,
                          ]}
                        >
                          {value}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={styles.fixedType}>
                  DESIGN_TOKEN
                </Text>
              )}

              <Text style={styles.fieldLabel}>Key</Text>
              <TextInput
                value={cKey}
                onChangeText={setCKey}
                placeholder={
                  tab === 'DESIGN'
                    ? 'TEXT.BODY_SIZE'
                    : 'HOME.WELCOME_TEXT'
                }
                autoCapitalize="characters"
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>Label</Text>
              <TextInput
                value={cLabel}
                onChangeText={setCLabel}
                placeholder="Human-readable name"
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>
                Description
              </Text>
              <TextInput
                value={cDescription}
                onChangeText={setCDescription}
                placeholder="Optional description"
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>
                Value (JSON)
              </Text>
              <TextInput
                value={cValue}
                onChangeText={setCValue}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, styles.jsonInput]}
              />

              <Text style={styles.hint}>
                Examples: {'{"string":"Hello"}'} Â·{' '}
                {'{"number":16}'} Â·{' '}
                {'{"url":"/profile/..."}'}
              </Text>

              <View style={styles.twoCol}>
                <View style={styles.flex}>
                  <Text style={styles.fieldLabel}>
                    Scope type
                  </Text>
                  <TextInput
                    value={cScopeType}
                    onChangeText={setCScopeType}
                    placeholder="optional"
                    style={styles.input}
                  />
                </View>

                <View style={styles.flex}>
                  <Text style={styles.fieldLabel}>
                    Scope UUID
                  </Text>
                  <TextInput
                    value={cScopeId}
                    onChangeText={setCScopeId}
                    placeholder="optional"
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </View>
              </View>

              <View style={styles.twoCol}>
                <View style={styles.flex}>
                  <Text style={styles.fieldLabel}>Locale</Text>
                  <TextInput
                    value={cLocale}
                    onChangeText={setCLocale}
                    placeholder="default / en / fil"
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </View>

                <View style={styles.flex}>
                  <Text style={styles.fieldLabel}>Order</Text>
                  <TextInput
                    value={cOrder}
                    onChangeText={setCOrder}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </View>
              </View>

              <SwitchRow
                label="Enabled"
                value={cEnabled}
                onValueChange={setCEnabled}
              />

              <SwitchRow
                label="Protected core configuration"
                value={cCore}
                onValueChange={setCCore}
              />

              <Pressable
                onPress={() => void saveConfig()}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>
                  SAVE CONFIGURATION
                </Text>
              </Pressable>
            </View>

            {(tab === 'DESIGN'
              ? designRows
              : contentRows
            ).map(item => (
              <View key={item.id} style={styles.card}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>
                      {item.label}
                    </Text>
                    <Text style={styles.meta}>
                      {item.item_type} Â· {item.item_key}
                    </Text>
                    <Text style={styles.value}>
                      {JSON.stringify(item.value)}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => {
                      editConfig(item);
                      if (tab === 'DESIGN') {
                        setCType('DESIGN_TOKEN');
                      }
                    }}
                    style={styles.editButton}
                  >
                    <Text style={styles.editText}>EDIT</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => deleteConfig(item)}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteText}>
                      {item.is_core ? 'DISABLE' : 'DELETE'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </AdminGate>
  );
}

function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7F5',
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 30,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backText: {
    color: '#275D45',
    fontSize: 14,
    fontWeight: '800',
  },
  eyebrow: {
    color: '#275D45',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  title: {
    marginTop: 4,
    color: '#17231D',
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 6,
    color: '#66736C',
    fontSize: 14,
    lineHeight: 20,
  },
  tabs: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  tab: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#CBD8D1',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  tabActive: {
    backgroundColor: '#275D45',
    borderColor: '#275D45',
  },
  tabText: {
    color: '#275D45',
    fontSize: 13,
    fontWeight: '900',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  sectionHead: {
    marginTop: 18,
    marginBottom: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    flex: 1,
    color: '#275D45',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  smallButton: {
    minHeight: 38,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: '#E7F1EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: {
    color: '#275D45',
    fontSize: 12,
    fontWeight: '900',
  },
  editor: {
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BFD1C7',
    borderRadius: 13,
    backgroundColor: '#F9FCFA',
  },
  editorTitle: {
    marginBottom: 6,
    color: '#17231D',
    fontSize: 17,
    fontWeight: '900',
  },
  fieldLabel: {
    marginTop: 10,
    marginBottom: 4,
    color: '#17231D',
    fontSize: 14,
    fontWeight: '900',
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#CBD8D1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 8,
    color: '#17231D',
    fontSize: 16,
  },
  inputLocked: {
    backgroundColor: '#EEF1EF',
    color: '#66736C',
  },
  jsonInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  choice: {
    minHeight: 36,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: '#CBD8D1',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  choiceActive: {
    backgroundColor: '#275D45',
    borderColor: '#275D45',
  },
  choiceText: {
    color: '#275D45',
    fontSize: 12,
    fontWeight: '900',
  },
  choiceTextActive: {
    color: '#FFFFFF',
  },
  switchRow: {
    minHeight: 46,
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    flex: 1,
    color: '#17231D',
    fontSize: 15,
    fontWeight: '800',
  },
  primaryButton: {
    minHeight: 48,
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#275D45',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  card: {
    marginBottom: 8,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#DDE5E0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    color: '#17231D',
    fontSize: 16,
    fontWeight: '900',
  },
  meta: {
    marginTop: 2,
    color: '#66736C',
    fontSize: 13,
    lineHeight: 18,
  },
  value: {
    marginTop: 3,
    color: '#17231D',
    fontSize: 13,
    lineHeight: 18,
  },
  editButton: {
    minHeight: 38,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#E7F1EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: {
    color: '#275D45',
    fontSize: 11,
    fontWeight: '900',
  },
  deleteButton: {
    minHeight: 38,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#FBEAEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#9B2525',
    fontSize: 11,
    fontWeight: '900',
  },
  hint: {
    marginTop: 4,
    color: '#66736C',
    fontSize: 12,
    lineHeight: 17,
  },
  fixedType: {
    marginTop: 6,
    color: '#275D45',
    fontSize: 13,
    fontWeight: '900',
  },
});