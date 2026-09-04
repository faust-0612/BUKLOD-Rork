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

type RecoveryPath = 'pin' | 'admin';
type RecoverySession = {
  requestId: string;
  requestToken: string;
  sessionExpiresAt?: string | null;
};

function cleanCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 10);
}

function formatLoginMethod(value: unknown) {
  const method = String(value ?? '').trim().toLowerCase();
  if (method === 'mobile') return 'Mobile number';
  if (method === 'email') return 'Email';
  if (method === 'username') return 'Username';
  return 'Login';
}

function formatExpiry(value: string | null) {
  if (!value) return '30 minutes after verification';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '30 minutes after verification';
  return date.toLocaleString();
}

export default function ForgotPasswordScreen() {
  const [path, setPath] = useState<RecoveryPath>('admin');

  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [pinPassword, setPinPassword] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

  const [forgotLogin, setForgotLogin] = useState(false);
  const [adminIdentifier, setAdminIdentifier] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [surname, setSurname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [recoverySession, setRecoverySession] = useState<RecoverySession | null>(null);
  const [recoveryStateText, setRecoveryStateText] = useState('');
  const [receivedCode, setReceivedCode] = useState('');
  const [receivedCodeExpiresAt, setReceivedCodeExpiresAt] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [codePassword, setCodePassword] = useState('');
  const [codeConfirm, setCodeConfirm] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);

  const pinInFlight = useRef(false);
  const requestInFlight = useRef(false);
  const codeInFlight = useRef(false);
  const pollInFlight = useRef(false);

  const selectPath = (next: RecoveryPath) => {
    if (pinBusy || requestBusy || codeBusy) return;
    setPath(next);
  };

  useEffect(() => {
    if (!recoverySession) return;
    let cancelled = false;

    const poll = async () => {
      if (pollInFlight.current || cancelled) return;
      pollInFlight.current = true;
      try {
        const { data, error } = await supabase.functions.invoke('account-recovery-v4', {
          body: {
            action: 'recovery_request_status',
            requestId: recoverySession.requestId,
            requestToken: recoverySession.requestToken,
          },
        });
        if (cancelled) return;
        if (error) throw error;
        if (!data?.ok) throw new Error(data?.message ?? 'Could not check recovery status.');

        const state = String(data?.state ?? 'waiting');
        if (state === 'waiting') {
          setRecoveryStateText('Waiting for System Admin verification…');
          return;
        }
        if (state === 'verified') {
          const nextCode = cleanCode(String(data?.code ?? ''));
          if (!/^[A-Z2-9]{10}$/.test(nextCode)) throw new Error('Verified recovery code was not returned correctly.');
          setReceivedCode(nextCode);
          setReceivedCodeExpiresAt(data?.codeExpiresAt ? String(data.codeExpiresAt) : null);
          setRecoveryStateText('ACCOUNT VERIFIED — your one-time recovery code is ready below.');
          setRecoverySession(null);
          if (Platform.OS !== 'web') {
            Alert.alert('ACCOUNT VERIFIED', 'BUKLOD generated your recovery code automatically. Enter the code shown on this screen with your new password.');
          }
          return;
        }
        if (state === 'rejected') {
          setRecoveryStateText(data?.message ?? 'This request could not be verified.');
          setRecoverySession(null);
          return;
        }
        if (state === 'session_expired' || state === 'code_expired' || state === 'completed') {
          setRecoveryStateText(data?.message ?? 'This recovery session is no longer active. Submit a new request if needed.');
          setRecoverySession(null);
        }
      } catch (error: any) {
        if (!cancelled) setRecoveryStateText(`Status check: ${String(error?.message ?? error ?? 'temporarily unavailable')}`);
      } finally {
        pollInFlight.current = false;
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [recoverySession]);

  const recoverWithPin = async () => {
    const cleanIdentifier = identifier.trim();
    if (cleanIdentifier.length < 3) {
      return Alert.alert('Recovery PIN', 'Enter your BUKLOD username, mobile number, or email.');
    }
    if (!/^\d{6}$/.test(pin)) {
      return Alert.alert('Recovery PIN', 'Enter your 6-digit Recovery PIN.');
    }
    if (pinPassword.length < 8) {
      return Alert.alert('New Password', 'Use at least 8 characters.');
    }
    if (pinPassword !== pinConfirm) {
      return Alert.alert('New Password', 'The passwords do not match.');
    }
    if (pinInFlight.current) return;
    pinInFlight.current = true;
    setPinBusy(true);

    try {
      const { data, error } = await supabase.functions.invoke('account-recovery-v3', {
        body: {
          action: 'recover_with_pin',
          identifier: cleanIdentifier,
          pin,
          newPassword: pinPassword,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? 'Account recovery failed.');

      Alert.alert(
        'Password Changed',
        `Your BUKLOD password is ready. ${formatLoginMethod(data?.loginMethod)}: ${String(data?.loginIdentifier ?? cleanIdentifier)}`,
        [
          {
            text: 'SIGN IN',
            onPress: () => router.replace('/(auth)/login' as any),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Recovery PIN', String(error?.message ?? error ?? 'Recovery failed.'));
    } finally {
      pinInFlight.current = false;
      setPinBusy(false);
    }
  };

  const requestAdminHelp = async () => {
    const cleanIdentifier = adminIdentifier.trim();
    if (!forgotLogin && cleanIdentifier.length < 3) {
      return Alert.alert(
        'Admin Assistance',
        'Enter the username, mobile number, or email you remember. If you do not remember any login, choose “I forgot my login too.”'
      );
    }

    if (forgotLogin) {
      if (firstName.trim().length < 2 || surname.trim().length < 2) {
        return Alert.alert('Admin Assistance', 'Enter your first name and surname.');
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate.trim())) {
        return Alert.alert('Admin Assistance', 'Enter birthday as YYYY-MM-DD, for example 1990-05-23.');
      }
    }

    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setRequestBusy(true);
    setRecoverySession(null);
    setRequestSent(false);
    setReceivedCode('');
    setReceivedCodeExpiresAt(null);
    setRecoveryStateText('Submitting recovery request…');

    try {
      const { data, error } = await supabase.functions.invoke('account-recovery-v4', {
        body: forgotLogin
          ? {
              action: 'request_admin_recovery',
              firstName: firstName.trim(),
              middleName: middleName.trim() || undefined,
              surname: surname.trim(),
              birthDate: birthDate.trim(),
            }
          : {
              action: 'request_admin_recovery',
              identifier: cleanIdentifier,
            },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? 'Could not submit the recovery request.');

      setRequestSent(true);
      if (data?.rateLimited) {
        setRecoveryStateText('Too many recent recovery requests. Please wait before trying again.');
        return;
      }

      const requestId = String(data?.requestId ?? '').trim();
      const requestToken = String(data?.requestToken ?? '').trim();
      if (!requestId || !/^[0-9a-f]{64}$/i.test(requestToken)) {
        throw new Error('Recovery request was received but the private waiting session could not be started. Please submit again.');
      }

      setRecoveryStateText('Waiting for System Admin verification… Keep this recovery screen open.');
      setRecoverySession({
        requestId,
        requestToken: requestToken.toLowerCase(),
        sessionExpiresAt: data?.sessionExpiresAt ? String(data.sessionExpiresAt) : null,
      });

      if (Platform.OS !== 'web') {
        Alert.alert(
          'Recovery Request Received',
          'Your request is now waiting for System Admin verification. Keep this screen open. Once verified, your one-time recovery code will appear here automatically.'
        );
      }
    } catch (error: any) {
      setRecoveryStateText('');
      Alert.alert('Admin Assistance', String(error?.message ?? error ?? 'Could not submit the request.'));
    } finally {
      requestInFlight.current = false;
      setRequestBusy(false);
    }
  };

  const recoverWithCode = async () => {
    const clean = cleanCode(code);
    if (!/^[A-Z2-9]{10}$/.test(clean)) {
      return Alert.alert('One-Time Code', 'Enter the 10-character one-time code shown after admin verification.');
    }
    if (codePassword.length < 8) {
      return Alert.alert('New Password', 'Use at least 8 characters.');
    }
    if (codePassword !== codeConfirm) {
      return Alert.alert('New Password', 'The passwords do not match.');
    }
    if (codeInFlight.current) return;
    codeInFlight.current = true;
    setCodeBusy(true);

    try {
      const { data, error } = await supabase.functions.invoke('account-recovery-v4', {
        body: {
          action: 'recover_with_admin_code',
          code: clean,
          newPassword: codePassword,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? 'Account recovery failed.');

      const login = String(data?.loginIdentifier ?? '').trim();
      Alert.alert(
        'Account Recovered',
        login
          ? `Password changed successfully. Your BUKLOD sign-in is:\n\n${formatLoginMethod(data?.loginMethod)}: ${login}\n\nKeep this login somewhere safe.`
          : 'Password changed successfully. You can now sign in again.',
        [
          {
            text: 'SIGN IN',
            onPress: () => router.replace('/(auth)/login' as any),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('One-Time Code', String(error?.message ?? error ?? 'Recovery failed.'));
    } finally {
      codeInFlight.current = false;
      setCodeBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="account-key-outline" size={31} color={colors.green} />
        </View>

        <Text style={styles.title}>Recover Your BUKLOD Account</Text>
        <Text style={styles.subtitle}>
          No SMS service is required. Use your Recovery PIN, or request Admin verification. After approval, BUKLOD sends the one-time code directly to this recovery screen.
        </Text>

        <View style={styles.pathRow}>
          <PathButton active={path === 'admin'} icon="account-wrench-outline" label="ADMIN HELP" onPress={() => selectPath('admin')} />
          <PathButton active={path === 'pin'} icon="shield-lock-outline" label="RECOVERY PIN" onPress={() => selectPath('pin')} />
        </View>

        {path === 'pin' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>I remember my Recovery PIN</Text>
            <Text style={styles.help}>
              Use the 6-digit Recovery PIN you created in My BUKLOD. Your login may be your username, Philippine mobile number, or email.
            </Text>
            <FieldLabel>Username, mobile number, or email</FieldLabel>
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="username / 09... / email"
              style={styles.input}
            />
            <FieldLabel>6-digit Recovery PIN</FieldLabel>
            <TextInput
              value={pin}
              onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              placeholder="6 digits"
              style={styles.input}
            />
            <FieldLabel>New password</FieldLabel>
            <TextInput value={pinPassword} onChangeText={setPinPassword} secureTextEntry placeholder="At least 8 characters" style={styles.input} />
            <FieldLabel>Confirm new password</FieldLabel>
            <TextInput value={pinConfirm} onChangeText={setPinConfirm} secureTextEntry placeholder="Re-enter new password" style={styles.input} />
            <PrimaryButton busy={pinBusy} label="RESET PASSWORD" onPress={recoverWithPin} />
          </View>
        )}

        {path === 'admin' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Request Account Verification</Text>
              <Text style={styles.help}>
                Enter a login you remember. Your request appears in the System Admin recovery center. After the admin verifies you, BUKLOD automatically generates the code and sends it back to this screen.
              </Text>

              <Pressable
                onPress={() => {
                  setForgotLogin((value) => !value);
                  setRequestSent(false);
                  setRecoverySession(null);
                  setRecoveryStateText('');
                  setReceivedCode('');
                  setReceivedCodeExpiresAt(null);
                }}
                style={styles.toggleRow}
              >
                <MaterialCommunityIcons
                  name={forgotLogin ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={22}
                  color={colors.green}
                />
                <Text style={styles.toggleText}>I forgot my login too</Text>
              </Pressable>

              {!forgotLogin ? (
                <>
                  <FieldLabel>Any login you remember</FieldLabel>
                  <TextInput
                    value={adminIdentifier}
                    onChangeText={setAdminIdentifier}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="username / 09... / email"
                    style={styles.input}
                  />
                </>
              ) : (
                <>
                  <FieldLabel>First name</FieldLabel>
                  <TextInput value={firstName} onChangeText={setFirstName} autoCapitalize="words" placeholder="First name" style={styles.input} />
                  <FieldLabel>Middle name (optional)</FieldLabel>
                  <TextInput value={middleName} onChangeText={setMiddleName} autoCapitalize="words" placeholder="Middle name" style={styles.input} />
                  <FieldLabel>Surname</FieldLabel>
                  <TextInput value={surname} onChangeText={setSurname} autoCapitalize="words" placeholder="Surname" style={styles.input} />
                  <FieldLabel>Birthday</FieldLabel>
                  <TextInput
                    value={birthDate}
                    onChangeText={(value) => setBirthDate(value.replace(/[^\d-]/g, '').slice(0, 10))}
                    keyboardType="numbers-and-punctuation"
                    placeholder="YYYY-MM-DD"
                    maxLength={10}
                    style={styles.input}
                  />
                </>
              )}

              <View style={styles.privacyCard}>
                <MaterialCommunityIcons name="shield-check-outline" size={20} color={colors.green} />
                <Text style={styles.privacyText}>
                  The admin never needs to copy or send the code. A private recovery-session token ties this screen to your request, and only this waiting recovery session can retrieve the generated code after verification.
                </Text>
              </View>

              <PrimaryButton busy={requestBusy} label={requestSent ? 'SUBMIT NEW REQUEST' : 'REQUEST ADMIN ASSISTANCE'} onPress={requestAdminHelp} />

              {!!recoveryStateText && (
                <View style={[styles.waitingCard, !!receivedCode && styles.verifiedCard]}>
                  {receivedCode ? (
                    <MaterialCommunityIcons name="check-decagram" size={26} color="#176B39" />
                  ) : recoverySession ? (
                    <ActivityIndicator color={colors.green} />
                  ) : (
                    <MaterialCommunityIcons name="information-outline" size={24} color={colors.green} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.waitingTitle}>{receivedCode ? 'ACCOUNT VERIFIED' : 'RECOVERY STATUS'}</Text>
                    <Text style={styles.waitingText}>{recoveryStateText}</Text>
                  </View>
                </View>
              )}

              {!!receivedCode && (
                <View style={styles.receivedCodeCard}>
                  <Text style={styles.receivedCodeLabel}>YOUR ONE-TIME RECOVERY CODE</Text>
                  <Text selectable style={styles.receivedCodeText}>{receivedCode}</Text>
                  <Text style={styles.receivedCodeExpiry}>Expires: {formatExpiry(receivedCodeExpiresAt)}</Text>
                  <Text style={styles.receivedCodeHelp}>Enter this code in the field below, then create your new password.</Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{receivedCode ? 'Enter your received code' : 'Already verified and received a code?'}</Text>
              <Text style={styles.help}>
                Enter the automatically generated code below. It expires after 30 minutes and works only once.
              </Text>
              <FieldLabel>10-character one-time code</FieldLabel>
              <TextInput
                value={code}
                onChangeText={(value) => setCode(cleanCode(value))}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={10}
                placeholder="XXXXXXXXXX"
                style={[styles.input, styles.codeInput]}
              />
              <FieldLabel>New password</FieldLabel>
              <TextInput value={codePassword} onChangeText={setCodePassword} secureTextEntry placeholder="At least 8 characters" style={styles.input} />
              <FieldLabel>Confirm new password</FieldLabel>
              <TextInput value={codeConfirm} onChangeText={setCodeConfirm} secureTextEntry placeholder="Re-enter new password" style={styles.input} />
              <PrimaryButton busy={codeBusy} label="RECOVER ACCOUNT" onPress={recoverWithCode} />
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PathButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.pathButton, active && styles.pathButtonActive]}>
      <MaterialCommunityIcons name={icon} size={19} color={active ? colors.green : '#647067'} />
      <Text style={[styles.pathText, active && styles.pathTextActive]}>{label}</Text>
    </Pressable>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

function PrimaryButton({ busy, label, onPress }: { busy: boolean; label: string; onPress: () => void | Promise<void> }) {
  return (
    <Pressable disabled={busy} onPress={() => void onPress()} style={[styles.primary, busy && styles.disabled]}>
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8F7' },
  content: { padding: 18, paddingBottom: 46 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8 },
  backText: { color: colors.text, fontWeight: '800' },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EAF4EC',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 12,
  },
  title: { marginTop: 13, textAlign: 'center', fontSize: 24, fontWeight: '900', color: colors.text },
  subtitle: { marginTop: 7, textAlign: 'center', color: '#647067', lineHeight: 20, marginBottom: 18 },
  pathRow: { flexDirection: 'row', gap: 7, marginBottom: 12 },
  pathButton: {
    flex: 1,
    minHeight: 64,
    borderWidth: 1,
    borderColor: '#D8DEDA',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  pathButtonActive: { borderColor: colors.green, backgroundColor: '#EAF4EC' },
  pathText: { color: '#647067', fontSize: 10, fontWeight: '900', textAlign: 'center' },
  pathTextActive: { color: colors.green },
  card: {
    borderWidth: 1,
    borderColor: '#DDE4DE',
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    padding: 15,
    marginBottom: 12,
  },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  help: { marginTop: 5, marginBottom: 10, color: '#68736A', lineHeight: 19, fontSize: 12.5 },
  label: { marginTop: 10, marginBottom: 6, fontWeight: '900', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: '#D7DED8',
    borderRadius: 12,
    backgroundColor: '#FBFCFB',
    minHeight: 50,
    paddingHorizontal: 13,
    color: colors.text,
  },
  codeInput: { fontSize: 18, letterSpacing: 2.5, fontWeight: '900' },
  primary: {
    marginTop: 17,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  disabled: { opacity: 0.6 },
  toggleRow: {
    marginTop: 5,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    borderRadius: 11,
    backgroundColor: '#F2F7F3',
  },
  toggleText: { color: colors.text, fontWeight: '900', flex: 1 },
  privacyCard: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EAF4EC',
    borderRadius: 11,
    padding: 11,
  },
  privacyText: { flex: 1, color: '#405347', fontSize: 11.5, lineHeight: 17 },
  waitingCard: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C9DDD0',
    backgroundColor: '#F4F8F5',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  verifiedCard: { borderColor: '#76AD87', backgroundColor: '#EDF8F0' },
  waitingTitle: { color: colors.text, fontSize: 11.5, fontWeight: '900' },
  waitingText: { marginTop: 3, color: '#56645B', fontSize: 11.5, lineHeight: 17 },
  receivedCodeCard: {
    marginTop: 12,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#4F9C67',
    backgroundColor: '#F1F8F3',
    padding: 13,
  },
  receivedCodeLabel: { textAlign: 'center', color: '#176B39', fontSize: 11, fontWeight: '900' },
  receivedCodeText: { marginTop: 8, textAlign: 'center', color: '#102B1A', fontSize: 29, fontWeight: '900', letterSpacing: 4 },
  receivedCodeExpiry: { marginTop: 7, textAlign: 'center', color: '#5C6C61', fontSize: 10.5, fontWeight: '800' },
  receivedCodeHelp: { marginTop: 8, textAlign: 'center', color: '#405347', fontSize: 11.5, lineHeight: 17 },
});