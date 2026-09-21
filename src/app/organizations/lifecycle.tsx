import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { BuklodFeedbackBanner } from '@/components/BuklodFeedbackBanner';
import { colors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import {
  readOrganizationScopeId,
  verifyOrganizationManageAccess,
} from '@/lib/buklodOrganization';
import {
  readInstitutionWorkspaceConfig,
  writeInstitutionWorkspaceConfig,
  type BuklodInstitutionWorkspaceConfig,
} from '@/lib/buklodOrganizationWorkspace';
import { isReportScopeEntitled } from '@/lib/buklodReportDomain';
import type { BuklodUserFeedback } from '@/lib/buklodUserFeedback';

type Impact = {
  activeMembers: number | null;
  suborganizations: number | null;
  officeFiles: number | null;
  reportEnabled: boolean | null;
};

type ScopeRow = {
  id: string;
  name: string;
  status: string;
  metadata: Record<string, unknown> | null;
};

const LIFECYCLES: Array<{
  key: BuklodInstitutionWorkspaceConfig['lifecycle'];
  description: string;
}> = [
  { key: 'DRAFT', description: 'Configuration is still being prepared.' },
  { key: 'PILOT', description: 'Limited institutional rollout.' },
  { key: 'ACTIVE', description: 'Normal Organization workspace operation.' },
  { key: 'RESTRICTED', description: 'Workspace remains present with restricted operation.' },
  { key: 'READ_ONLY', description: 'Prepared state for read-only institutional operation.' },
  { key: 'ARCHIVED', description: 'Remove from active operation while retaining records.' },
  { key: 'CLOSED', description: 'Closed institution; preserved rather than destructively deleted.' },
];

function feedback(
  tone: 'success' | 'error',
  message: string,
): BuklodUserFeedback {
  return {
    tone,
    category: tone === 'error' ? 'UNKNOWN_ERROR' : null,
    title:
      tone === 'error'
        ? 'Lifecycle not changed'
        : 'Lifecycle updated',
    message,
    nextStep:
      tone === 'error'
        ? 'Review the impact and try again.'
        : null,
    supportCode:
      tone === 'error' ? 'ORG-LIFE-500' : null,
    retryable: tone === 'error',
    needsSupport: tone === 'error',
  };
}

export default function OrganizationLifecycleScreen() {
  const params = useLocalSearchParams();
  const scopeId = readOrganizationScopeId(
    params as Record<string, unknown>,
  );

  const [scope, setScope] = useState<ScopeRow | null>(null);
  const [config, setConfig] =
    useState<BuklodInstitutionWorkspaceConfig | null>(null);
  const [impact, setImpact] = useState<Impact>({
    activeMembers: null,
    suborganizations: null,
    officeFiles: null,
    reportEnabled: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [message, setMessage] =
    useState<BuklodUserFeedback | null>(null);

  const load = useCallback(async () => {
    if (!scopeId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const access =
        await verifyOrganizationManageAccess(scopeId);
      if (!access.allowed) {
        throw new Error(
          "You don't have permission to manage this Organization.",
        );
      }

      const scopeResult = await (supabase as any)
        .from('buklod_scopes')
        .select('id,name,status,metadata')
        .eq('id', scopeId)
        .maybeSingle();

      if (scopeResult.error) throw scopeResult.error;
      if (!scopeResult.data) {
        throw new Error('Organization not found.');
      }

      const row = scopeResult.data as ScopeRow;
      setScope(row);
      setConfig(
        readInstitutionWorkspaceConfig(row.metadata),
      );

      const [
        memberResult,
        childResult,
        fileResult,
        reportResult,
      ] = await Promise.allSettled([
        (supabase as any)
          .from('buklod_scope_memberships')
          .select('user_id', {
            count: 'exact',
            head: true,
          })
          .eq('scope_id', scopeId)
          .eq('membership_status', 'ACTIVE'),
        (supabase as any)
          .from('buklod_scopes')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('parent_scope_id', scopeId)
          .eq('scope_type', 'ORGANIZATION')
          .neq('status', 'DELETED'),
        (supabase as any)
          .from('buklod_office_files')
          .select('id', {
            count: 'exact',
            head: true,
          })
          .eq('scope_id', scopeId)
          .neq('status', 'TRASHED'),
        isReportScopeEntitled(scopeId),
      ]);

      setImpact({
        activeMembers:
          memberResult.status === 'fulfilled' &&
          !memberResult.value.error
            ? Number(memberResult.value.count ?? 0)
            : null,
        suborganizations:
          childResult.status === 'fulfilled' &&
          !childResult.value.error
            ? Number(childResult.value.count ?? 0)
            : null,
        officeFiles:
          fileResult.status === 'fulfilled' &&
          !fileResult.value.error
            ? Number(fileResult.value.count ?? 0)
            : null,
        reportEnabled:
          reportResult.status === 'fulfilled'
            ? reportResult.value
            : null,
      });
    } catch (error) {
      setMessage(
        feedback(
          'error',
          error instanceof Error
            ? error.message
            : 'Lifecycle information could not be loaded.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const highImpact = useMemo(
    () =>
      config?.lifecycle === 'ARCHIVED' ||
      config?.lifecycle === 'CLOSED',
    [config?.lifecycle],
  );

  const changeLifecycle = useCallback(
    async (
      lifecycle: BuklodInstitutionWorkspaceConfig['lifecycle'],
    ) => {
      if (!scope || !config || !scopeId || saving) return;

      const destructiveLike =
        lifecycle === 'ARCHIVED' ||
        lifecycle === 'CLOSED';

      if (
        destructiveLike &&
        confirmName.trim() !== scope.name.trim()
      ) {
        setMessage(
          feedback(
            'error',
            'Type the exact Organization name before archiving or closing it.',
          ),
        );
        return;
      }

      setSaving(true);
      setMessage(null);

      try {
        const nextConfig = {
          ...config,
          lifecycle,
        };

        const metadata =
          writeInstitutionWorkspaceConfig(
            scope.metadata,
            nextConfig,
          );

        // Preserve records. CLOSED maps to archived underlying scope state
        // instead of destructive deletion.
        const status =
          lifecycle === 'ARCHIVED' ||
          lifecycle === 'CLOSED'
            ? 'ARCHIVED'
            : lifecycle === 'RESTRICTED'
              ? 'RESTRICTED'
              : 'ACTIVE';

        const { data, error } = await (supabase as any)
          .from('buklod_scopes')
          .update({
            metadata,
            status,
          })
          .eq('id', scopeId)
          .select('id,name,status,metadata')
          .single();

        if (error) throw error;
        if (!data?.id) {
          throw new Error(
            'The lifecycle change was not confirmed by the server.',
          );
        }

        setScope(data as ScopeRow);
        setConfig(nextConfig);
        setConfirmName('');
        setMessage(
          feedback(
            'success',
            `Organization lifecycle is now ${lifecycle}.`,
          ),
        );
      } catch {
        setMessage(
          feedback(
            'error',
            "BUKLOD couldn't update the Organization lifecycle. No destructive deletion was performed.",
          ),
        );
      } finally {
        setSaving(false);
      }
    },
    [
      config,
      confirmName,
      saving,
      scope,
      scopeId,
    ],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          color={colors.green}
          size="large"
        />
        <Text style={styles.loadingText}>
          Checking Organization impact…
        </Text>
      </View>
    );
  }

  if (!scope || !config) {
    return (
      <View style={styles.center}>
        {message ? (
          <BuklodFeedbackBanner
            feedback={message}
            onRetry={() => void load()}
          />
        ) : null}
      </View>
    );
  }

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

      <Text style={styles.eyebrow}>
        INSTITUTION LIFECYCLE
      </Text>
      <Text style={styles.title}>
        {scope.name}
      </Text>
      <Text style={styles.subtitle}>
        Archive and closure preserve records. This screen never performs a
        destructive Organization delete.
      </Text>

      {message ? (
        <View style={styles.feedback}>
          <BuklodFeedbackBanner
            feedback={message}
            onDismiss={() => setMessage(null)}
          />
        </View>
      ) : null}

      <View style={styles.impactCard}>
        <Text style={styles.sectionTitle}>
          IMPACT PREVIEW
        </Text>
        <View style={styles.metrics}>
          <Metric
            label="Active members"
            value={impact.activeMembers}
          />
          <Metric
            label="Sub-Orgs / units"
            value={impact.suborganizations}
          />
          <Metric
            label="Files"
            value={impact.officeFiles}
          />
          <Metric
            label="BUKLOD Report"
            value={
              impact.reportEnabled == null
                ? null
                : impact.reportEnabled
                  ? 1
                  : 0
            }
            textValue={
              impact.reportEnabled == null
                ? '—'
                : impact.reportEnabled
                  ? 'ENABLED'
                  : 'NOT ENABLED'
            }
          />
        </View>

        <View style={styles.dependency}>
          <Text style={styles.dependencyTitle}>
            Specialized app dependencies
          </Text>
          <Text style={styles.dependencyText}>
            Classroom and Quiz remain independent admission systems and are not
            automatically closed by an Organization lifecycle change. Review
            those apps before archive/closure.
          </Text>
        </View>

        <View style={styles.dependency}>
          <Text style={styles.dependencyTitle}>
            Open support cases
          </Text>
          <Text style={styles.dependencyText}>
            Support-case counts are restricted to BSOC and are not exposed to
            Organization admins here. Archiving an Organization does not erase
            or silently resolve existing support cases.
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          CURRENT: {config.lifecycle}
        </Text>
        <View style={styles.lifecycleList}>
          {LIFECYCLES.map(item => {
            const selected =
              item.key === config.lifecycle;
            return (
              <Pressable
                key={item.key}
                disabled={saving || selected}
                onPress={() =>
                  void changeLifecycle(item.key)
                }
                style={[
                  styles.lifecycle,
                  selected && styles.lifecycleOn,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.lifecycleTitle}>
                    {item.key.replaceAll('_', ' ')}
                  </Text>
                  <Text style={styles.lifecycleText}>
                    {item.description}
                  </Text>
                </View>
                {selected ? (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={20}
                    color={colors.green}
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={colors.muted}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.confirmLabel}>
          Required for ARCHIVED / CLOSED
        </Text>
        <TextInput
          value={confirmName}
          onChangeText={setConfirmName}
          placeholder={scope.name}
          style={styles.input}
        />
        <Text style={styles.confirmHelp}>
          Type the exact Organization name before selecting a high-impact
          lifecycle state.
        </Text>
      </View>
    </ScrollView>
  );
}

function Metric({
  label,
  value,
  textValue,
}: {
  label: string;
  value: number | null;
  textValue?: string;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>
        {textValue ??
          (value == null
            ? '—'
            : value.toLocaleString())}
      </Text>
      <Text style={styles.metricLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F8F6',
  },
  content: {
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    padding: 18,
    paddingBottom: 44,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#F5F8F6',
  },
  loadingText: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 12,
  },
  back: {
    alignSelf: 'flex-start',
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backText: {
    color: colors.greenDark,
    fontWeight: '900',
  },
  eyebrow: {
    marginTop: 8,
    color: colors.green,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  title: {
    marginTop: 4,
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  feedback: {
    marginTop: 12,
  },
  impactCard: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#D8E3DC',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  metric: {
    minWidth: 120,
    flexGrow: 1,
    borderRadius: 11,
    backgroundColor: '#F3F7F4',
    padding: 10,
  },
  metricValue: {
    color: colors.greenDark,
    fontSize: 16,
    fontWeight: '900',
  },
  metricLabel: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
  },
  dependency: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DFE7E2',
    paddingTop: 10,
  },
  dependencyTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  dependencyText: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 10.5,
    lineHeight: 16,
  },
  card: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#D8E3DC',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  lifecycleList: {
    marginTop: 10,
    gap: 6,
  },
  lifecycle: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: '#DCE4DF',
    borderRadius: 11,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lifecycleOn: {
    borderColor: '#B9D7C4',
    backgroundColor: '#EDF7F0',
  },
  lifecycleTitle: {
    color: colors.text,
    fontSize: 11.5,
    fontWeight: '900',
  },
  lifecycleText: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
  },
  confirmLabel: {
    marginTop: 16,
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
  },
  input: {
    marginTop: 6,
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#D2DDD6',
    borderRadius: 10,
    paddingHorizontal: 11,
    color: colors.text,
  },
  confirmHelp: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 9.5,
    lineHeight: 14,
  },
});
