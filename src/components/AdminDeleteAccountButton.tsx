import React, {
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  supabase,
} from '@/lib/supabase';

import {
  useAuth,
} from '@/providers/AuthProvider';

export default function
AdminDeleteAccountButton({
  userId,
  userName,
  disabled = false,
  onDeleted,
}: {
  userId: string;
  userName: string;
  disabled?: boolean;
  onDeleted?: () => void;
}) {
  const {
    profile,
  } =
    useAuth();

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const isSelf =
    profile?.id ===
    userId;

  const execute =
    async () => {
      if (
        isSelf ||
        busy
      ) {
        return;
      }

      setBusy(true);

      try {
        const {
          data,
          error,
        } =
          await supabase
            .functions
            .invoke(
              'admin-delete-user',
              {
                body: {
                  user_id:
                    userId,
                },
              },
            );

        if (error) {
          let message =
            error.message;

          try {
            const context =
              (error as any)
                ?.context;

            if (
              context &&
              typeof context.json ===
                'function'
            ) {
              const payload =
                await context.json();

              if (
                payload?.error
              ) {
                message =
                  payload.error;
              }
            }
          }
          catch {
            // Use original error message.
          }

          throw new Error(
            message,
          );
        }

        if (
          data?.error
        ) {
          throw new Error(
            String(
              data.error,
            ),
          );
        }

        Alert.alert(
          'Account Deleted',
          `${userName} was permanently removed from BUKLOD.`,
        );

        onDeleted?.();
      }
      catch (
        error: any
      ) {
        Alert.alert(
          'Delete Account Failed',
          error?.message ??
            'The account could not be deleted.',
        );
      }
      finally {
        setBusy(false);
      }
    };

  const confirm =
    () => {
      if (isSelf) {
        Alert.alert(
          'Protected System Admin',
          'Your currently signed-in System Admin account cannot be deleted from User Management.',
        );
        return;
      }

      Alert.alert(
        'Delete Account Permanently?',
        `Delete ${userName}? This permanently removes the Auth account and associated cascade data.`,
        [
          {
            text:
              'Cancel',
            style:
              'cancel',
          },

          {
            text:
              'Continue',
            style:
              'destructive',
            onPress:
              () => {
                Alert.alert(
                  'Final Confirmation',
                  `Permanently delete ${userName}? This cannot be undone.`,
                  [
                    {
                      text:
                        'Cancel',
                      style:
                        'cancel',
                    },

                    {
                      text:
                        'DELETE PERMANENTLY',
                      style:
                        'destructive',
                      onPress:
                        () =>
                          void execute(),
                    },
                  ],
                );
              },
          },
        ],
      );
    };

  return (
    <Pressable
      disabled={
        disabled ||
        busy
      }
      onPress={
        confirm
      }
      style={[
        styles.button,
        (
          disabled ||
          busy
        ) &&
          styles.disabled,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          size="small"
          color="#B42318"
        />
      ) : (
        <MaterialCommunityIcons
          name={
            isSelf
              ? 'shield-lock-outline'
              : 'delete-forever-outline'
          }
          size={19}
          color="#B42318"
        />
      )}

      <Text
        style={
          styles.text
        }
      >
        {isSelf
          ? 'CURRENT SYSTEM ADMIN'
          : 'DELETE ACCOUNT'}
      </Text>
    </Pressable>
  );
}

const styles =
  StyleSheet.create({
    button: {
      marginTop: 12,
      minHeight: 44,
      borderWidth: 1,
      borderColor: '#E5A29C',
      borderRadius: 12,
      backgroundColor: '#FFF5F4',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingHorizontal: 12,
    },

    disabled: {
      opacity: 0.55,
    },

    text: {
      color: '#B42318',
      fontSize: 11,
      fontWeight: '900',
    },
  });