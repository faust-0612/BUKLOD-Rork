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

export default function
ResetPasswordScreen() {
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
            'Recovery deep link:',
            String(
              (
                error as any
              )?.message ??
                error
            )
          );
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
        Alert.alert(
          'New Password',
          'Use at least 8 characters.'
        );
        return;
      }

      if (
        password !==
        confirm
      ) {
        Alert.alert(
          'New Password',
          'The passwords do not match.'
        );
        return;
      }

      setBusy(true);

      try {
        const {
          error,
        } =
          await supabase
            .auth
            .updateUser({
              password,
            });

        if (error) {
          throw error;
        }

        await supabase
          .auth
          .signOut();

        Alert.alert(
          'Password Changed',
          'Your new password is ready. Sign in again.',
          [
            {
              text:
                'SIGN IN',
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
        Alert.alert(
          'New Password',
          String(
            (
              error as any
            )?.message ??
              error
          )
        );
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
                SAVE NEW PASSWORD
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
