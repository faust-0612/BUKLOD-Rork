import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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

type Mode = {
  id: IgpatArenaMode;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  accent: [string, string];
  metric: string;
};

const MODES: Mode[] = [
  { id: 'duel', title: 'Duel', subtitle: 'One creator. One opponent. One clear challenge.', icon: 'sword-cross', accent: ['#3158FF','#17214B'], metric: '1 VS 1' },
  { id: 'prove_it', title: 'Prove It', subtitle: 'Show the skill, result or transformation.', icon: 'shield-star-outline', accent: ['#8C43FF','#301A52'], metric: 'SKILL' },
  { id: 'squad_battle', title: 'Squad vs Squad', subtitle: 'Team effort and verified completion.', icon: 'account-group-outline', accent: ['#00A66B','#123D2E'], metric: 'TEAM' },
  { id: 'king_of_the_hill', title: 'King of the Hill', subtitle: 'Hold the challenge through consistent wins.', icon: 'crown-outline', accent: ['#C98B00','#4A3410'], metric: 'CROWN' },
  { id: 'hard_mode', title: 'Hard Mode', subtitle: 'Higher-difficulty creative mission.', icon: 'fire', accent: ['#D14A28','#4B1C16'], metric: 'HARD' },
  { id: 'iron_streak', title: 'Iron Streak', subtitle: 'Consistency and mastery streak.', icon: 'link-variant', accent: ['#66717D','#252B31'], metric: 'STREAK' },
  { id: 'ranked_season', title: 'Ranked Season', subtitle: 'Seasonal skill competition with fair rules.', icon: 'podium-gold', accent: ['#2B7FD5','#17304A'], metric: 'RANKED' },
  { id: 'boss_challenge', title: 'Boss Challenge', subtitle: 'A shared high-difficulty target.', icon: 'shield-crown-outline', accent: ['#B52C5C','#4C1730'], metric: 'BOSS' },
  { id: 'last_man_standing', title: 'Last Man Standing', subtitle: 'Advance by completed challenge, not popularity.', icon: 'account-hard-hat-outline', accent: ['#7B5CFF','#2D254D'], metric: 'LMS' },
  { id: 'bounty_challenge', title: 'Bounty Challenge', subtitle: 'Complete a defined mission for recognition.', icon: 'target', accent: ['#E06B00','#4D2A12'], metric: 'MISSION' },
];

const FEATURED: Array<{ title: string; copy: string; mode: IgpatArenaMode; icon: keyof typeof MaterialCommunityIcons.glyphMap; tag: string }> = [
  { title: '60-Second Skill Duel', copy: 'Create one sharp IGPAT proving a useful skill in under one minute.', mode: 'duel', icon: 'sword-cross', tag: 'QUICK MATCH' },
  { title: 'Community Impact', copy: 'Show a real before-and-after action that helped people or place.', mode: 'prove_it', icon: 'hand-heart-outline', tag: 'IMPACT' },
  { title: 'Squad Mission', copy: 'Build a team challenge where every member contributes one verified action.', mode: 'squad_battle', icon: 'account-group-outline', tag: 'TEAM PLAY' },
];

export default function IgpatArenaScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<IgpatArenaMode>('duel');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const selectedMode = useMemo(() => MODES.find(x => x.id === selected) ?? MODES[0], [selected]);

  const prepare = (mode: IgpatArenaMode, suggestedTitle?: string) => {
    setSelected(mode);
    if (suggestedTitle) setTitle(suggestedTitle);
  };

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
        `${selectedMode.title} is ready. Skill, verified completion, teamwork and respect matter more than raw popularity.`,
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
      <LinearGradient colors={['#080B10','#12151D','#070908']} style={StyleSheet.absoluteFill} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back to IGPAT" style={styles.iconButton}>
          <MaterialCommunityIcons name="arrow-left" size={23} color="#fff" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>BUKLOD IGPAT</Text>
          <Text style={styles.title}>ARENA</Text>
          <Text style={styles.tagline}>Mastery · Challenge · Respect</Text>
        </View>
        <Pressable onPress={() => router.replace('/igpat' as any)} accessibilityRole="button" accessibilityLabel="Open IGPAT Watch" style={styles.iconButton}>
          <MaterialCommunityIcons name="play-circle-outline" size={23} color="#fff" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 42 }]} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#17335A','#111A2D']} style={styles.hero}>
          <View style={styles.heroIcon}><MaterialCommunityIcons name="shield-crown" size={42} color="#FFD76B" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroKicker}>ARENA SEASON</Text>
            <Text style={styles.heroTitle}>Prove skill. Build respect.</Text>
            <Text style={styles.heroCopy}>Competitive IGPAT without fake viewers, gambling mechanics or humiliating popularity contests.</Text>
            <View style={styles.heroActions}>
              <Pressable onPress={() => prepare('ranked_season', 'Ranked Season Challenge')} style={styles.heroPrimary}><Text style={styles.heroPrimaryText}>ENTER SEASON</Text></Pressable>
              <Pressable onPress={() => setRulesOpen(v => !v)} style={styles.heroSecondary}><Text style={styles.heroSecondaryText}>{rulesOpen ? 'HIDE RULES' : 'HOW IT WORKS'}</Text></Pressable>
            </View>
          </View>
        </LinearGradient>

        {rulesOpen ? (
          <View style={styles.ruleCard}>
            <MaterialCommunityIcons name="shield-check-outline" size={24} color="#9FE7BB" />
            <Text style={styles.ruleText}>Arena is separate from Pure Watch. Wins require completed challenge evidence where supported. No fake scarcity, no pay-to-win points, no manufactured engagement. Respect and safety rules apply to every mode.</Text>
          </View>
        ) : null}

        <View style={styles.sectionHead}>
          <View><Text style={styles.section}>FEATURED CHALLENGES</Text><Text style={styles.sectionSub}>Templates — choose one and make it yours.</Text></View>
          <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FFD76B" />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
          {FEATURED.map(feature => (
            <LinearGradient key={feature.title} colors={['#182234','#0F141E']} style={styles.featuredCard}>
              <View style={styles.featuredTop}><View style={styles.featuredIcon}><MaterialCommunityIcons name={feature.icon} size={26} color="#fff" /></View><Text style={styles.featuredTag}>{feature.tag}</Text></View>
              <Text style={styles.featuredTitle}>{feature.title}</Text>
              <Text style={styles.featuredCopy}>{feature.copy}</Text>
              <Pressable onPress={() => prepare(feature.mode, feature.title)} style={styles.featuredButton} accessibilityRole="button" accessibilityLabel={`Prepare ${feature.title}`}>
                <Text style={styles.featuredButtonText}>USE CHALLENGE</Text><MaterialCommunityIcons name="arrow-right" size={17} color="#07140D" />
              </Pressable>
            </LinearGradient>
          ))}
        </ScrollView>

        <View style={styles.sectionHead}><View><Text style={styles.section}>CHOOSE MODE</Text><Text style={styles.sectionSub}>Every mode has a distinct objective.</Text></View><Text style={styles.count}>{MODES.length} MODES</Text></View>
        <View style={styles.grid}>
          {MODES.map(mode => {
            const active = mode.id === selected;
            return (
              <Pressable key={mode.id} onPress={() => setSelected(mode.id)} accessibilityRole="button" accessibilityLabel={`Choose ${mode.title}`} style={[styles.card, active && styles.cardOn]}>
                <LinearGradient colors={active ? mode.accent : ['#14191D','#0D1012']} style={styles.cardGradient}>
                  <View style={styles.cardTop}><MaterialCommunityIcons name={mode.icon} size={27} color={active ? '#fff' : '#DDE5DF'} /><Text style={styles.metric}>{mode.metric}</Text></View>
                  <Text style={styles.cardTitle}>{mode.title}</Text>
                  <Text style={styles.cardSubtitle}>{mode.subtitle}</Text>
                  <View style={styles.selectRow}><Text style={styles.selectText}>{active ? 'SELECTED' : 'SELECT'}</Text><MaterialCommunityIcons name={active ? 'check-circle' : 'chevron-right'} size={16} color={active ? '#9FE7BB' : '#AAB3AD'} /></View>
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.createCard}>
          <View style={styles.createHeader}>
            <View style={[styles.selectedIcon, { backgroundColor: selectedMode.accent[0] }]}><MaterialCommunityIcons name={selectedMode.icon} size={24} color="#fff" /></View>
            <View style={{ flex: 1 }}><Text style={styles.createEyebrow}>READY TO BUILD</Text><Text style={styles.createTitle}>{selectedMode.title}</Text></View>
          </View>
          <TextInput value={title} onChangeText={setTitle} maxLength={160} placeholder="Challenge title or goal" placeholderTextColor="#768078" style={styles.input} editable={!busy} />
          <Pressable disabled={busy} onPress={() => void create()} style={[styles.createButton, busy && styles.disabled]} accessibilityRole="button" accessibilityLabel="Create Arena challenge">
            {busy ? <ActivityIndicator color="#07140D" /> : <MaterialCommunityIcons name="flag-checkered" size={20} color="#07140D" />}
            <Text style={styles.createText}>{busy ? 'CREATING…' : 'CREATE CHALLENGE'}</Text>
          </Pressable>
          <Text style={styles.createHint}>If the Arena backend migration is not active yet, the app will show the exact activation error instead of silently failing.</Text>
        </View>

        <View style={styles.statusPanel}>
          <Text style={styles.section}>ARENA IDENTITY</Text>
          <View style={styles.statusGrid}>
            {[
              ['medal-outline','Skill Badges'],['crown-outline','Champion Status'],['chart-timeline-variant','Win / Loss'],
              ['reload','Rematch'],['handshake-outline','Respect'],['calendar-star','Ranked Seasons'],
            ].map(([icon,label]) => (
              <Pressable key={label} onPress={() => Alert.alert(label, `${label} is part of the Arena progression layer and uses verified Arena records when the backend contracts are active.`)} style={styles.statusChip} accessibilityRole="button" accessibilityLabel={label}>
                <MaterialCommunityIcons name={icon as any} size={18} color="#9FE7BB" />
                <Text style={styles.statusText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#070908' },
  header: { zIndex: 3, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#28302B' },
  iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#151A18', borderWidth: 1, borderColor: '#2C3430' },
  headerCopy: { flex: 1, alignItems: 'center' },
  eyebrow: { color: '#9FE7BB', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  title: { marginTop: 1, color: '#fff', fontSize: 25, fontWeight: '900', letterSpacing: 1.1 },
  tagline: { marginTop: 1, color: '#9DA69F', fontSize: 10, fontWeight: '700' },
  content: { padding: 14, gap: 14 },
  hero: { minHeight: 210, borderRadius: 24, padding: 18, flexDirection: 'row', gap: 14, borderWidth: 1, borderColor: '#2E4F78', overflow: 'hidden' },
  heroIcon: { width: 66, height: 66, borderRadius: 22, backgroundColor: 'rgba(0,0,0,.25)', alignItems: 'center', justifyContent: 'center' },
  heroKicker: { color: '#FFD76B', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  heroTitle: { marginTop: 5, color: '#fff', fontSize: 23, lineHeight: 27, fontWeight: '900' },
  heroCopy: { marginTop: 7, color: '#C6D1DE', fontSize: 11, lineHeight: 16 },
  heroActions: { marginTop: 14, flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  heroPrimary: { minHeight: 38, paddingHorizontal: 13, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFD76B' },
  heroPrimaryText: { color: '#17130A', fontSize: 9, fontWeight: '900' },
  heroSecondary: { minHeight: 38, paddingHorizontal: 13, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#60718A', backgroundColor: 'rgba(0,0,0,.18)' },
  heroSecondaryText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  ruleCard: { flexDirection: 'row', gap: 10, padding: 13, borderRadius: 16, backgroundColor: '#111713', borderWidth: 1, borderColor: '#26362C' },
  ruleText: { flex: 1, color: '#B9C1BB', fontSize: 11, lineHeight: 16 },
  sectionHead: { marginTop: 4, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  section: { color: '#9FE7BB', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  sectionSub: { marginTop: 3, color: '#818B85', fontSize: 10 },
  count: { color: '#737E77', fontSize: 9, fontWeight: '900' },
  featuredRow: { gap: 10, paddingRight: 8 },
  featuredCard: { width: 260, minHeight: 205, padding: 15, borderRadius: 20, borderWidth: 1, borderColor: '#293446' },
  featuredTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  featuredIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#243147' },
  featuredTag: { color: '#FFD76B', fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  featuredTitle: { marginTop: 13, color: '#fff', fontSize: 17, fontWeight: '900' },
  featuredCopy: { marginTop: 6, color: '#AEB8C4', fontSize: 10.5, lineHeight: 15 },
  featuredButton: { marginTop: 'auto', minHeight: 40, paddingHorizontal: 12, borderRadius: 11, backgroundColor: '#DDF5E5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  featuredButtonText: { color: '#07140D', fontSize: 9, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  card: { width: '48.5%', minHeight: 156, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#29302B' },
  cardOn: { borderColor: '#8FBBA0' },
  cardGradient: { flex: 1, padding: 13 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metric: { color: '#ADB7B1', fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  cardTitle: { marginTop: 10, color: '#fff', fontSize: 14, fontWeight: '900' },
  cardSubtitle: { marginTop: 4, color: '#A2AAA5', fontSize: 10, lineHeight: 14 },
  selectRow: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { color: '#D9E0DC', fontSize: 8, fontWeight: '900' },
  createCard: { padding: 15, borderRadius: 20, backgroundColor: '#0F1311', borderWidth: 1, borderColor: '#2B3430' },
  createHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  selectedIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  createEyebrow: { color: '#9FE7BB', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  createTitle: { marginTop: 2, color: '#fff', fontSize: 18, fontWeight: '900' },
  input: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: '#333B35', paddingHorizontal: 12, color: '#fff', backgroundColor: '#090C0A' },
  createButton: { marginTop: 10, minHeight: 50, borderRadius: 13, backgroundColor: '#DDF5E5', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  createText: { color: '#07140D', fontSize: 10, fontWeight: '900' },
  createHint: { marginTop: 9, color: '#747E78', fontSize: 9.5, lineHeight: 14 },
  disabled: { opacity: .55 },
  statusPanel: { padding: 15, borderRadius: 20, backgroundColor: '#0C100E', borderWidth: 1, borderColor: '#27302B' },
  statusGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: { minWidth: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 11, borderRadius: 13, backgroundColor: '#151A17', borderWidth: 1, borderColor: '#29322D' },
  statusText: { color: '#C7CEC9', fontSize: 10, fontWeight: '800' },
});
