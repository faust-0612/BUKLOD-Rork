import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { supabase } from '@/lib/supabase';
import { loadIgpatBondRecipients, type IgpatBondRecipient } from '@/lib/igpat/bondRecipients';
import { useAuth } from '@/providers/AuthProvider';

type UnlockPreset = 'tomorrow' | 'sunday' | 'thirty_days' | 'custom';

function presetDate(kind: Exclude<UnlockPreset, 'custom'>): Date {
  const now = new Date();
  if (kind === 'tomorrow') {
    const result = new Date(now);
    result.setDate(result.getDate() + 1);
    result.setHours(9, 0, 0, 0);
    return result;
  }
  if (kind === 'sunday') {
    const result = new Date(now);
    const days = ((7 - result.getDay()) % 7) || 7;
    result.setDate(result.getDate() + days);
    result.setHours(9, 0, 0, 0);
    return result;
  }
  const result = new Date(now);
  result.setDate(result.getDate() + 30);
  return result;
}

function parseLocalDateTime(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const result = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day ||
    result.getHours() !== hour ||
    result.getMinutes() !== minute
  ) return null;
  return result;
}

function serverUpdateMissing(message: string): boolean {
  return /igpat_create_capsule_v2|function.*does not exist/i.test(message);
}

export default function IgpatCapsuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = String(id ?? '').trim();
  const { user } = useAuth();
  const [recipients, setRecipients] = useState<IgpatBondRecipient[]>([]);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [recipientLoading, setRecipientLoading] = useState(true);
  const [preset, setPreset] = useState<UnlockPreset>('tomorrow');
  const [customDate, setCustomDate] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setRecipients([]);
      setRecipientLoading(false);
      return () => { cancelled = true; };
    }
    setRecipientLoading(true);
    void loadIgpatBondRecipients(user.id)
      .then(rows => {
        if (cancelled) return;
        setRecipients(rows);
        setRecipientId(current => current && rows.some(row => row.id === current) ? current : rows[0]?.id ?? null);
      })
      .catch(error => {
        if (!cancelled) Alert.alert('IGPAT Capsule', String(error?.message ?? error));
      })
      .finally(() => {
        if (!cancelled) setRecipientLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  const unlockAt = useMemo(() => {
    if (preset === 'custom') return parseLocalDateTime(customDate);
    return presetDate(preset);
  }, [customDate, preset]);

  const send = useCallback(async () => {
    if (!postId || !recipientId || !unlockAt || sending) return;
    if (unlockAt.getTime() <= Date.now() + 60_000) {
      Alert.alert('IGPAT Capsule', 'Choose a future opening time.');
      return;
    }
    if (message.trim().length > 1200) {
      Alert.alert('IGPAT Capsule', 'Capsule message may be up to 1,200 characters.');
      return;
    }

    setSending(true);
    try {
      const { error } = await (supabase as any).rpc('igpat_create_capsule_v2', {
        p_post_id: postId,
        p_target_id: recipientId,
        p_message: message.trim(),
        p_unlock_at: unlockAt.toISOString(),
      });
      if (error) throw error;
      Alert.alert(
        'Capsule Scheduled',
        `This IGPAT Capsule will open on ${unlockAt.toLocaleString()}.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      const text = String(error?.message ?? error ?? 'Could not create Capsule.');
      Alert.alert(
        'IGPAT Capsule',
        serverUpdateMissing(text)
          ? 'The hardened Capsule server update still needs to be applied before Capsules can be created.'
          : text
      );
    } finally {
      setSending(false);
    }
  }, [message, postId, recipientId, sending, unlockAt]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" style={styles.back} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT</Text>
          <Text style={styles.title}>IGPAT Capsule</Text>
          <Text style={styles.subtitle}>Attach a future-opening message to this IGPAT.</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>SEND TO</Text>
        {recipientLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recipientRow}>
            {recipients.map(recipient => {
              const selected = recipient.id === recipientId;
              return (
                <Pressable
                  key={recipient.id}
                  onPress={() => setRecipientId(recipient.id)}
                  style={[styles.recipientChip, selected && styles.recipientSelected]}
                >
                  <Text style={[styles.recipientText, selected && styles.recipientTextSelected]} numberOfLines={1}>
                    {recipient.isSelf ? 'ME' : recipient.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        <Text style={styles.help}>Recipients are limited to you and people you already follow. The server also verifies that the recipient can access this IGPAT.</Text>

        <Text style={styles.label}>OPEN WHEN</Text>
        <View style={styles.presetGrid}>
          {([
            ['tomorrow', 'Tomorrow'],
            ['sunday', 'Sunday'],
            ['thirty_days', '30 Days Later'],
            ['custom', 'Event / Anniversary / Custom'],
          ] as Array<[UnlockPreset, string]>).map(([key, label]) => {
            const selected = preset === key;
            return (
              <Pressable key={key} style={[styles.preset, selected && styles.presetSelected]} onPress={() => setPreset(key)}>
                <Text style={[styles.presetText, selected && styles.presetTextSelected]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {preset === 'custom' ? (
          <>
            <Text style={styles.label}>CUSTOM LOCAL DATE & TIME</Text>
            <TextInput
              value={customDate}
              onChangeText={setCustomDate}
              placeholder="2026-10-15 19:00"
              placeholderTextColor="rgba(255,255,255,0.34)"
              style={styles.input}
              editable={!sending}
              autoCapitalize="none"
            />
            <Text style={styles.help}>Format: YYYY-MM-DD HH:mm. Use this for Event Day, Anniversary, or another approved future date.</Text>
          </>
        ) : unlockAt ? (
          <Text style={styles.datePreview}>{unlockAt.toLocaleString()}</Text>
        ) : null}

        <Text style={styles.label}>OPTIONAL MESSAGE</Text>
        <TextInput
          value={message}
          onChangeText={value => setMessage(value.slice(0, 1200))}
          placeholder="A message for when the Capsule opens…"
          placeholderTextColor="rgba(255,255,255,0.34)"
          multiline
          maxLength={1200}
          style={[styles.input, styles.textArea]}
          editable={!sending}
        />
        <Text style={styles.help}>The recipient must not receive this message before the server-authoritative unlock time.</Text>

        <Pressable
          style={[styles.primary, (!recipientId || !unlockAt || sending) && styles.disabled]}
          disabled={!recipientId || !unlockAt || sending}
          onPress={() => void send()}
        >
          {sending ? <ActivityIndicator color="#07100B" /> : <Text style={styles.primaryText}>SCHEDULE CAPSULE</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060908' },
  content: { padding: 20, paddingTop: 54, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  back: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D120F' },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 3, color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 5, color: 'rgba(255,255,255,0.56)', fontSize: 11, lineHeight: 17 },
  card: { marginTop: 22, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', backgroundColor: '#0D120F', padding: 16 },
  label: { marginTop: 16, marginBottom: 8, color: 'rgba(255,255,255,0.48)', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  recipientRow: { gap: 8, paddingRight: 12 },
  recipientChip: { maxWidth: 190, minHeight: 38, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#101512', alignItems: 'center', justifyContent: 'center' },
  recipientSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  recipientText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  recipientTextSelected: { color: '#07100B' },
  help: { marginTop: 8, color: 'rgba(255,255,255,0.43)', fontSize: 9, lineHeight: 14 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { minHeight: 40, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#101512', alignItems: 'center', justifyContent: 'center' },
  presetSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  presetText: { color: '#FFFFFF', fontSize: 8.8, fontWeight: '900' },
  presetTextSelected: { color: '#07100B' },
  input: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: '#101512', color: '#FFFFFF', paddingHorizontal: 12 },
  textArea: { minHeight: 112, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
  datePreview: { marginTop: 10, color: '#D9FF69', fontSize: 11, fontWeight: '900' },
  primary: { marginTop: 20, minHeight: 49, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#07100B', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  disabled: { opacity: 0.42 },
});
