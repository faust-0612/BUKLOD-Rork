import React, { useState } from 'react';
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

export default function AccountSecurityScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const changePassword = async () => {
    if (password.length < 8) {
      return Alert.alert('New Password', 'Use at least 8 characters.');
    }
    if (password !== confirm) {
      return Alert.alert('New Password', 'The passwords do not match.');
    }

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
          BUKLOD account recovery uses your username and 6-digit Recovery PIN. Synthetic @buklod.invalid addresses are never used for password-reset email.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Change Password</Text>
          <Text style={styles.label}>New Password</Text>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 8 characters" style={styles.input} />
          <Text style={styles.label}>Confirm New Password</Text>
          <TextInput value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Re-enter new password" style={styles.input} />
          <Pressable disabled={busy} onPress={() => void changePassword()} style={[styles.primary, busy && { opacity: 0.55 }]}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>CHANGE PASSWORD</Text>}
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recovery PIN</Text>
          <Text style={styles.help}>
            Create or replace your 6-digit Recovery PIN. The PIN is stored as a secure hash and is not sent by SMS or email.
          </Text>
          <Pressable onPress={() => router.push('/account/recovery-pin' as any)} style={styles.secondary}>
            <Text style={styles.secondaryText}>MANAGE RECOVERY PIN</Text>
          </Pressable>
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
  subtitle: { marginTop: 6, marginBottom: 16, color: colors.muted, fontSize: 10.5, lineHeight: 16 },
  card: { padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.white },
  cardTitle: { marginBottom: 10, color: colors.greenDark, fontSize: 13, fontWeight: '900' },
  label: { marginBottom: 5, color: colors.text, fontSize: 10, fontWeight: '800' },
  input: { minHeight: 47, paddingHorizontal: 12, marginBottom: 9, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: '#F8FAF9', color: colors.text },
  help: { color: colors.muted, fontSize: 10, lineHeight: 15, marginBottom: 10 },
  primary: { minHeight: 48, marginTop: 4, borderRadius: 12, backgroundColor: colors.greenDark, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontWeight: '900', fontSize: 10 },
  secondary: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.green, fontWeight: '900', fontSize: 11 },
});
