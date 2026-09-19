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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import {
  isBuklodInvalidCredentialsError,
  isBuklodTransientAuthError,
  signInWithPasswordResilient,
} from '@/lib/buklodAuthResilience';

type RecoveryStatus = {
  pinConfigured: boolean;
  loginHint: string | null;
};

const SUGGESTED_LOGINS_KEY = 'buklod.suggested_logins.v2';
const REMEMBERED_CREDENTIALS_KEY = 'buklod.remembered_credentials.v1';

function suggestedLoginPasswordKey(userId: string) {
  return `buklod.suggested_login.password.${userId}`;
}

async function writeStoredLoginSecret(key: string, value: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function syncRememberedPasswordForCurrentUser(
  userId: string,
  newPassword: string
) {
  const rawSuggested = await AsyncStorage.getItem(SUGGESTED_LOGINS_KEY);
  let currentIdentifier: string | null = null;

  if (rawSuggested) {
    try {
      const parsed = JSON.parse(rawSuggested);
      if (Array.isArray(parsed)) {
        const current = parsed.find(
          (item: any) =>
            String(item?.userId ?? '') === userId
        );

        if (typeof current?.identifier === 'string') {
          currentIdentifier = current.identifier.trim();
        }

        if (current?.hasPassword === true) {
          await writeStoredLoginSecret(
            suggestedLoginPasswordKey(userId),
            newPassword
          );
        }
      }
    } catch (error) {
      console.warn('Could not refresh suggested-login password.', error);
    }
  }

  if (!currentIdentifier) return;

  const rawRemembered = await AsyncStorage.getItem(
    REMEMBERED_CREDENTIALS_KEY
  );
  if (!rawRemembered) return;

  try {
    const remembered = JSON.parse(rawRemembered);
    const rememberedIdentifier =
      typeof remembered?.identifier === 'string'
        ? remembered.identifier.trim()
        : '';

    if (
      rememberedIdentifier &&
      rememberedIdentifier.toLowerCase() ===
        currentIdentifier.toLowerCase()
    ) {
      await AsyncStorage.setItem(
        REMEMBERED_CREDENTIALS_KEY,
        JSON.stringify({
          ...remembered,
          password: newPassword,
        })
      );
    }
  } catch (error) {
    console.warn('Could not refresh remembered BUKLOD credentials.', error);
  }
}

export default function AccountSecurityScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
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
    if (!currentPassword) {
      return Alert.alert(
        'Current Password',
        'Enter your current password first.'
      );
    }
    if (newPassword.length < 8) {
      return Alert.alert('New Password', 'Use at least 8 characters.');
    }
    if (newPassword !== confirm) {
      return Alert.alert('New Password', 'The passwords do not match.');
    }
    if (newPassword === currentPassword) {
      return Alert.alert(
        'New Password',
        'Choose a new password that is different from your current password.'
      );
    }
    if (inFlight.current) return;

    inFlight.current = true;
    setBusy(true);

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw userError;

      const user = userData.user;
      if (!user) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const email = user.email?.trim();
      const phone = user.phone?.trim();

      if (!email && !phone) {
        throw new Error(
          'BUKLOD could not securely identify this account for password verification.'
        );
      }

      const verifyResult = await signInWithPasswordResilient(
        email
          ? { email, password: currentPassword }
          : { phone: phone as string, password: currentPassword }
      );

      if (verifyResult.error) {
        if (isBuklodInvalidCredentialsError(verifyResult.error)) {
          Alert.alert(
            'Current Password',
            'Your current password is incorrect.'
          );
          return;
        }

        if (isBuklodTransientAuthError(verifyResult.error)) {
          Alert.alert(
            'BUKLOD is temporarily busy',
            'Your password was not rejected. The server did not finish the verification request. Please try again.'
          );
          return;
        }

        throw verifyResult.error;
      }

      if (
        !verifyResult.data.user?.id ||
        verifyResult.data.user.id !== user.id
      ) {
        throw new Error(
          'BUKLOD could not verify the current account safely.'
        );
      }

      const { error: updateError } =
        await supabase.auth.updateUser({ password: newPassword });

      if (updateError) throw updateError;

      try {
        await syncRememberedPasswordForCurrentUser(
          user.id,
          newPassword
        );
      } catch (storageError) {
        console.warn(
          'Password changed, but stored login credentials could not be refreshed.',
          storageError
        );
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      Alert.alert(
        'Password Changed',
        'Your BUKLOD password has been updated successfully.'
      );
    } catch (error: any) {
      if (isBuklodTransientAuthError(error)) {
        Alert.alert(
          'BUKLOD is temporarily busy',
          'The password change could not be completed because the server did not finish the request. Please try again.'
        );
        return;
      }

      Alert.alert(
        'Password & Recovery',
        String(error?.message ?? error ?? 'Could not change password.')
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/buklod' as any);
          }}
          style={styles.back}
        >
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
          <Text style={styles.label}>Current Password</Text>
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            placeholder="Enter current password"
            style={styles.input}
          />
          <Text style={styles.label}>New Password</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            placeholder="At least 8 characters"
            style={styles.input}
          />
          <Text style={styles.label}>Confirm New Password</Text>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            placeholder="Re-enter new password"
            style={styles.input}
          />
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
  input: { minHeight: 47, paddingHorizontal: 12, marginBottom: 9, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: '#F8FAF9', color: colors.text },
  help: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginBottom: 10 },
  primary: { minHeight: 48, marginTop: 4, borderRadius: 12, backgroundColor: colors.greenDark, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.white, fontWeight: '900', fontSize: 11 },
  secondary: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.green, fontWeight: '900', fontSize: 11 },
  disabled: { opacity: 0.55 },
});
