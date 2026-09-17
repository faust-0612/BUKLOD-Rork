import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  cancelBuklodHomeReminder,
  scheduleBuklodHomeReminder,
} from '@/lib/buklodHomeReminder';
import { useAuth } from '@/providers/AuthProvider';

type Reminder = {
  id: string;
  message: string;
  at: number;
  delivery: 'system' | 'web-in-app';
  fired?: boolean;
};

type Preset = '15m' | '30m' | '1h' | 'tonight' | 'morning';

function resolvePreset(preset: Preset) {
  const now = new Date();
  if (preset === '15m') return new Date(now.getTime() + 15 * 60_000);
  if (preset === '30m') return new Date(now.getTime() + 30 * 60_000);
  if (preset === '1h') return new Date(now.getTime() + 60 * 60_000);
  if (preset === 'tonight') {
    const target = new Date(now);
    target.setHours(22, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    return target;
  }
  const target = new Date(now);
  target.setDate(target.getDate() + 1);
  target.setHours(7, 0, 0, 0);
  return target;
}

function formatWhen(timestamp: number) {
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function PersonalHomeRemindersScreen() {
  const { profile } = useAuth();
  const userId = String(profile?.id ?? 'guest');
  const storageKey = useMemo(() => `buklod.personal-home.reminders.${userId}`, [userId]);
  const [message, setMessage] = useState('Magpahinga na at ihanda ang kailangan bukas.');
  const [preset, setPreset] = useState<Preset>('tonight');
  const [items, setItems] = useState<Reminder[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void AsyncStorage.getItem(storageKey).then((value) => {
      if (!value) return;
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) setItems(parsed);
      } catch {
        setItems([]);
      }
    });
  }, [storageKey]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const check = () => {
      const now = Date.now();
      const due = items.find((item) => !item.fired && item.at <= now);
      if (!due) return;
      const next = items.map((item) =>
        item.id === due.id ? { ...item, fired: true } : item,
      );
      setItems(next);
      void AsyncStorage.setItem(storageKey, JSON.stringify(next));
      Alert.alert('BUKLOD Home Reminder', due.message);
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [items, storageKey]);

  const persist = async (next: Reminder[]) => {
    setItems(next);
    await AsyncStorage.setItem(storageKey, JSON.stringify(next));
  };

  const addReminder = async () => {
    const clean = message.trim();
    if (!clean) {
      setError('Maglagay ng reminder message.');
      return;
    }
    const at = resolvePreset(preset);
    setBusy(true);
    setError('');
    try {
      const scheduled = await scheduleBuklodHomeReminder({ at, message: clean });
      const next: Reminder[] = [
        {
          id: scheduled.id,
          message: clean,
          at: at.getTime(),
          delivery: scheduled.delivery,
          fired: false,
        },
        ...items.filter((item) => item.at > Date.now() - 24 * 60 * 60_000),
      ].slice(0, 20);
      await persist(next);
    } catch (err: any) {
      setError(String(err?.message || 'Hindi ma-schedule ang reminder.'));
    } finally {
      setBusy(false);
    }
  };

  const removeReminder = async (item: Reminder) => {
    try {
      await cancelBuklodHomeReminder(item.id);
    } catch {
      // Local removal still proceeds even if the native schedule was already gone.
    }
    await persist(items.filter((entry) => entry.id !== item.id));
  };

  const presets: Array<{ id: Preset; label: string }> = [
    { id: '15m', label: '15 min' },
    { id: '30m', label: '30 min' },
    { id: '1h', label: '1 hour' },
    { id: 'tonight', label: '10 PM' },
    { id: 'morning', label: 'Tomorrow 7 AM' },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Back">
          <MaterialCommunityIcons name="arrow-left" size={23} color="#234434" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Good Night & Reminders</Text>
          <Text style={styles.subtitle}>
            {Platform.OS === 'web'
              ? 'Web reminders are saved and fire while BUKLOD is open or when you return after they are due.'
              : 'Native reminders use the phone notification system and can fire even when BUKLOD is not open.'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Reminder</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Ano ang ipapaalala?"
          placeholderTextColor="#829083"
          style={[styles.input, styles.multi]}
          multiline
        />
        <Text style={styles.label}>Kailan?</Text>
        <View style={styles.presetRow}>
          {presets.map((item) => {
            const active = preset === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setPreset(item.id)}
                style={[styles.preset, active && styles.presetActive]}
              >
                <Text style={[styles.presetText, active && styles.presetTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.preview}>Schedule: {formatWhen(resolvePreset(preset).getTime())}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={addReminder} disabled={busy} style={[styles.primary, busy && styles.disabled]}>
          <MaterialCommunityIcons name="alarm-plus" size={19} color="#FFFFFF" />
          <Text style={styles.primaryText}>{busy ? 'Sine-save…' : 'Schedule Reminder'}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Saved reminders</Text>
        {!items.length ? <Text style={styles.empty}>Wala pang reminder.</Text> : null}
        {items.map((item) => (
          <View key={item.id} style={styles.reminderRow}>
            <MaterialCommunityIcons
              name={item.fired ? 'check-circle-outline' : 'alarm'}
              size={22}
              color={item.fired ? '#6E7A70' : '#2D6B4F'}
            />
            <View style={styles.reminderCopy}>
              <Text style={styles.reminderText}>{item.message}</Text>
              <Text style={styles.reminderMeta}>
                {formatWhen(item.at)} · {item.delivery === 'system' ? 'phone notification' : 'web in-app'}
              </Text>
            </View>
            <Pressable onPress={() => removeReminder(item)} style={styles.deleteButton} accessibilityLabel="Delete reminder">
              <MaterialCommunityIcons name="trash-can-outline" size={19} color="#93483D" />
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F0E6' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16, paddingBottom: 42, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerCopy: { flex: 1 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D6D7CB' },
  title: { fontSize: 23, fontWeight: '900', color: '#22382C' },
  subtitle: { marginTop: 3, color: '#66756A', fontSize: 12, lineHeight: 17 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#DADBCF' },
  label: { color: '#324B3B', fontWeight: '900', fontSize: 12, marginBottom: 6, marginTop: 6 },
  input: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#CFD6CF', paddingHorizontal: 12, color: '#21392B', backgroundColor: '#FBFCF9' },
  multi: { minHeight: 78, paddingTop: 12, textAlignVertical: 'top' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  preset: { borderRadius: 12, borderWidth: 1, borderColor: '#C8D1C9', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FAFBF8' },
  presetActive: { backgroundColor: '#E7F1E9', borderColor: '#2D6B4F' },
  presetText: { color: '#5C6A61', fontSize: 11, fontWeight: '800' },
  presetTextActive: { color: '#2D6B4F' },
  preview: { marginTop: 11, color: '#66756A', fontSize: 11 },
  primary: { marginTop: 14, minHeight: 48, borderRadius: 14, backgroundColor: '#2D6B4F', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#FFFFFF', fontWeight: '900' },
  disabled: { opacity: 0.65 },
  error: { marginTop: 10, color: '#A43E35', fontWeight: '700', fontSize: 12 },
  sectionTitle: { fontSize: 16, color: '#22382C', fontWeight: '900', marginBottom: 8 },
  empty: { color: '#758078', fontSize: 12 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E3E4DD' },
  reminderCopy: { flex: 1 },
  reminderText: { color: '#2D4033', fontWeight: '800', fontSize: 12 },
  reminderMeta: { marginTop: 3, color: '#788178', fontSize: 10 },
  deleteButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF5F2' },
});
