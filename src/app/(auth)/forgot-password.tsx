import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { recordPasswordResetOnThisDevice } from '@/lib/buklodSuggestedLoginStorage';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { BuklodFeedbackBanner } from '@/components/BuklodFeedbackBanner';
import { useBuklodFeedback } from '@/providers/BuklodFeedbackProvider';
import { useBuklodI18n } from '@/providers/BuklodI18nProvider';
import {
  buildBuklodUserFeedback,
  trackBuklodFeedbackEvent,
  type BuklodUserFeedback,
} from '@/lib/buklodUserFeedback';

type RecoveryPath = 'email' | 'pin' | 'admin';

type RecoverySession = {
  requestId: string;
  requestToken: string;
  sessionExpiresAt?: string | null;
};

type OtpAccount = {
  accountId: string;
  label?: string | null;
  hint?: string | null;
};

function cleanAdminCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 10);
}

function cleanEmailOtp(value: string) {
  return value.replace(/\D/g, '').slice(0, 6);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());
}

function formatLoginMethod(value: unknown) {
  const method = String(value ?? '').trim().toLowerCase();
  if (method === 'mobile') return 'Mobile number';
  if (method === 'email') return 'Email';
  if (method === 'username') return 'Username';
  return 'Login';
}

function invokeRecovery(name: string, options: any) {
  return withBuklodTimeout<any>(
    supabase.functions.invoke(name, options),
    15_000,
    `Account recovery ${name}`
  );
}

function formatExpiry(value: string | null) {
  if (!value) return '30 minutes after verification';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '30 minutes after verification';
  return date.toLocaleString();
}

async function functionErrorMessage(error: any, fallback: string) {
  const context = error?.context;
  if (context) {
    try {
      const response = typeof context.clone === 'function' ? context.clone() : context;
      if (typeof response?.text === 'function') {
        const raw = String(await response.text()).trim();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            const message = String(parsed?.message ?? parsed?.error ?? '').trim();
            if (message) return message;
          } catch {
            if (!raw.startsWith('<')) return raw;
          }
        }
      }
    } catch {
      // Fall through to the safe UI message.
    }
  }

  const message = String(error?.message ?? '').trim();
  if (message && !/edge function returned a non-2xx status code/i.test(message)) return message;
  return fallback;
}

export default function ForgotPasswordScreen() {
  const { t } = useBuklodI18n();
  const { showFeedback } = useBuklodFeedback();
  const [path, setPath] = useState<RecoveryPath>('email');
  const [recoveryFeedback, setRecoveryFeedback] =
    useState<BuklodUserFeedback | null>(null);

  const [emailReady, setEmailReady] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [autoForgotLogin, setAutoForgotLogin] = useState(false);
  const [autoBirthDate, setAutoBirthDate] = useState('');
  const [emailChallengeId, setEmailChallengeId] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailRecoveryToken, setEmailRecoveryToken] = useState('');
  const [emailAccountId, setEmailAccountId] = useState('');
  const [emailOtpVerified, setEmailOtpVerified] = useState(false);
  const [emailPassword, setEmailPassword] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailStatus, setEmailStatus] = useState('');

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

  const emailInFlight = useRef(false);
  const pinInFlight = useRef(false);
  const requestInFlight = useRef(false);
  const codeInFlight = useRef(false);
  const pollInFlight = useRef(false);

  const showRecoveryFailure = useCallback(
    (
      error: unknown,
      outcome: string,
      fallbackMessage: string,
    ) => {
      const feedback = buildBuklodUserFeedback(
        error,
        {
          context: 'recovery',
          fallbackTitle: 'Recovery not completed',
          fallbackMessage,
        },
      );
      const safeFeedback: BuklodUserFeedback = {
        ...feedback,
        tone: feedback.tone === 'error' ? 'error' : 'warning',
        title: 'Recovery not completed',
        message: fallbackMessage,
        nextStep:
          'Try the current step again. If it repeats, open Need Help.',
        supportCode:
          feedback.supportCode ?? 'REC-100',
        retryable: true,
        needsSupport: true,
      };
      setRecoveryFeedback(safeFeedback);
      void trackBuklodFeedbackEvent({
        event: 'error_shown',
        category: safeFeedback.category,
        supportCode: safeFeedback.supportCode,
        route: '/(auth)/forgot-password',
        feature: 'Account Recovery',
        outcome,
      });
      void trackBuklodFeedbackEvent({
        event: 'action_failed',
        category: safeFeedback.category,
        supportCode: safeFeedback.supportCode,
        route: '/(auth)/forgot-password',
        feature: 'Account Recovery',
        outcome,
      });
      return safeFeedback;
    },
    [],
  );

  const openRecoveryHelp = useCallback(() => {
    const feedback = recoveryFeedback;
    void trackBuklodFeedbackEvent({
      event: 'support_opened_after_error',
      category: feedback?.category ?? 'RECOVERY_REQUIRED',
      supportCode: feedback?.supportCode ?? 'REC-100',
      route: '/(auth)/forgot-password',
      feature: 'Account Recovery',
      outcome: path,
    });

    router.push({
      pathname: '/help' as any,
      params: {
        category:
          emailOtpSent || emailOtpVerified || path === 'admin'
            ? 'RECOVERY_CODE'
            : 'FORGOT_PASSWORD',
        errorCode: feedback?.supportCode ?? 'REC-100',
        message:
          feedback?.message ||
          emailStatus ||
          recoveryStateText ||
          t('recovery.unavailable'),
        sourceRoute: '/(auth)/forgot-password',
      },
    });
  }, [
    emailOtpSent,
    emailOtpVerified,
    emailStatus,
    path,
    recoveryFeedback,
    recoveryStateText,
    t,
  ]);

  const showRecoverySuccess = useCallback(
    (message: string, outcome: string) => {
      const feedback: BuklodUserFeedback = {
        tone: 'success',
        category: null,
        title: t('recovery.passwordUpdated'),
        message,
        nextStep: t('recovery.passwordUpdatedNext'),
        supportCode: null,
        retryable: false,
        needsSupport: false,
      };
      setRecoveryFeedback(feedback);
      showFeedback(feedback, { autoHideMs: 5200 });
      void trackBuklodFeedbackEvent({
        event: 'recovery_success',
        route: '/(auth)/forgot-password',
        feature: 'Account Recovery',
        outcome,
      });
    },
    [showFeedback, t],
  );

  const selectPath = (next: RecoveryPath) => {
    if (emailBusy || pinBusy || requestBusy || codeBusy) return;
    setPath(next);
  };

  useEffect(() => {
    let cancelled = false;

    const checkEmailRecovery = async () => {
      try {
        const { data, error } = await invokeRecovery('account-recovery-otp-v1', {
          body: { action: 'service_status' },
        });
        if (cancelled) return;
        if (error || !data?.ok) {
          setEmailReady(false);
          return;
        }
        setEmailReady(data?.emailReady === true || data?.smsReady === true);
      } catch {
        if (!cancelled) setEmailReady(false);
      }
    };

    void checkEmailRecovery();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!recoverySession) return;
    let cancelled = false;

    const poll = async () => {
      if (pollInFlight.current || cancelled) return;
      pollInFlight.current = true;
      try {
        const { data, error } = await invokeRecovery('account-recovery-v4', {
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
          const nextCode = cleanAdminCode(String(data?.code ?? ''));
          if (!/^[A-Z2-9]{10}$/.test(nextCode)) {
            throw new Error('Verified recovery code was not returned correctly.');
          }
          setReceivedCode(nextCode);
          setCode(nextCode);
          setReceivedCodeExpiresAt(data?.codeExpiresAt ? String(data.codeExpiresAt) : null);
          setRecoveryStateText('ACCOUNT VERIFIED — your one-time recovery code is ready below.');
          setRecoverySession(null);
          if (Platform.OS !== 'web') {
            Alert.alert(
              'ACCOUNT VERIFIED',
              'BUKLOD generated your recovery code automatically. Enter your new password below.'
            );
          }
          return;
        }
        if (state === 'rejected') {
          setRecoveryStateText(data?.message ?? 'This request could not be verified.');
          setRecoverySession(null);
          return;
        }
        if (state === 'session_expired' || state === 'code_expired' || state === 'completed') {
          setRecoveryStateText(
            data?.message ?? 'This recovery session is no longer active. Submit a new request if needed.'
          );
          setRecoverySession(null);
        }
      } catch (error: any) {
        if (!cancelled) {
          setRecoveryStateText(
            `Status check: ${String(error?.message ?? error ?? 'temporarily unavailable')}`
          );
        }
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

  const requestEmailOtp = async () => {
    const clean = email.trim();
    if (!autoForgotLogin && clean.length < 3) {
      return Alert.alert(
        'Automatic Recovery',
        'Enter your registered email, mobile number, or username.'
      );
    }
    if (autoForgotLogin) {
      if (firstName.trim().length < 2 || surname.trim().length < 2) {
        return Alert.alert('Automatic Recovery', 'Enter your first name and surname.');
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate.trim())) {
        return Alert.alert(
          'Automatic Recovery',
          'Enter birthday as YYYY-MM-DD, for example 1990-05-23.'
        );
      }
    }
    if (emailReady === false) {
      return Alert.alert(
        'Automatic Recovery',
        'Automatic recovery is temporarily unavailable. Use Recovery PIN or Admin Help.'
      );
    }
    if (emailInFlight.current) return;

    emailInFlight.current = true;
    setEmailBusy(true);
    setRecoveryFeedback(null);
    setEmailStatus('Checking account and sending a 6-digit recovery code…');
    void trackBuklodFeedbackEvent({
      event: 'recovery_attempted',
      route: '/(auth)/forgot-password',
      feature: 'Automatic Recovery',
      outcome: 'request_otp',
    });
    setEmailOtp('');
    setEmailRecoveryToken('');
    setEmailAccountId('');
    setEmailOtpVerified(false);

    try {
      const { data, error } = await invokeRecovery('account-recovery-otp-v1', {
        body: autoForgotLogin
          ? {
              action: 'request_otp',
              firstName: firstName.trim(),
              middleName: middleName.trim() || undefined,
              surname: surname.trim(),
              birthDate: birthDate.trim(),
            }
          : {
              action: 'request_otp',
              identifier: clean,
              birthDate: autoBirthDate.trim() || undefined,
            },
      });
      if (error) {
        throw new Error(
          await functionErrorMessage(
            error,
            'The account could not be recovered automatically. Check the information or use Admin Help.'
          )
        );
      }
      if (!data?.ok) {
        throw new Error(
          data?.message ??
            'The account could not be recovered automatically. Check the information or use Admin Help.'
        );
      }

      const challengeId = String(data?.challengeId ?? '').trim();
      if (!/^[0-9a-f-]{36}$/i.test(challengeId)) {
        throw new Error('The recovery request was not started correctly. Please try again.');
      }

      if (!autoForgotLogin) setEmail(clean);
      setEmailChallengeId(challengeId);
      setEmailOtpSent(true);
      setEmailStatus(
        String(
          data?.message ??
            'Account matched. A 6-digit recovery code was sent to the registered recovery contact.'
        )
      );
    } catch (error: any) {
      const feedback = showRecoveryFailure(
        error,
        'request_otp_failed',
        'Automatic recovery could not be started. Check your information and try again.',
      );
      setEmailStatus(feedback.message);
    } finally {
      emailInFlight.current = false;
      setEmailBusy(false);
    }
  };

  const verifyEmailOtp = async () => {
    const cleanOtp = cleanEmailOtp(emailOtp);
    if (!emailChallengeId || !emailOtpSent) {
      return Alert.alert('Automatic Recovery', 'Request a recovery code first.');
    }
    if (!/^\d{6}$/.test(cleanOtp)) {
      return Alert.alert('Automatic Recovery', 'Enter the 6-digit recovery code that was sent.');
    }
    if (emailInFlight.current) return;

    emailInFlight.current = true;
    setEmailBusy(true);
    setEmailStatus('Verifying your recovery code…');

    try {
      const { data, error } = await invokeRecovery('account-recovery-otp-v1', {
        body: {
          action: 'verify_otp',
          challengeId: emailChallengeId,
          code: cleanOtp,
        },
      });
      if (error) {
        throw new Error(
          await functionErrorMessage(error, 'The recovery code is invalid or expired.')
        );
      }
      if (!data?.ok) throw new Error(data?.message ?? 'The recovery code is invalid or expired.');

      const recoveryToken = String(data?.recoveryToken ?? '').trim();
      const accounts: OtpAccount[] = Array.isArray(data?.accounts) ? data.accounts : [];
      if (recoveryToken.length < 32 || accounts.length < 1) {
        throw new Error('The verified recovery session could not be completed. Use Admin Help.');
      }
      if (accounts.length > 1) {
        throw new Error(
          'More than one BUKLOD account uses that recovery contact. Use Admin Help so the correct account can be selected safely.'
        );
      }

      setEmailRecoveryToken(recoveryToken);
      setEmailAccountId(String(accounts[0]?.accountId ?? ''));
      setEmailOtpVerified(true);
      setRecoveryFeedback(null);
      setEmailStatus('CODE VERIFIED — create your new password below.');
      void trackBuklodFeedbackEvent({
        event: 'action_success',
        route: '/(auth)/forgot-password',
        feature: 'Automatic Recovery',
        outcome: 'otp_verified',
      });
    } catch (error: any) {
      const feedback = showRecoveryFailure(
        error,
        'verify_otp_failed',
        'The verification code is incorrect, expired, or could not be verified. Request a new code if needed.',
      );
      setEmailStatus(feedback.message);
    } finally {
      emailInFlight.current = false;
      setEmailBusy(false);
    }
  };

  const resetEmailPassword = async () => {
    if (!emailOtpVerified || !emailRecoveryToken || !emailChallengeId || !emailAccountId) {
      return Alert.alert('Automatic Recovery', 'Verify the 6-digit recovery code first.');
    }
    if (emailPassword.length < 8) {
      return Alert.alert('New Password', 'Use at least 8 characters.');
    }
    if (emailPassword !== emailConfirm) {
      return Alert.alert('New Password', 'The passwords do not match.');
    }
    if (emailInFlight.current) return;

    emailInFlight.current = true;
    setEmailBusy(true);
    setRecoveryFeedback(null);
    setEmailStatus(t('recovery.updatingPassword'));

    try {
      const { data, error } = await invokeRecovery('account-recovery-otp-v1', {
        body: {
          action: 'reset_password',
          challengeId: emailChallengeId,
          recoveryToken: emailRecoveryToken,
          accountId: emailAccountId,
          newPassword: emailPassword,
        },
      });
      if (error) {
        throw new Error(
          await functionErrorMessage(error, 'Password reset could not be completed.')
        );
      }
      if (!data?.ok) throw new Error(data?.message ?? 'Password reset could not be completed.');

      const localCleanupOk =
        await recordPasswordResetOnThisDevice({
          userId: emailAccountId,
          loginIdentifier: email.trim().toLowerCase(),
        })
          .then(() => true)
          .catch(cleanupError => {
            console.warn(
              'Password changed, but local saved-login cleanup failed.',
              cleanupError
            );
            return false;
          });

      const successMessage =
        localCleanupOk
          ? 'Password updated successfully. The old saved one-tap password on this device was cleared.'
          : 'Password updated successfully. Use the new password. If one-tap login still shows an old password, remove that saved profile and sign in manually.';
      setEmailStatus(successMessage);
      showRecoverySuccess(successMessage, 'automatic_password_reset');
      showRecoverySuccess(
        'Password updated successfully. You can now sign in using your new password.',
        'pin_password_reset',
      );
      Alert.alert(
        'Password Changed',
        localCleanupOk
          ? 'Your password was changed successfully. BUKLOD cleared the old saved password on this device. Sign in with your new password once, then you may enable Remember password again.'
          : 'Your password was changed successfully. Sign in with the new password. If a saved one-tap profile still uses the old password, remove that saved profile and sign in manually once.',
        [{ text: 'SIGN IN', onPress: () => router.replace('/(auth)/login' as any) }]
      );
    } catch (error: any) {
      const feedback = showRecoveryFailure(
        error,
        'automatic_password_reset_failed',
        "We couldn't update your password right now. Please try again.",
      );
      setEmailStatus(feedback.message);
    } finally {
      emailInFlight.current = false;
      setEmailBusy(false);
    }
  };

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
    setRecoveryFeedback(null);
    void trackBuklodFeedbackEvent({
      event: 'recovery_attempted',
      route: '/(auth)/forgot-password',
      feature: 'Recovery PIN',
      outcome: 'pin_recovery',
    });

    try {
      const { data, error } = await invokeRecovery('account-recovery-v3', {
        body: {
          action: 'recover_with_pin',
          identifier: cleanIdentifier,
          pin,
          newPassword: pinPassword,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? 'Account recovery failed.');

      const recoveredLoginIdentifier =
        String(
          data?.loginIdentifier ??
          cleanIdentifier
        ).trim();

      const localCleanupOk =
        await recordPasswordResetOnThisDevice({
          loginIdentifier:
            recoveredLoginIdentifier,
        })
          .then(() => true)
          .catch(cleanupError => {
            console.warn(
              'Password changed, but local saved-login cleanup failed.',
              cleanupError
            );
            return false;
          });

      Alert.alert(
        'Password Changed',
        localCleanupOk
          ? `Your BUKLOD password is ready. ${formatLoginMethod(data?.loginMethod)}: ${recoveredLoginIdentifier}\n\nThe old saved password on this device was cleared. Sign in with the new password once, then you may enable Remember password again.`
          : `Your BUKLOD password is ready. ${formatLoginMethod(data?.loginMethod)}: ${recoveredLoginIdentifier}\n\nSign in with the new password. If a saved one-tap profile still uses the old password, remove that saved profile and sign in manually once.`,
        [{ text: 'SIGN IN', onPress: () => router.replace('/(auth)/login' as any) }]
      );
    } catch (error: any) {
      showRecoveryFailure(
        error,
        'pin_recovery_failed',
        'Recovery PIN could not complete account recovery. Check the details and try again.',
      );
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
        return Alert.alert(
          'Admin Assistance',
          'Enter birthday as YYYY-MM-DD, for example 1990-05-23.'
        );
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
      const { data, error } = await invokeRecovery('account-recovery-v4', {
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
        throw new Error(
          'Recovery request was received but the private waiting session could not be started. Please submit again.'
        );
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
          'Your request is waiting for System Admin verification. Keep this screen open. Once verified, the one-time recovery code will appear here automatically.'
        );
      }
    } catch (error: any) {
      const feedback = showRecoveryFailure(
        error,
        'assisted_recovery_request_failed',
        "We couldn't submit the assisted recovery request. Please try again.",
      );
      setRecoveryStateText(feedback.message);
    } finally {
      requestInFlight.current = false;
      setRequestBusy(false);
    }
  };

  const recoverWithCode = async () => {
    const clean = cleanAdminCode(code);
    if (!/^[A-Z2-9]{10}$/.test(clean)) {
      return Alert.alert(
        'One-Time Code',
        'Enter the 10-character one-time code shown after admin verification.'
      );
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
      const { data, error } = await invokeRecovery('account-recovery-v4', {
        body: {
          action: 'recover_with_admin_code',
          code: clean,
          newPassword: codePassword,
        },
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? 'Account recovery failed.');

      const login = String(data?.loginIdentifier ?? '').trim();

      const localCleanupOk =
        await recordPasswordResetOnThisDevice({
          loginIdentifier: login || null,
        })
          .then(() => true)
          .catch(cleanupError => {
            console.warn(
              'Password changed, but local saved-login cleanup failed.',
              cleanupError
            );
            return false;
          });

      showRecoverySuccess(
        'Password updated successfully. You can now sign in using your new password.',
        'assisted_password_reset',
      );
      Alert.alert(
        'Account Recovered',
        login
          ? (
              localCleanupOk
                ? `Password changed successfully. Your BUKLOD sign-in is:\n\n${formatLoginMethod(
                    data?.loginMethod
                  )}: ${login}\n\nThe old saved password on this device was cleared. Sign in with the new password once, then you may enable Remember password again.`
                : `Password changed successfully. Your BUKLOD sign-in is:\n\n${formatLoginMethod(
                    data?.loginMethod
                  )}: ${login}\n\nSign in with the new password. If a saved one-tap profile still uses the old password, remove that saved profile and sign in manually once.`
            )
          : (
              localCleanupOk
                ? 'Password changed successfully. The old saved password on this device was cleared. Return to Sign In and use the new password once.'
                : 'Password changed successfully. Return to Sign In and use the new password. If a saved one-tap profile still uses the old password, remove that saved profile first.'
            ),
        [{ text: 'SIGN IN', onPress: () => router.replace('/(auth)/login' as any) }]
      );
    } catch (error: any) {
      showRecoveryFailure(
        error,
        'assisted_code_recovery_failed',
        'The one-time recovery code is invalid, expired, or could not be used. Request a new recovery step if needed.',
      );
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
          Automatic recovery checks your registered email, mobile number, or username. A matched
          account receives a 6-digit code automatically. Admin Help is fallback only.
        </Text>

        {!!recoveryFeedback && (
          <View style={{ marginTop: 12 }}>
            <BuklodFeedbackBanner
              feedback={recoveryFeedback}
              onNeedHelp={openRecoveryHelp}
            />
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={openRecoveryHelp}
          style={styles.helpEntry}
        >
          <MaterialCommunityIcons
            name="lifebuoy"
            size={18}
            color={colors.greenDark}
          />
          <Text style={styles.helpEntryText}>
            {t('support.needHelp')}
          </Text>
        </Pressable>

        <View style={styles.pathRow}>
          <PathButton
            active={path === 'email'}
            icon="account-key-outline"
            label="AUTO"
            onPress={() => selectPath('email')}
          />
          <PathButton
            active={path === 'pin'}
            icon="shield-lock-outline"
            label="PIN"
            onPress={() => selectPath('pin')}
          />
          <PathButton
            active={path === 'admin'}
            icon="account-wrench-outline"
            label="ADMIN"
            onPress={() => selectPath('admin')}
          />
        </View>

        {path === 'email' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Automatic Recovery</Text>
            <Text style={styles.help}>
              Enter your registered email, mobile number, or username. Username recovery also
              requires birthday. If you forgot your login identifier, use name + birthday below.
            </Text>

            {emailReady === null ? (
              <View style={styles.inlineStatus}>
                <ActivityIndicator color={colors.green} />
                <Text style={styles.statusText}>Checking automatic recovery service…</Text>
              </View>
            ) : emailReady === false ? (
              <View style={styles.warningCard}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#8A5A00" />
                <Text style={styles.warningText}>
                  Automatic recovery is temporarily unavailable. Use Recovery PIN or Admin Help.
                </Text>
              </View>
            ) : null}

            <Pressable
              onPress={() => {
                setAutoForgotLogin((value) => !value);
                setEmailChallengeId('');
                setEmailOtp('');
                setEmailOtpSent(false);
                setEmailRecoveryToken('');
                setEmailAccountId('');
                setEmailOtpVerified(false);
                setEmailPassword('');
                setEmailConfirm('');
                setEmailStatus('');
              }}
              style={styles.toggleRow}
            >
              <MaterialCommunityIcons
                name={autoForgotLogin ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={22}
                color={colors.green}
              />
              <Text style={styles.toggleText}>I forgot my login identifier too</Text>
            </Pressable>

            {!autoForgotLogin ? (
              <>
                <FieldLabel>Registered email, mobile number, or username</FieldLabel>
                <TextInput
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    if (emailOtpSent || emailOtpVerified) {
                      setEmailChallengeId('');
                      setEmailOtp('');
                      setEmailOtpSent(false);
                      setEmailRecoveryToken('');
                      setEmailAccountId('');
                      setEmailOtpVerified(false);
                      setEmailPassword('');
                      setEmailConfirm('');
                      setEmailStatus('');
                    }
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="email / 09... / username"
                  editable={!emailBusy && !emailOtpVerified}
                  style={styles.input}
                />
                <FieldLabel>Birthday (required when using username)</FieldLabel>
                <TextInput
                  value={autoBirthDate}
                  onChangeText={(value) =>
                    setAutoBirthDate(value.replace(/[^\d-]/g, '').slice(0, 10))
                  }
                  keyboardType="numbers-and-punctuation"
                  placeholder="YYYY-MM-DD"
                  maxLength={10}
                  editable={!emailBusy && !emailOtpVerified}
                  style={styles.input}
                />
              </>
            ) : (
              <>
                <FieldLabel>First name</FieldLabel>
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  placeholder="First name"
                  editable={!emailBusy && !emailOtpVerified}
                  style={styles.input}
                />
                <FieldLabel>Middle name (optional)</FieldLabel>
                <TextInput
                  value={middleName}
                  onChangeText={setMiddleName}
                  autoCapitalize="words"
                  placeholder="Middle name"
                  editable={!emailBusy && !emailOtpVerified}
                  style={styles.input}
                />
                <FieldLabel>Surname</FieldLabel>
                <TextInput
                  value={surname}
                  onChangeText={setSurname}
                  autoCapitalize="words"
                  placeholder="Surname"
                  editable={!emailBusy && !emailOtpVerified}
                  style={styles.input}
                />
                <FieldLabel>Birthday</FieldLabel>
                <TextInput
                  value={birthDate}
                  onChangeText={(value) =>
                    setBirthDate(value.replace(/[^\d-]/g, '').slice(0, 10))
                  }
                  keyboardType="numbers-and-punctuation"
                  placeholder="YYYY-MM-DD"
                  maxLength={10}
                  editable={!emailBusy && !emailOtpVerified}
                  style={styles.input}
                />
              </>
            )}

            {!emailOtpVerified && (
              <>
                <PrimaryButton
                  busy={emailBusy && !emailOtpSent}
                  disabled={emailReady !== true}
                  label={emailOtpSent ? 'SEND NEW CODE' : 'MATCH ACCOUNT & SEND CODE'}
                  onPress={requestEmailOtp}
                />

                {emailOtpSent && (
                  <>
                    <FieldLabel>6-digit code</FieldLabel>
                    <TextInput
                      value={emailOtp}
                      onChangeText={(value) => setEmailOtp(cleanEmailOtp(value))}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="000000"
                      style={[styles.input, styles.codeInput]}
                    />
                    <PrimaryButton
                      busy={emailBusy}
                      label="VERIFY CODE"
                      onPress={verifyEmailOtp}
                    />
                  </>
                )}
              </>
            )}

            {emailOtpVerified && (
              <>
                <View style={styles.verifiedCard}>
                  <MaterialCommunityIcons name="check-decagram" size={23} color="#176B39" />
                  <Text style={styles.verifiedText}>
                    Recovery code verified. Set your new password.
                  </Text>
                </View>
                <FieldLabel>New password</FieldLabel>
                <TextInput
                  value={emailPassword}
                  onChangeText={setEmailPassword}
                  secureTextEntry
                  placeholder="At least 8 characters"
                  style={styles.input}
                />
                <FieldLabel>Confirm new password</FieldLabel>
                <TextInput
                  value={emailConfirm}
                  onChangeText={setEmailConfirm}
                  secureTextEntry
                  placeholder="Re-enter new password"
                  style={styles.input}
                />
                <PrimaryButton
                  busy={emailBusy}
                  label="RESET PASSWORD"
                  onPress={resetEmailPassword}
                />
              </>
            )}

            {!!emailStatus && (
              <View style={styles.inlineStatus}>
                <MaterialCommunityIcons
                  name={emailOtpVerified ? 'check-circle-outline' : 'information-outline'}
                  size={20}
                  color={colors.green}
                />
                <Text style={styles.statusText}>{emailStatus}</Text>
              </View>
            )}

            <Text style={styles.privacyText}>
              If the details do not match an active account, BUKLOD rejects the request immediately.
              If matched, the code is generated and sent automatically. Codes expire quickly and
              cannot be reused.
            </Text>
          </View>
        )}

        {path === 'pin' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>I remember my Recovery PIN</Text>
            <Text style={styles.help}>
              Use the 6-digit Recovery PIN you created in My BUKLOD. Your login may be your
              username, Philippine mobile number, or email.
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
            <TextInput
              value={pinPassword}
              onChangeText={setPinPassword}
              secureTextEntry
              placeholder="At least 8 characters"
              style={styles.input}
            />
            <FieldLabel>Confirm new password</FieldLabel>
            <TextInput
              value={pinConfirm}
              onChangeText={setPinConfirm}
              secureTextEntry
              placeholder="Re-enter new password"
              style={styles.input}
            />
            <PrimaryButton busy={pinBusy} label="RESET PASSWORD" onPress={recoverWithPin} />
          </View>
        )}

        {path === 'admin' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Admin Help — fallback only</Text>
              <Text style={styles.help}>
                If you still know your registered email, mobile number, or username, enter it below.
                Name + birthday is required only when you also forgot every login identifier.
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
                  <FieldLabel>Registered email, mobile number, or username</FieldLabel>
                  <TextInput
                    value={adminIdentifier}
                    onChangeText={setAdminIdentifier}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="email / 09... / username"
                    style={styles.input}
                  />
                  <View style={styles.verifiedCard}>
                    <MaterialCommunityIcons name="information-outline" size={22} color="#176B39" />
                    <Text style={styles.verifiedText}>
                      When a registered login is supplied, BUKLOD does not ask for name + birthday
                      to match the account.
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <FieldLabel>First name</FieldLabel>
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                    placeholder="First name"
                    style={styles.input}
                  />
                  <FieldLabel>Middle name (optional)</FieldLabel>
                  <TextInput
                    value={middleName}
                    onChangeText={setMiddleName}
                    autoCapitalize="words"
                    placeholder="Middle name"
                    style={styles.input}
                  />
                  <FieldLabel>Surname</FieldLabel>
                  <TextInput
                    value={surname}
                    onChangeText={setSurname}
                    autoCapitalize="words"
                    placeholder="Surname"
                    style={styles.input}
                  />
                  <FieldLabel>Birthday</FieldLabel>
                  <TextInput
                    value={birthDate}
                    onChangeText={(value) =>
                      setBirthDate(value.replace(/[^\d-]/g, '').slice(0, 10))
                    }
                    keyboardType="numbers-and-punctuation"
                    placeholder="YYYY-MM-DD"
                    maxLength={10}
                    style={styles.input}
                  />
                </>
              )}

              <PrimaryButton
                busy={requestBusy}
                label={requestSent ? 'SUBMIT NEW REQUEST' : 'REQUEST ADMIN ASSISTANCE'}
                onPress={requestAdminHelp}
              />

              {!!recoveryStateText && (
                <View style={[styles.waitingCard, !!receivedCode && styles.verifiedCard]}>
                  {receivedCode ? (
                    <MaterialCommunityIcons name="check-decagram" size={26} color="#176B39" />
                  ) : recoverySession ? (
                    <ActivityIndicator color={colors.green} />
                  ) : (
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={24}
                      color={colors.green}
                    />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.waitingTitle}>
                      {receivedCode ? 'ACCOUNT VERIFIED' : 'RECOVERY STATUS'}
                    </Text>
                    <Text style={styles.waitingText}>{recoveryStateText}</Text>
                  </View>
                </View>
              )}

              {!!receivedCode && (
                <View style={styles.receivedCodeCard}>
                  <Text style={styles.receivedCodeLabel}>YOUR ONE-TIME RECOVERY CODE</Text>
                  <Text selectable style={styles.receivedCodeText}>
                    {receivedCode}
                  </Text>
                  <Text style={styles.receivedCodeExpiry}>
                    Expires: {formatExpiry(receivedCodeExpiresAt)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {receivedCode ? 'Create your new password' : 'Already received an admin code?'}
              </Text>
              <FieldLabel>10-character one-time code</FieldLabel>
              <TextInput
                value={code}
                onChangeText={(value) => setCode(cleanAdminCode(value))}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={10}
                placeholder="XXXXXXXXXX"
                style={[styles.input, styles.codeInput]}
              />
              <FieldLabel>New password</FieldLabel>
              <TextInput
                value={codePassword}
                onChangeText={setCodePassword}
                secureTextEntry
                placeholder="At least 8 characters"
                style={styles.input}
              />
              <FieldLabel>Confirm new password</FieldLabel>
              <TextInput
                value={codeConfirm}
                onChangeText={setCodeConfirm}
                secureTextEntry
                placeholder="Re-enter new password"
                style={styles.input}
              />
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
      <MaterialCommunityIcons
        name={icon}
        size={18}
        color={active ? colors.green : '#647067'}
      />
      <Text style={[styles.pathText, active && styles.pathTextActive]}>{label}</Text>
    </Pressable>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

function PrimaryButton({
  busy,
  disabled = false,
  label,
  onPress,
}: {
  busy: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  const isDisabled = busy || disabled;
  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      style={[styles.primaryButton, isDisabled && styles.primaryButtonDisabled]}
    >
      {busy ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.primaryButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F8F5',
  },
  content: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 48,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    paddingVertical: 8,
  },
  backText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7F3E9',
    marginTop: 14,
  },
  title: {
    marginTop: 14,
    color: colors.text,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 8,
    color: '#5D685F',
    fontSize: 14,
    lineHeight: 21,
  },
  pathRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    marginBottom: 14,
  },
  pathButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7DED8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 6,
  },
  pathButtonActive: {
    borderColor: colors.green,
    backgroundColor: '#EDF7EF',
  },
  pathText: {
    color: '#647067',
    fontSize: 11,
    fontWeight: '800',
  },
  pathTextActive: {
    color: colors.green,
  },
  card: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderWidth: 1,
    borderColor: '#E0E6E1',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  help: {
    marginTop: 7,
    marginBottom: 10,
    color: '#667169',
    fontSize: 13,
    lineHeight: 19,
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#D3DBD5',
    borderRadius: 12,
    paddingHorizontal: 13,
    backgroundColor: '#FFFFFF',
    color: colors.text,
    fontSize: 15,
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 4,
    fontSize: 18,
    fontWeight: '800',
  },
  primaryButton: {
    minHeight: 50,
    marginTop: 16,
    borderRadius: 13,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  inlineStatus: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 12,
    backgroundColor: '#F1F7F2',
    padding: 12,
  },
  statusText: {
    flex: 1,
    color: '#38523E',
    fontSize: 13,
    lineHeight: 18,
  },
  warningCard: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderRadius: 12,
    backgroundColor: '#FFF8E8',
    padding: 12,
  },
  warningText: {
    flex: 1,
    color: '#6B5016',
    fontSize: 13,
    lineHeight: 18,
  },
  verifiedCard: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderRadius: 12,
    backgroundColor: '#EAF7ED',
    padding: 12,
  },
  verifiedText: {
    flex: 1,
    color: '#255D34',
    fontSize: 13,
    lineHeight: 18,
  },
  privacyText: {
    marginTop: 14,
    color: '#718078',
    fontSize: 12,
    lineHeight: 17,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
  },
  toggleText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  waitingCard: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderRadius: 12,
    padding: 13,
    backgroundColor: '#F1F7F2',
  },
  waitingTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  waitingText: {
    marginTop: 4,
    color: '#536159',
    fontSize: 13,
    lineHeight: 18,
  },
  receivedCodeCard: {
    marginTop: 14,
    borderRadius: 14,
    padding: 15,
    backgroundColor: '#F5FAF6',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4E7D8',
  },
  receivedCodeLabel: {
    color: '#52705A',
    fontSize: 11,
    fontWeight: '800',
  },
  receivedCodeText: {
    marginTop: 8,
    color: colors.text,
    fontSize: 24,
    letterSpacing: 3,
    fontWeight: '900',
  },
  receivedCodeExpiry: {
    marginTop: 6,
    color: '#68756D',
    fontSize: 12,
  },
  helpEntry: {
    marginTop: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  helpEntryText: {
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: '900',
    textDecorationLine: 'underline',
  },
});
