import React, { useRef, useState } from 'react';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  isBuklodInvalidCredentialsError,
  isBuklodTransientAuthError,
  resolveBuklodAccountLifecycleAfterLogin,
  signInWithPasswordResilient,
  signOutBuklodResilient,
} from '@/lib/buklodAuthResilience';
import { colors } from '@/lib/theme';

function normalizePhilippinePhone(value: string) {
  const cleaned = value.replace(/[^\d+]/g, '');
  if (/^\+639\d{9}$/.test(cleaned)) return cleaned;
  if (/^639\d{9}$/.test(cleaned)) return `+${cleaned}`;
  if (/^09\d{9}$/.test(cleaned)) return `+63${cleaned.slice(1)}`;
  return null;
}

function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase();
  if (
    username.length < 3 ||
    username.length > 30 ||
    !/^(?=.*[a-z])[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(username)
  ) return null;
  return username;
}

function mobileInternalEmail(phone: string) {
  return `m.${phone.replace(/\D/g, '')}@buklod.invalid`;
}
function legacyMobileInternalEmail(phone: string) {
  return `${phone.replace(/\D/g, '')}@buklod.invalid`;
}
function usernameInternalEmail(username: string) {
  return `u.${username}@buklod.invalid`;
}

/**
 * Standalone Report authentication.
 * Shares the canonical BUKLOD account but deliberately does not set the Main
 * fresh-Public intent and never routes to Main tabs.
 */
export default function BuklodReportLoginScreen() {
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const login = async () => {
    const raw = identifier.trim();
    if (!raw || !password) {
      Alert.alert('BUKLOD Report', 'Enter your BUKLOD Mobile Number, Username, or Email and password.');
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);

    try {
      let result: Awaited<ReturnType<typeof signInWithPasswordResilient>>;
      if (raw.includes('@')) {
        result = await signInWithPasswordResilient({
          email: raw.toLowerCase(),
          password,
        });
      } else {
        const phone = normalizePhilippinePhone(raw);
        if (phone) {
          result = await signInWithPasswordResilient({
            email: mobileInternalEmail(phone),
            password,
          });
          if (result.error && isBuklodInvalidCredentialsError(result.error)) {
            result = await signInWithPasswordResilient({
              email: legacyMobileInternalEmail(phone),
              password,
            });
          }
        } else {
          const username = normalizeUsername(raw);
          if (!username) {
            Alert.alert('BUKLOD Report', 'Enter a valid Mobile Number, Username, or Email.');
            return;
          }
          result = await signInWithPasswordResilient({
            email: usernameInternalEmail(username),
            password,
          });
        }
      }

      if (result.error) {
        const transient = isBuklodTransientAuthError(result.error);
        Alert.alert(
          transient ? 'BUKLOD is temporarily busy' : 'Login failed',
          transient
            ? 'Your password was not rejected. The BUKLOD server did not finish the sign-in request. Please try again.'
            : 'Invalid login identifier or password.'
        );
        return;
      }

      const { data: lifecycle, error: lifecycleError } = await resolveBuklodAccountLifecycleAfterLogin();
      if (lifecycleError) {
        await signOutBuklodResilient();
        throw lifecycleError;
      }
      if (lifecycle?.deactivated === true || lifecycle?.is_active === false) {
        await signOutBuklodResilient();
        Alert.alert(
          'Account unavailable',
          lifecycle?.deactivated === true
            ? 'This BUKLOD account is deactivated. Reactivate it from the main BUKLOD account flow before using BUKLOD Report.'
            : 'This BUKLOD account is inactive. Please contact a BUKLOD administrator.'
        );
        return;
      }

      router.replace('/reports' as any);
    } catch (error: any) {
      Alert.alert('BUKLOD Report', String(error?.message ?? error ?? 'Could not complete sign-in.'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'BUKLOD Report Login' }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 24, 48), paddingBottom: Math.max(insets.bottom + 24, 40) }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandIcon}>
            <MaterialCommunityIcons name="file-chart-outline" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.eyebrow}>STANDALONE APP</Text>
          <Text style={styles.title}>BUKLOD Report</Text>
          <Text style={styles.subtitle}>Use your existing BUKLOD account. This login opens Report only and does not change your BUKLOD Main workspace.</Text>

          <View style={styles.card}>
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>MOBILE NUMBER, USERNAME, OR EMAIL</Text>
              <TextInput
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                placeholder="BUKLOD account"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!busy}
                  placeholder="Password"
                  placeholderTextColor={colors.muted}
                  style={styles.passwordInput}
                  onSubmitEditing={() => void login()}
                />
                <Pressable disabled={busy} onPress={() => setShowPassword((current) => !current)} style={styles.eyeButton}>
                  <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.greenDark} />
                </Pressable>
              </View>
            </View>

            <Pressable disabled={busy} onPress={() => void login()} style={[styles.loginButton, busy && styles.disabled]}>
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialCommunityIcons name="login" size={19} color="#FFFFFF" />}
              <Text style={styles.loginText}>{busy ? 'Signing in…' : 'Open BUKLOD Report'}</Text>
            </Pressable>

            <Text style={styles.accountNote}>BUKLOD Main and BUKLOD Report share account identity and Organization/Cluster memberships, not app navigation or active-workspace state.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: 20, alignItems: 'center' },
  brandIcon: { width: 74, height: 74, borderRadius: 22, backgroundColor: colors.greenDark, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  eyebrow: { color: colors.greenDark, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  title: { marginTop: 4, color: colors.text, fontSize: 29, fontWeight: '900' },
  subtitle: { maxWidth: 440, marginTop: 8, color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  card: { width: '100%', maxWidth: 460, marginTop: 26, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: 16, gap: 14 },
  fieldWrap: { gap: 6 },
  label: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.45 },
  input: { minHeight: 48, borderRadius: 11, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF', paddingHorizontal: 12, color: colors.text, fontSize: 14 },
  passwordRow: { minHeight: 48, borderRadius: 11, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, minHeight: 46, paddingHorizontal: 12, color: colors.text, fontSize: 14 },
  eyeButton: { width: 48, height: 46, alignItems: 'center', justifyContent: 'center' },
  loginButton: { minHeight: 50, borderRadius: 12, backgroundColor: colors.greenDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loginText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  accountNote: { color: colors.muted, fontSize: 9, lineHeight: 14, textAlign: 'center' },
  disabled: { opacity: 0.55 },
});
