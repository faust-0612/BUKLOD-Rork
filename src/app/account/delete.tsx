import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';

import { Button, Card, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function DeleteAccountScreen() {
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (busy) return;

    if (confirmation.trim().toUpperCase() !== 'DELETE') {
      return Alert.alert(
        'Confirmation',
        'Type DELETE exactly to continue.'
      );
    }

    Alert.alert(
      'Permanently delete account?',
      'This action cannot be undone. BUKLOD will use the protected deletion service to remove your sign-in account, dependent data configured for deletion, and Storage objects owned by your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const { data, error } = await supabase.functions.invoke(
                'delete-account',
                {
                  body: {
                    confirmation: 'DELETE',
                    reason: reason.trim() || null,
                  },
                }
              );

              if (error) throw error;
              if (!data?.ok) {
                throw new Error(
                  data?.error ??
                    data?.message ??
                    'Account deletion was not completed.'
                );
              }

              try {
                await supabase.auth.signOut();
              } catch {
                // The Auth account may already be gone, which is expected.
              }

              router.replace('/(auth)/login' as any);
            } catch (error: any) {
              Alert.alert(
                'Could Not Delete Account',
                String(error?.message ?? error ?? 'Please try again.')
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={shared.screen}
      contentContainerStyle={shared.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={shared.h1}>Delete Account</Text>

      <Card>
        <Text style={shared.h2}>Permanent action</Text>
        <Text style={[shared.body, { marginTop: 7 }]}>
          Permanent deletion cannot be reversed. The protected backend checks
          your signed-in identity, handles account-owned Storage, and then asks
          Supabase Auth to delete the account. Database relationships still
          enforce their configured cascade, set-null, or retention rules.
        </Text>
        <Pressable
          onPress={() => router.push('/delete-account' as any)}
          accessibilityRole="link"
          accessibilityLabel="Read how account deletion works"
        >
          <Text
            style={[
              shared.body,
              { marginTop: 10, color: '#0E4F20', fontWeight: '800' },
            ]}
          >
            Read how account deletion works (public page)
          </Text>
        </Pressable>
      </Card>

      <TextInput
        multiline
        value={reason}
        onChangeText={setReason}
        placeholder="Reason (optional)"
        style={styles.area}
      />

      <Text style={shared.h2}>Type DELETE to confirm</Text>
      <TextInput
        value={confirmation}
        onChangeText={setConfirmation}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="DELETE"
        style={styles.input}
      />

      <Button
        title={busy ? 'DELETING...' : 'DELETE MY ACCOUNT PERMANENTLY'}
        onPress={remove}
      />
      <Button title="CANCEL" outline onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#B42318',
    borderRadius: 11,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  area: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 12,
    textAlignVertical: 'top',
    backgroundColor: '#FFFFFF',
  },
});