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

type Mode = 'pin' | 'code';

function cleanUsername(value: string) {
  return value.trim().toLowerCase();
}

export default function ForgotPasswordScreen() {
  const [mode, setMode] = useState<Mode>('pin');
  const [username, setUsername] = useState('');
  const [credential, setCredential] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);

  const resetPassword = async () => {
    const clean = cleanUsername(username);

    if (!/^(?=.*[a-z])[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(clean)) {
      return Alert.alert('Account Recovery', 'Enter your BUKLOD username.');
    }

    if (mode === 'pin') {
      if (!/^\d{6}$/.test(credential)) {
        return Alert.alert('Recovery PIN', 'Enter your 6-digit Recovery PIN.');
      }
    } else if (credential.trim().length < 6) {
      return Alert.alert(
        'One-Time Recovery Code',
        'Enter the one-time recovery code issued by a BUKLOD System Admin.'
      );
    }

    if (newPassword.length < 8) {
      return Alert.alert('New Password', 'Use at least 8 characters.');
    }

    if (newPassword !== confirm) {
      return Alert.alert('New Password', 'The passwords do not match.');
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'account-recovery-v2',
        {
          body: {
            action: mode === 'pin' ? 'recover_with_pin' : 'recover_with_admin_code',
            username: clean,
            pin: mode === 'pin' ? credential : undefined,
            code: mode === 'code' ? credential.trim() : undefined,
            newPassword,
          },
        }
      );

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? 'Account recovery failed.');

      Alert.alert(
        'Password Changed',
        'Your BUKLOD password has been reset. Sign in using your username and new password.',
        [
          {
            text: 'SIGN IN',
            onPress: () => router.replace('/(auth)/login' as any),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        'Account Recovery',
        String(error?.message ?? error ?? 'Recovery failed.')
      );
    } finally {
      setBusy(false);
    }
  };

  const requestAdminHelp = async () => {
    const clean = cleanUsername(username);

    if (!/^(?=.*[a-z])[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(clean)) {
      return Alert.alert(
        'Admin Assistance',
        'Enter your BUKLOD username first.'
      );
    }

    setRequestBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'account-recovery-v2',
        {
          body: {
            action: 'request_admin_recovery',
            username: clean,
          },
        }
      );

      if (error) throw error;
      if (!data?.ok) {
        throw new Error(data?.message ?? 'Could not submit the request.');
      }

      Alert.alert(
        'Request Received',
        data?.message ??
          'If the username exists, the request is now available to a BUKLOD System Admin.'
      );

      setMode('code');
      setCredential('');
    } catch (error: any) {
      Alert.alert(
        'Admin Assistance',
        String(error?.message ?? error ?? 'Could not submit the request.')
      );
    } finally {
      setRequestBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="lock-reset" size={30} color={colors.green} />
        </View>

        <Text style={styles.title}>Recover Your Account</Text>
        <Text style={styles.subtitle}>
          Use your BUKLOD username and the recovery method you prepared before losing access.
        </Text>

        <Text style={styles.label}>Username</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="your.username"
          style={styles.input}
        />

        <View style={styles.modeRow}>
          <Pressable
            onPress={() => {
              setMode('pin');
              setCredential('');
            }}
            style={[styles.modeButton, mode === 'pin' && styles.modeActive]}
          >
            <Text style={[styles.modeText, mode === 'pin' && styles.modeTextActive]}>
              RECOVERY PIN
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setMode('code');
              setCredential('');
            }}
            style={[styles.modeButton, mode === 'code' && styles.modeActive]}
          >
            <Text style={[styles.modeText, mode === 'code' && styles.modeTextActive]}>
              ONE-TIME CODE
            </Text>
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <MaterialCommunityIcons
            name={mode === 'pin' ? 'shield-lock-outline' : 'lock-reset'}
            size={21}
            color={colors.green}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>
              {mode === 'pin' ? 'Where is my Recovery PIN?' : 'Where is the one-time code?'}
            </Text>
            <Text style={styles.infoText}>
              {mode === 'pin'
                ? 'You create this 6-digit PIN while signed in: Profile > My BUKLOD > Recovery PIN. It is not sent by SMS or email, and BUKLOD never displays it again after saving.'
                : 'Request Admin Assistance below. After a System Admin verifies your identity, the admin can issue a one-time recovery code. The code expires after 30 minutes and works only once.'}
            </Text>
          </View>
        </View>

        <Text style={styles.label}>
          {mode === 'pin' ? '6-digit Recovery PIN' : 'One-Time Recovery Code'}
        </Text>

        <TextInput
          value={credential}
          onChangeText={(value) =>
            setCredential(mode === 'pin' ? value.replace(/\D/g, '').slice(0, 6) : value)
          }
          keyboardType={mode === 'pin' ? 'number-pad' : 'default'}
          autoCapitalize={mode === 'pin' ? 'none' : 'characters'}
          autoCorrect={false}
          secureTextEntry={mode === 'pin'}
          maxLength={mode === 'pin' ? 6 : 32}
          placeholder={mode === 'pin' ? 'Enter 6 digits' : 'Enter one-time code'}
          style={styles.input}
        />

        <Text style={styles.label}>New Password</Text>
        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="At least 8 characters"
          style={styles.input}
        />

        <Text style={styles.label}>Confirm New Password</Text>
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          placeholder="Re-enter new password"
          style={styles.input}
        />

        <Pressable
          onPress={resetPassword}
          disabled={busy}
          style={[styles.primary, busy && styles.disabled]}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryText}>RESET PASSWORD</Text>
          )}
        </Pressable>

        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Forgot or never created your Recovery PIN?</Text>
          <Text style={styles.helpText}>
            Submit a recovery request. A System Admin must verify your identity before issuing a temporary one-time code.
          </Text>

          <Pressable
            onPress={requestAdminHelp}
            disabled={requestBusy}
            style={styles.secondary}
          >
            {requestBusy ? (
              <ActivityIndicator color={colors.green} />
            ) : (
              <Text style={styles.secondaryText}>REQUEST ADMIN ASSISTANCE</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8F7' },
  content: { padding: 20, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8 },
  backText: { color: colors.text, fontWeight: '800' },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#EAF4EC',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 16,
  },
  title: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
  },
  subtitle: {
    marginTop: 7,
    marginBottom: 22,
    textAlign: 'center',
    color: '#647067',
    lineHeight: 20,
  },
  label: { marginTop: 12, marginBottom: 6, fontWeight: '900', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: '#D7DED8',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 50,
    paddingHorizontal: 14,
    color: colors.text,
  },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 4 },
  modeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D7DED8',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  modeActive: { borderColor: colors.green, backgroundColor: '#EAF4EC' },
  modeText: { fontSize: 11, fontWeight: '900', color: '#68736A' },
  modeTextActive: { color: colors.green },
  infoCard: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#EAF4EC',
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  infoTitle: { color: colors.text, fontWeight: '900' },
  infoText: { marginTop: 3, color: '#405347', lineHeight: 18, fontSize: 12 },
  primary: {
    marginTop: 20,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '900' },
  disabled: { opacity: 0.6 },
  helpCard: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#DDE4DE',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  helpTitle: { fontWeight: '900', color: colors.text },
  helpText: { marginTop: 5, color: '#68736A', lineHeight: 19 },
  secondary: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: colors.green, fontWeight: '900', fontSize: 12 },
});