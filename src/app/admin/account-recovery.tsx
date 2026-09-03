import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { useAuth } from '@/providers/AuthProvider';

type RecoveryRequest = {
  id: string;
  user_id: string;
  username: string;
  full_name: string | null;
  status: string;
  created_at: string;
  requested_at?: string | null;
  login_method?: string | null;
  login_hint?: string | null;
  mobile_hint?: string | null;
  birth_date?: string | null;
};

function methodLabel(value: string | null | undefined) {
  const method = String(value ?? '').toLowerCase();
  if (method === 'email') return 'Email account';
  if (method === 'mobile') return 'Mobile account';
  if (method === 'username') return 'Username account';
  return 'BUKLOD account';
}

export default function AdminAccountRecoveryScreen() {
  const { hasRole } = useAuth();
  const [rows, setRows] = useState<RecoveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('account-recovery-v3', {
        body: { action: 'admin_list_requests' },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? 'Could not load recovery requests.');
      setRows(Array.isArray(data.requests) ? data.requests : []);
    } catch (error: any) {
      Alert.alert('Account Recovery', String(error?.message ?? error ?? 'Could not load requests.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (hasRole('system_admin')) void load();
    else setLoading(false);
  }, [hasRole, load]);

  const issueCode = async (row: RecoveryRequest) => {
    setBusyId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke('account-recovery-v3', {
        body: { action: 'admin_issue_code', requestId: row.id },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? 'Could not issue recovery code.');

      Alert.alert(
        'One-Time Recovery Code',
        `${String(data.code ?? '')}\n\nGive this code only after you have verified the account owner. It expires in 30 minutes and works once. The member can use it even if they forgot their BUKLOD login.`
      );
      await load();
    } catch (error: any) {
      Alert.alert('Account Recovery', String(error?.message ?? error ?? 'Could not issue code.'));
    } finally {
      setBusyId(null);
    }
  };

  const rejectRequest = (row: RecoveryRequest) => {
    Alert.alert(
      'Reject Recovery Request?',
      'Use Reject when identity cannot be verified or the request appears suspicious. No recovery code will be issued.',
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'REJECT',
          style: 'destructive',
          onPress: () => void (async () => {
            setBusyId(row.id);
            try {
              const { data, error } = await supabase.functions.invoke('account-recovery-v3', {
                body: { action: 'admin_reject_request', requestId: row.id },
              });
              if (error) throw error;
              if (!data?.ok) throw new Error(data?.message ?? 'Could not reject request.');
              setRows((current) => current.filter((item) => item.id !== row.id));
            } catch (error: any) {
              Alert.alert('Account Recovery', String(error?.message ?? error ?? 'Could not reject request.'));
            } finally {
              setBusyId(null);
            }
          })(),
        },
      ]
    );
  };

  if (!hasRole('system_admin')) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="shield-lock-outline" size={34} color={colors.green} />
        <Text style={styles.title}>System Admin Only</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
    >
      <Pressable onPress={() => router.back()} style={styles.back}>
        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Account Recovery Requests</Text>
      <Text style={styles.subtitle}>
        Recovery codes are privileged credentials. Verify the member outside the recovery screen before issuing one.
      </Text>

      <View style={styles.warning}>
        <MaterialCommunityIcons name="shield-alert-outline" size={23} color="#8A5A00" />
        <Text style={styles.warningText}>
          Never ask for the member’s old password or Recovery PIN. Verify using identity information and a trusted ministry/contact channel you already know. If uncertain, reject the request.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 28 }} color={colors.green} />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="check-decagram-outline" size={28} color={colors.green} />
          <Text style={styles.emptyTitle}>No pending requests</Text>
          <Text style={styles.emptyText}>New verified recovery requests will appear here.</Text>
        </View>
      ) : (
        rows.map((row) => (
          <View key={row.id} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{row.full_name || 'BUKLOD Member'}</Text>
                <Text style={styles.method}>{methodLabel(row.login_method)}</Text>
              </View>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>PENDING</Text>
              </View>
            </View>

            <View style={styles.detailBox}>
              <DetailRow icon="account-key-outline" label="Saved login" value={row.login_hint || 'Not available'} />
              {!!row.mobile_hint && <DetailRow icon="phone-outline" label="Mobile on profile" value={row.mobile_hint} />}
              <DetailRow icon="cake-variant-outline" label="Birthday" value={row.birth_date || 'Not recorded'} />
              <DetailRow
                icon="clock-outline"
                label="Requested"
                value={new Date(row.requested_at || row.created_at).toLocaleString()}
              />
            </View>

            <Text style={styles.verifyPrompt}>
              Confirm the person’s identity before choosing ISSUE CODE. These details are for verification only and must not be read aloud to an unknown requester as hints.
            </Text>

            <Pressable
              onPress={() => void issueCode(row)}
              disabled={busyId === row.id}
              style={[styles.primary, busyId === row.id && styles.disabled]}
            >
              {busyId === row.id ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="key-plus" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryText}>IDENTITY VERIFIED — ISSUE CODE</Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => rejectRequest(row)}
              disabled={busyId === row.id}
              style={[styles.reject, busyId === row.id && styles.disabled]}
            >
              <MaterialCommunityIcons name="close-circle-outline" size={18} color="#A62828" />
              <Text style={styles.rejectText}>REJECT / CANNOT VERIFY</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <MaterialCommunityIcons name={icon} size={18} color={colors.green} />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 44, backgroundColor: '#F7F8F7', flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8 },
  backText: { color: colors.text, fontWeight: '800' },
  title: { marginTop: 12, fontSize: 24, fontWeight: '900', color: colors.text },
  subtitle: { marginTop: 6, marginBottom: 13, color: '#647067', lineHeight: 19 },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, marginBottom: 16, borderRadius: 13, borderWidth: 1, borderColor: '#ECD59F', backgroundColor: '#FFF7E5' },
  warningText: { flex: 1, color: '#6F520E', fontSize: 12, lineHeight: 18 },
  empty: { padding: 24, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE4DE', alignItems: 'center' },
  emptyTitle: { marginTop: 8, color: colors.text, fontWeight: '900' },
  emptyText: { marginTop: 4, color: '#68736A', textAlign: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 15, borderWidth: 1, borderColor: '#DEE4DF', padding: 14, marginBottom: 13 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  name: { fontSize: 17, fontWeight: '900', color: colors.text },
  method: { marginTop: 2, color: colors.green, fontWeight: '800', fontSize: 12 },
  pendingBadge: { backgroundColor: '#FFF0C9', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  pendingText: { color: '#7D5A00', fontWeight: '900', fontSize: 9 },
  detailBox: { marginTop: 12, borderRadius: 11, backgroundColor: '#F6F9F7', padding: 10, gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  detailLabel: { color: '#78827B', fontSize: 10.5, fontWeight: '800' },
  detailValue: { marginTop: 1, color: colors.text, fontSize: 12.5, fontWeight: '800' },
  verifyPrompt: { marginTop: 11, color: '#68736A', fontSize: 11, lineHeight: 17 },
  primary: { marginTop: 12, minHeight: 46, borderRadius: 10, backgroundColor: colors.green, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  primaryText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '900', textAlign: 'center' },
  reject: { marginTop: 8, minHeight: 43, borderRadius: 10, borderWidth: 1, borderColor: '#E5BABA', backgroundColor: '#FFF8F8', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  rejectText: { color: '#A62828', fontSize: 10.5, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
