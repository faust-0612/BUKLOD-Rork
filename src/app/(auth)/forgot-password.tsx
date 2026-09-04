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

type RecoveryPath = 'otp' | 'admin';
type OtpStage = 'contact' | 'verify' | 'select' | 'password' | 'success';
type RecoveryAccount = {
  accountId: string;
  label: string;
  hint: string;
};

type RecoveryResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
  challengeId?: string;
  channel?: 'sms' | 'email';
  expiresInSeconds?: number;
  resendAfterSeconds?: number;
  recoveryToken?: string;
  tokenExpiresInSeconds?: number;
  accountSelectionRequired?: boolean;
  accounts?: RecoveryAccount[];
};

function cleanCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 10);
}

function cleanOtp(value: string) {
  return value.replace(/\D/g, '').slice(0, 6);
}

function formatLoginMethod(value: unknown) {
  const method = String(value ?? '').trim().toLowerCase();
  if (method === 'mobile') return 'Mobile number';
  if (method === 'email') return 'Email';
  if (method === 'username') return 'Username';
  return 'Login';
}

function normalizeRecoveryContact(value: string) {
  const raw = value.trim();
  if (raw.includes('@')) return raw.toLowerCase();
  return raw.replace(/[\s()-]/g, '');
}

function isPhoneOrEmail(value: string) {
  const clean = normalizeRecoveryContact(value);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) && !clean.endsWith('@buklod.invalid')) return true;
  return /^(?:\+639|639|09)\d{9}$/.test(clean);
}

async function invokeOtpRecovery(body: Record<string, unknown>): Promise<RecoveryResponse> {
  const { data, error } = await supabase.functions.invoke('account-recovery-otp-v1', { body });
  if (!error) return (data ?? {}) as RecoveryResponse;

  let functionPayload: any = null;
  try {
    const context = (error as any)?.context;
    if (context && typeof context.json === 'function') {
      functionPayload = await context.json();
    }
  } catch {
    // Keep the transport error as fallback when the response body cannot be read.
  }

  const message = String(
    functionPayload?.message ??
      (error as any)?.message ??
      'Account recovery is temporarily unavailable. Please try again.'
  );
  const wrapped = new Error(message) as Error & { code?: string; retryAfterSeconds?: number };
  wrapped.code = functionPayload?.code;
  wrapped.retryAfterSeconds = Number(functionPayload?.retryAfterSeconds ?? 0) || undefined;
  throw wrapped;
}

export default function ForgotPasswordScreen() {
  const [path, setPath] = useState<RecoveryPath>('otp');

  const [otpStage, setOtpStage] = useState<OtpStage>('contact');
  const [contact, setContact] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [otp, setOtp] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [accounts, setAccounts] = useState<RecoveryAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [otpNotice, setOtpNotice] = useState('');
  const [otpError, setOtpError] = useState('');

  const [forgotLogin, setForgotLogin] = useState(false);
  const [adminIdentifier, setAdminIdentifier] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [surname, setSurname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const [code, setCode] = useState('');
  const [codePassword, setCodePassword] = useState('');
  const [codeConfirm, setCodeConfirm] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);

  const otpInFlight = useRef(false);
  const requestInFlight = useRef(false);
  const codeInFlight = useRef(false);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds > 0]);

  const selectPath = (next: RecoveryPath) => {
    if (otpBusy || requestBusy || codeBusy) return;
    setPath(next);
  };

  const resetOtpFlow = () => {
    setOtpStage('contact');
    setChallengeId('');
    setOtp('');
    setRecoveryToken('');
    setAccounts([]);
    setSelectedAccountId('');
    setNewPassword('');
    setConfirmPassword('');
    setResendSeconds(0);
    setOtpNotice('');
    setOtpError('');
  };

  const sendOtp = async () => {
    const cleanContact = normalizeRecoveryContact(contact);
    if (!isPhoneOrEmail(cleanContact)) {
      setOtpNotice('');
      setOtpError('Enter a valid Philippine mobile number or email address. Username is not used for automatic recovery.');
      return;
    }
    if (otpInFlight.current) return;
    otpInFlight.current = true;
    setOtpBusy(true);
    setOtpError('');
    setOtpNotice('');

    try {
      const data = await invokeOtpRecovery({ action: 'request_otp', contact: cleanContact });
      if (!data?.ok || !data.challengeId) throw new Error(data?.message ?? 'Recovery code could not be requested.');

      setContact(cleanContact);
      setChallengeId(data.challengeId);
      setOtp('');
      setRecoveryToken('');
      setAccounts([]);
      setSelectedAccountId('');
      setOtpStage('verify');
      setResendSeconds(Number(data.resendAfterSeconds ?? 45));
      setOtpNotice(
        data.message ??
          'If an active BUKLOD account uses that phone number or email, a 6-digit recovery code has been sent.'
      );
    } catch (error: any) {
      const retryAfter = Number(error?.retryAfterSeconds ?? 0);
      if (retryAfter > 0) setResendSeconds(retryAfter);
      setOtpError(String(error?.message ?? error ?? 'Recovery code could not be requested.'));
    } finally {
      otpInFlight.current = false;
      setOtpBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (!challengeId) {
      setOtpError('Request a new recovery code first.');
      setOtpStage('contact');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setOtpError('Enter the 6-digit recovery code.');
      return;
    }
    if (otpInFlight.current) return;
    otpInFlight.current = true;
    setOtpBusy(true);
    setOtpError('');

    try {
      const data = await invokeOtpRecovery({
        action: 'verify_otp',
        challengeId,
        contact: normalizeRecoveryContact(contact),
        code: otp,
      });
      if (!data?.ok || !data.recoveryToken) throw new Error(data?.message ?? 'Recovery code verification failed.');

      const nextAccounts = Array.isArray(data.accounts) ? data.accounts.filter((item) => !!item?.accountId) : [];
      setRecoveryToken(data.recoveryToken);
      setAccounts(nextAccounts);
      setSelectedAccountId(nextAccounts.length === 1 ? nextAccounts[0].accountId : '');
      setOtpNotice('Recovery code verified.');
      setOtpStage(nextAccounts.length > 1 ? 'select' : 'password');
    } catch (error: any) {
      setOtpError(String(error?.message ?? error ?? 'Invalid or expired recovery code.'));
    } finally {
      otpInFlight.current = false;
      setOtpBusy(false);
    }
  };

  const continueWithAccount = () => {
    if (!selectedAccountId) {
      setOtpError('Choose the BUKLOD account you want to recover.');
      return;
    }
    setOtpError('');
    setOtpStage('password');
  };

  const resetPasswordWithOtp = async () => {
    if (!challengeId || !recoveryToken) {
      setOtpError('Your recovery session has expired. Request a new code.');
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      setOtpError('Use a new password with 8 to 128 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setOtpError('The passwords do not match.');
      return;
    }
    if (accounts.length > 1 && !selectedAccountId) {
      setOtpError('Choose the BUKLOD account you want to recover.');
      setOtpStage('select');
      return;
    }
    if (otpInFlight.current) return;
    otpInFlight.current = true;
    setOtpBusy(true);
    setOtpError('');

    try {
      const data = await invokeOtpRecovery({
        action: 'reset_password',
        challengeId,
        recoveryToken,
        accountId: selectedAccountId || undefined,
        newPassword,
      });
      if (!data?.ok) throw new Error(data?.message ?? 'Password reset could not be completed.');

      setNewPassword('');
      setConfirmPassword('');
      setOtpNotice(data.message ?? 'Password changed successfully. You can now sign in again.');
      setOtpStage('success');
    } catch (error: any) {
      setOtpError(String(error?.message ?? error ?? 'Password reset could not be completed.'));
    } finally {
      otpInFlight.current = false;
      setOtpBusy(false);
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

    try {
      const { data, error } = await supabase.functions.invoke('account-recovery-v3', {
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
      Alert.alert(
        'Recovery Request Received',
        data?.message ??
          'If we can match the account, a BUKLOD System Admin can assist after identity verification.'
      );
    } catch (error: any) {
      Alert.alert('Admin Assistance', String(error?.message ?? error ?? 'Could not submit the request.'));
    } finally {
      requestInFlight.current = false;
      setRequestBusy(false);
    }
  };

  const recoverWithCode = async () => {
    const clean = cleanCode(code);
    if (!/^[A-Z2-9]{10}$/.test(clean)) {
      return Alert.alert('One-Time Code', 'Enter the 10-character code issued by a BUKLOD System Admin.');
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
      const { data, error } = await supabase.functions.invoke('account-recovery-v3', {
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
          Use the mobile number or email connected to your account. BUKLOD will send a one-time recovery code automatically.
        </Text>

        <View style={styles.pathRow}>
          <PathButton active={path === 'otp'} icon="message-processing-outline" label="PHONE / EMAIL OTP" onPress={() => selectPath('otp')} />
          <PathButton active={path === 'admin'} icon="account-wrench-outline" label="ADMIN HELP" onPress={() => selectPath('admin')} />
        </View>

        {path === 'otp' && (
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>
                  {otpStage === 'contact' ? '1' : otpStage === 'verify' ? '2' : otpStage === 'select' ? '3' : otpStage === 'password' ? (accounts.length > 1 ? '4' : '3') : '✓'}
                </Text>
              </View>
              <Text style={[styles.cardTitle, styles.cardTitleFlex]}>
                {otpStage === 'contact'
                  ? 'Enter phone number or email'
                  : otpStage === 'verify'
                    ? 'Verify your recovery code'
                    : otpStage === 'select'
                      ? 'Choose your BUKLOD account'
                      : otpStage === 'password'
                        ? 'Create a new password'
                        : 'Account recovery complete'}
              </Text>
            </View>

            {otpStage === 'contact' && (
              <>
                <Text style={styles.help}>
                  Username is not used for automatic recovery. Existing accounts without a verified phone or email can still use Admin Help below.
                </Text>
                <FieldLabel>Phone number or email</FieldLabel>
                <TextInput
                  value={contact}
                  onChangeText={setContact}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="09xxxxxxxxx or name@example.com"
                  style={styles.input}
                />
                <PrimaryButton busy={otpBusy} label="SEND 6-DIGIT CODE" onPress={sendOtp} />
              </>
            )}

            {otpStage === 'verify' && (
              <>
                <Text style={styles.help}>
                  Enter the 6-digit code sent to the phone number or email you provided. The code expires in 5 minutes.
                </Text>
                <View style={styles.contactChip}>
                  <MaterialCommunityIcons name={contact.includes('@') ? 'email-outline' : 'cellphone'} size={18} color={colors.green} />
                  <Text style={styles.contactChipText}>{contact}</Text>
                </View>
                <FieldLabel>6-digit recovery code</FieldLabel>
                <TextInput
                  value={otp}
                  onChangeText={(value) => setOtp(cleanOtp(value))}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  placeholder="000000"
                  style={[styles.input, styles.otpInput]}
                />
                <PrimaryButton busy={otpBusy} label="VERIFY CODE" onPress={verifyOtp} />
                <Pressable
                  disabled={otpBusy || resendSeconds > 0}
                  onPress={() => void sendOtp()}
                  style={[styles.secondaryButton, (otpBusy || resendSeconds > 0) && styles.disabled]}
                >
                  <Text style={styles.secondaryButtonText}>
                    {resendSeconds > 0 ? `RESEND IN ${resendSeconds}s` : 'RESEND CODE'}
                  </Text>
                </Pressable>
                <Pressable disabled={otpBusy} onPress={resetOtpFlow} style={styles.linkButton}>
                  <Text style={styles.linkText}>Use a different phone number or email</Text>
                </Pressable>
              </>
            )}

            {otpStage === 'select' && (
              <>
                <Text style={styles.help}>
                  More than one BUKLOD account is linked to this verified contact. Select only the account whose password you want to change.
                </Text>
                {accounts.map((account) => {
                  const selected = selectedAccountId === account.accountId;
                  return (
                    <Pressable
                      key={account.accountId}
                      onPress={() => {
                        setSelectedAccountId(account.accountId);
                        setOtpError('');
                      }}
                      style={[styles.accountOption, selected && styles.accountOptionSelected]}
                    >
                      <MaterialCommunityIcons
                        name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                        size={22}
                        color={selected ? colors.green : '#68736A'}
                      />
                      <View style={styles.accountOptionBody}>
                        <Text style={styles.accountLabel}>{account.label}</Text>
                        <Text style={styles.accountHint}>{account.hint}</Text>
                      </View>
                    </Pressable>
                  );
                })}
                <PrimaryButton busy={otpBusy} label="CONTINUE" onPress={continueWithAccount} />
              </>
            )}

            {otpStage === 'password' && (
              <>
                <Text style={styles.help}>
                  Your recovery contact has been verified. Set a new password for this existing BUKLOD account.
                </Text>
                {accounts.length === 1 && (
                  <View style={styles.accountSummary}>
                    <MaterialCommunityIcons name="account-check-outline" size={20} color={colors.green} />
                    <View style={styles.accountOptionBody}>
                      <Text style={styles.accountLabel}>{accounts[0].label}</Text>
                      <Text style={styles.accountHint}>{accounts[0].hint}</Text>
                    </View>
                  </View>
                )}
                {accounts.length > 1 && selectedAccountId ? (
                  <View style={styles.accountSummary}>
                    <MaterialCommunityIcons name="account-check-outline" size={20} color={colors.green} />
                    <View style={styles.accountOptionBody}>
                      <Text style={styles.accountLabel}>{accounts.find((item) => item.accountId === selectedAccountId)?.label ?? 'Selected BUKLOD account'}</Text>
                      <Text style={styles.accountHint}>{accounts.find((item) => item.accountId === selectedAccountId)?.hint ?? ''}</Text>
                    </View>
                  </View>
                ) : null}
                <FieldLabel>New password</FieldLabel>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  placeholder="At least 8 characters"
                  style={styles.input}
                />
                <FieldLabel>Confirm new password</FieldLabel>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  placeholder="Re-enter new password"
                  style={styles.input}
                />
                <PrimaryButton busy={otpBusy} label="CHANGE PASSWORD" onPress={resetPasswordWithOtp} />
                {accounts.length > 1 && (
                  <Pressable disabled={otpBusy} onPress={() => setOtpStage('select')} style={styles.linkButton}>
                    <Text style={styles.linkText}>Choose a different linked account</Text>
                  </Pressable>
                )}
              </>
            )}

            {otpStage === 'success' && (
              <>
                <View style={styles.successBox}>
                  <MaterialCommunityIcons name="check-circle-outline" size={28} color={colors.green} />
                  <Text style={styles.successText}>
                    Your password was changed on the same existing BUKLOD account. You can now sign in with the new password.
                  </Text>
                </View>
                <PrimaryButton busy={false} label="SIGN IN" onPress={() => router.replace('/(auth)/login' as any)} />
              </>
            )}

            {!!otpNotice && otpStage !== 'success' && (
              <View style={styles.noticeBox}>
                <MaterialCommunityIcons name="information-outline" size={19} color={colors.green} />
                <Text style={styles.noticeText}>{otpNotice}</Text>
              </View>
            )}

            {!!otpError && (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons name="alert-circle-outline" size={19} color="#A12A2A" />
                <Text style={styles.errorText}>{otpError}</Text>
              </View>
            )}
          </View>
        )}

        {path === 'admin' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>I need Admin Assistance</Text>
              <Text style={styles.help}>
                Use this only when you cannot receive an automatic recovery code, have no phone/email on the account, or no longer have access to them. A System Admin must verify your identity before issuing a one-time code.
              </Text>

              <Pressable
                onPress={() => {
                  setForgotLogin((value) => !value);
                  setRequestSent(false);
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
                  For privacy, BUKLOD does not confirm on this screen whether an account exists. The admin will verify the account owner before giving a code.
                </Text>
              </View>

              <PrimaryButton busy={requestBusy} label={requestSent ? 'REQUEST AGAIN' : 'REQUEST ADMIN ASSISTANCE'} onPress={requestAdminHelp} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Already received an Admin one-time code?</Text>
              <Text style={styles.help}>
                Enter the code below. You do not need to remember your old username, mobile number, email, or password. The code expires after 30 minutes and works once.
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
  pathText: { color: '#647067', fontSize: 9.5, fontWeight: '900', textAlign: 'center' },
  pathTextActive: { color: colors.green },
  card: {
    borderWidth: 1,
    borderColor: '#DDE4DE',
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    padding: 15,
    marginBottom: 12,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  cardTitleFlex: { flex: 1 },
  stepBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF4EC',
  },
  stepBadgeText: { color: colors.green, fontWeight: '900' },
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
  otpInput: { fontSize: 21, letterSpacing: 5, fontWeight: '900', textAlign: 'center' },
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
  secondaryButton: {
    marginTop: 9,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFCAC1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: colors.green, fontWeight: '900', fontSize: 12 },
  linkButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  linkText: { color: colors.green, fontWeight: '800', fontSize: 12 },
  disabled: { opacity: 0.6 },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F2F7F3',
    borderRadius: 11,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  contactChipText: { color: colors.text, fontWeight: '800', flex: 1 },
  accountOption: {
    marginTop: 8,
    minHeight: 60,
    borderWidth: 1,
    borderColor: '#D7DED8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FBFCFB',
  },
  accountOptionSelected: { borderColor: colors.green, backgroundColor: '#EAF4EC' },
  accountOptionBody: { flex: 1 },
  accountLabel: { color: colors.text, fontWeight: '900' },
  accountHint: { color: '#68736A', fontSize: 12, marginTop: 2 },
  accountSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 11,
    backgroundColor: '#F2F7F3',
    padding: 11,
    marginBottom: 2,
  },
  noticeBox: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 11,
    backgroundColor: '#EAF4EC',
    padding: 11,
  },
  noticeText: { flex: 1, color: '#405347', fontSize: 11.5, lineHeight: 17 },
  errorBox: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 11,
    backgroundColor: '#FDEEEE',
    padding: 11,
  },
  errorText: { flex: 1, color: '#7E2424', fontSize: 11.5, lineHeight: 17 },
  successBox: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    backgroundColor: '#EAF4EC',
    padding: 13,
  },
  successText: { flex: 1, color: '#405347', fontWeight: '700', lineHeight: 19 },
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
});