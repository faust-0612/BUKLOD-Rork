import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';

import { Button, Card, shared } from '@/components/UI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function DeactivateAccountScreen() {
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const deactivate = async () => {
    if (busy) return;

    if (confirmation.trim().toUpperCase() !== 'DEACTIVATE') {
      return Alert.alert(
        'Confirmation',
        'Type DEACTIVATE exactly to continue.'
      );
    }

    Alert.alert(
      'Deactivate your account?',
      'You will be signed out and normal BUKLOD access will be disabled. Your account and data are preserved so you can reactivate later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate Account',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const { data, error } = await (supabase as any).rpc(
                'deactivate_my_account',
                {
                  p_reason: reason.trim() || null,
                }
              );

              if (error) throw error;
              if (!data?.ok) {
                throw new Error('Account deactivation was not completed.');
              }

              await supabase.auth.signOut();
              router.replace('/(auth)/login' as any);
            } catch (error: any) {
              Alert.alert(
                'Could Not Deactivate',
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
      <Text style={shared.h1}>Deactivate Account</Text>

      <Card>
        <Text style={shared.h2}>Temporary and reversible</Text>
        <Text style={[shared.body, { marginTop: 7 }]}>
          Deactivation signs you out and disables normal account use. Your
          profile and account data are preserved. The next time you sign in,
          BUKLOD can offer to reactivate this account.
        </Text>
      </Card>

      <TextInput
        multiline
        value={reason}
        onChangeText={setReason}
        placeholder="Reason (optional)"
        style={styles.area}
      />

      <Text style={shared.h2}>Type DEACTIVATE to confirm</Text>
      <TextInput
        value={confirmation}
        onChangeText={setConfirmation}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="DEACTIVATE"
        style={styles.input}
      />

      <Button
        title={busy ? 'DEACTIVATING...' : 'DEACTIVATE MY ACCOUNT'}
        onPress={deactivate}
      />
      <Button title="CANCEL" outline onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#C77D26',
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