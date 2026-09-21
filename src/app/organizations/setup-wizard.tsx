import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as QRCode from 'qrcode';
import { router, useLocalSearchParams } from 'expo-router';

import { BuklodFeedbackBanner } from '@/components/BuklodFeedbackBanner';
import { colors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import {
  organizationScopeParams,
  readOrganizationScopeId,
  verifyOrganizationManageAccess,
} from '@/lib/buklodOrganization';
import {
  BUKLOD_ORGANIZATION_MODULE_REGISTRY,
  defaultInstitutionWorkspaceConfig,
  institutionModuleLabel,
  readInstitutionWorkspaceConfig,
  writeInstitutionWorkspaceConfig,
  type BuklodInstitutionPreset,
  type BuklodInstitutionWorkspaceConfig,
  type BuklodOrganizationModuleId,
} from '@/lib/buklodOrganizationWorkspace';
import type { BuklodUserFeedback } from '@/lib/buklodUserFeedback';

type ScopeRecord = {
  id: string;
  name: string;
  description: string | null;
  parent_scope_id: string | null;
  visibility: string;
  status: string;
  metadata: Record<string, unknown> | null;
};

const STEPS = [
  'Identity',
  'Structure',
  'Roles',
  'Modules',
  'Specialized Apps',
  'Member Access',
  'Invite',
  'Review',
  'Launch',
] as const;

const PRESETS: Array<{
  key: BuklodInstitutionPreset;
  label: string;
}> = [
  { key: 'SCHOOL', label: 'School' },
  { key: 'BUSINESS', label: 'Business' },
  { key: 'CHURCH', label: 'Church / Ministry' },
  { key: 'NGO', label: 'NGO / Foundation' },
  { key: 'TRAINING_CENTER', label: 'Training Center' },
  { key: 'ASSOCIATION', label: 'Association / Cooperative' },
  { key: 'COMMUNITY', label: 'Community Organization' },
  { key: 'OTHER', label: 'Other' },
];

const CORE_MODULES: BuklodOrganizationModuleId[] = [
  'community',
  'connect',
  'announcements',
  'members',
  'units',
  'events',
  'files',
  'calendar',
];

const SPECIALIZED_MODULES: BuklodOrganizationModuleId[] = [
  'reports',
  'classroom',
  'quiz',
];

function successFeedback(message: string): BuklodUserFeedback {
  return {
    tone: 'success',
    category: null,
    title: 'Workspace settings saved',
    message,
    nextStep: null,
    supportCode: null,
    retryable: false,
    needsSupport: false,
  };
}

function errorFeedback(message: string): BuklodUserFeedback {
  return {
    tone: 'error',
    category: 'UNKNOWN_ERROR',
    title: 'Workspace settings not saved',
    message,
    nextStep:
      'Try again. If it repeats, open Help from the Organization workspace.',
    supportCode: 'ORG-SETUP-500',
    retryable: true,
    needsSupport: true,
  };
}

export default function OrganizationSetupWizardScreen() {
  const params = useLocalSearchParams();
  const scopeId = readOrganizationScopeId(
    params as Record<string, unknown>,
  );

  const [step, setStep] = useState(0);
  const [scope, setScope] = useState<ScopeRecord | null>(null);
  const [config, setConfig] =
    useState<BuklodInstitutionWorkspaceConfig | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] =
    useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [joinPolicy, setJoinPolicy] =
    useState<'OPEN' | 'APPROVAL_REQUIRED' | 'INVITE_ONLY'>(
      'APPROVAL_REQUIRED',
    );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] =
    useState<BuklodUserFeedback | null>(null);
  const [qrUri, setQrUri] = useState<string | null>(null);

  const inviteLink = useMemo(
    () =>
      scopeId
        ? `https://buklod.expo.app/organizations/join?scopeId=${encodeURIComponent(
            scopeId,
          )}`
        : '',
    [scopeId],
  );

  const load = useCallback(async () => {
    if (!scopeId) {
      setLoading(false);
      setFeedback(
        errorFeedback('No Organization was selected.'),
      );
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const access =
        await verifyOrganizationManageAccess(scopeId);
      if (!access.allowed) {
        throw new Error(
          "You don't have permission to configure this Organization.",
        );
      }

      const { data, error } = await withBuklodTimeout(
        (supabase as any)
          .from('buklod_scopes')
          .select(
            'id,name,description,parent_scope_id,visibility,status,metadata',
          )
          .eq('id', scopeId)
          .maybeSingle(),
        8_000,
        'Organization setup',
      );

      if (error) throw error;
      if (!data) {
        throw new Error(
          'This Organization is unavailable.',
        );
      }

      const row = data as ScopeRecord;
      const nextConfig =
        readInstitutionWorkspaceConfig(row.metadata);

      setScope(row);
      setConfig(nextConfig);
      setName(row.name ?? '');
      setDescription(row.description ?? '');
      setVisibility(
        String(row.visibility).toUpperCase() === 'PRIVATE'
          ? 'PRIVATE'
          : 'PUBLIC',
      );

      const meta =
        row.metadata &&
        typeof row.metadata === 'object' &&
        !Array.isArray(row.metadata)
          ? row.metadata
          : {};
      const policy = String(
        (meta as any).join_policy ??
          'APPROVAL_REQUIRED',
      ).toUpperCase();

      setJoinPolicy(
        policy === 'OPEN' || policy === 'INVITE_ONLY'
          ? policy
          : 'APPROVAL_REQUIRED',
      );
    } catch (error) {
      setFeedback(
        errorFeedback(
          error instanceof Error
            ? error.message
            : 'Workspace setup could not be loaded.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!inviteLink) {
      setQrUri(null);
      return;
    }

    let active = true;
    void QRCode.toDataURL(inviteLink, {
      margin: 1,
      width: 240,
      errorCorrectionLevel: 'M',
    })
      .then(uri => {
        if (active) setQrUri(uri);
      })
      .catch(() => {
        if (active) setQrUri(null);
      });

    return () => {
      active = false;
    };
  }, [inviteLink]);

  const updateConfig = useCallback(
    (
      updater: (
        current: BuklodInstitutionWorkspaceConfig,
      ) => BuklodInstitutionWorkspaceConfig,
    ) => {
      setConfig(current =>
        current ? updater(current) : current,
      );
      setFeedback(null);
    },
    [],
  );

  const choosePreset = useCallback(
    (preset: BuklodInstitutionPreset) => {
      const next = defaultInstitutionWorkspaceConfig(preset);
      setConfig(current => ({
        ...next,
        lifecycle: current?.lifecycle ?? next.lifecycle,
        recommendedLanguage:
          current?.recommendedLanguage ?? null,
      }));
      setFeedback(null);
    },
    [],
  );

  const toggleModule = useCallback(
    (moduleId: BuklodOrganizationModuleId) => {
      if (moduleId === 'overview' || moduleId === 'help') {
        return;
      }

      updateConfig(current => ({
        ...current,
        enabledModules: {
          ...current.enabledModules,
          [moduleId]:
            current.enabledModules[moduleId] === false,
        },
      }));
    },
    [updateConfig],
  );

  const save = useCallback(
    async (
      overrides?: {
        lifecycle?: BuklodInstitutionWorkspaceConfig['lifecycle'];
      },
    ) => {
      if (!scopeId || !scope || !config) return false;
      if (!name.trim()) {
        setFeedback(
          errorFeedback('Organization name is required.'),
        );
        return false;
      }

      setSaving(true);
      setFeedback(null);

      try {
        const nextConfig: BuklodInstitutionWorkspaceConfig = {
          ...config,
          lifecycle:
            overrides?.lifecycle ?? config.lifecycle,
        };

        const existingMetadata =
          scope.metadata &&
          typeof scope.metadata === 'object' &&
          !Array.isArray(scope.metadata)
            ? scope.metadata
            : {};

        const metadata =
          writeInstitutionWorkspaceConfig(
            {
              ...existingMetadata,
              join_policy:
                visibility === 'PRIVATE'
                  ? 'INVITE_ONLY'
                  : joinPolicy,
            },
            nextConfig,
          );

        const { data, error } = await withBuklodTimeout(
          (supabase as any)
            .from('buklod_scopes')
            .update({
              name: name.trim(),
              description:
                description.trim() || null,
              visibility,
              metadata,
            })
            .eq('id', scopeId)
            .select(
              'id,name,description,parent_scope_id,visibility,status,metadata',
            )
            .single(),
          10_000,
          'Save Organization workspace',
        );

        if (error) throw error;
        if (!data?.id) {
          throw new Error(
            'Organization settings were not confirmed by the server.',
          );
        }

        setScope(data as ScopeRecord);
        setConfig(nextConfig);
        setFeedback(
          successFeedback(
            'Your Organization workspace configuration was saved.',
          ),
        );
        return true;
      } catch (error) {
        setFeedback(
          errorFeedback(
            error instanceof Error
              ? error.message
              : 'Workspace settings could not be saved.',
          ),
        );
        return false;
      } finally {
        setSaving(false);
      }
    },
    [
      config,
      description,
      joinPolicy,
      name,
      scope,
      scopeId,
      visibility,
    ],
  );

  const next = useCallback(async () => {
    if (saving) return;
    if (
      step === 0 ||
      step === 3 ||
      step === 4 ||
      step === 5
    ) {
      const saved = await save();
      if (!saved) return;
    }
    setStep(current =>
      Math.min(STEPS.length - 1, current + 1),
    );
  }, [save, saving, step]);

  const previous = useCallback(() => {
    if (saving) return;
    setStep(current => Math.max(0, current - 1));
  }, [saving]);

  const launch = useCallback(async () => {
    const saved = await save({ lifecycle: 'ACTIVE' });
    if (!saved) return;

    setFeedback(
      successFeedback(
        'Workspace activated. Members can now use enabled modules according to their permissions.',
      ),
    );
  }, [save]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={colors.green}
        />
        <Text style={styles.centerText}>
          Loading Organization setup…
        </Text>
      </View>
    );
  }

  if (!scope || !config) {
    return (
      <View style={styles.center}>
        {feedback ? (
          <BuklodFeedbackBanner
            feedback={feedback}
            onRetry={() => void load()}
          />
        ) : null}
        <Pressable
          onPress={() => router.replace('/organizations' as any)}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>
            MY ORGANIZATIONS
          </Text>
        </Pressable>
      </View>
    );
  }

  const renderModuleToggle = (
    moduleId: BuklodOrganizationModuleId,
  ) => {
    const module =
      BUKLOD_ORGANIZATION_MODULE_REGISTRY.find(
        item => item.id === moduleId,
      );
    if (!module) return null;

    const locked =
      moduleId === 'overview' || moduleId === 'help';
    const enabled =
      locked ||
      config.enabledModules[moduleId] !== false;

    return (
      <Pressable
        key={moduleId}
        disabled={locked}
        onPress={() => toggleModule(moduleId)}
        style={[
          styles.toggleRow,
          enabled && styles.toggleRowOn,
        ]}
      >
        <MaterialCommunityIcons
          name={module.icon as any}
          size={20}
          color={
            enabled
              ? colors.greenDark
              : colors.muted
          }
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleTitle}>
            {institutionModuleLabel(
              config,
              moduleId,
            )}
          </Text>
          <Text style={styles.toggleMeta}>
            {module.availability}
            {' • '}
            {module.permission}
          </Text>
        </View>
        <MaterialCommunityIcons
          name={
            enabled
              ? 'toggle-switch'
              : 'toggle-switch-off-outline'
          }
          size={28}
          color={
            enabled
              ? colors.green
              : colors.muted
          }
        />
      </Pressable>
    );
  };

  const stepContent = (() => {
    if (step === 0) {
      return (
        <>
          <Text style={styles.sectionTitle}>
            Organization identity
          </Text>
          <Text style={styles.help}>
            Configure the existing Organization. This does not create a
            separate app or codebase.
          </Text>

          <Text style={styles.label}>
            ORGANIZATION NAME
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder="Organization name"
          />

          <Text style={styles.label}>
            DESCRIPTION
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            style={[styles.input, styles.multiline]}
            multiline
            placeholder="Short description"
          />

          <Text style={styles.label}>
            WORKSPACE PRESET
          </Text>
          <View style={styles.choiceWrap}>
            {PRESETS.map(item => (
              <Pressable
                key={item.key}
                onPress={() => choosePreset(item.key)}
                style={[
                  styles.choice,
                  config.preset === item.key &&
                    styles.choiceOn,
                ]}
              >
                <Text
                  style={[
                    styles.choiceText,
                    config.preset === item.key &&
                      styles.choiceTextOn,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      );
    }

    if (step === 1) {
      return (
        <>
          <Text style={styles.sectionTitle}>
            Structure
          </Text>
          <Text style={styles.help}>
            Create or review Sub-Organizations / departments / units using the
            existing BUKLOD Sub-Organization engine.
          </Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname:
                  '/organizations/suborganizations' as any,
                params: organizationScopeParams(
                  scopeId,
                  {
                    parentScopeId: scopeId,
                    mode: 'units',
                  },
                ),
              })
            }
            style={styles.actionCard}
          >
            <MaterialCommunityIcons
              name="sitemap-outline"
              size={24}
              color={colors.greenDark}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>
                Manage {config.terminology.unit}
              </Text>
              <Text style={styles.actionText}>
                Add or review units under this Organization.
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={colors.muted}
            />
          </Pressable>
        </>
      );
    }

    if (step === 2) {
      return (
        <>
          <Text style={styles.sectionTitle}>
            Roles
          </Text>
          <Text style={styles.help}>
            Assign Organization Admins and existing functional roles. Admin
            authority remains scope-specific.
          </Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/organizations/admins' as any,
                params: organizationScopeParams(
                  scopeId,
                  { action: 'list' },
                ),
              })
            }
            style={styles.actionCard}
          >
            <MaterialCommunityIcons
              name="shield-account-outline"
              size={24}
              color={colors.greenDark}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>
                Admins & roles
              </Text>
              <Text style={styles.actionText}>
                Add admins or review role assignments.
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={colors.muted}
            />
          </Pressable>
        </>
      );
    }

    if (step === 3) {
      return (
        <>
          <Text style={styles.sectionTitle}>
            Core modules
          </Text>
          <Text style={styles.help}>
            Enable the existing Organization capabilities needed by this
            institution. Overview and Help always remain available.
          </Text>
          <View style={styles.toggleList}>
            {CORE_MODULES.map(renderModuleToggle)}
          </View>

          <Text style={styles.label}>
            DEFAULT LANDING MODULE
          </Text>
          <Text style={styles.help}>
            Members open this enabled module first after selecting the
            Organization. The module gateway still verifies permissions.
          </Text>
          <View style={styles.choiceWrap}>
            {BUKLOD_ORGANIZATION_MODULE_REGISTRY
              .filter(
                item =>
                  !item.adminOnly &&
                  (item.id === 'overview' ||
                    item.id === 'help' ||
                    config.enabledModules[item.id] !== false),
              )
              .map(item => (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    updateConfig(current => ({
                      ...current,
                      defaultLandingModule: item.id,
                    }))
                  }
                  style={[
                    styles.choice,
                    config.defaultLandingModule === item.id &&
                      styles.choiceOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      config.defaultLandingModule === item.id &&
                        styles.choiceTextOn,
                    ]}
                  >
                    {institutionModuleLabel(config, item.id)}
                  </Text>
                </Pressable>
              ))}
          </View>
        </>
      );
    }

    if (step === 4) {
      return (
        <>
          <Text style={styles.sectionTitle}>
            Specialized apps
          </Text>
          <Text style={styles.help}>
            These are doors to existing specialized BUKLOD apps. Enabling a
            door never bypasses Report, Classroom, or Quiz admission rules.
          </Text>
          <View style={styles.toggleList}>
            {SPECIALIZED_MODULES.map(renderModuleToggle)}
          </View>
        </>
      );
    }

    if (step === 5) {
      return (
        <>
          <Text style={styles.sectionTitle}>
            Member access
          </Text>
          <Text style={styles.help}>
            Choose how people discover and join this Organization.
          </Text>

          <Text style={styles.label}>
            VISIBILITY
          </Text>
          <View style={styles.choiceWrap}>
            {(['PUBLIC', 'PRIVATE'] as const).map(
              item => (
                <Pressable
                  key={item}
                  onPress={() => {
                    setVisibility(item);
                    if (item === 'PRIVATE') {
                      setJoinPolicy('INVITE_ONLY');
                    } else if (
                      joinPolicy === 'INVITE_ONLY'
                    ) {
                      setJoinPolicy(
                        'APPROVAL_REQUIRED',
                      );
                    }
                  }}
                  style={[
                    styles.choice,
                    visibility === item &&
                      styles.choiceOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      visibility === item &&
                        styles.choiceTextOn,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              ),
            )}
          </View>

          <Text style={styles.label}>
            JOIN POLICY
          </Text>
          <View style={styles.choiceWrap}>
            {(
              [
                'OPEN',
                'APPROVAL_REQUIRED',
                'INVITE_ONLY',
              ] as const
            ).map(item => {
              const disabled =
                visibility === 'PRIVATE' &&
                item !== 'INVITE_ONLY';
              return (
                <Pressable
                  key={item}
                  disabled={disabled}
                  onPress={() => setJoinPolicy(item)}
                  style={[
                    styles.choice,
                    joinPolicy === item &&
                      styles.choiceOn,
                    disabled && styles.disabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      joinPolicy === item &&
                        styles.choiceTextOn,
                    ]}
                  >
                    {item.replaceAll('_', ' ')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      );
    }

    if (step === 6) {
      return (
        <>
          <Text style={styles.sectionTitle}>
            Invite members
          </Text>
          <Text style={styles.help}>
            This link carries Organization context only. Authentication,
            approval policy, and membership rules still apply.
          </Text>

          <View style={styles.inviteBox}>
            <Text selectable style={styles.inviteLink}>
              {inviteLink}
            </Text>
            <Pressable
              onPress={() =>
                void Clipboard.setStringAsync(
                  inviteLink,
                ).then(() =>
                  setFeedback(
                    successFeedback(
                      'Invite link copied.',
                    ),
                  ),
                )
              }
              style={styles.copyButton}
            >
              <MaterialCommunityIcons
                name="content-copy"
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.copyText}>
                COPY INVITE LINK
              </Text>
            </Pressable>
          </View>

          {qrUri ? (
            <View style={styles.qrCard}>
              <Image
                source={{ uri: qrUri }}
                style={styles.qr}
              />
              <Text style={styles.qrText}>
                Scan to open the BUKLOD Organization join flow.
              </Text>
            </View>
          ) : (
            <Text style={styles.help}>
              QR preview is unavailable on this device. The invite link remains
              valid.
            </Text>
          )}
        </>
      );
    }

    if (step === 7) {
      const enabled =
        BUKLOD_ORGANIZATION_MODULE_REGISTRY
          .filter(
            item =>
              item.id === 'overview' ||
              item.id === 'help' ||
              config.enabledModules[item.id] !== false,
          )
          .map(item =>
            institutionModuleLabel(config, item.id),
          );

      return (
        <>
          <Text style={styles.sectionTitle}>
            Review
          </Text>
          <View style={styles.reviewCard}>
            <Text style={styles.reviewLabel}>
              ORGANIZATION
            </Text>
            <Text style={styles.reviewValue}>
              {name}
            </Text>

            <Text style={styles.reviewLabel}>
              PRESET
            </Text>
            <Text style={styles.reviewValue}>
              {config.preset}
            </Text>

            <Text style={styles.reviewLabel}>
              ACCESS
            </Text>
            <Text style={styles.reviewValue}>
              {visibility} •{' '}
              {visibility === 'PRIVATE'
                ? 'INVITE ONLY'
                : joinPolicy.replaceAll('_', ' ')}
            </Text>

            <Text style={styles.reviewLabel}>
              DEFAULT LANDING
            </Text>
            <Text style={styles.reviewValue}>
              {institutionModuleLabel(
                config,
                config.defaultLandingModule,
              )}
            </Text>

            <Text style={styles.reviewLabel}>
              ENABLED MODULES
            </Text>
            <Text style={styles.reviewValue}>
              {enabled.join(' • ')}
            </Text>
          </View>
        </>
      );
    }

    return (
      <>
        <Text style={styles.sectionTitle}>
          Launch workspace
        </Text>
        <Text style={styles.help}>
          Activation publishes this configuration to the existing Organization
          workspace. It does not create another application, database, or
          institution-specific fork.
        </Text>

        <View style={styles.launchCard}>
          <MaterialCommunityIcons
            name="rocket-launch-outline"
            size={34}
            color={colors.greenDark}
          />
          <Text style={styles.launchTitle}>
            {name}
          </Text>
          <Text style={styles.launchText}>
            {config.lifecycle === 'ACTIVE'
              ? 'Workspace configuration is active.'
              : `Current lifecycle: ${config.lifecycle}`}
          </Text>
          <Pressable
            disabled={saving}
            onPress={() => void launch()}
            style={[
              styles.launchButton,
              saving && styles.disabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.launchButtonText}>
                ACTIVATE WORKSPACE
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={() =>
              router.replace({
                pathname: '/scope' as any,
                params: {
                  scopeId,
                  section: 'home',
                },
              })
            }
            style={styles.openButton}
          >
            <Text style={styles.openButtonText}>
              OPEN ORGANIZATION WORKSPACE
            </Text>
          </Pressable>
        </View>
      </>
    );
  })();

  return (
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
          color={colors.greenDark}
        />
        <Text style={styles.backText}>
          Back to Organization
        </Text>
      </Pressable>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>
          INSTITUTION SETUP
        </Text>
        <Text style={styles.title}>
          {scope.name}
        </Text>
        <Text style={styles.subtitle}>
          Step {step + 1} of {STEPS.length} • {STEPS[step]}
        </Text>
      </View>

      <View style={styles.progress}>
        {STEPS.map((item, index) => (
          <View
            key={item}
            style={[
              styles.progressDot,
              index <= step &&
                styles.progressDotOn,
            ]}
          />
        ))}
      </View>

      {feedback ? (
        <View style={styles.feedbackWrap}>
          <BuklodFeedbackBanner
            feedback={feedback}
            onRetry={
              feedback.tone === 'error'
                ? () => void save()
                : null
            }
            onDismiss={() => setFeedback(null)}
          />
        </View>
      ) : null}

      <View style={styles.card}>
        {stepContent}
      </View>

      <View style={styles.footer}>
        <Pressable
          disabled={step === 0 || saving}
          onPress={previous}
          style={[
            styles.secondaryButton,
            (step === 0 || saving) &&
              styles.disabled,
          ]}
        >
          <Text style={styles.secondaryButtonText}>
            BACK
          </Text>
        </Pressable>

        {step < STEPS.length - 1 ? (
          <Pressable
            disabled={saving}
            onPress={() => void next()}
            style={[
              styles.primary,
              saving && styles.disabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>
                NEXT
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F8F6',
  },
  content: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    padding: 18,
    paddingBottom: 44,
  },
  center: {
    flex: 1,
    backgroundColor: '#F5F8F6',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  centerText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  backText: {
    color: colors.greenDark,
    fontWeight: '900',
  },
  hero: {
    marginTop: 6,
    borderRadius: 18,
    backgroundColor: colors.greenDark,
    padding: 18,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 5,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '800',
  },
  progress: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 5,
  },
  progressDot: {
    flex: 1,
    height: 5,
    borderRadius: 99,
    backgroundColor: '#DCE5DF',
  },
  progressDotOn: {
    backgroundColor: colors.green,
  },
  feedbackWrap: {
    marginTop: 12,
  },
  card: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#DCE5DF',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 18,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  help: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 18,
  },
  label: {
    marginTop: 16,
    marginBottom: 6,
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#D5DFD8',
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    color: colors.text,
  },
  multiline: {
    minHeight: 92,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  choice: {
    minHeight: 37,
    borderWidth: 1,
    borderColor: '#D3DDD6',
    borderRadius: 10,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  choiceOn: {
    borderColor: colors.green,
    backgroundColor: '#EAF4ED',
  },
  choiceText: {
    color: colors.muted,
    fontSize: 10.5,
    fontWeight: '900',
  },
  choiceTextOn: {
    color: colors.greenDark,
  },
  actionCard: {
    marginTop: 14,
    minHeight: 70,
    borderWidth: 1,
    borderColor: '#D5DFD8',
    borderRadius: 13,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  actionText: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  toggleList: {
    marginTop: 12,
    gap: 7,
  },
  toggleRow: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: '#DCE4DF',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  toggleRowOn: {
    borderColor: '#B9D5C2',
    backgroundColor: '#F0F7F2',
  },
  toggleTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  toggleMeta: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 9.5,
  },
  inviteBox: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#D5DFD8',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#F9FBFA',
  },
  inviteLink: {
    color: colors.text,
    fontSize: 11,
    lineHeight: 17,
  },
  copyButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    minHeight: 39,
    borderRadius: 9,
    backgroundColor: colors.greenDark,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
  },
  copyText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  qrCard: {
    marginTop: 14,
    alignItems: 'center',
    gap: 7,
  },
  qr: {
    width: 220,
    height: 220,
    backgroundColor: '#FFFFFF',
  },
  qrText: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
  },
  reviewCard: {
    marginTop: 12,
    borderRadius: 13,
    backgroundColor: '#F6F9F7',
    padding: 13,
  },
  reviewLabel: {
    marginTop: 9,
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  reviewValue: {
    marginTop: 2,
    color: colors.text,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '800',
  },
  launchCard: {
    marginTop: 14,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#EFF7F1',
    padding: 20,
  },
  launchTitle: {
    marginTop: 9,
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  launchText: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
  },
  launchButton: {
    marginTop: 16,
    minWidth: 220,
    minHeight: 48,
    borderRadius: 11,
    backgroundColor: colors.greenDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  launchButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  openButton: {
    marginTop: 9,
    minWidth: 220,
    minHeight: 45,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  openButtonText: {
    color: colors.greenDark,
    fontWeight: '900',
  },
  footer: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  primary: {
    minWidth: 112,
    minHeight: 46,
    borderRadius: 11,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  secondaryButton: {
    minWidth: 96,
    minHeight: 46,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#C7D6CC',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: colors.greenDark,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.45,
  },
});
