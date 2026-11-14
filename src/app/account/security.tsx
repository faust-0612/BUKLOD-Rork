import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type RecoveryStatus = {
  pinConfigured: boolean;
  loginHint: string | null;
};

export default function AccountSecurityScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(true);
  const [recovery, setRecovery] = useState<RecoveryStatus>({
    pinConfigured: false,
    loginHint: null,
  });
  const inFlight = useRef(false);

  useEffect(() => {
    let active = true;
    void supabase.functions
      .invoke('account-recovery-v3', { body: { action: 'recovery_status' } })
      .then(({ data }) => {
        if (!active || !data?.ok) return;
        setRecovery({
          pinConfigured: data.pinConfigured === true,
          loginHint: typeof data.loginHint === 'string' ? data.loginHint : null,
        });
      })
      .catch((error) => console.warn('Recovery status:', error))
      .finally(() => {
        if (active) setRecoveryBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const changePassword = async () => {
    if (password.length < 8) {
      return Alert.alert('New Password', 'Use at least 8 characters.');
    }
    if (password !== confirm) {
      return Alert.alert('New Password', 'The passwords do not match.');
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      setConfirm('');
      Alert.alert('Password Changed', 'Your BUKLOD password has been updated.');
    } catch (error: any) {
      Alert.alert('Password & Recovery', String(error?.message ?? error ?? 'Could not change password.'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="shield-key-outline" size={30} color={colors.green} />
        </View>
        <Text style={styles.title}>Password & Recovery</Text>
        <Text style={styles.subtitle}>
          Keep your password private and prepare a Recovery PIN before you need it. Email accounts can also use a secure recovery link.
        </Text>

        <View style={[styles.protection, recovery.pinConfigured ? styles.protectionOn : styles.protectionOff]}>
          {recoveryBusy ? (
            <ActivityIndicator color={colors.green} />
          ) : (
            <>
              <MaterialCommunityIcons
                name={recovery.pinConfigured ? 'shield-check-outline' : 'shield-alert-outline'}
                size={24}
                color={recovery.pinConfigured ? colors.green : '#9A6500'}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.protectionTitle}>
                  {recovery.pinConfigured ? 'Recovery PIN is ready' : 'Recovery PIN needs setup'}
                </Text>
                <Text style={styles.protectionText}>
                  {recovery.pinConfigured
                    ? `Protected login: ${recovery.loginHint || 'your BUKLOD account'}`
                    : 'Only a few seconds now can prevent a long account-recovery process later.'}
                </Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Change Password</Text>
          <Text style={styles.label}>New Password</Text>
          <TextInput allowFontScaling value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 8 characters" style={styles.input} />
          <Text style={styles.label}>Confirm New Password</Text>
          <TextInput allowFontScaling value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Re-enter new password" style={styles.input} />
          <Pressable disabled={busy} onPress={() => void changePassword()} style={[styles.primary, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>CHANGE PASSWORD</Text>}
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recovery PIN</Text>
          <Text style={styles.help}>
            Create or replace your private 6-digit Recovery PIN. It works with the username, mobile number, or email saved as your BUKLOD login.
          </Text>
          <Pressable onPress={() => router.push('/account/recovery-pin' as any)} style={styles.secondary}>
            <Text style={styles.secondaryText}>{recovery.pinConfigured ? 'MANAGE RECOVERY PIN' : 'SET UP RECOVERY PIN'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>If you lose access later</Text>
          <Text style={styles.help}>
            From Sign In, open account recovery. Email users can request a secure link. Anyone with a Recovery PIN can reset using their saved login. If you forget everything, Admin Assistance can verify your identity and issue a one-time code.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 42 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  backText: { color: colors.text, fontWeight: '800' },
  iconCircle: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF7EF', marginBottom: 10 },
  title: { color: colors.greenDark, fontSize: 25, fontWeight: '900' },
  subtitle: { marginTop: 6, marginBottom: 14, color: colors.muted, fontSize: 11.5, lineHeight: 17 },
  protection: { marginBottom: 13, borderRadius: 13, borderWidth: 1, padding: 12, flexDirection: 'row', gap: 9, alignItems: 'center' },
  protectionOn: { backgroundColor: '#EAF4EC', borderColor: '#B9D7C0' },
  protectionOff: { backgroundColor: '#FFF7E5', borderColor: '#E9CE91' },
  protectionTitle: { color: colors.text, fontWeight: '900' },
  protectionText: { marginTop: 2, color: '#5E6961', fontSize: 11.5, lineHeight: 17 },
  card: { padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.white },
  cardTitle: { marginBottom: 10, color: colors.greenDark, fontSize: 14, fontWeight: '900' },
  label: { marginBottom: 5, color: colors.text, fontSize: 11, fontWeight: '800' },
  input: { fontSize: 16, minHeight: 47, paddingHorizontal: 12, marginBottom: 9, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: '#F8FAF9', color: colors.text },
  help: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginBottom: 10 },
  primary: { minHeight: 48, marginTop: 4, borderRadius: 12, backgroundColor: colors.greenDark, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontWeight: '900', fontSize: 11 },
  secondary: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.green, fontWeight: '900', fontSize: 11 },
  disabled: { opacity: 0.55 },
});
