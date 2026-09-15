import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
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
import { IGPAT_ARENA_MODES, type IgpatArenaClientMode } from '@/lib/igpat/arena';
import { loadIgpatBondRecipients, type IgpatBondRecipient } from '@/lib/igpat/bondRecipients';
import { useAuth } from '@/providers/AuthProvider';

export default function IgpatArenaCreateScreen() {
  const { user } = useAuth();
  const [mode, setMode] = useState<IgpatArenaClientMode>('duel');
  const [title, setTitle] = useState('');
  const [recipients, setRecipients] = useState<IgpatBondRecipient[]>([]);
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setRecipients([]);
      setLoadingPeople(false);
      return () => { cancelled = true; };
    }

    setLoadingPeople(true);
    void loadIgpatBondRecipients(user.id)
      .then(rows => {
        if (cancelled) return;
        const followed = rows.filter(row => !row.isSelf);
        setRecipients(followed);
        setOpponentId(current => current && followed.some(row => row.id === current) ? current : followed[0]?.id ?? null);
      })
      .catch(error => {
        if (cancelled) return;
        console.warn('BUKLOD IGPAT Arena recipients:', String((error as any)?.message ?? error));
        setRecipients([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPeople(false);
      });

    return () => { cancelled = true; };
  }, [user?.id]);

  const selectedMode = useMemo(
    () => IGPAT_ARENA_MODES.find(option => option.key === mode) ?? IGPAT_ARENA_MODES[0],
    [mode]
  );
  const needsOpponent = mode === 'duel';

  const create = async () => {
    if (!user?.id || busy) return;
    if (needsOpponent && !opponentId) {
      Alert.alert('IGPAT Arena', 'Choose a followed member for this Duel.');
      return;
    }
    const safeTitle = title.trim();
    if (safeTitle.length < 3) {
      Alert.alert('IGPAT Arena', 'Give this challenge a clear title.');
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc('igpat_create_arena_challenge_v2', {
        p_mode: mode,
        p_post_id: null,
        p_opponent_user_id: opponentId,
        p_title: safeTitle,
      });
      if (error) throw error;
      const challengeId = String(data ?? '').trim();
      if (!challengeId) throw new Error('Arena did not return the new challenge ID.');
      router.replace(`/igpat/arena/${challengeId}` as any);
    } catch (error: any) {
      console.warn('BUKLOD IGPAT create Arena:', String(error?.message ?? error));
      Alert.alert(
        'Could Not Start Arena',
        error?.message ?? 'The secured Arena server update may still need to be applied.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT ARENA</Text>
          <Text style={styles.title}>Start a Challenge</Text>
          <Text style={styles.subtitle}>Competition must be demonstrated, intentional, and respectful. Normal social posts never get a win/loss label.</Text>
        </View>
      </View>

      <Text style={styles.label}>MODE</Text>
      <View style={styles.modeList}>
        {IGPAT_ARENA_MODES.map(option => {
          const selected = option.key === mode;
          return (
            <Pressable key={option.key} style={[styles.modeCard, selected && styles.modeSelected]} onPress={() => {
              setMode(option.key);
              if (option.key === 'duel' && !opponentId) setOpponentId(recipients[0]?.id ?? null);
            }} disabled={busy}>
              <View style={[styles.modeIcon, selected && styles.modeIconSelected]}>
                <MaterialCommunityIcons
                  name={option.key === 'duel' ? 'sword-cross' : option.key === 'prove_it' ? 'arm-flex-outline' : 'shield-star-outline'}
                  size={18}
                  color={selected ? '#07100B' : '#FFFFFF'}
                />
              </View>
              <View style={styles.modeCopy}>
                <Text style={[styles.modeTitle, selected && styles.modeTitleSelected]}>{option.label.toUpperCase()}</Text>
                <Text style={[styles.modeHint, selected && styles.modeHintSelected]}>{option.helper}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>CHALLENGE</Text>
      <TextInput
        value={title}
        onChangeText={value => setTitle(value.slice(0, 160))}
        placeholder="e.g. 30-second verse explanation"
        placeholderTextColor="rgba(255,255,255,0.34)"
        style={styles.input}
        maxLength={160}
        editable={!busy}
      />
      <Text style={styles.helper}>{selectedMode.helper}</Text>

      <Text style={styles.label}>{needsOpponent ? 'OPPONENT' : 'OPPONENT · OPTIONAL'}</Text>
      <Text style={styles.helperTop}>For privacy and anti-harassment safety, direct challenges are limited to people you already follow.</Text>
      {loadingPeople ? (
        <View style={styles.loadingRow}><ActivityIndicator color="#FFFFFF" /><Text style={styles.loadingText}>Loading followed members…</Text></View>
      ) : recipients.length ? (
        <View style={styles.peopleList}>
          {!needsOpponent ? (
            <Pressable style={[styles.personChip, opponentId == null && styles.personSelected]} onPress={() => setOpponentId(null)} disabled={busy}>
              <Text style={[styles.personText, opponentId == null && styles.personTextSelected]}>OPEN TO ARENA</Text>
            </Pressable>
          ) : null}
          {recipients.map(person => {
            const selected = opponentId === person.id;
            return (
              <Pressable key={person.id} style={[styles.personChip, selected && styles.personSelected]} onPress={() => setOpponentId(person.id)} disabled={busy}>
                <Text style={[styles.personText, selected && styles.personTextSelected]} numberOfLines={1}>{person.name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{needsOpponent ? 'Follow a member first before starting a direct Duel.' : 'You can still post an open Prove It or Hard Mode challenge.'}</Text>
        </View>
      )}

      <View style={styles.rules}>
        <Text style={styles.rulesTitle}>ARENA RULES</Text>
        <Text style={styles.rulesText}>• Both Duel participants submit their own IGPAT.</Text>
        <Text style={styles.rulesText}>• Participants cannot vote in their own match.</Text>
        <Text style={styles.rulesText}>• Each outside viewer has one Respect vote per challenge.</Text>
        <Text style={styles.rulesText}>• No humiliation, harassment, or engagement farming.</Text>
      </View>

      <Pressable style={[styles.submit, (busy || (needsOpponent && !opponentId)) && styles.submitDisabled]} disabled={busy || (needsOpponent && !opponentId)} onPress={() => void create()}>
        {busy ? <ActivityIndicator color="#07100B" /> : <MaterialCommunityIcons name="flag-checkered" size={18} color="#07100B" />}
        <Text style={styles.submitText}>{busy ? 'STARTING…' : 'START ARENA CHALLENGE'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050807' },
  content: { padding: 18, paddingTop: 54, paddingBottom: 48 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: '#0D120F' },
  headerCopy: { flex: 1 },
  eyebrow: { color: 'rgba(255,255,255,0.44)', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 4, color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 5, color: 'rgba(255,255,255,0.56)', fontSize: 10, lineHeight: 16 },
  label: { marginTop: 22, marginBottom: 8, color: 'rgba(255,255,255,0.46)', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.9 },
  modeList: { gap: 8 },
  modeCard: { minHeight: 76, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#0D120F', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  modeSelected: { borderColor: '#FFFFFF', backgroundColor: '#FFFFFF' },
  modeIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  modeIconSelected: { backgroundColor: 'rgba(7,16,11,0.08)' },
  modeCopy: { flex: 1 },
  modeTitle: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  modeTitleSelected: { color: '#07100B' },
  modeHint: { marginTop: 4, color: 'rgba(255,255,255,0.44)', fontSize: 8.8, lineHeight: 13 },
  modeHintSelected: { color: 'rgba(7,16,11,0.58)' },
  input: { minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0D120F', color: '#FFFFFF', paddingHorizontal: 14, fontSize: 11 },
  helper: { marginTop: 7, color: 'rgba(255,255,255,0.38)', fontSize: 8.8, lineHeight: 13 },
  helperTop: { marginBottom: 9, color: 'rgba(255,255,255,0.42)', fontSize: 8.8, lineHeight: 13 },
  loadingRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9 },
  loadingText: { color: 'rgba(255,255,255,0.50)', fontSize: 9 },
  peopleList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  personChip: { maxWidth: '100%', minHeight: 40, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0D120F', alignItems: 'center', justifyContent: 'center' },
  personSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  personText: { maxWidth: 220, color: 'rgba(255,255,255,0.72)', fontSize: 9, fontWeight: '900' },
  personTextSelected: { color: '#07100B' },
  emptyCard: { borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: '#0D120F', padding: 14 },
  emptyText: { color: 'rgba(255,255,255,0.48)', fontSize: 9, lineHeight: 14 },
  rules: { marginTop: 22, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(217,255,105,0.18)', backgroundColor: '#10150D', padding: 14 },
  rulesTitle: { color: '#D9FF69', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  rulesText: { marginTop: 6, color: 'rgba(255,255,255,0.55)', fontSize: 8.8, lineHeight: 14 },
  submit: { marginTop: 18, minHeight: 52, borderRadius: 16, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  submitDisabled: { opacity: 0.38 },
  submitText: { color: '#07100B', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7 },
});
