/* BUKLOD_CHARACTER_R37B_SPECIAL_SERIES1_PREVIEW_V2_SAFE
 * Restores the locked Series 1 passport presentation without restoring legacy
 * discover/unlock/active RPC authority. Locked Specials remain hidden by V2.
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import {
  SPECIAL_REQUIRED_RANK_ORDER,
  setMyBuklodCharacterActiveV2,
  type BuklodCharacterSelectionV2State,
  type BuklodSpecialCharacterId,
} from '@/lib/buklodCharacterSelectionV2';
import { SPECIAL_CHARACTER_HERO } from '@/lib/buklodSpecialCharacterAssets';

type Props = {
  userId?: string | null;
  state: BuklodCharacterSelectionV2State;
  onStateRefresh: () => Promise<void> | void;
};

type SeriesProfile = {
  id: BuklodSpecialCharacterId;
  name: string;
  role: string;
  profession: string;
  personality: string;
  stages: readonly string[];
};

const SERIES_PROFILES: Record<BuklodSpecialCharacterId, SeriesProfile> = {
  jawo: {
    id: 'jawo',
    name: 'Jawo',
    role: 'Music Enthusiast',
    profession: 'Forester',
    personality: 'Warm, relaxed, nature-loving.',
    stages: ['Young Dreamer','Nature Lover','Student Musician','Campus Volunteer','Youth Encourager','Choir Member','Guitar Learner','Worship Music Helper','Community Singer','Music Team Member','Youth Mentor','Worship Leader','Creative Ministry Worker','Forest Advocate','Community Organizer','Music Trainer','Mission Volunteer','Discipleship Worker','Church Planting Partner','Purposeful Leader'],
  },
  trudice: {
    id: 'trudice',
    name: 'Trudice',
    role: 'Sunday School Teacher',
    profession: 'Teacher',
    personality: 'Gentle, patient, teacher-like.',
    stages: ['Little Learner','Story Listener','Sunday School Helper','Young Teacher','Children’s Guide','Classroom Assistant','Student Mentor','Learning Facilitator','Sunday School Teacher','Classroom Teacher','Creative Educator','Values Mentor','Children’s Ministry Teacher','Learning Coordinator','Teacher-Leader','Curriculum Builder','Mentor of Teachers','Education Ministry Leader','Community Educator','Legacy Teacher'],
  },
  ace: {
    id: 'ace',
    name: 'Ace',
    role: 'Chess Master',
    profession: 'Nurse',
    personality: 'Calm, precise, strategic.',
    stages: ['Curious Learner','Caring Student','Chess Beginner','School Helper','Youth Encourager','Nursing Student','Chess Competitor','Community Helper','Campus Leader','Junior Nurse','Board Passer','Staff Nurse','Wellness Advocate','Chess Mentor','Community Health Leader','Mission Nurse','Strategic Mentor','Healing Servant Leader','Regional Health Mentor','Legacy Care Champion'],
  },
  mitch: {
    id: 'mitch',
    name: 'Mitch',
    role: 'Arts Guide',
    profession: 'Teacher · Tribal/Cultural Context',
    personality: 'Creative, expressive, warm.',
    stages: ['Little Dreamer','Young Creator','Art Helper','Story Drawer','Classroom Assistant','Student Teacher','Creative Mentor','Community Artist','Arts Teacher','Tribal Educator','Culture Advocate','Creative Leader','Workshop Facilitator','Arts Ministry Worker','Community Inspiration Builder','Education & Arts Coordinator','Missionary-Educator','Regional Creative Trainer','Heritage Advocate','Legacy Art Mentor'],
  },
  niel: {
    id: 'niel',
    name: 'Niel',
    role: 'Youth Pastor · Discipleship Guide',
    profession: 'Pastor · Teacher',
    personality: 'Pastoral, musical, mission-minded.',
    stages: ['Young Singer','Faith Listener','Youth Helper','Small Group Member','Worship Volunteer','Bible Learner','Student Mentor','Young Teacher','Worship Leader','Youth Pastor','Discipleship Leader','Mission Volunteer','Outreach Trainer','Church Planting Apprentice','Community Shepherd','Ministry Coordinator','Discipleship Pastor','Church Planting Leader','Regional Mission Mentor','Legacy Disciple-Maker'],
  },
  angel: {
    id: 'angel',
    name: 'Angel',
    role: 'Treasurer · Budget Manager',
    profession: 'Financial Steward',
    personality: 'Organized, practical, soft-spoken.',
    stages: ['Little Helper','Savings Learner','Student Organizer','Class Treasurer','Young Steward','Record Keeper','Budget Assistant','Community Volunteer','Stewardship Worker','Finance Coordinator','Ministry Treasurer','Resource Planner','Budget Manager','Community Treasurer','Financial Trainer','Stewardship Leader','Development Coordinator','Resource Director','Community Finance Head','Legacy Steward'],
  },
  vhen: {
    id: 'vhen',
    name: 'Vhen',
    role: 'Agriculture Expert · Businessman',
    profession: 'Community Helper',
    personality: 'Friendly, practical, family-oriented.',
    stages: ['Farm Helper','Garden Learner','Student Worker','Youth Volunteer','Field Assistant','Crop Care Worker','Community Helper','Agriculture Learner','Farm Technician','Harvest Organizer','Agribusiness Starter','Small Business Owner','Community Grower','Agriculture Specialist','Family Provider','Farm Entrepreneur','Community Business Leader','Resource Steward','Agriculture Mentor','Legacy Builder'],
  },
  ellusur: {
    id: 'ellusur',
    name: 'Elesur',
    role: 'Pastor · Teacher',
    profession: 'Farming Advocate · Volunteer',
    personality: 'Steady, hardworking, service-oriented.',
    stages: ['Little Learner','Church Boy','Student Helper','Youth Volunteer','Bible Learner','Classroom Assistant','Farm Helper','Community Volunteer','Sunday Helper','Teacher-in-Service','Ministry Worker','Field Mentor','Faith Leader','Community Teacher','Pastor','Agricultural Advocate','Volunteer Coordinator','Mission Pastor','Community Builder','Legacy Shepherd'],
  },
};

function statusLabel(active: boolean, level: number) {
  return active ? `ACTIVE · LEVEL ${level}` : 'UNLOCKED';
}

export default function BuklodSpecialSeriesOne({ userId, state, onStateRefresh }: Props) {
  const { theme } = useBuklodPresentation();
  const visible = state.visible_special_character_ids;
  const activeSpecialId = visible.includes(state.active_character_id as BuklodSpecialCharacterId)
    ? (state.active_character_id as BuklodSpecialCharacterId)
    : null;
  const [openId, setOpenId] = useState<BuklodSpecialCharacterId | null>(null);
  const [busyId, setBusyId] = useState<BuklodSpecialCharacterId | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const openProfile = useMemo(
    () => (openId && visible.includes(openId) ? SERIES_PROFILES[openId] : null),
    [openId, visible],
  );
  const activeProfile = activeSpecialId ? SERIES_PROFILES[activeSpecialId] : null;

  const activate = async (id: BuklodSpecialCharacterId) => {
    if (!userId || busyId || state.active_character_id === id) return;
    setBusyId(id);
    setMessage(null);
    try {
      await setMyBuklodCharacterActiveV2(userId, id);
      await onStateRefresh();
      setMessage(`${SERIES_PROFILES[id].name} is now your active Character at Level 1.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Could not activate Special Character.');
    } finally {
      setBusyId(null);
    }
  };

  if (!visible.length) return null;

  return (
    <View style={[styles.wrap, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>SPECIAL CHARACTERS · SERIES 1</Text>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Eight new BUKLOD journeys</Text>
          <Text style={[styles.note, { color: theme.textMuted }]}>Additions to Phan, Quin, Van, Christian and Lhen — never replacements. Only Specials already unlocked by your canonical Circle Rank appear here.</Text>
        </View>
        <MaterialCommunityIcons name="account-star-outline" size={26} color={theme.accent} />
      </View>

      {activeSpecialId && activeProfile ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open active Special Character ${activeProfile.name}`}
          onPress={() => setOpenId(activeSpecialId)}
          style={({ pressed }) => [styles.activeHero, { borderColor: theme.accentSoft, backgroundColor: theme.surface }, pressed && styles.pressed]}
        >
          <View style={styles.activeHeroTopRow}>
            <View style={styles.activeHeroLabelWrap}>
              <MaterialCommunityIcons name="check-decagram" size={18} color={theme.accent} />
              <View style={styles.activeHeroLabelCopy}>
                <Text style={[styles.activeHeroEyebrow, { color: theme.accent }]}>ACTIVE SPECIAL CHARACTER · MAIN VIEW</Text>
                <Text style={[styles.activeHeroName, { color: theme.textPrimary }]}>{activeProfile.name}</Text>
              </View>
            </View>
            <View style={[styles.activeHeroState, { borderColor: theme.accentSoft, backgroundColor: theme.surfaceMuted }]}>
              <Text style={[styles.activeHeroStateText, { color: theme.accent }]}>{statusLabel(true, state.character_level)}</Text>
            </View>
          </View>
          <View style={styles.activeHeroFrame}>
            <Image source={SPECIAL_CHARACTER_HERO[activeSpecialId]} style={styles.activeHeroImage} contentFit="contain" transition={160} />
          </View>
          <Text style={[styles.activeHeroRole, { color: theme.textPrimary }]}>{activeProfile.role}</Text>
          <Text style={[styles.activeHeroMeta, { color: theme.textSecondary }]}>{activeProfile.profession}</Text>
          <Text style={[styles.activeHeroNote, { color: theme.textMuted }]}>Special identity is active. Circle Points and Circle Rank remain preserved separately; Character levels do not transfer.</Text>
        </Pressable>
      ) : null}

      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {visible.map((id) => {
          const profile = SERIES_PROFILES[id];
          const active = state.active_character_id === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`Preview ${profile.name}`}
              onPress={() => setOpenId(id)}
              style={({ pressed }) => [styles.card, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }, pressed && styles.pressed]}
            >
              <View style={styles.thumbFrame}>
                <Image source={SPECIAL_CHARACTER_HERO[id]} style={styles.thumb} contentFit="contain" transition={120} />
              </View>
              <Text style={[styles.name, { color: theme.textPrimary }]}>{profile.name}</Text>
              <Text style={[styles.role, { color: theme.textSecondary }]} numberOfLines={2}>{profile.role}</Text>
              <View style={[styles.lockPill, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <MaterialCommunityIcons name={active ? 'check-decagram-outline' : 'star-circle-outline'} size={12} color={active ? theme.accent : theme.textMuted} />
                <Text style={[styles.lockText, { color: active ? theme.accent : theme.textMuted }]}>{statusLabel(active, active ? state.character_level : 1)}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.policyRow}>
        <Text style={[styles.policy, { color: theme.textMuted }]}>Special Character access is governed by canonical Circle Rank. Locked Specials are hidden. Choosing another Character starts that selected Character at Level 1 without reducing Circle Points or Circle Rank.</Text>
      </View>
      {message ? <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text> : null}

      <Modal visible={Boolean(openProfile)} transparent animationType="fade" onRequestClose={() => setOpenId(null)}>
        <Pressable style={styles.backdrop} onPress={() => setOpenId(null)}>
          <Pressable style={[styles.modalCard, { borderColor: theme.border, backgroundColor: theme.surface }]} onPress={(event) => event.stopPropagation()}>
            {openProfile && openId ? (
              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator nestedScrollEnabled>
                <View style={styles.modalTopRow}>
                  <View style={styles.modalTitleWrap}>
                    <Text style={[styles.modalEyebrow, { color: theme.accent }]}>SERIES 1 · CHARACTER PASSPORT PREVIEW</Text>
                    <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>{openProfile.name}</Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel="Close preview" onPress={() => setOpenId(null)} hitSlop={8}>
                    <MaterialCommunityIcons name="close" size={24} color={theme.textMuted} />
                  </Pressable>
                </View>

                <View style={styles.mediumFrame}>
                  <Image source={SPECIAL_CHARACTER_HERO[openId]} style={styles.medium} contentFit="contain" transition={140} />
                </View>
                <Text style={[styles.profileLine, { color: theme.textPrimary }]}>{openProfile.role}</Text>
                <Text style={[styles.profileMeta, { color: theme.textSecondary }]}>{openProfile.profession}</Text>
                <Text style={[styles.profileMeta, { color: theme.textMuted }]}>{openProfile.personality}</Text>

                <Text style={[styles.stageTitle, { color: theme.textPrimary }]}>STAGES 1–20</Text>
                <View style={styles.stageGrid}>
                  {openProfile.stages.map((stage, index) => (
                    <View key={`${openProfile.id}-stage-${index + 1}`} style={[styles.stageChip, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
                      <Text style={[styles.stageNo, { color: theme.accent }]}>{index + 1}</Text>
                      <Text style={[styles.stageName, { color: theme.textSecondary }]}>{stage}</Text>
                    </View>
                  ))}
                </View>

                <View style={[styles.unlockBox, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}>
                  <MaterialCommunityIcons name="check-decagram-outline" size={22} color={theme.accent} />
                  <View style={styles.unlockCopy}>
                    <Text style={[styles.unlockTitle, { color: theme.textPrimary }]}>Circle Rank access verified</Text>
                    <View style={styles.requirementRow}>
                      <MaterialCommunityIcons name="check-circle-outline" size={15} color={theme.accent} />
                      <Text style={[styles.requirementText, { color: theme.textSecondary }]}>Unlocked at Circle Rank {SPECIAL_REQUIRED_RANK_ORDER[openId]}</Text>
                    </View>
                    <Text style={[styles.unlockText, { color: theme.textMuted }]}>This passport is visible because the server-authoritative V2 state includes this Special Character. Selecting it starts this Character at Level 1; levels never transfer between Characters.</Text>

                    {state.active_character_id !== openId ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Use ${openProfile.name}`}
                        disabled={Boolean(busyId)}
                        onPress={() => void activate(openId)}
                        style={({ pressed }) => [styles.actionButton, { backgroundColor: theme.accent }, pressed && styles.pressed]}
                      >
                        {busyId === openId ? <ActivityIndicator size="small" color={theme.white} /> : <Text style={[styles.actionText, { color: theme.white }]}>USE CHARACTER</Text>}
                      </Pressable>
                    ) : (
                      <View style={[styles.activeButton, { borderColor: theme.accentSoft, backgroundColor: theme.surface }]}>
                        <MaterialCommunityIcons name="check-decagram" size={16} color={theme.accent} />
                        <Text style={[styles.activeButtonText, { color: theme.accent }]}>ACTIVE CHARACTER · LEVEL {state.character_level}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, paddingBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 14 },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  title: { fontSize: 16, fontWeight: '900' },
  note: { fontSize: 10, lineHeight: 15 },
  activeHero: { marginHorizontal: 14, marginTop: 14, borderWidth: 1, borderRadius: 18, padding: 12, overflow: 'hidden' },
  activeHeroTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  activeHeroLabelWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeHeroLabelCopy: { flex: 1 },
  activeHeroEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 0.55 },
  activeHeroName: { marginTop: 2, fontSize: 21, fontWeight: '900' },
  activeHeroState: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  activeHeroStateText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.35 },
  activeHeroFrame: { marginTop: 10, width: '100%', height: 330, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 14 },
  activeHeroImage: { width: '100%', height: '100%' },
  activeHeroRole: { marginTop: 10, fontSize: 13, fontWeight: '900' },
  activeHeroMeta: { marginTop: 2, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  activeHeroNote: { marginTop: 7, fontSize: 9, lineHeight: 13 },
  row: { gap: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  card: { width: 176, borderWidth: 1, borderRadius: 16, padding: 9 },
  pressed: { opacity: 0.75 },
  thumbFrame: { width: '100%', height: 132, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 12 },
  thumb: { width: '100%', height: '100%' },
  name: { marginTop: 8, fontSize: 15, fontWeight: '900' },
  role: { marginTop: 2, minHeight: 28, fontSize: 9, lineHeight: 13, fontWeight: '700' },
  lockPill: { marginTop: 7, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4 },
  lockText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.3 },
  policyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  policy: { flex: 1, fontSize: 9, lineHeight: 13 },
  message: { paddingHorizontal: 14, paddingBottom: 10, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 620, maxHeight: '92%', borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  modalContent: { padding: 16, paddingBottom: 28 },
  modalTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  modalTitleWrap: { flex: 1 },
  modalEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  modalTitle: { marginTop: 2, fontSize: 24, fontWeight: '900' },
  mediumFrame: { marginTop: 12, width: '100%', height: 360, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 16 },
  medium: { width: '100%', height: '100%' },
  profileLine: { marginTop: 12, fontSize: 14, fontWeight: '900' },
  profileMeta: { marginTop: 3, fontSize: 11, lineHeight: 16 },
  stageTitle: { marginTop: 16, marginBottom: 8, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  stageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stageChip: { width: '48%', minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6 },
  stageNo: { width: 18, fontSize: 10, fontWeight: '900' },
  stageName: { flex: 1, fontSize: 9, lineHeight: 12, fontWeight: '700' },
  unlockBox: { marginTop: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  unlockCopy: { flex: 1 },
  unlockTitle: { flex: 1, fontSize: 11, fontWeight: '900' },
  requirementRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 7 },
  requirementText: { flex: 1, fontSize: 10, fontWeight: '700' },
  unlockText: { marginTop: 8, fontSize: 10, lineHeight: 15 },
  actionButton: { marginTop: 10, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  actionText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  activeButton: { marginTop: 10, minHeight: 42, flexDirection: 'row', gap: 7, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  activeButtonText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.35, textAlign: 'center' },
});
