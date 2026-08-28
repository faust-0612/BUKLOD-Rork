/* PATCH_175A_ORGANIZATION_ADMINS */
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
import { colors } from '@/lib/theme';
import { readOrganizationScopeId } from '@/lib/buklodOrganization';

type AdminRow = {
  user_id: string;
  full_name: string;
  username: string | null;
  membership_status: string | null;
  assigned_at: string | null;
};
type SearchRow = {
  user_id: string;
  full_name: string;
  username: string | null;
  mobile: string | null;
  email: string | null;
  membership_status: string | null;
};
type LogRow = {
  id: string;
  action_key: string;
  actor_name: string | null;
  target_name: string | null;
  created_at: string;
  details: Record<string, any> | null;
};

export default function OrganizationAdminsScreen() {
  const params = useLocalSearchParams<{ organization?: string; action?: string }>();
  const scopeId = readOrganizationScopeId(params as Record<string, unknown>);
  const requestedAction = String(params.action ?? 'list');
  const [action, setAction] = useState(requestedAction === 'activity' ? 'activity' : requestedAction === 'add' ? 'add' : 'list');
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    if (!scopeId) return;
    setLoading(true);
    try {
      const [{ data: adminData, error: adminError }, { data: logData, error: logError }] =
        await Promise.all([
          (supabase as any).rpc('buklod_org_list_admins_v1', { _scope_id: scopeId }),
          (supabase as any).rpc('buklod_org_admin_log_v1', { _scope_id: scopeId, _limit: 100 }),
        ]);
      if (adminError) throw adminError;
      if (logError) throw logError;
      setAdmins((adminData ?? []) as AdminRow[]);
      setLogs((logData ?? []) as LogRow[]);
    } catch (error: any) {
      Alert.alert('Admins & Roles', String(error?.message ?? error));
    } finally {
      setLoading(false);
    }
  }, [scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (action !== 'add') return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data, error } = await (supabase as any).rpc(
          'buklod_org_search_users',
          { _scope_id: scopeId, _query: q },
        );
        if (cancelled) return;
        if (error) throw error;
        setResults((data ?? []) as SearchRow[]);
      } catch (error: any) {
        if (!cancelled) {
          Alert.alert('Search Users', String(error?.message ?? error));
          setResults([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [action, query, scopeId]);

  const adminIds = useMemo(() => new Set(admins.map(row => row.user_id)), [admins]);

  const setAdmin = async (userId: string, enabled: boolean) => {
    if (busyId) return;
    setBusyId(userId);
    try {
      const { error } = await (supabase as any).rpc(
        'buklod_org_set_admin_v1',
        { _scope_id: scopeId, _user_id: userId, _enabled: enabled },
      );
      if (error) throw error;
      if (enabled) {
        setQuery('');
        setResults([]);
      }
      await load();
    } catch (error: any) {
      Alert.alert(
        enabled ? 'Could Not Add Admin' : 'Could Not Remove Admin',
        String(error?.message ?? error),
      );
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = (row: AdminRow) =>
    Alert.alert(
      'Remove Organization Admin?',
      `${row.full_name} will lose Organization Admin controls but their membership is not automatically deleted.`,
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'REMOVE ADMIN',
          style: 'destructive',
          onPress: () => void setAdmin(row.user_id, false),
        },
      ],
    );

  return (
    <BuklodPortalScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={() => router.back()} style={styles.back}>
        <MaterialCommunityIcons name="arrow-left" size={20} color={colors.greenDark} />
        <Text style={styles.backText}>Admins & Roles</Text>
      </Pressable>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>ORGANIZATION ADMIN</Text>
        <Text style={styles.title}>Admins & Roles</Text>
        <Text style={styles.subtitle}>
          Admin rights are exact-scope management rights. Normal active members keep member access without admin controls.
        </Text>
      </View>

      <View style={styles.tabs}>
        {[
          ['list', 'ADMINS'],
          ['add', 'ADD ADMIN'],
          ['activity', 'ACTIVITY'],
        ].map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setAction(key)}
            style={[styles.tab, action === key && styles.tabOn]}
          >
            <Text style={[styles.tabText, action === key && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={colors.greenDark} /></View>
      ) : action === 'add' ? (
        <>
          <Text style={styles.label}>SEARCH BUKLOD USER</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Name, username, mobile or email"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            style={styles.input}
          />
          {searching && <ActivityIndicator style={{ marginTop: 12 }} color={colors.greenDark} />}
          <View style={styles.card}>
            {results.map(row => {
              const alreadyAdmin = adminIds.has(row.user_id);
              const activeMember =
                String(row.membership_status ?? '').toUpperCase() === 'ACTIVE';
              return (
                <View key={row.user_id} style={styles.row}>
                  <View style={styles.avatar}>
                    <MaterialCommunityIcons name="account-outline" size={20} color={colors.greenDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{row.full_name}</Text>
                    <Text style={styles.meta}>
                      {row.username ? `@${row.username}` : row.mobile ?? row.email ?? 'BUKLOD user'}
                      {row.membership_status ? `  •  ${row.membership_status}` : ''}
                    </Text>
                  </View>
                  {alreadyAdmin ? (
                    <Text style={styles.activeTag}>ADMIN</Text>
                  ) : !activeMember ? (
                    <Text style={styles.memberFirstTag}>ACTIVE MEMBER FIRST</Text>
                  ) : (
                    <Pressable
                      disabled={busyId === row.user_id}
                      onPress={() => void setAdmin(row.user_id, true)}
                      style={styles.addButton}
                    >
                      {busyId === row.user_id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.addText}>MAKE ADMIN</Text>
                      )}
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        </>
      ) : action === 'activity' ? (
        <View style={styles.card}>
          {logs.length === 0 ? (
            <Text style={styles.empty}>No admin activity recorded yet.</Text>
          ) : logs.map(log => (
            <View key={log.id} style={styles.logRow}>
              <Text style={styles.logAction}>{log.action_key.replace(/_/g, ' ')}</Text>
              <Text style={styles.logMeta}>
                {log.actor_name ?? 'Admin'}
                {log.target_name ? ` → ${log.target_name}` : ''}
              </Text>
              <Text style={styles.logDate}>{new Date(log.created_at).toLocaleString()}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.card}>
          {admins.length === 0 ? (
            <Text style={styles.empty}>No Organization Admin found.</Text>
          ) : admins.map(row => (
            <View key={row.user_id} style={styles.row}>
              <View style={styles.avatar}>
                <MaterialCommunityIcons name="shield-account-outline" size={20} color={colors.greenDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{row.full_name}</Text>
                <Text style={styles.meta}>
                  {row.username ? `@${row.username}` : 'Organization Admin'}
                  {row.membership_status ? `  •  ${row.membership_status}` : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => confirmRemove(row)}
                style={styles.removeButton}
              >
                <Text style={styles.removeText}>REMOVE</Text>
              </Pressable>
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
  hero: { borderRadius: 20, padding: 17, backgroundColor: colors.greenDark, marginBottom: 12 },
  eyebrow: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8, color: 'rgba(255,255,255,0.72)' },
  title: { marginTop: 5, fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  subtitle: { marginTop: 6, fontSize: 10.5, lineHeight: 15, color: 'rgba(255,255,255,0.82)' },
  tabs: { flexDirection: 'row', gap: 7, marginBottom: 14 },
  tab: { flex: 1, minHeight: 38, borderWidth: 1, borderColor: colors.line, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  tabOn: { borderColor: colors.greenDark, backgroundColor: colors.greenSoft },
  tabText: { fontSize: 8, fontWeight: '900', color: colors.muted },
  tabTextOn: { color: colors.greenDark },
  label: { marginBottom: 5, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5, color: colors.greenDark },
  input: { minHeight: 45, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingHorizontal: 11, color: colors.text, backgroundColor: '#FFFFFF' },
  loading: { minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  card: { marginTop: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 18, paddingHorizontal: 12, backgroundColor: colors.white, overflow: 'hidden' },
  row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 9 },
  avatar: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenSoft },
  name: { fontSize: 11, fontWeight: '900', color: colors.text },
  meta: { marginTop: 3, fontSize: 8.5, color: colors.muted },
  activeTag: { fontSize: 8, fontWeight: '900', color: '#166534' },
  memberFirstTag: { maxWidth: 92, textAlign: 'center', fontSize: 7.2, lineHeight: 10, fontWeight: '900', color: '#92400E' },
  addButton: { minWidth: 78, minHeight: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, backgroundColor: colors.greenDark },
  addText: { fontSize: 7.8, fontWeight: '900', color: '#FFFFFF' },
  removeButton: { minHeight: 32, borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, backgroundColor: '#FEE2E2' },
  removeText: { fontSize: 7.8, fontWeight: '900', color: '#991B1B' },
  empty: { paddingVertical: 30, textAlign: 'center', fontSize: 10, color: colors.muted },
  logRow: { minHeight: 66, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 10 },
  logAction: { fontSize: 10, fontWeight: '900', color: colors.text, textTransform: 'uppercase' },
  logMeta: { marginTop: 3, fontSize: 9, color: colors.muted },
  logDate: { marginTop: 3, fontSize: 8, color: colors.muted },
});
