import React, { useState } from 'react';
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

export default function RecoveryPinScreen() {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!/^\d{6}$/.test(pin)) {
      return Alert.alert('Recovery PIN', 'Create a PIN containing exactly 6 digits.');
    }

    if (pin !== confirm) {
      return Alert.alert('Recovery PIN', 'The PINs do not match.');
    }

    if (/^(\d)\1{5}$/.test(pin) || ['123456', '654321', '000000'].includes(pin)) {
      return Alert.alert(
        'Recovery PIN',
        'Choose a less predictable 6-digit PIN.'
      );
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'account-recovery-v2',
        {
          body: {
            action: 'set_pin',
            pin,
          },
        }
      );

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message ?? 'Could not save Recovery PIN.');

      setPin('');
      setConfirm('');

      Alert.alert(
        'Recovery PIN Saved',
        'Your Recovery PIN was saved securely. BUKLOD will not display it later. Keep it somewhere only you can access.'
      );
    } catch (error: any) {
      Alert.alert(
        'Recovery PIN',
        String(error?.message ?? error ?? 'Could not save Recovery PIN.')
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.back}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="shield-lock-outline" size={30} color={colors.green} />
        </View>

        <Text style={styles.title}>Recovery PIN</Text>
        <Text style={styles.subtitle}>
          Create or replace the 6-digit PIN you can use with your username if you forget your password.
        </Text>

        <View style={styles.notice}>
          <MaterialCommunityIcons name="information-outline" size={22} color={colors.green} />
          <Text style={styles.noticeText}>
            This is where your Recovery PIN comes from. You create it yourself while signed in. It is not sent by SMS or email, and it cannot be viewed again after saving.
          </Text>
        </View>

        <Text style={styles.label}>New 6-digit Recovery PIN</Text>
        <TextInput
          value={pin}
          onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          placeholder="Enter 6 digits"
          style={styles.input}
        />

        <Text style={styles.label}>Confirm Recovery PIN</Text>
        <TextInput
          value={confirm}
          onChangeText={(value) => setConfirm(value.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          placeholder="Re-enter 6 digits"
          style={styles.input}
        />

        <Text style={styles.securityNote}>
          Do not use your birthday, 123456, 654321, repeated digits, or another obvious sequence.
        </Text>

        <Pressable
          onPress={save}
          disabled={busy}
          style={[styles.primary, busy && styles.disabled]}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryText}>SAVE RECOVERY PIN</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8F7' },
  content: { padding: 20, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8 },
  backText: { color: colors.text, fontWeight: '800' },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#EAF4EC',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 16,
  },
  title: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: 25,
    fontWeight: '900',
    color: colors.text,
  },
  subtitle: {
    marginTop: 7,
    textAlign: 'center',
    color: '#647067',
    lineHeight: 20,
  },
  notice: {
    marginTop: 18,
    borderRadius: 12,
    backgroundColor: '#EAF4EC',
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  noticeText: { flex: 1, color: '#405347', lineHeight: 19 },
  label: { marginTop: 18, marginBottom: 6, color: colors.text, fontWeight: '900' },
  input: {
    borderWidth: 1,
    borderColor: '#D7DED8',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 52,
    paddingHorizontal: 14,
    fontSize: 18,
    letterSpacing: 3,
    color: colors.text,
  },
  securityNote: {
    marginTop: 10,
    color: '#68736A',
    fontSize: 12,
    lineHeight: 18,
  },
  primary: {
    marginTop: 22,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '900' },
  disabled: { opacity: 0.6 },
});