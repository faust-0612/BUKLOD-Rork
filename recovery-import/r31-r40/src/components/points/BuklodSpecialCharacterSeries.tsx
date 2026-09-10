/* BUKLOD_SPECIAL_BATCH1_R40_PREMIUM_UI */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  SPECIAL_CHARACTER_HERO,
  getBuklodSpecialLevelAsset,
  type BuklodSpecialCharacterId,
} from '@/lib/buklodSpecialCharacterAssets';

type Props = {
  userId?: string | null;
};

type CharacterState = {
  character_id: BuklodSpecialCharacterId;
  display_name: string;
  series_no: number;
  unlock_rank_order: number;
  domain_key: string;
  unlocked: boolean;
  next_locked: boolean;
  level1_preview_allowed: boolean;
  current_level: number;
  level_count: number;
  stage_titles?: string[] | null;
  active?: boolean;
};

type StatePayload = {
  series_no: number;
  circle_rank_order: number;
  visibility_rule: string;
  active_special_character_id?: BuklodSpecialCharacterId | null;
  characters: CharacterState[];
};

type CollectibleItem = {
  level_no: number;
  collectible_id: string;
  collectible_name: string;
  badge_name: string;
  difficulty_tier: number;
  secret: boolean;
  earned: boolean;
  earned_at: string | null;
  earned_early: boolean;
  level_viewable: boolean;
  requirement: unknown;
};

type CollectiblePayload = {
  character_id: BuklodSpecialCharacterId;
  unlocked: boolean;
  current_level: number;
  level1_always_viewable: boolean;
  collectibles: CollectibleItem[];
};

type CharacterConfig = {
  id: BuklodSpecialCharacterId;
  name: string;
  rank: number;
  domain: string;
  quote: string;
  description: string;
  traits: string[];
  stages: string[];
};

const CHARACTERS: CharacterConfig[] = [
  {
    id: 'ace',
    name: 'ACE',
    rank: 5,
    domain: 'HEALTH STRATEGY SERVICE',
    quote: 'Small steps of care create a stronger community.',
    description: 'Health, discipline, practical care, and wise service shaped into one purposeful journey.',
    traits: ['Health Advocacy', 'Community Service', 'Strategy & Planning', 'Practical Discipleship'],
    stages: ['Curious Learner','Caring Student','Chess Beginner','School Helper','Youth Encourager','Nursing Student','Chess Competitor','Community Helper','Campus Leader','Junior Nurse','Board Passer','Staff Nurse','Wellness Advocate','Chess Mentor','Community Health Leader','Mission Nurse','Strategic Mentor','Healing Servant Leader','Regional Health Mentor','Legacy Care Champion'],
  },
  {
    id: 'ellusur',
    name: 'ELLUSUR',
    rank: 6,
    domain: 'FAITH TEACHING SERVICE',
    quote: 'Faith grows best when it is planted, taught, and lived.',
    description: 'A steady path of learning, teaching, agriculture, ministry, and faithful community service.',
    traits: ['Faith Formation', 'Teaching', 'Agriculture', 'Pastoral Service'],
    stages: ['Little Learner','Church Boy','Student Helper','Youth Volunteer','Bible Learner','Classroom Assistant','Farm Helper','Community Volunteer','Sunday Helper','Teacher-in-Service','Ministry Worker','Field Mentor','Faith Leader','Community Teacher','Pastor','Agricultural Advocate','Volunteer Coordinator','Mission Pastor','Community Builder','Legacy Shepherd'],
  },
  {
    id: 'jawo',
    name: 'JAVVO',
    rank: 7,
    domain: 'NATURE MUSIC COMMUNITY',
    quote: 'Harmony is built when gifts are shared with purpose.',
    description: 'Music, nature, worship, creativity, and community life grow together through service.',
    traits: ['Music', 'Nature', 'Worship', 'Community'],
    stages: ['Young Dreamer','Nature Lover','Student Musician','Campus Volunteer','Youth Encourager','Choir Member','Guitar Learner','Worship Music Helper','Community Singer','Music Team Member','Youth Mentor','Worship Leader','Creative Ministry Worker','Forest Advocate','Community Organizer','Music Trainer','Mission Volunteer','Discipleship Worker','Church Planting Partner','Purposeful Leader'],
  },
  {
    id: 'mitch',
    name: 'MITCH',
    rank: 8,
    domain: 'ARTS CULTURE TEACHING',
    quote: 'Creativity becomes powerful when it helps others learn.',
    description: 'A creative educator journey joining visual art, culture, teaching, mentorship, and mission.',
    traits: ['Creative Arts', 'Teaching', 'Culture', 'Mentorship'],
    stages: ['Little Dreamer','Young Creator','Art Helper','Story Drawer','Classroom Assistant','Student Teacher','Creative Mentor','Community Artist','Arts Teacher','Tribal Educator','Culture Advocate','Creative Leader','Workshop Facilitator','Arts Ministry Worker','Community Inspiration Builder','Education & Arts Coordinator','Missionary-Educator','Regional Creative Trainer','Heritage Advocate','Legacy Art Mentor'],
  },
  {
    id: 'niel',
    name: 'NIEL',
    rank: 9,
    domain: 'WORSHIP DISCIPLESHIP MISSION',
    quote: 'Lead worship. Make disciples. Carry the mission forward.',
    description: 'A worship and discipleship path that matures into mentoring, mission, and church planting.',
    traits: ['Worship', 'Discipleship', 'Mentoring', 'Mission'],
    stages: ['Young Singer','Faith Listener','Youth Helper','Small Group Member','Worship Volunteer','Bible Learner','Student Mentor','Young Teacher','Worship Leader','Youth Pastor','Discipleship Leader','Mission Volunteer','Outreach Trainer','Church Planting Apprentice','Community Shepherd','Ministry Coordinator','Discipleship Pastor','Church Planting Leader','Regional Mission Mentor','Legacy Disciple-Maker'],
  },
  {
    id: 'angel',
    name: 'ANGEL',
    rank: 10,
    domain: 'STEWARDSHIP ACCOUNTABILITY',
    quote: 'Steward well today so more can be served tomorrow.',
    description: 'A stewardship journey built around responsibility, transparent records, planning, and resource care.',
    traits: ['Stewardship', 'Finance', 'Accountability', 'Resource Planning'],
    stages: ['Little Helper','Savings Learner','Student Organizer','Class Treasurer','Young Steward','Record Keeper','Budget Assistant','Community Volunteer','Stewardship Worker','Finance Coordinator','Ministry Treasurer','Resource Planner','Budget Manager','Community Treasurer','Financial Trainer','Stewardship Leader','Development Coordinator','Resource Director','Community Finance Head','Legacy Steward'],
  },
  {
    id: 'vhen',
    name: 'VHEN',
    rank: 11,
    domain: 'AGRICULTURE BUSINESS FAMILY',
    quote: 'Grow what matters. Build what lasts. Provide with purpose.',
    description: 'Agriculture, productivity, enterprise, family provision, and stewardship form this builder journey.',
    traits: ['Agriculture', 'Enterprise', 'Family', 'Stewardship'],
    stages: ['Farm Helper','Garden Learner','Student Worker','Youth Volunteer','Field Assistant','Crop Care Worker','Community Helper','Agriculture Learner','Farm Technician','Harvest Organizer','Agribusiness Starter','Small Business Owner','Community Grower','Agriculture Specialist','Family Provider','Farm Entrepreneur','Community Business Leader','Resource Steward','Agriculture Mentor','Legacy Builder'],
  },
  {
    id: 'trudice',
    name: 'TRUDICE',
    rank: 13,
    domain: 'CHILDREN TEACHING DISCIPLESHIP',
    quote: 'Teach with care, and every lesson can shape a life.',
    description: 'A children and education journey centered on teaching, values, curriculum, and mentoring teachers.',
    traits: ['Children', 'Teaching', 'Values', 'Mentoring'],
    stages: ['Little Learner','Story Listener','Sunday School Helper','Young Teacher','Children\'s Guide','Classroom Assistant','Student Mentor','Learning Facilitator','Sunday School Teacher','Classroom Teacher','Creative Educator','Values Mentor','Children\'s Ministry Teacher','Learning Coordinator','Teacher-Leader','Curriculum Builder','Mentor of Teachers','Education Ministry Leader','Community Educator','Legacy Teacher'],
  },
];

const METRIC_LABELS: Record<string, string> = {
  event_attended: 'verified event attendance',
  report_submitted: 'reports submitted',
  devotion_completed: 'devotions completed',
  reading_completed: 'daily readings completed',
  lesson_completed: 'lessons completed',
  community_post: 'meaningful community posts',
  active_week: 'active weeks',
  active_weeks: 'active weeks',
  cross_feature: 'cross-feature milestones',
};

function asText(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? 'Unknown error');
  }
  return String(error ?? 'Unknown error');
}

function friendlyRequirement(value: unknown, secret: boolean) {
  if (secret) return 'Hidden challenge. Keep using BUKLOD naturally to discover it.';
  if (!value || typeof value !== 'object') return 'Complete the required mastery milestones.';
  const root = value as Record<string, unknown>;
  const groups = ['all', 'any'];
  const parts: string[] = [];
  for (const key of groups) {
    const items = root[key];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const metric = String(row.metric ?? '').trim();
      const count = Number(row.gte ?? row.count ?? 0);
      if (!metric || !Number.isFinite(count) || count <= 0) continue;
      parts.push(`${count} ${METRIC_LABELS[metric] ?? metric.replace(/_/g, ' ')}`);
    }
  }
  if (!parts.length) return 'Complete the required mastery milestones.';
  return parts.join(' + ');
}

function mergeCharacter(payload: StatePayload | null, config: CharacterConfig) {
  const server = payload?.characters?.find((item) => item.character_id === config.id);
  const rank = payload?.circle_rank_order ?? 1;
  return {
    ...config,
    server,
    unlocked: server?.unlocked ?? rank >= config.rank,
    currentLevel: Math.max(1, Math.min(20, server?.current_level ?? 1)),
    active: Boolean(server?.active || payload?.active_special_character_id === config.id),
  };
}

/* BUKLOD_SPECIAL_R40K_ANDROID_PERF_R1 */
const NATIVE_SPECIAL_THUMB: Record<BuklodSpecialCharacterId, any> = {
  ace: require('../../../assets/images/characters/special-series1/ace_medium.webp'),
  ellusur: require('../../../assets/images/characters/special-series1/ellusur_medium.webp'),
  jawo: require('../../../assets/images/characters/special-series1/jawo_medium.webp'),
  mitch: require('../../../assets/images/characters/special-series1/mitch_medium.webp'),
  niel: require('../../../assets/images/characters/special-series1/niel_medium.webp'),
  angel: require('../../../assets/images/characters/special-series1/angel_medium.webp'),
  vhen: require('../../../assets/images/characters/special-series1/vhen_medium.webp'),
  trudice: require('../../../assets/images/characters/special-series1/trudice_medium.webp'),
};
export default function BuklodSpecialCharacterSeries({ userId }: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  /* BUKLOD_SPECIAL_R40_ANDROID_NATIVE_LAYOUT_R1 */
  const nativeLayout = Platform.OS !== 'web';

  const [payload, setPayload] = useState<StatePayload | null>(null);
  const [selectedId, setSelectedId] = useState<BuklodSpecialCharacterId>('ace');
  const [collectibles, setCollectibles] = useState<CollectiblePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [collectibleLoading, setCollectibleLoading] = useState(false);
  const [using, setUsing] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [showAllLevels, setShowAllLevels] = useState(false);
  const [showAllCollectibles, setShowAllCollectibles] = useState(false);
  const [nativeDetailsOpen, setNativeDetailsOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const merged = useMemo(
    () => CHARACTERS.map((config) => mergeCharacter(payload, config)),
    [payload],
  );

  const selected = useMemo(
    () => merged.find((item) => item.id === selectedId) ?? merged[0],
    [merged, selectedId],
  );

  const nextLockedId = useMemo(() => {
    const rank = payload?.circle_rank_order ?? 1;
    return CHARACTERS.find((item) => item.rank > rank)?.id ?? null;
  }, [payload?.circle_rank_order]);

  const loadState = useCallback(async () => {
    if (!userId) {
      setPayload(null);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.rpc('get_my_buklod_special_character_state_v2');
      if (error) throw error;
      const next = data as StatePayload;
      setPayload(next);
      setSelectedId((previous) => {
        if (previous) return previous;
        return next.active_special_character_id ?? 'ace';
      });
    } catch (error) {
      console.warn('BUKLOD special character state failed:', error);
      setMessage(asText(error));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadCollectibles = useCallback(async (characterId: BuklodSpecialCharacterId) => {
    setCollectibleLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_my_buklod_special_collectibles_v2', {
        p_character_id: characterId,
      });
      if (error) throw error;
      setCollectibles(data as CollectiblePayload);
    } catch (error) {
      console.warn('BUKLOD special collectibles failed:', error);
      setMessage(asText(error));
    } finally {
      setCollectibleLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    setShowAllLevels(false);
    setShowAllCollectibles(false);
    if (nativeLayout && !nativeDetailsOpen) {
      setCollectibles(null);
      return;
    }
    void loadCollectibles(selectedId);
  }, [selectedId, loadCollectibles, nativeLayout, nativeDetailsOpen]);

  useEffect(() => {
    if (nativeLayout) {
      setNativeDetailsOpen(false);
    }
  }, [selectedId, nativeLayout]);

  const useCharacter = useCallback(async () => {
    if (!selected.unlocked || selected.active || using) return;
    setUsing(true);
    setMessage(null);
    try {
      const { error } = await supabase.rpc('set_my_buklod_special_character_active_v1', {
        p_character_id: selected.id,
      });
      if (error) throw error;
      setMessage(`${selected.name} is now your active Special Character.`);
      await loadState();
    } catch (error) {
      setMessage(asText(error));
    } finally {
      setUsing(false);
    }
  }, [selected, using, loadState]);

  const trackJourney = useCallback(async () => {
    if (selected.unlocked || tracking) return;
    setTracking(true);
    setMessage(null);
    try {
      const { error } = await supabase.rpc('set_my_buklod_special_character_pursuit_v1', {
        p_character_id: selected.id,
      });
      if (error) throw error;
      setMessage(`${selected.name} journey is now being tracked.`);
    } catch (error) {
      setMessage(asText(error));
    } finally {
      setTracking(false);
    }
  }, [selected, tracking]);

  if (!userId) return null;

  const rank = payload?.circle_rank_order ?? 1;
  const progress = Math.max(0, Math.min(1, rank / selected.rank));
  const levelItems = showAllLevels ? Array.from({ length: 20 }, (_, i) => i + 1) : Array.from({ length: 12 }, (_, i) => i + 1);
  const visibleCollectibles = showAllCollectibles
    ? collectibles?.collectibles ?? []
    : (collectibles?.collectibles ?? []).slice(0, 12);

  return (
    <View style={[styles.shell, nativeLayout && styles.shellNative]}>
      <View style={[styles.topHeader, compact && styles.topHeaderCompact]}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>SC</Text>
        </View>
        <View style={[styles.headerCopy, nativeLayout && compact && styles.headerCopyNativeCompact]}>
          <Text style={styles.heading}>Special Character Journey</Text>
          <Text style={styles.subheading}>
            Harder mastery progression. Every Batch 1 character has a Level 1 preview; rank gates still control unlocking.
          </Text>
        </View>
        {!compact ? (
          <View style={styles.missionNote}>
            <Text style={styles.missionTitle}>More than a character. A mission.</Text>
            <Text style={styles.missionText}>Grow in character. Serve with purpose. Make an impact.</Text>
          </View>
        ) : null}
        {loading ? <ActivityIndicator /> : null}
      </View>

      <ScrollView horizontal nestedScrollEnabled removeClippedSubviews={nativeLayout} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.characterRail}>
        {merged.map((character) => {
          const chosen = character.id === selectedId;
          const isNext = character.id === nextLockedId;
          return (
            <Pressable
              key={character.id}
              accessibilityRole="button"
              accessibilityLabel={`View ${character.name}`}
              onPress={() => setSelectedId(character.id)}
              style={[styles.characterCard, chosen && styles.characterCardSelected]}
            >
              <View style={styles.characterImageFrame}>
                <Image
                  source={nativeLayout ? NATIVE_SPECIAL_THUMB[character.id] : SPECIAL_CHARACTER_HERO[character.id]}
                  style={styles.characterImage}
                  resizeMode="contain"
                />
                {!character.unlocked ? (
                  <View style={styles.lockChip}>
                    <Text style={styles.lockChipText}>LOCKED</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.characterName}>{character.name}</Text>
              <Text style={styles.characterRank}>Rank {character.rank}</Text>
              {character.active ? (
                <Text style={styles.characterStateActive}>ACTIVE</Text>
              ) : isNext ? (
                <Text style={styles.characterStateNext}>NEXT TO UNLOCK</Text>
              ) : !character.unlocked ? (
                <Text style={styles.characterStateMuted}>LOCKED</Text>
              ) : (
                <Text style={styles.characterStateReady}>AVAILABLE</Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.heroPanel, compact && styles.heroPanelCompact, nativeLayout && compact && styles.heroPanelNativeCompact]}>
        <View style={[styles.largeArtFrame, compact && styles.largeArtFrameCompact, nativeLayout && compact && styles.largeArtFrameNativeCompact]}>
          <Image
            source={SPECIAL_CHARACTER_HERO[selected.id]}
            style={[styles.largeArt, nativeLayout && compact && styles.largeArtNativeCompact]}
            resizeMode="contain"
          />
        </View>

        <View style={[styles.heroCopy, nativeLayout && compact && styles.heroCopyNativeCompact]}>
          <View style={styles.titleRow}>
            <Text style={styles.detailTitle}>{selected.name}</Text>
            <View style={styles.specialPill}><Text style={styles.specialPillText}>SPECIAL CHARACTER</Text></View>
          </View>
          <Text style={styles.detailDomain}>{selected.domain}</Text>
          <Text style={styles.quoteText}>"{selected.quote}"</Text>
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

        <View style={[styles.rankPanel, nativeLayout && compact && styles.rankPanelNativeCompact]}>
          <Text style={styles.rankStatus}>{selected.unlocked ? 'Unlocked' : 'Locked'}</Text>
          <Text style={styles.rankSubtitle}>
            {selected.unlocked ? `Current character level ${selected.currentLevel}` : `Unlocks at Circle Rank ${selected.rank}`}
          </Text>

          <View style={styles.rankLine}>
            <Text style={styles.rankLabel}>Your Current Rank</Text>
            <Text style={styles.rankValue}>{rank} / {selected.rank}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>

          <Text style={styles.rankHelp}>
            {selected.unlocked
              ? 'This character is available for your journey.'
              : rank + 1 >= selected.rank
                ? 'You are almost there. Keep earning Circle Points.'
                : 'Keep growing across BUKLOD activities to reach this character.'}
          </Text>

          {selected.unlocked ? (
            <Pressable
              disabled={using || selected.active}
              onPress={useCharacter}
              style={[styles.primaryAction, (using || selected.active) && styles.primaryActionDisabled]}
            >
              <Text style={styles.primaryActionText}>
                {selected.active ? 'ACTIVE CHARACTER' : using ? 'SETTING...' : 'USE CHARACTER'}
              </Text>
            </Pressable>
          ) : (
            <Pressable disabled={tracking} onPress={trackJourney} style={styles.subtleAction}>
              <Text style={styles.subtleActionText}>{tracking ? 'TRACKING...' : 'TRACK THIS JOURNEY'}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {nativeLayout ? (
        <Pressable
          onPress={() => setNativeDetailsOpen((value) => !value)}
          style={styles.nativeDetailsToggle}
        >
          <Text style={styles.nativeDetailsToggleTitle}>
            {nativeDetailsOpen ? 'HIDE JOURNEY DETAILS' : 'OPEN JOURNEY DETAILS'}
          </Text>
          <Text style={styles.nativeDetailsToggleText}>
            {nativeDetailsOpen
              ? 'Close detailed levels and collectibles for faster browsing.'
              : 'Loads Level 1-20 and collectibles only when you open them.'}
          </Text>
        </Pressable>
      ) : null}

      {(!nativeLayout || nativeDetailsOpen) ? (
        <>
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionTitle}>LEVEL 1 - 20 JOURNEY</Text>
            <Text style={styles.sectionCaption}>
              Level 1 is always previewable. Future level artwork stays hidden until earned.
            </Text>
          </View>
          <Pressable onPress={() => setShowAllLevels((value) => !value)} style={styles.textAction}>
            <Text style={styles.textActionText}>{showAllLevels ? 'SHOW LESS' : 'VIEW ALL LEVELS'}</Text>
          </Pressable>
        </View>

        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelRail}>
          {levelItems.map((level) => {
            const viewable = level === 1 || (selected.unlocked && level <= selected.currentLevel);
            const isCurrent = selected.unlocked && level === selected.currentLevel;
            const item = collectibles?.collectibles.find((row) => row.level_no === level);
            return (
              <View key={`${selected.id}-${level}`} style={[styles.levelCard, isCurrent && styles.levelCardCurrent]}>
                <View style={styles.levelImageFrame}>
                  {viewable ? (
                    <Image source={getBuklodSpecialLevelAsset(selected.id, level)} style={styles.levelImage} resizeMode="contain" />
                  ) : (
                    <View style={styles.lockedPreview}>
                      <View style={styles.lockCircle}><Text style={styles.lockCircleText}>L</Text></View>
                    </View>
                  )}
                  <View style={styles.levelNumberBadge}><Text style={styles.levelNumberText}>{level}</Text></View>
                </View>
                <Text style={styles.levelTitle} numberOfLines={2}>{selected.stages[level - 1] ?? `Level ${level}`}</Text>
                <Text style={viewable ? styles.levelOpen : styles.levelLocked}>{viewable ? (isCurrent ? 'CURRENT' : 'PREVIEW') : 'LOCKED'}</Text>
                {item ? <Text style={styles.levelCollectible} numberOfLines={1}>{item.collectible_name}</Text> : null}
              </View>
            );
          })}
        </ScrollView>
      </View>

      {nativeLayout ? (
        <Pressable
          onPress={() => setNativeDetailsOpen((value) => !value)}
          style={styles.nativeDetailsToggle}
        >
          <Text style={styles.nativeDetailsToggleTitle}>
            {nativeDetailsOpen ? 'HIDE JOURNEY DETAILS' : 'OPEN JOURNEY DETAILS'}
          </Text>
          <Text style={styles.nativeDetailsToggleText}>
            {nativeDetailsOpen
              ? 'Close detailed levels and collectibles for faster browsing.'
              : 'Loads Level 1-20 and collectibles only when you open them.'}
          </Text>
        </Pressable>
      ) : null}

      {(!nativeLayout || nativeDetailsOpen) ? (
        <>
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderCopy}>
            <Text style={styles.sectionTitle}>COLLECTIBLES & BADGES</Text>
            <Text style={styles.sectionCaption}>
              Harder cross-feature mastery rewards, awarded automatically by the server.
            </Text>
          </View>
          <Pressable onPress={() => setShowAllCollectibles((value) => !value)} style={styles.textAction}>
            <Text style={styles.textActionText}>{showAllCollectibles ? 'SHOW LESS' : 'VIEW ALL COLLECTIBLES'}</Text>
          </Pressable>
        </View>

        {collectibleLoading ? (
          <ActivityIndicator style={styles.collectibleLoader} />
        ) : (
          <View style={styles.collectibleGrid}>
            {visibleCollectibles.map((item) => (
              <View key={item.collectible_id} style={[styles.collectibleCard, compact && styles.collectibleCardCompact]}>
                <View style={[styles.collectibleIcon, item.secret && !item.earned && styles.collectibleIconSecret]}>
                  <Text style={styles.collectibleIconText}>{item.secret && !item.earned ? '?' : item.level_no}</Text>
                </View>
                <Text style={styles.collectibleName} numberOfLines={2}>{item.collectible_name}</Text>
                <Text style={styles.badgeName} numberOfLines={1}>{item.badge_name}</Text>
                <Text style={styles.requirementText} numberOfLines={3}>
                  {friendlyRequirement(item.requirement, item.secret && !item.earned)}
                </Text>
                <Text style={item.earned ? styles.collectibleEarned : item.secret ? styles.collectibleSecret : styles.collectibleTier}>
                  {item.earned ? (item.earned_early ? 'COLLECTED EARLY' : 'COLLECTED') : item.secret ? 'SECRET' : `TIER ${item.difficulty_tier}`}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
        </>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginTop: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D9E7DE',
    backgroundColor: '#F7FBF8',
    overflow: 'hidden',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
  },
  topHeaderCompact: { alignItems: 'flex-start', flexWrap: 'wrap' },
  brandMark: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#178A43',
    alignItems: 'center', justifyContent: 'center',
  },
  brandMarkText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  headerCopy: { flex: 1, minWidth: 220 },
  heading: { fontSize: 25, lineHeight: 30, fontWeight: '900', color: '#0D2A1C' },
  subheading: { marginTop: 2, fontSize: 11.5, lineHeight: 17, color: '#315F45' },
  missionNote: {
    maxWidth: 360, minWidth: 260, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 18, backgroundColor: '#F3F7EF', borderWidth: 1, borderColor: '#E1E8DA',
  },
  missionTitle: { fontSize: 12, fontWeight: '900', color: '#253528' },
  missionText: { marginTop: 2, fontSize: 10.5, color: '#5E6C62' },

  characterRail: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  characterCard: {
    width: 150, borderRadius: 17, padding: 7, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#DDE7E0',
  },
  characterCardSelected: {
    borderColor: '#1EA653', borderWidth: 2,
    shadowColor: '#1EA653', shadowOpacity: 0.12, shadowRadius: 8, elevation: 2,
  },
  characterImageFrame: {
    height: 138, borderRadius: 13, overflow: 'hidden',
    backgroundColor: '#F1F5F2', alignItems: 'center', justifyContent: 'center',
  },
  characterImage: { width: '100%', height: '100%' },
  lockChip: {
    position: 'absolute', right: 6, top: 6, borderRadius: 999,
    paddingHorizontal: 7, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.92)',
  },
  lockChipText: { fontSize: 8, fontWeight: '900', color: '#667069' },
  characterName: { marginTop: 7, textAlign: 'center', fontSize: 14, fontWeight: '900', color: '#15271D' },
  characterRank: { marginTop: 1, textAlign: 'center', fontSize: 10, color: '#506257' },
  characterStateActive: { marginTop: 5, textAlign: 'center', fontSize: 8.5, fontWeight: '900', color: '#15783A' },
  characterStateNext: { marginTop: 5, textAlign: 'center', fontSize: 8.5, fontWeight: '900', color: '#178A43' },
  characterStateMuted: { marginTop: 5, textAlign: 'center', fontSize: 8.5, fontWeight: '900', color: '#879089' },
  characterStateReady: { marginTop: 5, textAlign: 'center', fontSize: 8.5, fontWeight: '900', color: '#34754A' },

  heroPanel: {
    marginHorizontal: 16, marginBottom: 14, padding: 10, borderRadius: 22,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE7E0',
    flexDirection: 'row', gap: 18, alignItems: 'stretch',
  },
  heroPanelCompact: { flexDirection: 'column' },
  largeArtFrame: {
    width: 360, minHeight: 260, borderRadius: 18, overflow: 'hidden',
    backgroundColor: '#EDF5F0', alignItems: 'center', justifyContent: 'center',
  },
  largeArtFrameCompact: { width: '100%', minHeight: 280 },
  largeArt: { width: '100%', height: '100%', minHeight: 260 },
  heroCopy: { flex: 1.2, paddingVertical: 12, minWidth: 240 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  detailTitle: { fontSize: 34, lineHeight: 40, fontWeight: '900', color: '#0E2A1C' },
  specialPill: { backgroundColor: '#F6EBD1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  specialPillText: { fontSize: 9, fontWeight: '900', color: '#8A6517' },
  detailDomain: { marginTop: 5, fontSize: 16, fontWeight: '900', color: '#178A43' },
  quoteText: { marginTop: 8, fontSize: 13, lineHeight: 19, fontStyle: 'italic', color: '#4C6658' },
  description: { marginTop: 8, fontSize: 12, lineHeight: 19, color: '#43564B' },
  traitWrap: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  traitPill: {
    minWidth: 120, flexDirection: 'row', alignItems: 'center', gap: 7,
    borderWidth: 1, borderColor: '#E3E9E5', borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFFFFF',
  },
  traitDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#1C9A4C' },
  traitDotAlt: { backgroundColor: '#2687D8' },
  traitDotGold: { backgroundColor: '#E3A516' },
  traitDotPurple: { backgroundColor: '#8D48CC' },
  traitText: { flex: 1, fontSize: 9.5, fontWeight: '800', color: '#2F3D34' },

  rankPanel: {
    width: 300, minWidth: 240, padding: 16, borderRadius: 18,
    backgroundColor: '#EDF8F1', justifyContent: 'center',
  },
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
  subtleAction: { marginTop: 12, alignSelf: 'flex-start', paddingVertical: 5 },
  subtleActionText: { fontSize: 9.5, fontWeight: '900', color: '#167A3C' },

  sectionCard: {
    marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 20,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE7E0',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionHeaderCopy: { flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#163425' },
  sectionCaption: { marginTop: 2, fontSize: 10.5, lineHeight: 15, color: '#617068' },
  textAction: { paddingHorizontal: 9, paddingVertical: 6 },
  textActionText: { fontSize: 9, fontWeight: '900', color: '#176E39' },

  levelRail: { paddingTop: 10, gap: 8 },
  levelCard: {
    width: 124, minHeight: 176, borderRadius: 14, padding: 6,
    borderWidth: 1, borderColor: '#E0E7E2', backgroundColor: '#FBFDFC',
  },
  levelCardCurrent: { borderColor: '#1DA04C', borderWidth: 2 },
  levelImageFrame: {
    height: 92, borderRadius: 11, overflow: 'hidden',
    backgroundColor: '#ECF1EE', alignItems: 'center', justifyContent: 'center',
  },
  levelImage: { width: '100%', height: '100%' },
  lockedPreview: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F3F1' },
  lockCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#D8DEDA', alignItems: 'center', justifyContent: 'center' },
  lockCircleText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  levelNumberBadge: {
    position: 'absolute', bottom: 5, left: 5, width: 20, height: 20,
    borderRadius: 10, backgroundColor: '#178E45', alignItems: 'center', justifyContent: 'center',
  },
  levelNumberText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  levelTitle: { marginTop: 6, minHeight: 30, fontSize: 10.5, lineHeight: 14, fontWeight: '800', color: '#24352B' },
  levelOpen: { marginTop: 3, fontSize: 8.5, fontWeight: '900', color: '#16813E' },
  levelLocked: { marginTop: 3, fontSize: 8.5, fontWeight: '900', color: '#879088' },
  levelCollectible: { marginTop: 5, fontSize: 8.5, color: '#66736B' },

  collectibleLoader: { marginVertical: 20 },
  collectibleGrid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  collectibleCard: {
    width: 150, minHeight: 168, borderRadius: 14, padding: 10,
    borderWidth: 1, borderColor: '#E1E8E3', backgroundColor: '#FBFDFC',
  },
  collectibleCardCompact: { width: '48%' },
  collectibleIcon: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#E0F3E6',
    alignItems: 'center', justifyContent: 'center',
  },
  collectibleIconSecret: { backgroundColor: '#E6E8E7' },
  collectibleIconText: { fontSize: 12, fontWeight: '900', color: '#188442' },
  collectibleName: { marginTop: 8, fontSize: 11, fontWeight: '900', color: '#22332A' },
  badgeName: { marginTop: 2, fontSize: 9, color: '#667269' },
  requirementText: { marginTop: 7, minHeight: 38, fontSize: 8.5, lineHeight: 12, color: '#69746D' },
  collectibleEarned: { marginTop: 7, fontSize: 8.5, fontWeight: '900', color: '#12833C' },
  collectibleSecret: { marginTop: 7, fontSize: 8.5, fontWeight: '900', color: '#986F17' },
  collectibleTier: { marginTop: 7, fontSize: 8.5, fontWeight: '900', color: '#58655C' },

  message: {
    marginHorizontal: 16, marginBottom: 14, padding: 10, borderRadius: 12,
    backgroundColor: '#F5F7F5', fontSize: 10.5, lineHeight: 15, color: '#9B2C2C',
  },

  /* BUKLOD_SPECIAL_R40_ANDROID_NATIVE_LAYOUT_R1 */
  nativeDetailsToggle: {
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CFE2D5',
    backgroundColor: '#F4FAF6',
  },
  nativeDetailsToggleTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    color: '#17683A',
  },
  nativeDetailsToggleText: {
    marginTop: 3,
    fontSize: 10.5,
    lineHeight: 15,
    color: '#557060',
  },
  shellNative: {
    overflow: 'visible',
  },
  headerCopyNativeCompact: {
    minWidth: 0,
    width: '100%',
  },
  heroPanelNativeCompact: {
    alignItems: 'stretch',
  },
  largeArtFrameNativeCompact: {
    width: '100%',
    height: 300,
    minHeight: 300,
  },
  largeArtNativeCompact: {
    width: '100%',
    height: 300,
    minHeight: 0,
  },
  heroCopyNativeCompact: {
    minWidth: 0,
    width: '100%',
  },
  rankPanelNativeCompact: {
    width: '100%',
    minWidth: 0,
  },
});
