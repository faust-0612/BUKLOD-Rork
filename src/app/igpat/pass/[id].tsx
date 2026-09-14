import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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

function serverUpdateMissing(message: string): boolean {
  return /igpat_create_pass_v2|function.*does not exist/i.test(message);
}

export default function IgpatPassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = String(id ?? '').trim();
  const { user } = useAuth();
  const [recipients, setRecipients] = useState<IgpatBondRecipient[]>([]);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setLoading(false);
      return () => { cancelled = true; };
    }
    setLoading(true);
    void loadIgpatBondRecipients(user.id)
      .then(rows => {
        if (cancelled) return;
        const people = rows.filter(row => !row.isSelf);
        setRecipients(people);
        setRecipientId(current => current && people.some(row => row.id === current) ? current : people[0]?.id ?? null);
      })
      .catch(error => {
        if (!cancelled) Alert.alert('Pass the IGPAT', String(error?.message ?? error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  const send = useCallback(async () => {
    if (!postId || !recipientId || sending) return;
    setSending(true);
    try {
      const { error } = await (supabase as any).rpc('igpat_create_pass_v2', {
        p_post_id: postId,
        p_target_id: recipientId,
        p_message: message.trim(),
      });
      if (error) throw error;
      Alert.alert('IGPAT Passed', 'This IGPAT was intentionally passed to the selected person.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      const text = String(error?.message ?? error ?? 'Could not pass this IGPAT.');
      Alert.alert(
        'Pass the IGPAT',
        serverUpdateMissing(text)
          ? 'The hardened Pass server update still needs to be applied before this can be sent.'
          : text
      );
    } finally {
      setSending(false);
    }
  }, [message, postId, recipientId, sending]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" style={styles.back} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT</Text>
          <Text style={styles.title}>Pass the IGPAT</Text>
          <Text style={styles.subtitle}>Pass this moment intentionally to one person.</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>SELECT RECIPIENT</Text>
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : recipients.length ? (
          <View style={styles.recipientList}>
            {recipients.map(recipient => {
              const selected = recipient.id === recipientId;
              return (
                <Pressable
                  key={recipient.id}
                  style={[styles.recipient, selected && styles.recipientSelected]}
                  onPress={() => setRecipientId(recipient.id)}
                >
                  <View style={[styles.avatar, selected && styles.avatarSelected]}>
                    <Text style={[styles.avatarText, selected && styles.avatarTextSelected]}>{recipient.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <Text numberOfLines={1} style={[styles.recipientName, selected && styles.recipientNameSelected]}>{recipient.name}</Text>
                  {selected ? <MaterialCommunityIcons name="check" size={18} color="#07100B" /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.empty}>Follow someone first to use Pass the IGPAT. This keeps recipient discovery intentional rather than exposing the member directory.</Text>
        )}
        <Text style={styles.help}>The server verifies that the selected person is active and can actually access this IGPAT before the Pass is created.</Text>

        <Text style={styles.label}>OPTIONAL MESSAGE</Text>
        <TextInput
          value={message}
          onChangeText={value => setMessage(value.slice(0, 1200))}
          placeholder="Why are you passing this to them?"
          placeholderTextColor="rgba(255,255,255,0.34)"
          maxLength={1200}
          multiline
          editable={!sending}
          style={[styles.input, styles.textArea]}
        />

        <Pressable
          style={[styles.primary, (!recipientId || sending) && styles.disabled]}
          disabled={!recipientId || sending}
          onPress={() => void send()}
        >
          {sending ? <ActivityIndicator color="#07100B" /> : <Text style={styles.primaryText}>PASS THIS IGPAT</Text>}
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
  recipientList: { gap: 8 },
  recipient: { minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#101512', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  recipientSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  avatarSelected: { backgroundColor: 'rgba(7,16,11,0.10)' },
  avatarText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  avatarTextSelected: { color: '#07100B' },
  recipientName: { flex: 1, color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  recipientNameSelected: { color: '#07100B' },
  empty: { color: 'rgba(255,255,255,0.58)', fontSize: 10, lineHeight: 16 },
  help: { marginTop: 9, color: 'rgba(255,255,255,0.42)', fontSize: 9, lineHeight: 14 },
  input: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: '#101512', color: '#FFFFFF', paddingHorizontal: 12 },
  textArea: { minHeight: 105, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
  primary: { marginTop: 20, minHeight: 49, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#07100B', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  disabled: { opacity: 0.42 },
});
