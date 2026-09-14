/* BUKLOD_CHARACTER_R40_LAYOUT_LOCK_V3 */
/* Approved R40 premium presentation forward-ported onto V2/server authority. */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import {
  SPECIAL_REQUIRED_RANK_ORDER,
  setMyBuklodCharacterActiveV2,
  type BuklodCharacterSelectionV2State,
  type BuklodSpecialCharacterId,
} from '@/lib/buklodCharacterSelectionV2';
import {
  SPECIAL_CHARACTER_HERO,
  getBuklodSpecialLevelAsset,
} from '@/lib/buklodSpecialCharacterAssets';

type Props = {
  userId?: string | null;
  state: BuklodCharacterSelectionV2State;
  onStateRefresh: () => Promise<void> | void;
};

type CollectibleRow = {
  level_no?: number;
  collectible_id?: string;
  collectible_name?: string;
  badge_name?: string;
  difficulty_tier?: number;
  secret?: boolean;
  earned?: boolean;
};

type Profile = {
  id: BuklodSpecialCharacterId;
  name: string;
  domain: string;
  quote: string;
  description: string;
  traits: readonly string[];
  stages: readonly string[];
};

const PROFILES: Record<BuklodSpecialCharacterId, Profile> = {
  jawo: {
    id: 'jawo', name: 'JAWO', domain: 'NATURE · MUSIC · COMMUNITY',
    quote: 'Harmony is built when gifts are shared with purpose.',
    description: 'Music, nature, worship, creativity, and community life grow together through service.',
    traits: ['Music', 'Nature', 'Worship', 'Community'],
    stages: ['Young Dreamer','Nature Lover','Student Musician','Campus Volunteer','Youth Encourager','Choir Member','Guitar Learner','Worship Music Helper','Community Singer','Music Team Member','Youth Mentor','Worship Leader','Creative Ministry Worker','Forest Advocate','Community Organizer','Music Trainer','Mission Volunteer','Discipleship Worker','Church Planting Partner','Purposeful Leader'],
  },
  trudice: {
    id: 'trudice', name: 'TRUDICE', domain: 'CHILDREN · TEACHING · DISCIPLESHIP',
    quote: 'Teach with care, and every lesson can shape a life.',
    description: 'A children and education journey centered on teaching, values, curriculum, and mentoring teachers.',
    traits: ['Children', 'Teaching', 'Values', 'Mentoring'],
    stages: ['Little Learner','Story Listener','Sunday School Helper','Young Teacher','Children’s Guide','Classroom Assistant','Student Mentor','Learning Facilitator','Sunday School Teacher','Classroom Teacher','Creative Educator','Values Mentor','Children’s Ministry Teacher','Learning Coordinator','Teacher-Leader','Curriculum Builder','Mentor of Teachers','Education Ministry Leader','Community Educator','Legacy Teacher'],
  },
  ace: {
    id: 'ace', name: 'ACE', domain: 'HEALTH · STRATEGY · SERVICE',
    quote: 'Small steps of care create a stronger community.',
    description: 'Health, discipline, practical care, and wise service shaped into one purposeful journey.',
    traits: ['Health Advocacy', 'Community Service', 'Strategy', 'Practical Care'],
    stages: ['Curious Learner','Caring Student','Chess Beginner','School Helper','Youth Encourager','Nursing Student','Chess Competitor','Community Helper','Campus Leader','Junior Nurse','Board Passer','Staff Nurse','Wellness Advocate','Chess Mentor','Community Health Leader','Mission Nurse','Strategic Mentor','Healing Servant Leader','Regional Health Mentor','Legacy Care Champion'],
  },
  mitch: {
    id: 'mitch', name: 'MITCH', domain: 'ARTS · CULTURE · TEACHING',
    quote: 'Creativity becomes powerful when it helps others learn.',
    description: 'A creative educator journey joining visual art, culture, teaching, mentorship, and mission.',
    traits: ['Creative Arts', 'Teaching', 'Culture', 'Mentorship'],
    stages: ['Little Dreamer','Young Creator','Art Helper','Story Drawer','Classroom Assistant','Student Teacher','Creative Mentor','Community Artist','Arts Teacher','Tribal Educator','Culture Advocate','Creative Leader','Workshop Facilitator','Arts Ministry Worker','Community Inspiration Builder','Education & Arts Coordinator','Missionary-Educator','Regional Creative Trainer','Heritage Advocate','Legacy Art Mentor'],
  },
  niel: {
    id: 'niel', name: 'NIEL', domain: 'WORSHIP · DISCIPLESHIP · MISSION',
    quote: 'Lead worship. Make disciples. Carry the mission forward.',
    description: 'A worship and discipleship path that matures into mentoring, mission, and church planting.',
    traits: ['Worship', 'Discipleship', 'Mentoring', 'Mission'],
    stages: ['Young Singer','Faith Listener','Youth Helper','Small Group Member','Worship Volunteer','Bible Learner','Student Mentor','Young Teacher','Worship Leader','Youth Pastor','Discipleship Leader','Mission Volunteer','Outreach Trainer','Church Planting Apprentice','Community Shepherd','Ministry Coordinator','Discipleship Pastor','Church Planting Leader','Regional Mission Mentor','Legacy Disciple-Maker'],
  },
  angel: {
    id: 'angel', name: 'ANGEL', domain: 'STEWARDSHIP · ACCOUNTABILITY',
    quote: 'Steward well today so more can be served tomorrow.',
    description: 'A stewardship journey built around responsibility, transparent records, planning, and resource care.',
    traits: ['Stewardship', 'Finance', 'Accountability', 'Planning'],
    stages: ['Little Helper','Savings Learner','Student Organizer','Class Treasurer','Young Steward','Record Keeper','Budget Assistant','Community Volunteer','Stewardship Worker','Finance Coordinator','Ministry Treasurer','Resource Planner','Budget Manager','Community Treasurer','Financial Trainer','Stewardship Leader','Development Coordinator','Resource Director','Community Finance Head','Legacy Steward'],
  },
  vhen: {
    id: 'vhen', name: 'VHEN', domain: 'AGRICULTURE · BUSINESS · FAMILY',
    quote: 'Grow what matters. Build what lasts. Provide with purpose.',
    description: 'Agriculture, productivity, enterprise, family provision, and stewardship form this builder journey.',
    traits: ['Agriculture', 'Enterprise', 'Family', 'Stewardship'],
    stages: ['Farm Helper','Garden Learner','Student Worker','Youth Volunteer','Field Assistant','Crop Care Worker','Community Helper','Agriculture Learner','Farm Technician','Harvest Organizer','Agribusiness Starter','Small Business Owner','Community Grower','Agriculture Specialist','Family Provider','Farm Entrepreneur','Community Business Leader','Resource Steward','Agriculture Mentor','Legacy Builder'],
  },
  ellusur: {
    id: 'ellusur', name: 'ELESUR', domain: 'FAITH · TEACHING · SERVICE',
    quote: 'Faith grows best when it is planted, taught, and lived.',
    description: 'A steady path of learning, teaching, agriculture, ministry, and faithful community service.',
    traits: ['Faith Formation', 'Teaching', 'Agriculture', 'Pastoral Service'],
    stages: ['Little Learner','Church Boy','Student Helper','Youth Volunteer','Bible Learner','Classroom Assistant','Farm Helper','Community Volunteer','Sunday Helper','Teacher-in-Service','Ministry Worker','Field Mentor','Faith Leader','Community Teacher','Pastor','Agricultural Advocate','Volunteer Coordinator','Mission Pastor','Community Builder','Legacy Shepherd'],
  },
};

export default function BuklodSpecialCharacterSeries({ userId, state, onStateRefresh }: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const nativeLayout = Platform.OS !== 'web';
  /* Canonical: only server-approved visible IDs are rendered. Locked Specials stay hidden. */
  const visible = state.visible_special_character_ids;
  const activeSpecial = visible.includes(state.active_character_id as BuklodSpecialCharacterId)
    ? (state.active_character_id as BuklodSpecialCharacterId)
    : null;
  const [selectedId, setSelectedId] = useState<BuklodSpecialCharacterId | null>(activeSpecial ?? visible[0] ?? null);
  const [previewLevel, setPreviewLevel] = useState(activeSpecial ? state.character_level : 1);
  const [busy, setBusy] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(!nativeLayout);
  const [collectibles, setCollectibles] = useState<CollectibleRow[]>([]);
  const [collectibleLoading, setCollectibleLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId && visible.includes(selectedId)) return;
    setSelectedId(activeSpecial ?? visible[0] ?? null);
  }, [activeSpecial, selectedId, visible]);

  useEffect(() => {
    if (!selectedId) return;
    const active = state.active_character_id === selectedId;
    setPreviewLevel(active ? Math.max(1, Math.min(20, state.character_level)) : 1);
    if (nativeLayout) setDetailsOpen(false);
  }, [nativeLayout, selectedId, state.active_character_id, state.character_level]);

  useEffect(() => {
    if (!selectedId || !userId || (nativeLayout && !detailsOpen)) {
      setCollectibles([]);
      setCollectibleLoading(false);
      return;
    }
    let mounted = true;
    setCollectibleLoading(true);
    void (async () => {
      try {
        const { data, error } = await (supabase as any).rpc('get_my_buklod_special_collectibles_v2', {
          p_character_id: selectedId,
        });
        if (!mounted) return;
        if (error) {
          setCollectibles([]);
          return;
        }
        const rows = Array.isArray(data?.collectibles) ? data.collectibles : [];
        setCollectibles(rows as CollectibleRow[]);
      } catch {
        if (mounted) setCollectibles([]);
      } finally {
        if (mounted) setCollectibleLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [detailsOpen, nativeLayout, selectedId, userId]);

  if (!visible.length) {
    return (
      <View style={styles.shell}>
        <Text style={styles.heading}>Special Character Journey</Text>
        <Text style={styles.subheading}>Special Characters remain hidden until your canonical Circle Rank unlocks them.</Text>
      </View>
    );
  }

  const selected = PROFILES[selectedId ?? visible[0]];
  const active = state.active_character_id === selected.id;
  const currentLevel = active ? Math.max(1, Math.min(20, state.character_level)) : 1;
  const requiredRank = SPECIAL_REQUIRED_RANK_ORDER[selected.id];
  const rankProgress = Math.max(0, Math.min(1, state.circle_rank_order / Math.max(1, requiredRank)));
  const levelCollectibles = collectibles.filter((item) => Number(item.level_no) === previewLevel);

  const useCharacter = async () => {
    if (!userId || active || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await setMyBuklodCharacterActiveV2(userId, selected.id);
      setPreviewLevel(1);
      await onStateRefresh();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Could not activate Special Character.');
    } finally {
      setBusy(false);
    }
  };

  const trackJourney = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await (supabase as any).rpc('set_my_buklod_special_character_pursuit_v1', {
        p_character_id: selected.id,
      });
      if (error) throw error;
      setMessage(`${selected.name} journey is being tracked.`);
    } catch {
      setMessage('Journey tracking is unavailable right now. Character access is unchanged.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.shell, nativeLayout && styles.shellNative]}>
      <View style={[styles.topHeader, compact && styles.topHeaderCompact]}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>SC</Text></View>
        <View style={styles.headerCopy}>
          <Text style={styles.heading}>Special Character Journey</Text>
          <Text style={styles.subheading}>Harder mastery progression. Only Specials already unlocked by Circle Rank appear here.</Text>
        </View>
        {!compact ? (
          <View style={styles.missionNote}>
            <Text style={styles.missionTitle}>More than a character. A mission.</Text>
            <Text style={styles.missionText}>Grow in character. Serve with purpose. Make an impact.</Text>
          </View>
        ) : null}
      </View>

      <ScrollView horizontal nestedScrollEnabled removeClippedSubviews={nativeLayout} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.characterRail}>
        {visible.map((id) => {
          const profile = PROFILES[id];
          const chosen = id === selected.id;
          const activeNow = state.active_character_id === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`View ${profile.name}`}
              onPress={() => setSelectedId(id)}
              style={[styles.characterCard, chosen && styles.characterCardSelected]}
            >
              <View style={styles.characterImageFrame}>
                <Image source={SPECIAL_CHARACTER_HERO[id]} style={styles.characterImage} resizeMode="contain" />
              </View>
              <Text style={styles.characterName}>{profile.name}</Text>
              <Text style={styles.characterRank}>Circle Rank {SPECIAL_REQUIRED_RANK_ORDER[id]}</Text>
              <Text style={activeNow ? styles.characterStateActive : styles.characterStateReady}>
                {activeNow ? `ACTIVE · LEVEL ${state.character_level}` : 'UNLOCKED'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.heroPanel, compact && styles.heroPanelCompact]}>
        <View style={[styles.largeArtFrame, compact && styles.largeArtFrameCompact]}>
          <Image source={SPECIAL_CHARACTER_HERO[selected.id]} style={styles.largeArt} resizeMode="contain" />
        </View>
        <View style={styles.heroCopy}>
          <View style={styles.titleRow}>
            <Text style={styles.detailTitle}>{selected.name}</Text>
            <View style={styles.specialPill}><Text style={styles.specialPillText}>SPECIAL CHARACTER</Text></View>
          </View>
          <Text style={styles.detailDomain}>{selected.domain}</Text>
          <Text style={styles.quoteText}>“{selected.quote}”</Text>
          <Text style={styles.description}>{selected.description}</Text>
          <View style={styles.traitWrap}>
            {selected.traits.map((trait, index) => (
              <View key={trait} style={styles.traitPill}>
                <View style={[styles.traitDot, index === 1 && styles.traitDotAlt, index === 2 && styles.traitDotGold, index === 3 && styles.traitDotPurple]} />
                <Text style={styles.traitText}>{trait}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={[styles.rankPanel, compact && styles.rankPanelCompact]}>
          <Text style={styles.rankStatus}>{active ? `Level ${currentLevel}` : 'Unlocked'}</Text>
          <Text style={styles.rankSubtitle}>{active ? selected.stages[currentLevel - 1] : 'Selecting this Character starts it at Level 1.'}</Text>
          <View style={styles.rankLine}>
            <Text style={styles.rankLabel}>Your Circle Rank</Text>
            <Text style={styles.rankValue}>{state.circle_rank_order} / {requiredRank}</Text>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${rankProgress * 100}%` }]} /></View>
          <Text style={styles.rankHelp}>Circle Points and Circle Rank remain intact when you change Character. Character levels do not transfer.</Text>
          {!active ? (
            <Pressable disabled={busy} onPress={() => void useCharacter()} style={[styles.primaryAction, busy && styles.primaryActionDisabled]}>
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryActionText}>USE CHARACTER</Text>}
            </Pressable>
          ) : (
            <View style={styles.activePill}><Text style={styles.activePillText}>ACTIVE CHARACTER</Text></View>
          )}
          <Pressable disabled={busy} onPress={() => void trackJourney()} style={styles.subtleAction}>
            <Text style={styles.subtleActionText}>TRACK THIS JOURNEY</Text>
          </Pressable>
        </View>
      </View>

      {nativeLayout ? (
        <Pressable onPress={() => setDetailsOpen((value) => !value)} style={styles.nativeDetailsToggle}>
          <Text style={styles.nativeDetailsToggleTitle}>{detailsOpen ? 'HIDE JOURNEY DETAILS' : 'OPEN JOURNEY DETAILS'}</Text>
          <Text style={styles.nativeDetailsToggleText}>{detailsOpen ? 'Close detailed levels and collectibles for faster browsing.' : 'Loads Level 1-20 and collectibles only when you open them.'}</Text>
        </Pressable>
      ) : null}

      {(!nativeLayout || detailsOpen) ? (
        <>
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderCopy}>
                <Text style={styles.sectionTitle}>LEVEL 1 - 20 JOURNEY</Text>
                <Text style={styles.sectionCaption}>Future level artwork can be previewed; server state alone determines the earned/current level.</Text>
              </View>
            </View>
            <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelRail}>
              {Array.from({ length: 20 }, (_, index) => index + 1).map((level) => {
                const isCurrent = active && level === currentLevel;
                const earned = active && level <= currentLevel;
                const chosen = level === previewLevel;
                return (
                  <Pressable key={`${selected.id}-${level}`} onPress={() => setPreviewLevel(level)} style={[styles.levelCard, isCurrent && styles.levelCardCurrent, chosen && styles.levelCardChosen]}>
                    <View style={styles.levelImageFrame}>
                      <Image source={getBuklodSpecialLevelAsset(selected.id, level)} style={styles.levelImage} resizeMode="contain" />
                      <View style={styles.levelNumberBadge}><Text style={styles.levelNumberText}>{level}</Text></View>
                    </View>
                    <Text style={styles.levelTitle} numberOfLines={2}>{selected.stages[level - 1]}</Text>
                    <Text style={isCurrent ? styles.levelOpen : earned ? styles.levelOpen : styles.levelLocked}>{isCurrent ? 'CURRENT' : earned ? 'EARNED' : 'PREVIEW'}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderCopy}>
                <Text style={styles.sectionTitle}>COLLECTIBLES & BADGES</Text>
                <Text style={styles.sectionCaption}>Level {previewLevel} rewards. Collectibles never transfer Character level or Circle Rank.</Text>
              </View>
            </View>
            {collectibleLoading ? <ActivityIndicator style={styles.collectibleLoader} /> : levelCollectibles.length ? (
              <View style={styles.collectibleGrid}>
                {levelCollectibles.map((item, index) => (
                  <View key={item.collectible_id ?? `${selected.id}-${previewLevel}-${index}`} style={[styles.collectibleCard, compact && styles.collectibleCardCompact]}>
                    <View style={styles.collectibleIcon}><Text style={styles.collectibleIconText}>{item.secret && !item.earned ? '?' : previewLevel}</Text></View>
                    <Text style={styles.collectibleName} numberOfLines={2}>{item.collectible_name ?? `Level ${previewLevel} collectible`}</Text>
                    {item.badge_name ? <Text style={styles.badgeName} numberOfLines={1}>{item.badge_name}</Text> : null}
                    <Text style={item.earned ? styles.collectibleEarned : styles.collectibleTier}>{item.earned ? 'COLLECTED' : `TIER ${item.difficulty_tier ?? 1}`}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyCollectible}>No collectible rows are available from the server for this level. Character progression is unchanged.</Text>
            )}
          </View>
        </>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { marginTop: 18, borderRadius: 24, borderWidth: 1, borderColor: '#D9E7DE', backgroundColor: '#F7FBF8', overflow: 'hidden' },
  shellNative: { overflow: 'visible' },
  topHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10 },
  topHeaderCompact: { alignItems: 'flex-start', flexWrap: 'wrap' },
  brandMark: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#178A43', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  headerCopy: { flex: 1, minWidth: 220 },
  heading: { fontSize: 24, lineHeight: 29, fontWeight: '900', color: '#0D2A1C' },
  subheading: { marginTop: 2, fontSize: 11, lineHeight: 17, color: '#315F45' },
  missionNote: { maxWidth: 360, minWidth: 250, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, backgroundColor: '#F3F7EF', borderWidth: 1, borderColor: '#E1E8DA' },
  missionTitle: { fontSize: 12, fontWeight: '900', color: '#253528' },
  missionText: { marginTop: 2, fontSize: 10.5, color: '#5E6C62' },
  characterRail: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  characterCard: { width: 150, borderRadius: 17, padding: 7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE7E0' },
  characterCardSelected: { borderColor: '#1EA653', borderWidth: 2, shadowColor: '#1EA653', shadowOpacity: 0.12, shadowRadius: 8, elevation: 2 },
  characterImageFrame: { height: 138, borderRadius: 13, overflow: 'hidden', backgroundColor: '#F1F5F2', alignItems: 'center', justifyContent: 'center' },
  characterImage: { width: '100%', height: '100%' },
  characterName: { marginTop: 7, textAlign: 'center', fontSize: 14, fontWeight: '900', color: '#15271D' },
  characterRank: { marginTop: 1, textAlign: 'center', fontSize: 10, color: '#506257' },
  characterStateActive: { marginTop: 5, textAlign: 'center', fontSize: 8.5, fontWeight: '900', color: '#15783A' },
  characterStateReady: { marginTop: 5, textAlign: 'center', fontSize: 8.5, fontWeight: '900', color: '#34754A' },
  heroPanel: { marginHorizontal: 16, marginBottom: 14, padding: 10, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE7E0', flexDirection: 'row', gap: 18, alignItems: 'stretch' },
  heroPanelCompact: { flexDirection: 'column' },
  largeArtFrame: { width: 330, minHeight: 260, borderRadius: 18, overflow: 'hidden', backgroundColor: '#EDF5F0', alignItems: 'center', justifyContent: 'center' },
  largeArtFrameCompact: { width: '100%', height: 300, minHeight: 300 },
  largeArt: { width: '100%', height: '100%', minHeight: 260 },
  heroCopy: { flex: 1.2, paddingVertical: 12, minWidth: 220 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  detailTitle: { fontSize: 32, lineHeight: 38, fontWeight: '900', color: '#0E2A1C' },
  specialPill: { backgroundColor: '#F6EBD1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  specialPillText: { fontSize: 9, fontWeight: '900', color: '#8A6517' },
  detailDomain: { marginTop: 5, fontSize: 15, fontWeight: '900', color: '#178A43' },
  quoteText: { marginTop: 8, fontSize: 13, lineHeight: 19, fontStyle: 'italic', color: '#4C6658' },
  description: { marginTop: 8, fontSize: 12, lineHeight: 19, color: '#43564B' },
  traitWrap: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  traitPill: { minWidth: 112, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#E3E9E5', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFFFFF' },
  traitDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#1C9A4C' },
  traitDotAlt: { backgroundColor: '#2687D8' },
  traitDotGold: { backgroundColor: '#E3A516' },
  traitDotPurple: { backgroundColor: '#8D48CC' },
  traitText: { flex: 1, fontSize: 9.5, fontWeight: '800', color: '#2F3D34' },
  rankPanel: { width: 290, minWidth: 230, padding: 16, borderRadius: 18, backgroundColor: '#EDF8F1', justifyContent: 'center' },
  rankPanelCompact: { width: '100%', minWidth: 0 },
  rankStatus: { fontSize: 18, fontWeight: '900', color: '#163A26' },
  rankSubtitle: { marginTop: 2, fontSize: 11, lineHeight: 16, color: '#3C5B49' },
  rankLine: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  rankLabel: { fontSize: 10, color: '#53675A' },
  rankValue: { fontSize: 12, fontWeight: '900', color: '#167C3C' },
  progressTrack: { marginTop: 7, height: 10, borderRadius: 5, backgroundColor: '#CFE8D8', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: '#1AA14C' },
  rankHelp: { marginTop: 14, fontSize: 10.5, lineHeight: 16, color: '#237243' },
  primaryAction: { marginTop: 14, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#168A42' },
  primaryActionDisabled: { opacity: 0.55 },
  primaryActionText: { fontSize: 9, fontWeight: '900', color: '#FFFFFF' },
  activePill: { marginTop: 14, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#DDF2E5' },
  activePillText: { fontSize: 9, fontWeight: '900', color: '#168A42' },
  subtleAction: { marginTop: 10, alignSelf: 'flex-start', paddingVertical: 5 },
  subtleActionText: { fontSize: 9.5, fontWeight: '900', color: '#167A3C' },
  nativeDetailsToggle: { marginHorizontal: 16, marginBottom: 14, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: '#CFE2D5', backgroundColor: '#F4FAF6' },
  nativeDetailsToggleTitle: { fontSize: 12, lineHeight: 16, fontWeight: '900', color: '#17683A' },
  nativeDetailsToggleText: { marginTop: 3, fontSize: 10.5, lineHeight: 15, color: '#557060' },
  sectionCard: { marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE7E0' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionHeaderCopy: { flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#163425' },
  sectionCaption: { marginTop: 2, fontSize: 10.5, lineHeight: 15, color: '#617068' },
  levelRail: { paddingTop: 10, gap: 8 },
  levelCard: { width: 124, minHeight: 176, borderRadius: 14, padding: 6, borderWidth: 1, borderColor: '#E0E7E2', backgroundColor: '#FBFDFC' },
  levelCardCurrent: { borderColor: '#1DA04C', borderWidth: 2 },
  levelCardChosen: { backgroundColor: '#F0FAF4' },
  levelImageFrame: { height: 92, borderRadius: 11, overflow: 'hidden', backgroundColor: '#ECF1EE', alignItems: 'center', justifyContent: 'center' },
  levelImage: { width: '100%', height: '100%' },
  levelNumberBadge: { position: 'absolute', bottom: 5, left: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: '#178E45', alignItems: 'center', justifyContent: 'center' },
  levelNumberText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  levelTitle: { marginTop: 6, minHeight: 30, fontSize: 10.5, lineHeight: 14, fontWeight: '800', color: '#24352B' },
  levelOpen: { marginTop: 3, fontSize: 8.5, fontWeight: '900', color: '#16813E' },
  levelLocked: { marginTop: 3, fontSize: 8.5, fontWeight: '900', color: '#879088' },
  collectibleLoader: { marginVertical: 20 },
  collectibleGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  collectibleCard: { width: 150, minHeight: 140, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#E1E8E3', backgroundColor: '#FBFDFC' },
  collectibleCardCompact: { width: '48%' },
  collectibleIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E0F3E6', alignItems: 'center', justifyContent: 'center' },
  collectibleIconText: { fontSize: 12, fontWeight: '900', color: '#188442' },
  collectibleName: { marginTop: 8, fontSize: 11, fontWeight: '900', color: '#22332A' },
  badgeName: { marginTop: 2, fontSize: 9, color: '#667269' },
  collectibleEarned: { marginTop: 7, fontSize: 8.5, fontWeight: '900', color: '#12833C' },
  collectibleTier: { marginTop: 7, fontSize: 8.5, fontWeight: '900', color: '#58655C' },
  emptyCollectible: { marginTop: 10, fontSize: 10, lineHeight: 15, color: '#69746D' },
  message: { marginHorizontal: 16, marginBottom: 14, padding: 10, borderRadius: 12, backgroundColor: '#F5F7F5', fontSize: 10.5, lineHeight: 15, color: '#9B2C2C' },
});
