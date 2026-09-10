import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/providers/AuthProvider';
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
  objective: string;
  winRule: string;
  missions: string[];
  features: string[];
};

const MODES: Mode[] = [
  {
    id: 'duel', title: 'Duel', subtitle: 'One creator. One opponent. One clear challenge.',
    icon: 'sword-cross', accent: ['#3158FF', '#17214B'], metric: '1 VS 1',
    objective: 'Answer the same challenge with one IGPAT each. The result is based on the defined skill or completion rule, not raw popularity.',
    winRule: 'Best verified challenge completion wins. Ties can trigger a rematch.',
    missions: ['60-second useful skill', 'One verse, one practical application', 'Before-and-after service task'],
    features: ['Opponent card', 'Challenge timer', 'Side-by-side result', 'Rematch', 'Respect'],
  },
  {
    id: 'prove_it', title: 'Prove It', subtitle: 'Show the skill, result or transformation.',
    icon: 'shield-star-outline', accent: ['#8C43FF', '#301A52'], metric: 'SKILL',
    objective: 'Upload clear evidence that a defined skill, service action, or transformation was completed.',
    winRule: 'Completion evidence must satisfy the challenge rule. No popularity requirement.',
    missions: ['Teach one useful technique', 'Show a completed community task', 'Demonstrate a learned skill'],
    features: ['Evidence checklist', 'Completion badge', 'Skill category', 'Review state', 'Share result'],
  },
  {
    id: 'squad_battle', title: 'Squad vs Squad', subtitle: 'Team effort and verified completion.',
    icon: 'account-group-outline', accent: ['#00A66B', '#123D2E'], metric: 'TEAM',
    objective: 'Two squads complete the same mission with every member contributing one valid action.',
    winRule: 'Team completion, quality, and verified participation determine the result.',
    missions: ['Community clean-up relay', 'Team learning challenge', 'Group service mission'],
    features: ['Squad roster', 'Member contribution tracker', 'Team progress', 'Battle result', 'Respect vote'],
  },
  {
    id: 'king_of_the_hill', title: 'King of the Hill', subtitle: 'Hold the challenge through consistent wins.',
    icon: 'crown-outline', accent: ['#C98B00', '#4A3410'], metric: 'CROWN',
    objective: 'Take the hill, then defend it against valid challengers.',
    winRule: 'The current holder stays champion while completing each incoming challenge successfully.',
    missions: ['7-day consistency hill', 'Skill mastery hill', 'Service streak hill'],
    features: ['Current holder', 'Defense count', 'Challenger queue', 'Crown history', 'Respect'],
  },
  {
    id: 'hard_mode', title: 'Hard Mode', subtitle: 'Higher-difficulty creative mission.',
    icon: 'fire', accent: ['#D14A28', '#4B1C16'], metric: 'HARD',
    objective: 'Take a normal Arena mission with stricter limits, stronger evidence, or a harder completion rule.',
    winRule: 'Complete every hard condition. Partial completion does not count as a win.',
    missions: ['No-cut 60-second explanation', 'Three-step service challenge', 'Timed skill demonstration'],
    features: ['Hard conditions', 'Failure-safe retry', 'Mastery badge', 'Attempt record', 'Completion proof'],
  },
  {
    id: 'iron_streak', title: 'Iron Streak', subtitle: 'Consistency and mastery streak.',
    icon: 'link-variant', accent: ['#66717D', '#252B31'], metric: 'STREAK',
    objective: 'Keep completing a defined Arena action across consecutive days or rounds.',
    winRule: 'The streak continues only when each required action is completed within its window.',
    missions: ['7-day learning streak', 'Daily encouragement streak', 'Service consistency streak'],
    features: ['Streak counter', 'Current day', 'Best streak', 'Recovery rules', 'Iron badge'],
  },
  {
    id: 'ranked_season', title: 'Ranked Season', subtitle: 'Seasonal skill competition with fair rules.',
    icon: 'podium-gold', accent: ['#2B7FD5', '#17304A'], metric: 'RANKED',
    objective: 'Compete across a season using completed Arena challenges and verified results.',
    winRule: 'Season standing uses valid wins and completion records, never purchased points or fake engagement.',
    missions: ['Weekly Duel set', 'Season service circuit', 'Multi-skill ranked ladder'],
    features: ['Season tier', 'Placement matches', 'Win/loss', 'Season history', 'Champion badge'],
  },
  {
    id: 'boss_challenge', title: 'Boss Challenge', subtitle: 'A shared high-difficulty target.',
    icon: 'shield-crown-outline', accent: ['#B52C5C', '#4C1730'], metric: 'BOSS',
    objective: 'One difficult mission is broken into clear objectives that can be completed individually or by a team.',
    winRule: 'Beat every required objective before the challenge closes.',
    missions: ['Community impact boss', 'Learning mastery boss', 'Team outreach boss'],
    features: ['Boss health/progress', 'Objectives', 'Contributor list', 'Milestone rewards', 'Final clear'],
  },
  {
    id: 'last_man_standing', title: 'Last Man Standing', subtitle: 'Advance by completed challenge, not popularity.',
    icon: 'account-hard-hat-outline', accent: ['#7B5CFF', '#2D254D'], metric: 'LMS',
    objective: 'Players advance round by round by completing the current challenge correctly.',
    winRule: 'Missed or failed challenge removes a player from the active round. Final valid player wins.',
    missions: ['Knowledge elimination', 'Skill round ladder', 'Service challenge rounds'],
    features: ['Round board', 'Active players', 'Elimination state', 'Final round', 'Champion result'],
  },
  {
    id: 'bounty_challenge', title: 'Bounty Challenge', subtitle: 'Complete a defined mission for recognition.',
    icon: 'target', accent: ['#E06B00', '#4D2A12'], metric: 'MISSION',
    objective: 'Accept a clearly defined mission and complete the required proof.',
    winRule: 'First valid completion or all valid completions can receive recognition depending on mission rules.',
    missions: ['Help-one-person mission', 'Creative teaching bounty', 'Community improvement bounty'],
    features: ['Mission brief', 'Acceptance state', 'Proof upload', 'Completion review', 'Recognition'],
  },
];

const FEATURED: Array<{
  title: string;
  copy: string;
  mode: IgpatArenaMode;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tag: string;
}> = [
  { title: '60-Second Skill Duel', copy: 'Create one sharp IGPAT proving a useful skill in under one minute.', mode: 'duel', icon: 'sword-cross', tag: 'QUICK MATCH' },
  { title: 'Community Impact', copy: 'Show a real before-and-after action that helped people or place.', mode: 'prove_it', icon: 'hand-heart-outline', tag: 'IMPACT' },
  { title: 'Squad Mission', copy: 'Build a team challenge where every member contributes one verified action.', mode: 'squad_battle', icon: 'account-group-outline', tag: 'TEAM PLAY' },
];

export default function IgpatArenaScreen() {
  const insets = useSafeAreaInsets();
  const { hasRole } = useAuth();
  const isSystemAdmin = hasRole('system_admin');
  const [selected, setSelected] = useState<IgpatArenaMode>('duel');
  const [openModeId, setOpenModeId] = useState<IgpatArenaMode | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const selectedMode = useMemo(() => MODES.find(x => x.id === selected) ?? MODES[0], [selected]);
  const openMode = useMemo(() => MODES.find(x => x.id === openModeId) ?? null, [openModeId]);

  const inspectMode = (mode: IgpatArenaMode, suggestedTitle?: string) => {
    setSelected(mode);
    if (suggestedTitle) setTitle(suggestedTitle);
    setOpenModeId(mode);
  };

  const prepare = (mode: IgpatArenaMode, suggestedTitle?: string) => {
    setSelected(mode);
    if (suggestedTitle) setTitle(suggestedTitle);
    setOpenModeId(null);
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
      <LinearGradient colors={['#080B10', '#12151D', '#070908']} style={StyleSheet.absoluteFill} />

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
        {isSystemAdmin ? (
          <LinearGradient colors={['#164E39', '#10261D']} style={styles.adminBanner}>
            <MaterialCommunityIcons name="shield-key-outline" size={27} color="#BDF7D2" />
            <View style={{ flex: 1 }}>
              <Text style={styles.adminTitle}>SYSTEM ADMIN · ARENA QA ACCESS</Text>
              <Text style={styles.adminCopy}>All Arena modes and preview content are unlocked for inspection. No user-facing rank or progression lock blocks this account.</Text>
            </View>
            <MaterialCommunityIcons name="lock-open-check-outline" size={25} color="#BDF7D2" />
          </LinearGradient>
        ) : null}

        <LinearGradient colors={['#17335A', '#111A2D']} style={styles.hero}>
          <View style={styles.heroIcon}><MaterialCommunityIcons name="shield-crown" size={42} color="#FFD76B" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroKicker}>ARENA SEASON</Text>
            <Text style={styles.heroTitle}>Prove skill. Build respect.</Text>
            <Text style={styles.heroCopy}>Competitive IGPAT without fake viewers, gambling mechanics or humiliating popularity contests.</Text>
            <View style={styles.heroActions}>
              <Pressable onPress={() => inspectMode('ranked_season', 'Ranked Season Challenge')} style={styles.heroPrimary}>
                <Text style={styles.heroPrimaryText}>ENTER SEASON</Text>
              </Pressable>
              <Pressable onPress={() => setRulesOpen(v => !v)} style={styles.heroSecondary}>
                <Text style={styles.heroSecondaryText}>{rulesOpen ? 'HIDE RULES' : 'HOW IT WORKS'}</Text>
              </Pressable>
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
          <View><Text style={styles.section}>FEATURED CHALLENGES</Text><Text style={styles.sectionSub}>Tap a challenge to open its real Arena content.</Text></View>
          <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FFD76B" />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
          {FEATURED.map(feature => (
            <LinearGradient key={feature.title} colors={['#182234', '#0F141E']} style={styles.featuredCard}>
              <View style={styles.featuredTop}>
                <View style={styles.featuredIcon}><MaterialCommunityIcons name={feature.icon} size={26} color="#fff" /></View>
                <Text style={styles.featuredTag}>{feature.tag}</Text>
              </View>
              <Text style={styles.featuredTitle}>{feature.title}</Text>
              <Text style={styles.featuredCopy}>{feature.copy}</Text>
              <Pressable onPress={() => inspectMode(feature.mode, feature.title)} style={styles.featuredButton} accessibilityRole="button" accessibilityLabel={`Open ${feature.title}`}>
                <Text style={styles.featuredButtonText}>OPEN CHALLENGE</Text>
                <MaterialCommunityIcons name="arrow-right" size={17} color="#07140D" />
              </Pressable>
            </LinearGradient>
          ))}
        </ScrollView>

        <View style={styles.sectionHead}>
          <View><Text style={styles.section}>CHOOSE MODE</Text><Text style={styles.sectionSub}>Every card opens its own objective, rules, missions and tools.</Text></View>
          <Text style={styles.count}>{MODES.length} MODES</Text>
        </View>

        <View style={styles.grid}>
          {MODES.map(mode => {
            const active = mode.id === selected;
            return (
              <Pressable key={mode.id} onPress={() => inspectMode(mode.id)} accessibilityRole="button" accessibilityLabel={`Open ${mode.title}`} style={[styles.card, active && styles.cardOn]}>
                <LinearGradient colors={active ? mode.accent : ['#14191D', '#0D1012']} style={styles.cardGradient}>
                  <View style={styles.cardTop}>
                    <MaterialCommunityIcons name={mode.icon} size={27} color={active ? '#fff' : '#DDE5DF'} />
                    <View style={styles.cardStatusRow}>
                      {isSystemAdmin ? <Text style={styles.qaPill}>QA OPEN</Text> : null}
                      <Text style={styles.metric}>{mode.metric}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardTitle}>{mode.title}</Text>
                  <Text style={styles.cardSubtitle}>{mode.subtitle}</Text>
                  <View style={styles.selectRow}>
                    <Text style={styles.selectText}>OPEN MODE</Text>
                    <MaterialCommunityIcons name="arrow-top-right" size={16} color="#AAB3AD" />
                  </View>
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.createCard}>
          <View style={styles.createHeader}>
            <View style={[styles.selectedIcon, { backgroundColor: selectedMode.accent[0] }]}>
              <MaterialCommunityIcons name={selectedMode.icon} size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.createEyebrow}>READY TO BUILD</Text>
              <Text style={styles.createTitle}>{selectedMode.title}</Text>
            </View>
            <Pressable onPress={() => inspectMode(selectedMode.id)} style={styles.infoButton} accessibilityRole="button" accessibilityLabel={`Inspect ${selectedMode.title}`}>
              <MaterialCommunityIcons name="information-outline" size={20} color="#fff" />
            </Pressable>
          </View>
          <TextInput value={title} onChangeText={setTitle} maxLength={160} placeholder="Challenge title or goal" placeholderTextColor="#768078" style={styles.input} editable={!busy} />
          <Pressable disabled={busy} onPress={() => void create()} style={[styles.createButton, busy && styles.disabled]} accessibilityRole="button" accessibilityLabel="Create Arena challenge">
            {busy ? <ActivityIndicator color="#07140D" /> : <MaterialCommunityIcons name="flag-checkered" size={20} color="#07140D" />}
            <Text style={styles.createText}>{busy ? 'CREATING…' : 'CREATE CHALLENGE'}</Text>
          </Pressable>
          <Text style={styles.createHint}>Mode previews work locally. Challenge persistence uses the Arena backend contract and shows an exact error if that backend is not active.</Text>
        </View>

        <View style={styles.statusPanel}>
          <Text style={styles.section}>ARENA IDENTITY</Text>
          <View style={styles.statusGrid}>
            {[
              ['medal-outline', 'Skill Badges'], ['crown-outline', 'Champion Status'], ['chart-timeline-variant', 'Win / Loss'],
              ['reload', 'Rematch'], ['handshake-outline', 'Respect'], ['calendar-star', 'Ranked Seasons'],
            ].map(([icon, label]) => (
              <Pressable key={label} onPress={() => Alert.alert(label, `${label} is part of the Arena progression layer. System Admin can inspect it without user-facing locks.`)} style={styles.statusChip} accessibilityRole="button" accessibilityLabel={label}>
                <MaterialCommunityIcons name={icon as any} size={18} color="#9FE7BB" />
                <Text style={styles.statusText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal transparent visible={Boolean(openMode)} animationType="slide" onRequestClose={() => setOpenModeId(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismiss} onPress={() => setOpenModeId(null)} />
          {openMode ? (
            <View style={[styles.modeSheet, { paddingBottom: Math.max(insets.bottom, 16) + 14 }]}>
              <LinearGradient colors={openMode.accent} style={styles.modeSheetHero}>
                <Pressable onPress={() => setOpenModeId(null)} style={styles.modeClose} accessibilityRole="button" accessibilityLabel="Close Arena mode">
                  <MaterialCommunityIcons name="close" size={21} color="#fff" />
                </Pressable>
                <View style={styles.modeHeroIcon}><MaterialCommunityIcons name={openMode.icon} size={42} color="#fff" /></View>
                <Text style={styles.modeMetric}>{openMode.metric}</Text>
                <Text style={styles.modeTitle}>{openMode.title}</Text>
                <Text style={styles.modeSubtitle}>{openMode.subtitle}</Text>
                {isSystemAdmin ? (
                  <View style={styles.adminModePill}><MaterialCommunityIcons name="lock-open-check-outline" size={15} color="#D9FFE7" /><Text style={styles.adminModeText}>SYSTEM ADMIN · UNLOCKED</Text></View>
                ) : null}
              </LinearGradient>

              <ScrollView contentContainerStyle={styles.modeBody} showsVerticalScrollIndicator={false}>
                <Text style={styles.detailLabel}>OBJECTIVE</Text>
                <Text style={styles.detailBody}>{openMode.objective}</Text>

                <View style={styles.winRule}>
                  <MaterialCommunityIcons name="trophy-outline" size={22} color="#FFD76B" />
                  <View style={{ flex: 1 }}><Text style={styles.detailLabel}>WIN / COMPLETION RULE</Text><Text style={styles.detailBody}>{openMode.winRule}</Text></View>
                </View>

                <Text style={styles.detailLabel}>STARTER MISSIONS</Text>
                <View style={styles.detailList}>
                  {openMode.missions.map((mission, index) => (
                    <Pressable key={mission} onPress={() => setTitle(mission)} style={styles.missionRow} accessibilityRole="button" accessibilityLabel={`Use ${mission}`}>
                      <View style={styles.numberOrb}><Text style={styles.numberText}>{index + 1}</Text></View>
                      <Text style={styles.missionText}>{mission}</Text>
                      <MaterialCommunityIcons name="plus-circle-outline" size={19} color="#9FE7BB" />
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.detailLabel}>MODE TOOLS</Text>
                <View style={styles.toolGrid}>
                  {openMode.features.map(feature => (
                    <View key={feature} style={styles.toolChip}><MaterialCommunityIcons name="check-decagram-outline" size={16} color="#9FE7BB" /><Text style={styles.toolText}>{feature}</Text></View>
                  ))}
                </View>

                <Pressable onPress={() => prepare(openMode.id, title.trim() || `${openMode.title} Challenge`)} style={styles.useModeButton} accessibilityRole="button" accessibilityLabel={`Use ${openMode.title} mode`}>
                  <Text style={styles.useModeText}>USE THIS MODE</Text>
                  <MaterialCommunityIcons name="arrow-down" size={18} color="#07140D" />
                </Pressable>
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>
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
  adminBanner: { padding: 13, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#347A5B' },
  adminTitle: { color: '#D8FFE6', fontSize: 10, fontWeight: '900', letterSpacing: .8 },
  adminCopy: { marginTop: 3, color: '#A9D8BA', fontSize: 9.5, lineHeight: 14 },
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
  featuredCard: { width: 260, minHeight: 205, padding: 15, borderRadius: 20, borderWidth: 1, borderColor: '#283341' },
  featuredTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featuredIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#26364C', alignItems: 'center', justifyContent: 'center' },
  featuredTag: { color: '#FFD76B', fontSize: 8, fontWeight: '900', letterSpacing: .8 },
  featuredTitle: { marginTop: 14, color: '#fff', fontSize: 17, fontWeight: '900' },
  featuredCopy: { marginTop: 6, color: '#AAB7C7', fontSize: 10.5, lineHeight: 15 },
  featuredButton: { marginTop: 'auto', minHeight: 38, borderRadius: 11, backgroundColor: '#DDF5E5', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  featuredButtonText: { color: '#07140D', fontSize: 9, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  card: { width: '48.5%', minHeight: 170, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#29302B' },
  cardOn: { borderColor: '#8FBBA0' },
  cardGradient: { flex: 1, padding: 13 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardStatusRow: { alignItems: 'flex-end', gap: 4 },
  qaPill: { color: '#BDF7D2', fontSize: 6.5, fontWeight: '900', letterSpacing: .6 },
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
  infoButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1B211D', borderWidth: 1, borderColor: '#323B35' },
  input: { minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: '#333B35', paddingHorizontal: 12, color: '#fff', backgroundColor: '#090C0A' },
  createButton: { marginTop: 10, minHeight: 50, borderRadius: 13, backgroundColor: '#DDF5E5', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  createText: { color: '#07140D', fontSize: 10, fontWeight: '900' },
  createHint: { marginTop: 9, color: '#747E78', fontSize: 9.5, lineHeight: 14 },
  disabled: { opacity: .55 },
  statusPanel: { padding: 15, borderRadius: 20, backgroundColor: '#0C100E', borderWidth: 1, borderColor: '#27302B' },
  statusGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusChip: { minWidth: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 11, borderRadius: 13, backgroundColor: '#151A17', borderWidth: 1, borderColor: '#29322D' },
  statusText: { color: '#C7CEC9', fontSize: 10, fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.72)' },
  modalDismiss: { ...StyleSheet.absoluteFillObject },
  modeSheet: { maxHeight: '88%', backgroundColor: '#0B0F0D', borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: '#2A332E' },
  modeSheetHero: { minHeight: 190, padding: 20, justifyContent: 'flex-end' },
  modeClose: { position: 'absolute', right: 14, top: 14, width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,.28)' },
  modeHeroIcon: { width: 62, height: 62, borderRadius: 20, backgroundColor: 'rgba(0,0,0,.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modeMetric: { color: '#D9E1DD', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  modeTitle: { marginTop: 2, color: '#fff', fontSize: 27, fontWeight: '900' },
  modeSubtitle: { marginTop: 4, color: '#E4E9E6', fontSize: 11.5, lineHeight: 17 },
  adminModePill: { marginTop: 10, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(0,0,0,.24)' },
  adminModeText: { color: '#D9FFE7', fontSize: 8, fontWeight: '900' },
  modeBody: { padding: 17, paddingBottom: 30 },
  detailLabel: { color: '#9FE7BB', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 8 },
  detailBody: { marginTop: 5, color: '#C4CCC7', fontSize: 11, lineHeight: 17 },
  winRule: { marginTop: 15, padding: 13, borderRadius: 15, backgroundColor: '#16170F', borderWidth: 1, borderColor: '#3E3A1D', flexDirection: 'row', gap: 10 },
  detailList: { marginTop: 7, gap: 7 },
  missionRow: { minHeight: 50, paddingHorizontal: 10, borderRadius: 13, backgroundColor: '#131815', borderWidth: 1, borderColor: '#29332D', flexDirection: 'row', alignItems: 'center', gap: 9 },
  numberOrb: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#24362B' },
  numberText: { color: '#BDF7D2', fontSize: 10, fontWeight: '900' },
  missionText: { flex: 1, color: '#E7ECE9', fontSize: 10.5, fontWeight: '800' },
  toolGrid: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  toolChip: { minWidth: '47%', flexGrow: 1, minHeight: 42, paddingHorizontal: 9, borderRadius: 12, backgroundColor: '#121714', borderWidth: 1, borderColor: '#28322C', flexDirection: 'row', alignItems: 'center', gap: 7 },
  toolText: { color: '#C8D0CB', fontSize: 9.5, fontWeight: '800' },
  useModeButton: { marginTop: 20, minHeight: 52, borderRadius: 14, backgroundColor: '#DDF5E5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  useModeText: { color: '#07140D', fontSize: 10, fontWeight: '900' },
});
