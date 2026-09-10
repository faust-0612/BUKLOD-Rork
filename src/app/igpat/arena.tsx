import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createIgpatArenaChallenge,
  type IgpatArenaMode,
} from '@/lib/igpat/igpatRuntime';

const MODES: Array<{
  id: IgpatArenaMode;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}> = [
  { id: 'duel', title: 'Duel', subtitle: 'One-on-one creator challenge.', icon: 'sword-cross' },
  { id: 'prove_it', title: 'Prove It', subtitle: 'Show the skill, result or transformation.', icon: 'shield-star-outline' },
  { id: 'squad_battle', title: 'Squad vs Squad', subtitle: 'Team pride without humiliation.', icon: 'account-group-outline' },
  { id: 'king_of_the_hill', title: 'King of the Hill', subtitle: 'Hold the top challenge position.', icon: 'crown-outline' },
  { id: 'hard_mode', title: 'Hard Mode', subtitle: 'Higher-difficulty creative challenge.', icon: 'fire' },
  { id: 'iron_streak', title: 'Iron Streak', subtitle: 'Consistency and mastery streak.', icon: 'link-variant' },
  { id: 'ranked_season', title: 'Ranked Season', subtitle: 'Seasonal skill competition.', icon: 'podium-gold' },
  { id: 'boss_challenge', title: 'Boss Challenge', subtitle: 'A shared high-difficulty target.', icon: 'shield-crown-outline' },
  { id: 'last_man_standing', title: 'Last Man Standing', subtitle: 'Progressive elimination by completed challenge—not popularity.', icon: 'account-hard-hat-outline' },
  { id: 'bounty_challenge', title: 'Bounty Challenge', subtitle: 'Complete a defined task for recognition—not gambling.', icon: 'target' },
];

export default function IgpatArenaScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<IgpatArenaMode>('duel');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const selectedMode = useMemo(() => MODES.find(x => x.id === selected) ?? MODES[0], [selected]);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await createIgpatArenaChallenge({
        mode: selected,
        title: title.trim() || selectedMode.title,
      });
      Alert.alert(
        'Arena challenge created',
        `Your ${selectedMode.title} challenge is ready. Respect, skill and verified completion matter more than raw popularity.`,
      );
      setTitle('');
      console.log('IGPAT Arena challenge:', result);
    } catch (error) {
      Alert.alert('BUKLOD IGPAT Arena', String((error as any)?.message ?? error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back to IGPAT">
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT</Text>
          <Text style={styles.title}>ARENA</Text>
          <Text style={styles.tagline}>Mastery · Challenge · Respect</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.ruleCard}>
          <MaterialCommunityIcons name="shield-check-outline" size={24} color="#98E0B1" />
          <Text style={styles.ruleText}>
            Arena is separate from Pure Watch. No fake scarcity, gambling mechanics, humiliating rankings or manufactured engagement. Challenges reward skill, completion, teamwork and respect.
          </Text>
        </View>

        <Text style={styles.section}>CHOOSE MODE</Text>
        <View style={styles.grid}>
          {MODES.map(mode => {
            const active = mode.id === selected;
            return (
              <Pressable key={mode.id} onPress={() => setSelected(mode.id)} style={[styles.card, active && styles.cardOn]}>
                <MaterialCommunityIcons name={mode.icon} size={25} color={active ? '#07140D' : '#DDE5DF'} />
                <Text style={[styles.cardTitle, active && styles.cardTitleOn]}>{mode.title}</Text>
                <Text style={[styles.cardSubtitle, active && styles.cardSubtitleOn]}>{mode.subtitle}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.createCard}>
          <Text style={styles.section}>CREATE {selectedMode.title.toUpperCase()}</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={160}
            placeholder="Challenge title or goal"
            placeholderTextColor="#768078"
            style={styles.input}
          />
          <Pressable disabled={busy} onPress={() => void create()} style={[styles.createButton, busy && { opacity: 0.6 }]}>
            {busy ? <ActivityIndicator color="#07140D" /> : <MaterialCommunityIcons name="flag-checkered" size={20} color="#07140D" />}
            <Text style={styles.createText}>{busy ? 'CREATING…' : 'CREATE CHALLENGE'}</Text>
          </Pressable>
        </View>

        <View style={styles.statusGrid}>
          {['Skill Badges','Champion Status','Win / Loss','Rematch','Respect','Ranked Seasons'].map(label => (
            <View key={label} style={styles.statusChip}>
              <MaterialCommunityIcons name="check-decagram-outline" size={17} color="#98E0B1" />
              <Text style={styles.statusText}>{label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#070A08' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#28302B' },
  headerCopy: { flex: 1, alignItems: 'center' },
  eyebrow: { color: '#98E0B1', fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  title: { marginTop: 2, color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  tagline: { marginTop: 2, color: '#9DA69F', fontSize: 10, fontWeight: '700' },
  content: { padding: 14 },
  ruleCard: { flexDirection: 'row', gap: 10, padding: 13, borderRadius: 16, backgroundColor: '#111713', borderWidth: 1, borderColor: '#26362C' },
  ruleText: { flex: 1, color: '#B9C1BB', fontSize: 11, lineHeight: 16 },
  section: { marginTop: 20, marginBottom: 10, color: '#98E0B1', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  card: { width: '48.5%', minHeight: 128, padding: 12, borderRadius: 15, backgroundColor: '#111512', borderWidth: 1, borderColor: '#29302B' },
  cardOn: { backgroundColor: '#D8F4E1', borderColor: '#D8F4E1' },
  cardTitle: { marginTop: 8, color: '#fff', fontSize: 13, fontWeight: '900' },
  cardTitleOn: { color: '#07140D' },
  cardSubtitle: { marginTop: 4, color: '#939D96', fontSize: 10, lineHeight: 14 },
  cardSubtitleOn: { color: '#334039' },
  createCard: { marginTop: 8, padding: 14, borderRadius: 16, backgroundColor: '#0E120F', borderWidth: 1, borderColor: '#29302B' },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#333B35', paddingHorizontal: 12, color: '#fff', backgroundColor: '#090C0A' },
  createButton: { marginTop: 10, minHeight: 48, borderRadius: 12, backgroundColor: '#D8F4E1', flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  createText: { color: '#07140D', fontSize: 11, fontWeight: '900' },
  statusGrid: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: '#111512' },
  statusText: { color: '#C7CEC9', fontSize: 10, fontWeight: '800' },
});
