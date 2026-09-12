import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import {
  listReportDefinitions,
  setReportDefinitionStatus,
} from '@/lib/buklodReportDomain';
import type { ReportDefinitionRow } from '@/lib/buklodReportContracts';
import { verifyOrganizationManageAccess } from '@/lib/buklodOrganization';
import { colors } from '@/lib/theme';

function firstParam(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim();
  return '';
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function cardTitle(row: ReportDefinitionRow) {
  const requirements = objectValue(row.content_requirements);
  return String(requirements.template_label ?? '').trim() || row.title;
}

function category(row: ReportDefinitionRow) {
  const requirements = objectValue(row.content_requirements);
  if (String(requirements.template_key ?? '') === 'MZB_MINISTERIAL_REPORT_V1') return 'MINISTRY';
  return String(requirements.category ?? 'CUSTOM').toUpperCase();
}

function sourceLabel(row: ReportDefinitionRow) {
  const requirements = objectValue(row.content_requirements);
  if (String(requirements.template_key ?? '') === 'MZB_MINISTERIAL_REPORT_V1') return 'MZB current layout';
  if (requirements.source_file) return 'Uploaded form';
  return 'Custom builder';
}

export default function BuklodReportLibraryScreen() {
  const params = useLocalSearchParams();
  const scopeId = firstParam(params.scopeId ?? params.scope_id ?? params.organization);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [scopeName, setScopeName] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [rows, setRows] = useState<ReportDefinitionRow[]>([]);

  const load = useCallback(async () => {
    if (!scopeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const access = await verifyOrganizationManageAccess(scopeId);
      setAllowed(access.allowed);
      setScopeName(access.scopeName ?? 'Selected scope');
      if (!access.allowed) {
        setRows([]);
        return;
      }
      setRows(await listReportDefinitions(scopeId, includeArchived));
    } catch (error: unknown) {
      Alert.alert('BUKLOD Report', error instanceof Error ? error.message : 'Could not open report library.');
    } finally {
      setLoading(false);
    }
  }, [includeArchived, scopeId]);

  useEffect(() => { void load(); }, [load]);

  const openBuilder = (definitionId?: string) => {
    router.push({
      pathname: '/reports/template-builder',
      params: { scopeId, definitionId: definitionId ?? '' },
    } as any);
  };

  const openDeadlines = (definitionId?: string) => {
    router.push({
      pathname: '/reports/definitions',
      params: { scopeId, definitionId: definitionId ?? '' },
    } as any);
  };

  const openConsolidated = (definitionId: string) => {
    router.push({
      pathname: '/reports/consolidated',
      params: { scopeId, definitionId },
    } as any);
  };

  const archive = async (row: ReportDefinitionRow) => {
    try {
      await setReportDefinitionStatus(row.id, row.status === 'ARCHIVED' ? 'DRAFT' : 'ARCHIVED');
      await load();
    } catch (error: unknown) {
      Alert.alert('BUKLOD Report', error instanceof Error ? error.message : 'Could not update report card.');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Report Library' }} />
      <BuklodPortalScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <MaterialCommunityIcons name="arrow-left" size={19} color={colors.greenDark} />
          <Text style={styles.backText}>BUKLOD Report</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>ORGANIZATION / CLUSTER REPORTING SYSTEM</Text>
          <Text style={styles.heroTitle}>Report Library</Text>
          <Text style={styles.heroText}>
            {scopeName || 'Selected scope'}. Each report card can have its own form, fields and purpose while using the same assignment and submission engine.
          </Text>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.green} /><Text style={styles.note}>Loading report cards…</Text></View>
        ) : !allowed ? (
          <View style={styles.infoCard}><Text style={styles.note}>Exact-scope admin access is required.</Text></View>
        ) : (
          <>
            <View style={styles.createRow}>
              <Pressable onPress={() => openBuilder()} style={styles.primaryButton}>
                <MaterialCommunityIcons name="file-upload-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>Upload / build report</Text>
              </Pressable>
              <Pressable onPress={() => openDeadlines()} style={styles.secondaryButton}>
                <MaterialCommunityIcons name="calendar-clock-outline" size={17} color={colors.greenDark} />
                <Text style={styles.secondaryText}>Deadline manager</Text>
              </Pressable>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Show archived</Text>
              <Switch value={includeArchived} onValueChange={setIncludeArchived} />
            </View>

            {rows.length === 0 ? (
              <View style={styles.infoCard}>
                <MaterialCommunityIcons name="file-document-plus-outline" size={24} color={colors.greenDark} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>No report cards yet</Text>
                  <Text style={styles.note}>Upload the Organization/Cluster reporting layout or build a form manually.</Text>
                </View>
              </View>
            ) : rows.map((row) => (
              <View key={row.id} style={[styles.reportCard, row.status === 'ARCHIVED' && styles.archived]}>
                <View style={styles.reportHead}>
                  <View style={styles.reportIcon}>
                    <MaterialCommunityIcons
                      name={sourceLabel(row) === 'MZB current layout' ? 'church-outline' : 'file-document-edit-outline'}
                      size={23}
                      color={colors.greenDark}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.category}>{category(row)}</Text>
                    <Text style={styles.reportTitle}>{cardTitle(row)}</Text>
                    <Text style={styles.reportMeta}>{sourceLabel(row)} · {row.recurrence_kind} · {row.status}</Text>
                  </View>
                </View>

                {row.description ? <Text style={styles.description}>{row.description}</Text> : null}

                <View style={styles.actions}>
                  <Pressable onPress={() => openBuilder(row.id)} style={styles.actionButton}>
                    <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.greenDark} />
                    <Text style={styles.actionText}>Template</Text>
                  </Pressable>
                  {row.status !== 'ARCHIVED' ? (
                    <Pressable onPress={() => openDeadlines(row.id)} style={styles.actionButton}>
                      <MaterialCommunityIcons name="bell-plus-outline" size={16} color={colors.greenDark} />
                      <Text style={styles.actionText}>Deadline</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => openConsolidated(row.id)} style={styles.actionButton}>
                    <MaterialCommunityIcons name="file-chart-outline" size={16} color={colors.greenDark} />
                    <Text style={styles.actionText}>Consolidated</Text>
                  </Pressable>
                  <Pressable onPress={() => void archive(row)} style={styles.actionButton}>
                    <MaterialCommunityIcons name={row.status === 'ARCHIVED' ? 'restore' : 'archive-outline'} size={16} color={colors.muted} />
                    <Text style={styles.actionText}>{row.status === 'ARCHIVED' ? 'Restore' : 'Archive'}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}
      </BuklodPortalScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, gap: 12, backgroundColor: colors.background },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  hero: { borderRadius: 18, padding: 16, backgroundColor: colors.greenDark, gap: 5 },
  heroEyebrow: { color: 'rgba(255,255,255,0.68)', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  heroText: { color: 'rgba(255,255,255,0.86)', fontSize: 11, lineHeight: 16 },
  center: { paddingVertical: 28, alignItems: 'center', gap: 8 },
  note: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  createRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryButton: { minHeight: 43, borderRadius: 10, paddingHorizontal: 13, backgroundColor: colors.greenDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  secondaryButton: { minHeight: 43, borderRadius: 10, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secondaryText: { color: colors.greenDark, fontSize: 11, fontWeight: '900' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  infoCard: { borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF', padding: 13, flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  cardTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  reportCard: { borderRadius: 16, borderWidth: 1, borderColor: '#DCE5E0', backgroundColor: '#FFFFFF', padding: 13, gap: 10 },
  archived: { opacity: 0.58 },
  reportHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reportIcon: { width: 43, height: 43, borderRadius: 12, backgroundColor: '#EAF5EF', alignItems: 'center', justifyContent: 'center' },
  category: { color: '#61766C', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  reportTitle: { color: '#173B2F', fontSize: 15, fontWeight: '900' },
  reportMeta: { marginTop: 2, color: colors.muted, fontSize: 9 },
  description: { color: '#51635A', fontSize: 10, lineHeight: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actionButton: { minHeight: 34, borderRadius: 9, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { color: colors.greenDark, fontSize: 9, fontWeight: '900' },
});
