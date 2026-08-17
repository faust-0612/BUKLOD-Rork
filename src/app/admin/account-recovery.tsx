import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
};

export default function AdminAccountRecoveryScreen() {
  const { hasRole } = useAuth();
  const [rows, setRows] = useState<RecoveryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'account-recovery-v2',
        { body: { action: 'admin_list_requests' } }
      );

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? 'Could not load recovery requests.');

      setRows(data.requests ?? []);
    } catch (error: any) {
      Alert.alert('Account Recovery', String(error?.message ?? error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasRole('system_admin')) {
      load();
    } else {
      setLoading(false);
    }
  }, [hasRole, load]);

  const issueCode = async (row: RecoveryRequest) => {
    setBusyId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke(
        'account-recovery-v2',
        {
          body: {
            action: 'admin_issue_code',
            requestId: row.id,
          },
        }
      );

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? 'Could not issue code.');

      Alert.alert(
        'One-time Recovery Code',
        `${data.code}\n\nGive this code only to the verified account owner. It expires in 30 minutes and works once.`
      );

      await load();
    } catch (error: any) {
      Alert.alert('Account Recovery', String(error?.message ?? error));
    } finally {
      setBusyId(null);
    }
  };

  if (!hasRole('system_admin')) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>System Admin Only</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Account Recovery Requests</Text>
      <Text style={styles.subtitle}>
        Verify the member outside the app before issuing a one-time recovery code. The code expires after 30 minutes and works once.
      </Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 28 }} />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No pending recovery requests.</Text>
        </View>
      ) : (
        rows.map((row) => (
          <View key={row.id} style={styles.card}>
            <Text style={styles.name}>{row.full_name || row.username}</Text>
            <Text style={styles.username}>@{row.username}</Text>
            <Text style={styles.time}>
              Requested {new Date(row.created_at).toLocaleString()}
            </Text>

            <Pressable
              onPress={() => issueCode(row)}
              disabled={busyId === row.id}
              style={styles.primary}
            >
              {busyId === row.id ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryText}>ISSUE ONE-TIME RECOVERY CODE</Text>
              )}
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, backgroundColor: '#F7F8F7', flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8 },
  backText: { color: colors.text, fontWeight: '800' },
  title: { marginTop: 16, fontSize: 24, fontWeight: '900', color: colors.text },
  subtitle: { marginTop: 6, marginBottom: 18, color: '#647067', lineHeight: 19 },
  empty: { padding: 20, borderRadius: 12, backgroundColor: '#FFFFFF' },
  emptyText: { color: '#68736A' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DEE4DF',
    padding: 14,
    marginBottom: 12,
  },
  name: { fontSize: 16, fontWeight: '900', color: colors.text },
  username: { marginTop: 2, color: colors.green, fontWeight: '800' },
  time: { marginTop: 7, color: '#7A847D', fontSize: 12 },
  primary: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
});