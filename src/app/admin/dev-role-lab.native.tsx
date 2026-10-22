import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';
import BuklodAdMobBanner from '@/components/BuklodAdMobBanner';
import BuklodAdFillDiagnostics from '@/components/BuklodAdFillDiagnostics';
import { getBuklodAdsDiagnostics } from '@/lib/buklodAds';

type DevRole =
  | 'PUBLIC_USER'
  | 'LOCAL_MEMBER'
  | 'CLUSTER_MEMBER'
  | 'CLUSTER_ADMIN'
  | 'CHURCH_MEMBER'
  | 'CHURCH_ADMIN'
  | 'MZB_MEMBER'
  | 'MZB_WORKER'
  | 'MZB_MISSIONARY'
  | 'MZB_DEACON'
  | 'MZB_PASTOR'
  | 'MZB_LEADERSHIP'
  | 'MZB_OFFICE_STAFF'
  | 'ORG_ADMIN'
  | 'SYSTEM_ADMIN';

type FaithMode = 'CHRISTIAN' | 'NON_CHRISTIAN' | 'PREFER_NOT_TO_SAY';

type ScopeRow = {
  scope_id: string;
  scope_type: string;
  name: string;
  scope_status?: string | null;
  visibility?: string | null;
  geo_level?: string | null;
  membership_status?: string | null;
  role_keys: string[];
  is_admin: boolean;
  member_count?: number | null;
  show_faith_content?: boolean | null;
  feature_keys: string[];
  is_active_scope?: boolean;
};


const ROLE_OPTIONS: Array<{ key: DevRole; label: string; group: string }> = [
  { key: 'PUBLIC_USER', label: 'Public User', group: 'General' },
  { key: 'LOCAL_MEMBER', label: 'Local Member', group: 'Local' },
  { key: 'CLUSTER_MEMBER', label: 'Cluster Member', group: 'Cluster' },
  { key: 'CLUSTER_ADMIN', label: 'Cluster Admin', group: 'Cluster' },
  { key: 'CHURCH_MEMBER', label: 'Church Member', group: 'Church' },
  { key: 'CHURCH_ADMIN', label: 'Church Admin', group: 'Church' },
  { key: 'MZB_MEMBER', label: 'MZB Member', group: 'MZB' },
  { key: 'MZB_WORKER', label: 'Worker', group: 'MZB' },
  { key: 'MZB_MISSIONARY', label: 'Missionary', group: 'MZB' },
  { key: 'MZB_DEACON', label: 'Deacon', group: 'MZB' },
  { key: 'MZB_PASTOR', label: 'Pastor', group: 'MZB' },
  { key: 'MZB_LEADERSHIP', label: 'Leadership', group: 'MZB' },
  { key: 'MZB_OFFICE_STAFF', label: 'Office Staff', group: 'MZB' },
  { key: 'ORG_ADMIN', label: 'Organization Admin', group: 'MZB' },
  { key: 'SYSTEM_ADMIN', label: 'System Admin', group: 'System' },
];

const FAITH_OPTIONS: Array<{ key: FaithMode; label: string }> = [
  { key: 'CHRISTIAN', label: 'Christian' },
  { key: 'NON_CHRISTIAN', label: 'Non-Christian' },
  { key: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

function currentEnvironment() {
  return (process.env.EXPO_PUBLIC_APP_ENV ?? 'production').trim().toLowerCase();
}

function buildPermissions(
  role: DevRole,
  scopeType: string | null,
  tithes: boolean,
  bayanihan: boolean,
  learn: boolean
) {
  const system = role === 'SYSTEM_ADMIN';
  const clusterAdmin = system || (role === 'CLUSTER_ADMIN' && scopeType === 'CLUSTER');
  const churchAdmin = system || (role === 'CHURCH_ADMIN' && scopeType === 'CHURCH');
  const orgAdmin = system || (role === 'ORG_ADMIN' && scopeType === 'ORGANIZATION');
  const members =
    system ||
    clusterAdmin ||
    churchAdmin ||
    orgAdmin ||
    ['MZB_DEACON', 'MZB_PASTOR', 'MZB_LEADERSHIP', 'MZB_OFFICE_STAFF'].includes(role);
  const moderate =
    system || clusterAdmin || churchAdmin || orgAdmin || role === 'MZB_LEADERSHIP';

  return [
    ['Generic / Public Home', true],
    ['Scoped Home', true],
    ['Community Read', true],
    ['Community Post', true],
    ['Connect', true],
    ['Member Directory', members],
    ['Community Moderation', moderate],
    ['Invite / Remove Members', clusterAdmin || churchAdmin || orgAdmin || system],
    ['Scope Settings', clusterAdmin || churchAdmin || orgAdmin || system],
    ['Tithes', tithes],
    ['Bayanihan', bayanihan],
    ['Restricted Learn', learn],
    ['System Administration', system],
  ] as Array<[string, boolean]>;
}

export default function DeveloperRoleLabScreen() {
  const { roles, hasRole } = useAuth();

  const [scopes, setScopes] = useState<ScopeRow[]>([]);
  const [activeScope, setActiveScope] = useState<ScopeRow | null>(null);
  const [scopesLoading, setScopesLoading] = useState(true);

  const [role, setRole] = useState<DevRole>('PUBLIC_USER');
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [faithMode, setFaithMode] = useState<FaithMode>('CHRISTIAN');
  const [tithes, setTithes] = useState(false);
  const [bayanihan, setBayanihan] = useState(false);
  const [learn, setLearn] = useState(false);
  const [ads, setAds] = useState<any>(null);
  const [adBusy, setAdBusy] = useState(false);
  const [feedDebug, setFeedDebug] = useState<any[]>([]);
  const [feedBusy, setFeedBusy] = useState(false);

  const environment = currentEnvironment();
  const isSystemAdmin = hasRole('system_admin');
  const allowedEnvironment = environment !== 'production';

  async function loadScopes() {
    setScopesLoading(true);

    try {
      const { data, error } = await (supabase as any)
        .rpc('buklod_my_scopes');

      if (error) {
        throw error;
      }

      const rows = (Array.isArray(data) ? data : []) as ScopeRow[];

      setScopes(rows);

      const current =
        rows.find((item: ScopeRow) => item.is_active_scope) ??
        rows.find((item: ScopeRow) => item.scope_type === 'PUBLIC') ??
        rows[0] ??
        null;

      setActiveScope(current);

      setScopeId((previous) =>
        previous &&
        rows.some((item: ScopeRow) => item.scope_id === previous)
          ? previous
          : current?.scope_id ?? null
      );
    } catch (error: any) {
      console.warn(
        'Developer Test Lab scopes:',
        error
      );

      setScopes([]);
      setActiveScope(null);
    } finally {
      setScopesLoading(false);
    }
  }

  useEffect(() => {
    if (isSystemAdmin && allowedEnvironment) {
      void loadScopes();
    } else {
      setScopesLoading(false);
    }
  }, [isSystemAdmin, allowedEnvironment]);

  const simulatedScope = useMemo(
    () => scopes.find((item: ScopeRow) => item.scope_id === scopeId) ?? activeScope ?? null,
    [scopes, scopeId, activeScope]
  );

  useEffect(() => {
    if (!scopeId && activeScope) setScopeId(activeScope.scope_id);
  }, [scopeId, activeScope]);

  useEffect(() => {
    if (!simulatedScope) return;
    setTithes(simulatedScope.feature_keys.includes('restricted.tithes'));
    setBayanihan(simulatedScope.feature_keys.includes('restricted.bayanihan'));
    setLearn(simulatedScope.feature_keys.includes('restricted.learn'));
  }, [simulatedScope?.scope_id]);

  async function refreshAds() {
    setAdBusy(true);
    try {
      setAds(await getBuklodAdsDiagnostics());
    } catch (error: any) {
      Alert.alert('AdMob Diagnostics', String(error?.message ?? error));
    } finally {
      setAdBusy(false);
    }
  }

  async function loadFeedDebug() {
    setFeedBusy(true);

    try {
      const { data, error } = await (supabase as any).rpc(
        'get_buklod_community_feed_v4',
        {
          p_audience: 'public',
          p_mode: 'for_you',
          p_limit: 5,
        }
      );

      if (error) {
        throw error;
      }

      setFeedDebug(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert(
        'Feed Engine',
        String(error?.message ?? error)
      );
    } finally {
      setFeedBusy(false);
    }
  }

  useEffect(() => {
    void refreshAds();
  }, []);

  if (!isSystemAdmin || !allowedEnvironment) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Developer Test Lab</Text>
        <Text style={styles.help}>System Admin + staging/development only.</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/me' as any)}>
          <Text style={styles.primaryText}>RETURN</Text>
        </Pressable>
      </View>
    );
  }

  if (scopesLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.help}>Loading scopes...</Text>
      </View>
    );
  }

  const forceFaith =
    simulatedScope?.scope_type === 'CHURCH' ||
    simulatedScope?.scope_type === 'ORGANIZATION';

  const permissions = buildPermissions(
    role,
    simulatedScope?.scope_type ?? null,
    tithes,
    bayanihan,
    learn
  );

  async function applyRealScope() {
    if (!simulatedScope) return;
    try {
      const { error } = await (supabase as any)
        .rpc(
          'buklod_set_active_scope',
          {
            _scope_id: simulatedScope.scope_id,
          }
        );

      if (error) {
        throw error;
      }

      setActiveScope(simulatedScope);
      await loadScopes();

      Alert.alert(
        'Active Scope',
        `${simulatedScope.name} is now the real active scope. Test role remains simulation-only.`
      );
    } catch (error: any) {
      Alert.alert('Scope', String(error?.message ?? error));
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>
          SYSTEM ADMIN / {environment.toUpperCase()}
        </Text>
        <Text style={styles.heroTitle}>Developer Test Lab</Text>
        <Text style={styles.heroText}>
          Test roles, scopes, faith, entitlements and AdMob without changing real database roles.
        </Text>
      </View>

      <View style={styles.warning}>
        <Text style={styles.warningTitle}>SIMULATION ONLY</Text>
        <Text style={styles.warningText}>
          View As Role affects only this lab's expected permission matrix. It does not grant or impersonate a real Supabase role.
        </Text>
      </View>

      <Card title="Real Account">
        <Info label="Environment" value={environment.toUpperCase()} />
        <Info label="Actual roles" value={roles.length ? roles.join(', ') : 'None'} />
        <Info label="Actual scope" value={activeScope?.name ?? 'Public'} />
      </Card>

      <Card title="1. View As Role">
        <View style={styles.chips}>
          {ROLE_OPTIONS.map((item) => {
            const on = role === item.key;
            return (
              <Pressable
                key={item.key}
                style={[styles.roleChip, on && styles.roleChipOn]}
                onPress={() => setRole(item.key)}
              >
                <Text style={[styles.roleGroup, on && styles.roleTextOn]}>{item.group}</Text>
                <Text style={[styles.roleText, on && styles.roleTextOn]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card title="2. View As Scope">
        {scopes.map((scope: ScopeRow) => {
          const on = simulatedScope?.scope_id === scope.scope_id;
          return (
            <Pressable
              key={scope.scope_id}
              style={[styles.scopeRow, on && styles.scopeRowOn]}
              onPress={() => setScopeId(scope.scope_id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.scopeName}>{scope.name}</Text>
                <Text style={styles.scopeMeta}>
                  {scope.scope_type}
                  {scope.geo_level ? ` | ${scope.geo_level}` : ''}
                  {scope.is_admin ? ' | ADMIN' : ''}
                </Text>
              </View>
              <Text style={on ? styles.selected : styles.unselected}>
                {on ? 'SELECTED' : 'VIEW'}
              </Text>
            </Pressable>
          );
        })}

        {!!simulatedScope && (
          <Pressable style={styles.secondaryButton} onPress={() => void applyRealScope()}>
            <Text style={styles.secondaryText}>USE AS REAL ACTIVE SCOPE</Text>
          </Pressable>
        )}
      </Card>

      <Card title="3. Faith Simulation">
        <View style={styles.chips}>
          {FAITH_OPTIONS.map((item) => {
            const on = faithMode === item.key;
            return (
              <Pressable
                key={item.key}
                disabled={forceFaith}
                style={[styles.smallChip, on && styles.roleChipOn, forceFaith && styles.disabled]}
                onPress={() => setFaithMode(item.key)}
              >
                <Text style={[styles.roleText, on && styles.roleTextOn]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Info
          label="Effective faith content"
          value={forceFaith || faithMode === 'CHRISTIAN' ? 'VISIBLE' : 'HIDDEN'}
        />

        {forceFaith && (
          <Text style={styles.note}>Church / Organization scope forces faith content ON.</Text>
        )}
      </Card>

      <Card title="4. Entitlement Simulation">
        <Toggle label="Tithes" value={tithes} onChange={setTithes} />
        <Toggle label="Bayanihan" value={bayanihan} onChange={setBayanihan} />
        <Toggle label="Restricted Learn" value={learn} onChange={setLearn} />
      </Card>

      <Card title="5. Expected Permission Matrix">
        {permissions.map(([label, allowed]) => (
          <View key={label} style={styles.permissionRow}>
            <Text style={[styles.permissionMark, allowed ? styles.allow : styles.deny]}>
              {allowed ? 'YES' : 'NO'}
            </Text>
            <Text style={styles.permissionLabel}>{label}</Text>
          </View>
        ))}
      </Card>

      <Card title="6. Navigation Sanity Check">
        <Text style={styles.help}>
          These open the real app with your actual System Admin permissions.
        </Text>
        <View style={styles.actions}>
          {[
            ['Home', '/home'],
            ['Community', '/buklod'],
            ['Messages', '/messages'],
            ['Prayer', '/prayer'],
            ['Scope Workspace', '/scope'],
            ['Clusters', '/clusters'],
            ['Churches', '/churches'],
            ['MZB', '/mzb'],
            ['Bible', '/bible'],
            ['Admin', '/admin'],
          ].map(([label, route]) => (
            <Pressable
              key={label}
              style={styles.navButton}
              onPress={() => router.push(route as any)}
            >
              <Text style={styles.navText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card title="7. AdMob Diagnostics">
        <Info label="Ad mode" value={ads?.testMode ? 'GOOGLE TEST ADS' : 'PRODUCTION ADS'} />
        <Info label="Can request ads" value={ads?.canRequestAds ? 'YES' : 'NO / WAITING'} />
        <Info label="Consent status" value={String(ads?.consentStatus ?? 'UNKNOWN')} />
        <Info
          label="Interstitial configured"
          value={ads?.interstitialConfigured ? 'YES' : 'NO'}
        />

        <Pressable
          disabled={adBusy}
          style={[styles.secondaryButton, adBusy && styles.disabled]}
          onPress={() => void refreshAds()}
        >
          <Text style={styles.secondaryText}>
            {adBusy ? 'REFRESHING...' : 'REFRESH AD STATUS'}
          </Text>
        </Pressable>

        <BuklodAdMobBanner placement="test" compact />
        <BuklodAdFillDiagnostics fill={ads?.fill ?? null} />
      </Card>

      <Card title="8. Feed Engine">
        <Text style={styles.help}>
          Live server-side weighted ranking. No AI/ML in this version.
        </Text>

        <View style={styles.feedModes}>
          <Text style={styles.feedChip}>FOR YOU</Text>
          <Text style={styles.feedChip}>LATEST</Text>
          
        </View>

        <Text style={styles.note}>
          Default weights: Recency 40 + Scope Relevance 20 + Interaction Affinity 15 + Content Preference 10 + Engagement 10 + Priority 5.
        </Text>

        <Pressable
          disabled={feedBusy}
          style={[
            styles.secondaryButton,
            feedBusy && styles.disabled,
          ]}
          onPress={() => void loadFeedDebug()}
        >
          <Text style={styles.secondaryText}>
            {feedBusy ? 'LOADING SCORES...' : 'LOAD TOP 5 PUBLIC FOR YOU'}
          </Text>
        </Pressable>

        {feedDebug.map((item, index) => (
          <View key={item.id ?? String(index)} style={styles.feedDebugCard}>
            <View style={styles.feedDebugHeader}>
              <Text style={styles.feedDebugRank}>#{index + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.feedDebugAuthor}>
                  {resolvePersonDisplayName(
                    item.author_name,
                    item.user_id,
                  )}
                </Text>
                <Text style={styles.scopeMeta}>
                  {String(item.category ?? 'post').toUpperCase()} | SCORE {String(item.score_total ?? 0)}
                </Text>
              </View>
            </View>

            <Text style={styles.feedDebugBody} numberOfLines={2}>
              {String(item.body ?? '')}
            </Text>

            <Info label="Recency" value={String(item.score_recency ?? 0)} />
            <Info label="Scope Relevance" value={String(item.score_scope_relevance ?? 0)} />
            <Info label="Interaction Affinity" value={String(item.score_interaction_affinity ?? 0)} />
            <Info label="Content Preference" value={String(item.score_content_preference ?? 0)} />
            <Info label="Engagement" value={String(item.score_engagement ?? 0)} />
            <Info label="Priority" value={String(item.score_priority ?? 0)} />
          </View>
        ))}

        {!feedBusy && feedDebug.length === 0 && (
          <Text style={styles.help}>
            Tap LOAD TOP 5 to inspect why posts rank higher or lower.
          </Text>
        )}
      </Card>

      <View style={{ height: 40 }} />
</ScrollView>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.permissionLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F7F5' },
  content: { padding: 14, gap: 12 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F4F7F5',
    gap: 12,
  },
  title: { color: '#203E31', fontSize: 23, fontWeight: '900' },
  help: { color: '#718078', fontSize: 11, lineHeight: 17 },
  hero: { padding: 17, borderRadius: 18, backgroundColor: '#174D35', gap: 4 },
  heroEyebrow: { color: '#BFE5D1', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
  heroText: { color: '#D7EADF', fontSize: 11, lineHeight: 16 },
  warning: {
    padding: 13,
    borderRadius: 14,
    backgroundColor: '#FFF5D8',
    borderWidth: 1,
    borderColor: '#E8D49E',
  },
  warningTitle: { color: '#765E21', fontSize: 10, fontWeight: '900' },
  warningText: { marginTop: 4, color: '#756744', lineHeight: 18, fontSize: 12 },
  card: {
    padding: 14,
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DFE7E2',
    backgroundColor: '#FFFFFF',
  },
  cardTitle: { color: '#203E31', fontSize: 16, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  roleChip: {
    minWidth: '30%',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FAFBFA',
  },
  smallChip: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#DCE5E0',
    backgroundColor: '#FAFBFA',
  },
  roleChipOn: { borderColor: '#4B8C69', backgroundColor: '#EAF5EF' },
  roleGroup: { color: '#8A9690', fontSize: 8, fontWeight: '800' },
  roleText: { color: '#44564D', fontSize: 10, fontWeight: '800' },
  roleTextOn: { color: '#225B3D' },
  disabled: { opacity: 0.45 },
  scopeRow: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E1E7E3',
  },
  scopeRowOn: { borderColor: '#5A9975', backgroundColor: '#EDF6F1' },
  scopeName: { color: '#31493D', fontWeight: '900', fontSize: 12 },
  scopeMeta: { marginTop: 2, color: '#7C8982', fontSize: 8, fontWeight: '700' },
  selected: { color: '#2D6A4F', fontSize: 8, fontWeight: '900' },
  unselected: { color: '#87938C', fontSize: 8, fontWeight: '800' },
  infoRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2EF',
    gap: 10,
  },
  infoLabel: { flex: 1, color: '#68776F', fontSize: 11 },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    color: '#29493A',
    fontSize: 10,
    fontWeight: '900',
  },
  toggleRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2EF',
  },
  note: {
    padding: 8,
    borderRadius: 9,
    backgroundColor: '#E9F4ED',
    color: '#33664A',
    fontSize: 10,
    lineHeight: 15,
  },
  permissionRow: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1EF',
  },
  permissionMark: { width: 34, fontSize: 9, fontWeight: '900' },
  allow: { color: '#2D6A4F' },
  deny: { color: '#9A4D4D' },
  permissionLabel: { flex: 1, color: '#394D43', fontWeight: '800', fontSize: 11 },
  primaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
    borderRadius: 11,
    backgroundColor: '#2D6A4F',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
  secondaryButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#5D8E75',
    backgroundColor: '#F2F8F4',
  },
  secondaryText: { color: '#316448', fontSize: 10, fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  navButton: {
    width: '48%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#DFE7E2',
    backgroundColor: '#F8FAF9',
  },
  navText: { color: '#385346', fontSize: 10, fontWeight: '900' },
  feedDebugCard: {
    padding: 10,
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DFE7E2',
    backgroundColor: '#FAFCFB',
  },
  feedDebugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedDebugRank: {
    minWidth: 28,
    color: '#2D6A4F',
    fontSize: 16,
    fontWeight: '900',
  },
  feedDebugAuthor: {
    color: '#29493A',
    fontSize: 11,
    fontWeight: '900',
  },
  feedDebugBody: {
    color: '#5A6961',
    fontSize: 10,
    lineHeight: 15,
  },
  feedModes: { flexDirection: 'row', gap: 6 },
  feedChip: {
    flex: 1,
    paddingVertical: 11,
    textAlign: 'center',
    borderRadius: 10,
    overflow: 'hidden',
    color: '#326048',
    backgroundColor: '#EDF4F0',
    fontSize: 9,
    fontWeight: '900',
  },
});
