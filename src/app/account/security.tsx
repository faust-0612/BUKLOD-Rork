import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import * as Clipboard
  from 'expo-clipboard';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  supabase,
} from '@/lib/supabase';

import {
  colors,
} from '@/lib/theme';

import {
  passwordRecoveryRedirectUrl,
} from '@/lib/buklodAuthRecovery';

type SecurityStatus = {
  email:
    | string
    | null;
  email_confirmed:
    boolean;
  real_email:
    boolean;
  email_recovery_ready:
    boolean;
  recovery_code_count:
    number;
};

export default function
AccountSecurityScreen() {
  const [
    status,
    setStatus,
  ] =
    useState<
      SecurityStatus | null
    >(null);

  const [
    loading,
    setLoading,
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

  const [
    codes,
    setCodes,
  ] =
    useState<
      string[]
    >([]);

  const load =
    useCallback(
      async () => {
        setLoading(true);

        try {
          const {
            data,
            error,
          } =
            await (
              supabase as any
            ).rpc(
              'buklod_account_security_status'
            );

          if (error) {
            throw error;
          }

          const row =
            Array.isArray(
              data
            )
              ? data[0] ??
                null
              : data ??
                null;

          if (row) {
            setStatus({
              email:
                row.email ??
                null,
              email_confirmed:
                Boolean(
                  row
                    .email_confirmed
                ),
              real_email:
                Boolean(
                  row
                    .real_email
                ),
              email_recovery_ready:
                Boolean(
                  row
                    .email_recovery_ready
                ),
              recovery_code_count:
                Number(
                  row
                    .recovery_code_count ??
                    0
                ),
            });
          }
        } catch (
          error
        ) {
          Alert.alert(
            'My Account',
            String(
              (
                error as any
              )?.message ??
                error
            )
          );
        } finally {
          setLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    void load();
  }, [load]);

  const changePassword =
    async () => {
      if (
        password.length <
        8
      ) {
        Alert.alert(
          'Change Password',
          'Use at least 8 characters.'
        );
        return;
      }

      if (
        password !==
        confirm
      ) {
        Alert.alert(
          'Change Password',
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

        setPassword('');
        setConfirm('');

        Alert.alert(
          'Password Updated',
          'Your new password is now active.'
        );
      } catch (
        error
      ) {
        Alert.alert(
          'Change Password',
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

  const sendRecoveryEmail =
    async () => {
      if (
        !status
          ?.email_recovery_ready ||
        !status.email
      ) {
        Alert.alert(
          'Recovery Email',
          'This account does not yet have a real confirmed auth email for self-service email recovery.'
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
            .resetPasswordForEmail(
              status.email,
              {
                redirectTo:
                  passwordRecoveryRedirectUrl(),
              }
            );

        if (error) {
          throw error;
        }

        Alert.alert(
          'Recovery Email',
          'A password recovery link was sent to your confirmed email.'
        );
      } catch (
        error
      ) {
        Alert.alert(
          'Recovery Email',
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

  const generateCodes =
    async () => {
      Alert.alert(
        'Generate Recovery Codes?',
        'This will invalidate every previous BUKLOD recovery code. Save the new codes somewhere outside this phone.',
        [
          {
            text:
              'CANCEL',
            style:
              'cancel',
          },
          {
            text:
              'GENERATE',
            onPress:
              () => {
                void (
                  async () => {
                    setBusy(
                      true
                    );

                    try {
                      const {
                        data,
                        error,
                      } =
                        await supabase
                          .functions
                          .invoke(
                            'account-recovery',
                            {
                              body: {
                                action:
                                  'generate',
                              },
                            }
                          );

                      if (
                        error
                      ) {
                        throw error;
                      }

                      const next =
                        Array.isArray(
                          data
                            ?.codes
                        )
                          ? data
                              .codes
                              .map(
                                (
                                  item:
                                    any
                                ) =>
                                  String(
                                    item
                                  )
                              )
                          : [];

                      if (
                        !next
                          .length
                      ) {
                        throw new Error(
                          'No recovery codes were returned.'
                        );
                      }

                      setCodes(
                        next
                      );

                      await load();

                      Alert.alert(
                        'Recovery Codes Ready',
                        'Copy or write down these codes now. BUKLOD does not store the readable version.'
                      );
                    } catch (
                      error
                    ) {
                      Alert.alert(
                        'Recovery Codes',
                        String(
                          (
                            error as any
                          )?.message ??
                            error
                        )
                      );
                    } finally {
                      setBusy(
                        false
                      );
                    }
                  }
                )();
              },
          },
        ]
      );
    };

  const copyCodes =
    async () => {
      if (!codes.length) {
        return;
      }

      await Clipboard
        .setStringAsync(
          codes.join(
            '\n'
          )
        );

      Alert.alert(
        'Copied',
        'Recovery codes copied. Store them somewhere private and outside this device.'
      );
    };

  if (loading) {
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
      </View>
    );
  }

  const emailReady =
    Boolean(
      status
        ?.email_recovery_ready
    );

  const codeReady =
    Number(
      status
        ?.recovery_code_count ??
        0
    ) > 0;

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={
        styles.content
      }
    >
      <Text
        style={
          styles.eyebrow
        }
      >
        MY ACCOUNT
      </Text>

      <Text
        style={
          styles.title
        }
      >
        Password & Recovery
      </Text>

      <Text
        style={
          styles.subtitle
        }
      >
        BUKLOD never stores or shows
        your readable password. Use a
        confirmed email or offline
        recovery codes to reset it
        safely.
      </Text>

      <View
        style={
          styles.readiness
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          RECOVERY READINESS
        </Text>

        <View
          style={
            styles.statusRow
          }
        >
          <MaterialCommunityIcons
            name={
              emailReady
                ? 'check-circle'
                : 'alert-circle-outline'
            }
            size={21}
            color={
              emailReady
                ? colors.green
                : '#B26A00'
            }
          />

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              style={
                styles.statusTitle
              }
            >
              Email Recovery
            </Text>

            <Text
              style={
                styles.statusText
              }
            >
              {emailReady
                ? `Ready • ${status?.email}`
                : status?.real_email
                ? 'Real email exists but is not confirmed in Supabase Auth.'
                : 'Not configured for this account.'}
            </Text>
          </View>
        </View>

        <View
          style={
            styles.statusRow
          }
        >
          <MaterialCommunityIcons
            name={
              codeReady
                ? 'check-circle'
                : 'key-alert-outline'
            }
            size={21}
            color={
              codeReady
                ? colors.green
                : '#B26A00'
            }
          />

          <View
            style={{
              flex: 1,
            }}
          >
            <Text
              style={
                styles.statusTitle
              }
            >
              Offline Recovery Codes
            </Text>

            <Text
              style={
                styles.statusText
              }
            >
              {codeReady
                ? `${status?.recovery_code_count} unused code(s) are active.`
                : 'No saved emergency recovery set yet.'}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={
          styles.card
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          CHANGE PASSWORD
        </Text>

        <TextInput
          value={
            password
          }
          onChangeText={
            setPassword
          }
          placeholder="New password"
          secureTextEntry
          style={
            styles.input
          }
        />

        <TextInput
          value={
            confirm
          }
          onChangeText={
            setConfirm
          }
          placeholder="Confirm new password"
          secureTextEntry
          style={
            styles.input
          }
        />

        <Pressable
          disabled={
            busy
          }
          onPress={() =>
            void changePassword()
          }
          style={[
            styles.primary,
            busy && {
              opacity:
                0.5,
            },
          ]}
        >
          <Text
            style={
              styles.primaryText
            }
          >
            CHANGE PASSWORD
          </Text>
        </Pressable>
      </View>

      <View
        style={
          styles.card
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          EMAIL RECOVERY
        </Text>

        <Text
          style={
            styles.help
          }
        >
          A real confirmed auth email
          is also required before an
          account may create a Church
          organization.
        </Text>

        <Pressable
          disabled={
            busy ||
            !emailReady
          }
          onPress={() =>
            void sendRecoveryEmail()
          }
          style={[
            styles.outline,
            !emailReady && {
              opacity:
                0.45,
            },
          ]}
        >
          <Text
            style={
              styles.outlineText
            }
          >
            SEND TEST RECOVERY EMAIL
          </Text>
        </Pressable>
      </View>

      <View
        style={
          styles.card
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          OFFLINE RECOVERY CODES
        </Text>

        <Text
          style={
            styles.help
          }
        >
          This is the fallback for an
          account with no usable phone
          or email. The codes reset the
          password; they never reveal
          the old password.
        </Text>

        <Pressable
          disabled={
            busy
          }
          onPress={
            generateCodes
          }
          style={
            styles.outline
          }
        >
          <Text
            style={
              styles.outlineText
            }
          >
            {codeReady
              ? 'REGENERATE RECOVERY CODES'
              : 'GENERATE RECOVERY CODES'}
          </Text>
        </Pressable>

        {!!codes.length && (
          <View
            style={
              styles.codesBox
            }
          >
            <Text
              style={
                styles.warning
              }
            >
              SAVE THESE NOW — THEY
              WILL NOT BE SHOWN AGAIN
              AFTER YOU LEAVE THIS
              SCREEN.
            </Text>

            {codes.map(
              (
                code,
                index
              ) => (
                <Text
                  selectable
                  key={
                    code
                  }
                  style={
                    styles.code
                  }
                >
                  {index + 1}. {code}
                </Text>
              )
            )}

            <Pressable
              onPress={() =>
                void copyCodes()
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
                COPY ALL CODES
              </Text>
            </Pressable>
          </View>
        )}
      </View>
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

    content: {
      padding: 18,
      paddingBottom: 42,
      backgroundColor:
        colors.background,
    },

    eyebrow: {
      color:
        colors.green,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    title: {
      marginTop: 3,
      color:
        colors.greenDark,
      fontSize: 25,
      fontWeight: '900',
    },

    subtitle: {
      marginTop: 6,
      marginBottom: 14,
      color:
        colors.muted,
      fontSize: 10.5,
      lineHeight: 16,
    },

    readiness: {
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 17,
      backgroundColor:
        '#F0F7F3',
    },

    card: {
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 17,
      backgroundColor:
        colors.white,
    },

    sectionTitle: {
      marginBottom: 9,
      color:
        colors.greenDark,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.55,
    },

    statusRow: {
      flexDirection:
        'row',
      gap: 9,
      alignItems:
        'center',
      marginBottom: 9,
    },

    statusTitle: {
      color:
        colors.text,
      fontSize: 11,
      fontWeight: '900',
    },

    statusText: {
      marginTop: 2,
      color:
        colors.muted,
      fontSize: 8.5,
      lineHeight: 13,
    },

    input: {
      minHeight: 47,
      paddingHorizontal: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor:
        colors.line,
      borderRadius: 12,
      backgroundColor:
        '#F8FAF9',
      color:
        colors.text,
    },

    help: {
      color:
        colors.muted,
      fontSize: 9.5,
      lineHeight: 15,
    },

    primary: {
      minHeight: 48,
      marginTop: 10,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderRadius: 12,
      backgroundColor:
        colors.greenDark,
    },

    primaryText: {
      color:
        colors.white,
      fontSize: 9.5,
      fontWeight: '900',
      letterSpacing: 0.3,
    },

    outline: {
      minHeight: 48,
      marginTop: 10,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth: 1,
      borderColor:
        colors.green,
      borderRadius: 12,
      backgroundColor:
        colors.white,
    },

    outlineText: {
      color:
        colors.greenDark,
      fontSize: 9.5,
      fontWeight: '900',
      textAlign:
        'center',
    },

    codesBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor:
        '#FFF8E8',
    },

    warning: {
      marginBottom: 9,
      color:
        '#8A4B00',
      fontSize: 8.5,
      lineHeight: 13,
      fontWeight: '900',
    },

    code: {
      marginBottom: 7,
      color:
        colors.text,
      fontSize: 8.5,
      lineHeight: 13,
      fontWeight: '700',
    },
  });
