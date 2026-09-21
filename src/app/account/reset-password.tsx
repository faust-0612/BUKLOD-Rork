import React, {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Linking as RNLinking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  router,
} from 'expo-router';

import {
  supabase,
} from '@/lib/supabase';

import {
  colors,
} from '@/lib/theme';

import {
  consumeSupabaseRecoveryUrl,
} from '@/lib/buklodAuthRecovery';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { BuklodFeedbackBanner } from '@/components/BuklodFeedbackBanner';
import { useBuklodFeedback } from '@/providers/BuklodFeedbackProvider';
import { useBuklodI18n } from '@/providers/BuklodI18nProvider';
import {
  buildBuklodUserFeedback,
  trackBuklodFeedbackEvent,
  type BuklodUserFeedback,
} from '@/lib/buklodUserFeedback';

export default function
ResetPasswordScreen() {
  const { t } = useBuklodI18n();
  const { showFeedback } = useBuklodFeedback();
  const [feedback, setFeedback] =
    useState<BuklodUserFeedback | null>(null);
  const [
    ready,
    setReady,
  ] =
    useState(false);

  const [
    checking,
    setChecking,
  ] =
    useState(true);

  const [
    password,
    setPassword,
  ] =
    useState('');

  const [
    confirm,
    setConfirm,
  ] =
    useState('');

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  useEffect(() => {
    let active =
      true;

    const handle =
      async (
        url:
          | string
          | null
      ) => {
        try {
          await consumeSupabaseRecoveryUrl(
            url
          );
        } catch (
          error
        ) {
          console.warn(
            'Recovery deep link could not be consumed.'
          );
          const next = buildBuklodUserFeedback(
            error,
            {
              context: 'recovery',
              fallbackTitle: 'Recovery link problem',
              fallbackMessage:
                'This recovery link could not be opened safely. Request a new recovery link.',
            },
          );
          if (active) {
            setFeedback({
              ...next,
              title: 'Recovery link problem',
              message:
                'This recovery link could not be opened safely. Request a new recovery link.',
              nextStep: 'Request a new recovery link or open Need Help.',
              supportCode: next.supportCode ?? 'REC-100',
              needsSupport: true,
            });
          }
          void trackBuklodFeedbackEvent({
            event: 'error_shown',
            category: next.category,
            supportCode: next.supportCode ?? 'REC-100',
            route: '/account/reset-password',
            feature: 'Password Recovery',
            outcome: 'recovery_link_failed',
          });
        }

        const {
          data,
        } =
          await supabase
            .auth
            .getSession();

        if (active) {
          setReady(
            Boolean(
              data.session
            )
          );
          setChecking(
            false
          );
        }
      };

    void RNLinking
      .getInitialURL()
      .then(
        handle
      );

    const linkSub =
      RNLinking
        .addEventListener(
          'url',
          event => {
            void handle(
              event.url
            );
          }
        );

    const {
      data:
        authListener,
    } =
      supabase
        .auth
        .onAuthStateChange(
          (
            event,
            session
          ) => {
            if (
              !active
            ) {
              return;
            }

            if (
              event ===
                'PASSWORD_RECOVERY' ||
              session
            ) {
              setReady(
                Boolean(
                  session
                )
              );
              setChecking(
                false
              );
            }
          }
        );

    return () => {
      active =
        false;

      linkSub.remove();

      authListener
        .subscription
        .unsubscribe();
    };
  }, []);

  const save =
    async () => {
      if (
        password.length <
        8
      ) {
        setFeedback({
          tone: 'warning',
          category: 'VALIDATION_ERROR',
          title: 'Password is too short',
          message: 'Use at least 8 characters.',
          nextStep: 'Create a longer password, then try again.',
          supportCode: null,
          retryable: false,
          needsSupport: false,
        });
        return;
      }

      if (
        password !==
        confirm
      ) {
        setFeedback({
          tone: 'warning',
          category: 'VALIDATION_ERROR',
          title: 'Passwords do not match',
          message: 'The two password fields must match.',
          nextStep: 'Re-enter the confirmation password.',
          supportCode: null,
          retryable: false,
          needsSupport: false,
        });
        return;
      }

      setBusy(true);
      setFeedback(null);
      void trackBuklodFeedbackEvent({
        event: 'recovery_attempted',
        route: '/account/reset-password',
        feature: 'Password Recovery',
        outcome: 'password_update',
      });

      try {
        const {
          error,
        } =
          await withBuklodTimeout(
            supabase
              .auth
              .updateUser({
                password,
              }),
            15_000,
            'Update recovery password',
          );

        if (error) {
          throw error;
        }

        await withBuklodTimeout(
          supabase.auth.signOut(),
          10_000,
          'Recovery sign out',
        );

        const successFeedback: BuklodUserFeedback = {
          tone: 'success',
          category: null,
          title: t('recovery.passwordUpdated'),
          message: t('recovery.passwordUpdatedNext'),
          nextStep: 'Go to Login and use your new password.',
          supportCode: null,
          retryable: false,
          needsSupport: false,
        };
        setFeedback(successFeedback);
        showFeedback(successFeedback, { autoHideMs: 5200 });
        void trackBuklodFeedbackEvent({
          event: 'recovery_success',
          route: '/account/reset-password',
          feature: 'Password Recovery',
          outcome: 'password_updated',
        });

        Alert.alert(
          t('recovery.passwordUpdated'),
          t('recovery.passwordUpdatedNext'),
          [
            {
              text:
                'GO TO LOGIN',
              onPress:
                () =>
                  router.replace(
                    '/(auth)/login'
                  ),
            },
          ]
        );
      } catch (
        error
      ) {
        const next = buildBuklodUserFeedback(
          error,
          {
            context: 'recovery',
            fallbackTitle: 'Password update failed',
            fallbackMessage:
              "We couldn't update your password right now.",
          },
        );
        const safeFeedback: BuklodUserFeedback = {
          ...next,
          title: 'Password update failed',
          message:
            "We couldn't update your password right now.",
          nextStep: 'Try again. If it repeats, open Need Help.',
          supportCode: next.supportCode ?? 'REC-100',
          needsSupport: true,
        };
        setFeedback(safeFeedback);
        void trackBuklodFeedbackEvent({
          event: 'error_shown',
          category: safeFeedback.category,
          supportCode: safeFeedback.supportCode,
          route: '/account/reset-password',
          feature: 'Password Recovery',
          outcome: 'password_update_failed',
        });
      } finally {
        setBusy(false);
      }
    };

  if (checking) {
    return (
      <View
        style={
          styles.center
        }
      >
        <ActivityIndicator
          color={
            colors.green
          }
        />

        <Text
          style={
            styles.checking
          }
        >
          Checking recovery link...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={
        styles.content
      }
    >
      <View
        style={
          styles.icon
        }
      >
        <MaterialCommunityIcons
          name="key-change"
          size={34}
          color={
            colors.white
          }
        />
      </View>

      <Text
        style={
          styles.title
        }
      >
        Set New Password
      </Text>

      {!!feedback && (
        <View style={styles.feedbackWrap}>
          <BuklodFeedbackBanner
            feedback={feedback}
            onRetry={
              feedback.retryable && !busy
                ? () => void save()
                : null
            }
            onNeedHelp={
              feedback.needsSupport
                ? () => {
                    void trackBuklodFeedbackEvent({
                      event: 'support_opened_after_error',
                      category: feedback.category,
                      supportCode: feedback.supportCode,
                      route: '/account/reset-password',
                      feature: 'Password Recovery',
                      outcome: 'need_help',
                    });
                    router.push({
                      pathname: '/help' as any,
                      params: {
                        category: 'RECOVERY_CODE',
                        errorCode: feedback.supportCode ?? 'REC-100',
                        message: feedback.message,
                        sourceRoute: '/account/reset-password',
                      },
                    });
                  }
                : null
            }
          />
        </View>
      )}

      {!ready ? (
        <View
          style={
            styles.card
          }
        >
          <Text
            style={
              styles.message
            }
          >
            This recovery link is not
            active. Request a new
            password recovery email
            from the sign-in screen.
          </Text>

          <Pressable
            onPress={() =>
              router.replace(
                '/(auth)/forgot-password'
              )
            }
            style={
              styles.primary
            }
          >
            <Text
              style={
                styles.primaryText
              }
            >
              REQUEST NEW LINK
            </Text>
          </Pressable>
        </View>
      ) : (
        <View
          style={
            styles.card
          }
        >
          <Text
            style={
              styles.label
            }
          >
            New Password
          </Text>

          <TextInput
            value={
              password
            }
            onChangeText={
              setPassword
            }
            secureTextEntry
            placeholder="At least 8 characters"
            style={
              styles.input
            }
          />

          <Text
            style={
              styles.label
            }
          >
            Confirm Password
          </Text>

          <TextInput
            value={
              confirm
            }
            onChangeText={
              setConfirm
            }
            secureTextEntry
            placeholder="Repeat new password"
            style={
              styles.input
            }
          />

          <Pressable
            disabled={
              busy
            }
            onPress={() =>
              void save()
            }
            style={[
              styles.primary,
              busy && {
                opacity:
                  0.5,
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator
                color={
                  colors.white
                }
              />
            ) : (
              <Text
                style={
                  styles.primaryText
                }
              >
                {busy ? 'UPDATING PASSWORD…' : 'SAVE NEW PASSWORD'}
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.background,
    },

    checking: {
      marginTop: 8,
      color:
        colors.muted,
    },

    content: {
      flexGrow: 1,
      justifyContent:
        'center',
      padding: 22,
      backgroundColor:
        colors.background,
    },

    icon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      alignSelf:
        'center',
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.greenDark,
    },

    title: {
      marginTop: 14,
      marginBottom: 14,
      textAlign:
        'center',
      color:
        colors.greenDark,
      fontSize: 26,
      fontWeight: '900',
    },

    feedbackWrap: {
      width: '100%',
      maxWidth: 620,
      alignSelf: 'center',
      marginBottom: 12,
    },

    card: {
      padding: 16,
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 18,
      backgroundColor:
        colors.white,
    },

    message: {
      color:
        colors.text,
      lineHeight: 19,
      textAlign:
        'center',
    },

    label: {
      marginTop: 5,
      marginBottom: 5,
      color:
        colors.text,
      fontSize: 11,
      fontWeight: '900',
    },

    input: {
      minHeight: 48,
      paddingHorizontal: 12,
      marginBottom: 7,
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 12,
      backgroundColor:
        '#F8FAF9',
      color:
        colors.text,
    },

    primary: {
      minHeight: 50,
      marginTop: 14,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderRadius: 13,
      backgroundColor:
        colors.greenDark,
    },

    primaryText: {
      color:
        colors.white,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.35,
    },
  });
