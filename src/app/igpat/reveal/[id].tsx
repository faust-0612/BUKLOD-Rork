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
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

type RevealState = {
  configured: boolean;
  is_owner: boolean;
  enabled?: boolean;
  target_count?: number;
  meaningful_count?: number;
  remaining_count?: number;
  unlocked?: boolean;
  reveal_text?: string | null;
};

function rpcMissing(message: string): boolean {
  return /get_buklod_igpat_reveal_v1|set_buklod_igpat_reveal_v1|function.*does not exist/i.test(message);
}

export default function IgpatCommunityRevealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = String(id ?? '').trim();
  const [state, setState] = useState<RevealState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetText, setTargetText] = useState('50');
  const [revealText, setRevealText] = useState('');

  const load = useCallback(async () => {
    if (!postId) {
      setError('This IGPAT link is incomplete.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc('get_buklod_igpat_reveal_v1', {
        p_post_id: postId,
      });
      if (rpcError) throw rpcError;
      const next = (data ?? { configured: false, is_owner: false }) as RevealState;
      setState(next);
      if (next.target_count) setTargetText(String(next.target_count));
      if (next.is_owner && typeof next.reveal_text === 'string') setRevealText(next.reveal_text);
    } catch (err: any) {
      const message = String(err?.message ?? err ?? 'Community Reveal could not load.');
      setError(
        rpcMissing(message)
          ? 'Community Reveal is prepared in source, but its server update still needs to be applied.'
          : message
      );
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!postId || saving) return;
    const target = Number.parseInt(targetText, 10);
    const text = revealText.trim();
    if (!Number.isInteger(target) || target < 2 || target > 500) {
      Alert.alert('Community Reveal', 'Choose a target from 2 to 500 unique participants.');
      return;
    }
    if (!text) {
      Alert.alert('Community Reveal', 'Add the message, result, announcement, or lesson conclusion to reveal.');
      return;
    }
    if (text.length > 1200) {
      Alert.alert('Community Reveal', 'Reveal text may be up to 1,200 characters.');
      return;
    }

    setSaving(true);
    try {
      const { error: rpcError } = await (supabase as any).rpc('set_buklod_igpat_reveal_v1', {
        p_post_id: postId,
        p_target_count: target,
        p_reveal_text: text,
        p_enabled: true,
      });
      if (rpcError) throw rpcError;
      await load();
      Alert.alert('Community Reveal Saved', 'The reveal will open deterministically when the participation target is reached.');
    } catch (err: any) {
      const message = String(err?.message ?? err ?? 'Could not save Community Reveal.');
      Alert.alert(
        'Community Reveal',
        rpcMissing(message)
          ? 'The Community Reveal server update still needs to be applied before this can be saved.'
          : message
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!postId || saving) return;
    setSaving(true);
    try {
      const { error: rpcError } = await (supabase as any).rpc('set_buklod_igpat_reveal_v1', {
        p_post_id: postId,
        p_target_count: 2,
        p_reveal_text: '',
        p_enabled: false,
      });
      if (rpcError) throw rpcError;
      setRevealText('');
      setTargetText('50');
      await load();
    } catch (err: any) {
      const message = String(err?.message ?? err ?? 'Could not remove Community Reveal.');
      Alert.alert('Community Reveal', rpcMissing(message) ? 'The Community Reveal server update still needs to be applied.' : message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loading}>Loading Community Reveal…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT</Text>
          <Text style={styles.title}>Community Reveal</Text>
        </View>
      </View>

      <Text style={styles.intro}>
        A deterministic participation milestone. No random prize, chance mechanic, or gambling-like unlock.
      </Text>

      {error ? (
        <View style={styles.card}>
          <Text style={styles.errorTitle}>REVEAL UNAVAILABLE</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.secondaryButton} onPress={() => void load()}>
            <Text style={styles.secondaryButtonText}>RETRY</Text>
          </Pressable>
        </View>
      ) : state?.is_owner ? (
        <>
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>{state.configured ? 'MANAGE REVEAL' : 'CREATE REVEAL'}</Text>
            <Text style={styles.label}>UNIQUE PARTICIPANT TARGET</Text>
            <TextInput
              value={targetText}
              onChangeText={value => setTargetText(value.replace(/[^0-9]/g, '').slice(0, 3))}
              keyboardType="number-pad"
              placeholder="50"
              placeholderTextColor="rgba(255,255,255,0.35)"
              editable={!saving}
              style={styles.input}
            />
            <Text style={styles.help}>Each non-author person counts once across an explicit Pulse, visible comment, or same-audience direct Relay response.</Text>

            <Text style={styles.label}>WHAT WILL BE REVEALED?</Text>
            <TextInput
              value={revealText}
              onChangeText={value => setRevealText(value.slice(0, 1200))}
              multiline
              maxLength={1200}
              placeholder="Result, continuation, announcement, lesson conclusion…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              editable={!saving}
              style={[styles.input, styles.textArea]}
            />

            {state.configured ? (
              <View style={styles.progressBox}>
                <Text style={styles.progressStrong}>{Number(state.meaningful_count ?? 0)} / {Number(state.target_count ?? 0)}</Text>
                <Text style={styles.progressCopy}>{state.unlocked ? 'TARGET REACHED' : `${Number(state.remaining_count ?? 0)} more unique participant${Number(state.remaining_count ?? 0) === 1 ? '' : 's'} needed`}</Text>
              </View>
            ) : null}

            <Pressable style={[styles.primaryButton, saving && styles.disabled]} disabled={saving} onPress={() => void save()}>
              {saving ? <ActivityIndicator color="#07100B" /> : <Text style={styles.primaryButtonText}>SAVE COMMUNITY REVEAL</Text>}
            </Pressable>
            {state.configured ? (
              <Pressable style={[styles.secondaryButton, saving && styles.disabled]} disabled={saving} onPress={() => void remove()}>
                <Text style={styles.secondaryButtonText}>REMOVE REVEAL</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : !state?.configured ? (
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>NO COMMUNITY REVEAL</Text>
          <Text style={styles.body}>This creator has not attached a Community Reveal to this IGPAT.</Text>
        </View>
      ) : state.unlocked ? (
        <View style={[styles.card, styles.unlockedCard]}>
          <Text style={styles.unlockEyebrow}>COMMUNITY REVEAL · OPEN</Text>
          <Text style={styles.revealText}>{state.reveal_text || 'The reveal is open.'}</Text>
          <Text style={styles.progressFooter}>{Number(state.meaningful_count ?? 0)} unique participants reached the target of {Number(state.target_count ?? 0)}.</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.lockIcon}>
            <MaterialCommunityIcons name="lock-outline" size={24} color="#D9FF69" />
          </View>
          <Text style={styles.cardEyebrow}>COMMUNITY REVEAL · LOCKED</Text>
          <Text style={styles.progressLarge}>{Number(state.meaningful_count ?? 0)} / {Number(state.target_count ?? 0)}</Text>
          <Text style={styles.body}>{Number(state.remaining_count ?? 0)} more unique participant{Number(state.remaining_count ?? 0) === 1 ? '' : 's'} needed. The hidden content remains on the server until the threshold is reached.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060908' },
  content: { padding: 20, paddingTop: 54, paddingBottom: 48 },
  center: { flex: 1, backgroundColor: '#060908', alignItems: 'center', justifyContent: 'center', padding: 24 },
  loading: { marginTop: 12, color: 'rgba(255,255,255,0.64)', fontSize: 11 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0D120F' },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 3, color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  intro: { marginTop: 14, color: 'rgba(255,255,255,0.56)', fontSize: 11, lineHeight: 17 },
  card: { marginTop: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', backgroundColor: '#0D120F', padding: 16 },
  unlockedCard: { borderColor: 'rgba(217,255,105,0.32)', backgroundColor: '#10150D' },
  cardEyebrow: { color: 'rgba(255,255,255,0.68)', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  unlockEyebrow: { color: '#D9FF69', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  label: { marginTop: 16, marginBottom: 7, color: 'rgba(255,255,255,0.48)', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  input: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: '#101512', color: '#FFFFFF', paddingHorizontal: 12 },
  textArea: { minHeight: 128, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
  help: { marginTop: 8, color: 'rgba(255,255,255,0.42)', fontSize: 9, lineHeight: 14 },
  progressBox: { marginTop: 16, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', padding: 12 },
  progressStrong: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  progressCopy: { marginTop: 4, color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: '800' },
  progressLarge: { marginTop: 12, color: '#FFFFFF', fontSize: 34, fontWeight: '900' },
  primaryButton: { marginTop: 18, minHeight: 48, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#07100B', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  secondaryButton: { marginTop: 10, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7 },
  disabled: { opacity: 0.46 },
  body: { marginTop: 9, color: 'rgba(255,255,255,0.62)', fontSize: 11, lineHeight: 18 },
  revealText: { marginTop: 12, color: '#FFFFFF', fontSize: 17, lineHeight: 25, fontWeight: '800' },
  progressFooter: { marginTop: 14, color: 'rgba(255,255,255,0.46)', fontSize: 9.5, lineHeight: 15 },
  lockIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(217,255,105,0.08)', marginBottom: 12 },
  errorTitle: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  errorText: { marginTop: 8, color: 'rgba(255,255,255,0.58)', fontSize: 11, lineHeight: 17 },
});
