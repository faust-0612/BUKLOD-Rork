/* PATCH_175A_ORGANIZATION_ADMIN_MODULE */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import BuklodPortalScrollView from '@/components/BuklodPortalScrollView';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  enqueuePendingAction,
  orgAdminRecordsCacheKey,
  readOfflineCache,
  writeOfflineCache,
  type BuklodSyncStatus,
} from '@/lib/buklodOfflineSync';
import { BuklodSyncStatusBadge } from '@/components/BuklodSyncStatusBadge';
import { useNetwork } from '@/providers/NetworkProvider';
import { colors } from '@/lib/theme';
import { readOrganizationScopeId } from '@/lib/buklodOrganization';

type AdminRecord = {
  id: string;
  module_key: string;
  title: string;
  body: string | null;
  status: string;
  sort_order: number;
  is_pinned: boolean;
  starts_at: string | null;
  ends_at: string | null;
  payload: Record<string, any>;
  created_at: string;
  updated_at: string;
};

type Overview = {
  active_members?: number;
  active_admins?: number;
  suborganizations?: number;
  total_records?: number;
  announcements?: number;
  events?: number;
  resources?: number;
};

const STATUSES = ['DRAFT', 'ACTIVE', 'PUBLISHED', 'COMPLETED', 'ARCHIVED'] as const;

type AdminModuleCache = {
  records: AdminRecord[];
  overview: Overview;
};

export default function OrganizationAdminModuleScreen() {
  const params = useLocalSearchParams<{
    organization?: string;
    module?: string;
    title?: string;
    mode?: string;
  }>();

  const scopeId = readOrganizationScopeId(params as Record<string, unknown>);
  const moduleKey = typeof params.module === 'string' ? params.module : 'custom_module';
  const screenTitle = typeof params.title === 'string' ? params.title : 'Organization Records';
  const mode = typeof params.mode === 'string' ? params.mode : 'manage';

  const { online } = useNetwork();

  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [overview, setOverview] = useState<Overview>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] =
    useState<BuklodSyncStatus | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('ACTIVE');
  const [pinned, setPinned] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [url, setUrl] = useState('');
  const [location, setLocation] = useState('');
  const [value, setValue] = useState('');
  const [target, setTarget] = useState('');

  const load = useCallback(async () => {
    if (!scopeId) return;

    const cacheKey = orgAdminRecordsCacheKey(
      scopeId,
      moduleKey,
    );

    const cached = await readOfflineCache<AdminModuleCache>(
      cacheKey,
    );

    if (cached) {
      setRecords(cached.records);
      setOverview(cached.overview);
      setLoading(false);
    } else {
      setLoading(true);
    }

    if (!online) {
      setLoading(false);
      return;
    }

    try {
      const [{ data, error }, { data: overviewData, error: overviewError }] =
        await Promise.all([
          (supabase as any).rpc('buklod_org_list_records_v1', {
            _scope_id: scopeId,
            _module_key: moduleKey,
          }),
          (supabase as any).rpc('buklod_org_overview_v1', {
            _scope_id: scopeId,
          }),
        ]);
      if (error) throw error;
      if (overviewError) throw overviewError;

      const nextRecords = (data ?? []) as AdminRecord[];
      const nextOverview = (overviewData ?? {}) as Overview;

      setRecords(nextRecords);
      setOverview(nextOverview);

      await writeOfflineCache(
        cacheKey,
        {
          records: nextRecords,
          overview: nextOverview,
        },
        'network',
      );
    } catch (error: any) {
      if (!cached) {
        Alert.alert(screenTitle, String(error?.message ?? error));
      }
    } finally {
      setLoading(false);
    }
  }, [moduleKey, online, scopeId, screenTitle]);

  useEffect(() => {
    void load();
  }, [load]);

  const reset = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setStatus('ACTIVE');
    setPinned(false);
    setStartsAt('');
    setEndsAt('');
    setUrl('');
    setLocation('');
    setValue('');
    setTarget('');
  };

  const edit = (row: AdminRecord) => {
    setEditingId(row.id);
    setTitle(row.title ?? '');
    setBody(row.body ?? '');
    setStatus((STATUSES.includes(row.status as any) ? row.status : 'ACTIVE') as any);
    setPinned(Boolean(row.is_pinned));
    setStartsAt(row.starts_at ?? '');
    setEndsAt(row.ends_at ?? '');
    setUrl(String(row.payload?.url ?? ''));
    setLocation(String(row.payload?.location ?? ''));
    setValue(String(row.payload?.value ?? ''));
    setTarget(String(row.payload?.target ?? ''));
  };

  const save = async () => {
    if (!title.trim()) {
      Alert.alert(screenTitle, 'Enter a title or record name.');
      return;
    }
    setBusy(true);

    const payload = {
      _scope_id: scopeId,
      _module_key: moduleKey,
      _record_id: editingId,
      _title: title.trim(),
      _body: body.trim() || null,
      _status: status,
      _is_pinned: pinned,
      _starts_at: startsAt.trim() || null,
      _ends_at: endsAt.trim() || null,
      _payload: {
        url: url.trim(),
        location: location.trim(),
        value: value.trim(),
        target: target.trim(),
        mode,
      },
    };

    try {
      if (!online) {
        await enqueuePendingAction({
          type: 'org_upsert_record',
          scopeKey: `${scopeId}:${moduleKey}`,
          label: title.trim(),
          payload,
        });

        const localId =
          editingId ??
          `offline_${Date.now()}`;
        const now = new Date().toISOString();
        const optimistic: AdminRecord = {
          id: localId,
          module_key: moduleKey,
          title: title.trim(),
          body: body.trim() || null,
          status,
          sort_order: 0,
          is_pinned: pinned,
          starts_at: startsAt.trim() || null,
          ends_at: endsAt.trim() || null,
          payload: payload._payload,
          created_at: now,
          updated_at: now,
        };

        setRecords((current) => {
          const without = current.filter(
            (row) => row.id !== localId,
          );
          return [optimistic, ...without];
        });

        setSaveStatus('saved_offline');
        reset();
        return;
      }

      const { error } = await (supabase as any).rpc(
        'buklod_org_upsert_record_v1',
        payload,
      );
      if (error) throw error;
      setSaveStatus('synced');
      reset();
      await load();
    } catch (error: any) {
      setSaveStatus('failed_to_sync');
      Alert.alert('Could Not Save', String(error?.message ?? error));
    } finally {
      setBusy(false);
    }
  };

  const remove = (row: AdminRecord) => {
    Alert.alert(
      'Delete Record?',
      row.title,
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'DELETE',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await (supabase as any).rpc(
                'buklod_org_delete_record_v1',
                { _scope_id: scopeId, _record_id: row.id },
              );
              if (error) throw error;
              if (editingId === row.id) reset();
              await load();
            } catch (error: any) {
              Alert.alert('Could Not Delete', String(error?.message ?? error));
            }
          },
        },
      ],
    );
  };

  const filtered = useMemo(() => {
    if (mode === 'archive') return records.filter(row => row.status === 'ARCHIVED');
    if (mode === 'published') return records.filter(row => row.status === 'PUBLISHED');
    if (mode === 'pinned') return records.filter(row => row.is_pinned);
    return records;
  }, [mode, records]);

  const reportLike =
    mode === 'report' ||
    moduleKey.startsWith('reports') ||
    moduleKey.includes('monitoring');

  return (
    <BuklodPortalScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => router.back()} style={styles.back}>
        <MaterialCommunityIcons name="arrow-left" size={20} color={colors.greenDark} />
        <Text style={styles.backText}>Organization Management</Text>
      </Pressable>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{moduleKey.replace(/_/g, ' ').toUpperCase()}</Text>
        <Text style={styles.title}>{screenTitle}</Text>
        <Text style={styles.subtitle}>
          Live records for this exact Organization scope. Create, edit, publish, pin, archive or delete entries here.
        </Text>
      </View>

      {reportLike && (
        <>
          <Text style={styles.section}>LIVE OVERVIEW</Text>
          <View style={styles.stats}>
            {[
              ['MEMBERS', overview.active_members ?? 0],
              ['ADMINS', overview.active_admins ?? 0],
              ['SUB-ORGS', overview.suborganizations ?? 0],
              ['RECORDS', overview.total_records ?? 0],
              ['ANNOUNCE', overview.announcements ?? 0],
              ['EVENTS', overview.events ?? 0],
            ].map(([label, number]) => (
              <View key={String(label)} style={styles.stat}>
                <Text style={styles.statNumber}>{String(number)}</Text>
                <Text style={styles.statLabel}>{String(label)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <Text style={styles.section}>{editingId ? 'EDIT RECORD' : 'NEW RECORD'}</Text>
      <View style={styles.cardPad}>
        <Text style={styles.label}>TITLE / NAME</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Title or record name"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        <Text style={[styles.label, styles.topGap]}>DETAILS / NOTES</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Details, description, notes, content or instructions"
          placeholderTextColor={colors.muted}
          multiline
          style={[styles.input, styles.multiline]}
        />

        <Text style={[styles.label, styles.topGap]}>STATUS</Text>
        <View style={styles.choiceWrap}>
          {STATUSES.map(item => (
            <Pressable
              key={item}
              onPress={() => setStatus(item)}
              style={[styles.choice, status === item && styles.choiceOn]}
            >
              <Text style={[styles.choiceText, status === item && styles.choiceTextOn]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, styles.topGap]}>START / DATE</Text>
            <TextInput
              value={startsAt}
              onChangeText={setStartsAt}
              placeholder="2026-08-15 18:00"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, styles.topGap]}>END / DEADLINE</Text>
            <TextInput
              value={endsAt}
              onChangeText={setEndsAt}
              placeholder="Optional"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </View>
        </View>

        <Text style={[styles.label, styles.topGap]}>URL / FILE / RESOURCE LINK</Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://..."
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          style={styles.input}
        />

        <Text style={[styles.label, styles.topGap]}>LOCATION</Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="Place / venue / area"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, styles.topGap]}>VALUE / RESULT</Text>
            <TextInput value={value} onChangeText={setValue} placeholder="Optional" placeholderTextColor={colors.muted} style={styles.input} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, styles.topGap]}>TARGET</Text>
            <TextInput value={target} onChangeText={setTarget} placeholder="Optional" placeholderTextColor={colors.muted} style={styles.input} />
          </View>
        </View>

        <Pressable
          onPress={() => setPinned(value => !value)}
          style={[styles.pin, pinned && styles.pinOn]}
        >
          <MaterialCommunityIcons
            name={pinned ? 'pin' : 'pin-outline'}
            size={17}
            color={colors.greenDark}
          />
          <Text style={styles.pinText}>{pinned ? 'PINNED / PRIORITY' : 'PIN / MARK PRIORITY'}</Text>
        </Pressable>

        <View style={styles.formActions}>
          {saveStatus ? (
            <BuklodSyncStatusBadge status={saveStatus} />
          ) : null}
          {editingId && (
            <Pressable onPress={reset} style={styles.secondary}>
              <Text style={styles.secondaryText}>CANCEL EDIT</Text>
            </Pressable>
          )}
          <Pressable
            disabled={busy}
            onPress={() => void save()}
            style={[styles.primary, busy && { opacity: 0.55 }]}
          >
            {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
            <Text style={styles.primaryText}>
              {!online
                ? 'SAVE OFFLINE'
                : editingId
                  ? 'SAVE CHANGES'
                  : 'CREATE RECORD'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.section}>RECORDS</Text>
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.greenDark} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyText}>No records in this view.</Text></View>
      ) : (
        <View style={styles.card}>
          {filtered.map(row => (
            <View key={row.id} style={styles.record}>
              <View style={{ flex: 1 }}>
                <View style={styles.recordTitleLine}>
                  {row.is_pinned && <MaterialCommunityIcons name="pin" size={13} color={colors.greenDark} />}
                  <Text style={styles.recordTitle}>{row.title}</Text>
                </View>
                <Text style={styles.recordMeta}>
                  {row.status}
                  {row.id.startsWith('offline_')
                    ? '  •  Saved Offline'
                    : ''}
                  {row.starts_at ? `  •  ${new Date(row.starts_at).toLocaleString()}` : ''}
                </Text>
                {row.body ? <Text numberOfLines={3} style={styles.recordBody}>{row.body}</Text> : null}
                {row.payload?.url ? <Text numberOfLines={1} style={styles.link}>{String(row.payload.url)}</Text> : null}
              </View>
              <View style={styles.recordActions}>
                <Pressable onPress={() => edit(row)} style={styles.iconButton}>
                  <MaterialCommunityIcons name="pencil-outline" size={17} color={colors.greenDark} />
                </Pressable>
                <Pressable onPress={() => remove(row)} style={styles.iconButtonDanger}>
                  <MaterialCommunityIcons name="trash-can-outline" size={17} color="#B42318" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </BuklodPortalScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 16 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backText: { fontSize: 10.5, fontWeight: '800', color: colors.greenDark },
  hero: { borderRadius: 20, padding: 17, backgroundColor: colors.greenDark, marginBottom: 14 },
  eyebrow: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8, color: 'rgba(255,255,255,0.72)' },
  title: { marginTop: 5, fontSize: 21, fontWeight: '900', color: '#FFFFFF' },
  subtitle: { marginTop: 6, fontSize: 10.5, lineHeight: 15, color: 'rgba(255,255,255,0.82)' },
  section: { marginBottom: 7, marginTop: 3, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.75, color: colors.greenDark },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  stat: { width: '31%', minHeight: 64, flexGrow: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  statNumber: { fontSize: 18, fontWeight: '900', color: colors.greenDark },
  statLabel: { marginTop: 2, fontSize: 7.5, fontWeight: '900', color: colors.muted },
  cardPad: { borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, backgroundColor: colors.white, marginBottom: 14 },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: 18, paddingHorizontal: 12, backgroundColor: colors.white, overflow: 'hidden' },
  label: { marginBottom: 5, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5, color: colors.greenDark },
  topGap: { marginTop: 12 },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, color: colors.text, backgroundColor: '#FFFFFF' },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  twoCol: { flexDirection: 'row', gap: 8 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: { minHeight: 32, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  choiceOn: { borderColor: colors.greenDark, backgroundColor: colors.greenSoft },
  choiceText: { fontSize: 7.7, fontWeight: '900', color: colors.muted },
  choiceTextOn: { color: colors.greenDark },
  pin: { marginTop: 13, minHeight: 38, borderWidth: 1, borderColor: colors.line, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFFFFF' },
  pinOn: { borderColor: colors.greenDark, backgroundColor: colors.greenSoft },
  pinText: { fontSize: 8, fontWeight: '900', color: colors.greenDark },
  formActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  primary: { flex: 1, minHeight: 44, borderRadius: 12, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenDark },
  primaryText: { fontSize: 8.5, fontWeight: '900', color: '#FFFFFF' },
  secondary: { minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, backgroundColor: '#FFFFFF' },
  secondaryText: { fontSize: 8, fontWeight: '900', color: colors.greenDark },
  loading: { minHeight: 140, alignItems: 'center', justifyContent: 'center' },
  empty: { minHeight: 120, borderWidth: 1, borderColor: colors.line, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  emptyText: { fontSize: 10, color: colors.muted },
  record: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 10 },
  recordTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  recordTitle: { flex: 1, fontSize: 11, fontWeight: '900', color: colors.text },
  recordMeta: { marginTop: 3, fontSize: 8, fontWeight: '800', color: colors.greenDark },
  recordBody: { marginTop: 4, fontSize: 9, lineHeight: 13, color: colors.muted },
  link: { marginTop: 3, fontSize: 8.5, color: colors.greenDark },
  recordActions: { flexDirection: 'row', gap: 5 },
  iconButton: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenSoft },
  iconButtonDanger: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0EF' },
});
