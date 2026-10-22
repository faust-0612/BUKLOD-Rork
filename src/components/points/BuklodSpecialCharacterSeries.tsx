/* BUKLOD_SPECIAL_BATCH1_R40_PREMIUM_UI */
/* Approved Sep. 5 R40 presentation; current V2/server unlock and activation remain authoritative. */
import React, { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageStyle,
  type StyleProp,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import {
  SPECIAL_CHARACTER_ORDER,
  SPECIAL_REQUIRED_RANK_ORDER,
  setBuklodCharacterDisplayOverride,
  setMyBuklodCharacterActiveV2,
  type BuklodCharacterSelectionV2State,
  type BuklodSpecialCharacterId,
} from '@/lib/buklodCharacterSelectionV2';
import {
  SPECIAL_CHARACTER_HERO,
  getBuklodSpecialLevelAsset,
} from '@/lib/buklodSpecialCharacterAssets';
import {
  BUKLOD_CHARACTER_BADGES,
  BUKLOD_CHARACTER_STAGES,
  BUKLOD_COLLECTIBLE_SLOT_LABELS,
  buklodCollectibleNames,
  buklodStageMasteryBadge,
} from '@/lib/buklodCharacterWorldCatalog';

type Props = {
  userId?: string | null;
  state: BuklodCharacterSelectionV2State;
  onStateRefresh: () => Promise<void> | void;
};

type CollectibleItem = {
  level_no: number;
  collectible_id: string;
  collectible_name: string;
  badge_name: string;
  difficulty_tier: number;
  secret: boolean;
  earned: boolean;
  earned_at?: string | null;
  earned_early?: boolean;
  level_viewable?: boolean;
  requirement?: unknown;
};

type CollectiblePayload = {
  character_id?: BuklodSpecialCharacterId;
  unlocked?: boolean;
  current_level?: number;
  level1_always_viewable?: boolean;
  collectibles?: CollectibleItem[];
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

const SPECIAL_ORDER: BuklodSpecialCharacterId[] = [...SPECIAL_CHARACTER_ORDER];

const PROFILES: Record<BuklodSpecialCharacterId, Profile> = {
  ace: {
    id: 'ace', name: 'ACE', domain: 'HEALTH STRATEGY SERVICE',
    quote: 'Small steps of care create a stronger community.',
    description: 'Health, discipline, practical care, and wise service shaped into one purposeful journey.',
    traits: ['Health Advocacy', 'Community Service', 'Strategy & Planning', 'Practical Discipleship'],
    stages: BUKLOD_CHARACTER_STAGES.ace,
  },
  ellusur: {
    id: 'ellusur', name: 'ELESUR', domain: 'FAITH TEACHING SERVICE',
    quote: 'Faith grows best when it is planted, taught, and lived.',
    description: 'A steady path of learning, teaching, agriculture, ministry, and faithful community service.',
    traits: ['Faith Formation', 'Teaching', 'Agriculture', 'Pastoral Service'],
    stages: BUKLOD_CHARACTER_STAGES.ellusur,
  },
  jawo: {
    id: 'jawo', name: 'JAWO', domain: 'NATURE MUSIC COMMUNITY',
    quote: 'Harmony is built when gifts are shared with purpose.',
    description: 'Music, nature, worship, creativity, and community life grow together through service.',
    traits: ['Music', 'Nature', 'Worship', 'Community'],
    stages: BUKLOD_CHARACTER_STAGES.jawo,
  },
  mitch: {
    id: 'mitch', name: 'MITCH', domain: 'ARTS CULTURE TEACHING',
    quote: 'Creativity becomes powerful when it helps others learn.',
    description: 'A creative educator journey joining visual art, culture, teaching, mentorship, and mission.',
    traits: ['Creative Arts', 'Teaching', 'Culture', 'Mentorship'],
    stages: BUKLOD_CHARACTER_STAGES.mitch,
  },
  niel: {
    id: 'niel', name: 'NIEL', domain: 'WORSHIP DISCIPLESHIP MISSION',
    quote: 'Lead worship. Make disciples. Carry the mission forward.',
    description: 'A worship and discipleship path that matures into mentoring, mission, and church planting.',
    traits: ['Worship', 'Discipleship', 'Mentoring', 'Mission'],
    stages: BUKLOD_CHARACTER_STAGES.niel,
  },
  angel: {
    id: 'angel', name: 'ANGEL', domain: 'STEWARDSHIP ACCOUNTABILITY',
    quote: 'Steward well today so more can be served tomorrow.',
    description: 'A stewardship journey built around responsibility, transparent records, planning, and resource care.',
    traits: ['Stewardship', 'Finance', 'Accountability', 'Resource Planning'],
    stages: BUKLOD_CHARACTER_STAGES.angel,
  },
  vhen: {
    id: 'vhen', name: 'VHEN', domain: 'AGRICULTURE BUSINESS FAMILY',
    quote: 'Grow what matters. Build what lasts. Provide with purpose.',
    description: 'Agriculture, productivity, enterprise, family provision, and stewardship form this builder journey.',
    traits: ['Agriculture', 'Enterprise', 'Family', 'Stewardship'],
    stages: BUKLOD_CHARACTER_STAGES.vhen,
  },
  trudice: {
    id: 'trudice', name: 'TRUDICE', domain: 'CHILDREN TEACHING DISCIPLESHIP',
    quote: 'Teach with care, and every lesson can shape a life.',
    description: 'A children and education journey centered on teaching, values, curriculum, and mentoring teachers.',
    traits: ['Children', 'Teaching', 'Values', 'Mentoring'],
    stages: BUKLOD_CHARACTER_STAGES.trudice,
  },
};

/** Unlocked specials + the next locked preview only. Farther specials stay concealed. */
function visibleSpecialRail(
  rankOrder: number,
  unlockedIds: readonly string[],
): BuklodSpecialCharacterId[] {
  const unlocked = SPECIAL_ORDER.filter(
    (id) => unlockedIds.includes(id) || rankOrder >= SPECIAL_REQUIRED_RANK_ORDER[id],
  );
  const nextLocked = SPECIAL_ORDER.find(
    (id) => !unlocked.includes(id),
  );
  return nextLocked ? [...unlocked, nextLocked] : unlocked;
}

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

function friendlyRequirement(value: unknown, secret: boolean) {
  if (secret) return 'Hidden challenge. Keep using BUKLOD naturally to discover it.';
  if (!value || typeof value !== 'object') return 'Complete the required mastery milestones.';
  const root = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ['all', 'any']) {
    const rows = root[key];
    if (!Array.isArray(rows)) continue;
    for (const item of rows) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const metric = String(row.metric ?? '').trim();
      const count = Number(row.gte ?? row.count ?? 0);
      if (!metric || !Number.isFinite(count) || count <= 0) continue;
      parts.push(`${count} ${METRIC_LABELS[metric] ?? metric.replace(/_/g, ' ')}`);
    }
  }
  return parts.length ? parts.join(' + ') : 'Complete the required mastery milestones.';
}

function CharacterPhoto({ source, style }: { source: number; style: StyleProp<ImageStyle> }) {
  return (
    <ExpoImage
      source={source}
      contentFit="contain"
      transition={0}
      cachePolicy="memory-disk"
      style={style}
    />
  );
}

export default function BuklodSpecialCharacterSeries({ userId, state, onStateRefresh }: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 760;
  const nativeLayout = Platform.OS !== 'web';
  const visible = state.visible_special_character_ids;
  const activeSpecial = SPECIAL_ORDER.includes(state.active_character_id as BuklodSpecialCharacterId)
    ? (state.active_character_id as BuklodSpecialCharacterId)
    : null;

  const isUnlocked = (id: BuklodSpecialCharacterId) =>
    visible.includes(id) || state.circle_rank_order >= SPECIAL_REQUIRED_RANK_ORDER[id];

  const [selectedId, setSelectedId] = useState<BuklodSpecialCharacterId>(
    activeSpecial ?? 'ace',
  );
  const effectiveSelectedId = SPECIAL_ORDER.includes(selectedId) ? selectedId : 'ace';
  const [collectibles, setCollectibles] = useState<CollectiblePayload | null>(null);
  const [collectibleLoading, setCollectibleLoading] = useState(false);
  const [using, setUsing] = useState(false);
  const [showAllLevels, setShowAllLevels] = useState(false);
  const [showAllCollectibles, setShowAllCollectibles] = useState(false);
  const [nativeDetailsOpen, setNativeDetailsOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewLevel, setPreviewLevel] = useState(1);

  useEffect(() => {
    const urls = SPECIAL_ORDER
      .map((id) => Image.resolveAssetSource(SPECIAL_CHARACTER_HERO[id])?.uri)
      .filter((uri): uri is string => typeof uri === 'string' && uri.length > 0);
    if (urls.length > 0) void ExpoImage.prefetch(urls, 'memory-disk');
  }, []);

  useEffect(() => {
    if (activeSpecial) setSelectedId(activeSpecial);
  }, [activeSpecial]);

  useEffect(() => {
    const rail = visibleSpecialRail(state.circle_rank_order, visible);
    if (!rail.includes(selectedId)) {
      setSelectedId(rail[0] ?? 'ace');
    }
  }, [selectedId, state.circle_rank_order, visible]);

  useEffect(() => {
    setShowAllLevels(false);
    setShowAllCollectibles(false);
    if (nativeLayout) setNativeDetailsOpen(false);
    const nextLevel =
      state.active_character_id === effectiveSelectedId
        ? Math.max(1, Math.min(20, state.character_level))
        : 1;
    setPreviewLevel(nextLevel);
  }, [nativeLayout, effectiveSelectedId, state.active_character_id, state.character_level]);

  useEffect(() => {
    setBuklodCharacterDisplayOverride({
      character_id: effectiveSelectedId,
      character_level: previewLevel,
    });
  }, [effectiveSelectedId, previewLevel]);

  useEffect(() => {
    const unlockedNow = visible.includes(effectiveSelectedId)
      || state.circle_rank_order >= SPECIAL_REQUIRED_RANK_ORDER[effectiveSelectedId];
    if (!userId || !effectiveSelectedId || !unlockedNow) {
      setCollectibles(null);
      setCollectibleLoading(false);
      return;
    }
    let mounted = true;
    setCollectibles(null);
    setCollectibleLoading(true);
    setMessage(null);
    void (async () => {
      try {
        const { data, error } = await (supabase as any).rpc('get_my_buklod_special_collectibles_v2', {
          p_character_id: effectiveSelectedId,
        });
        if (!mounted) return;
        if (error) throw error;
        setCollectibles((data ?? null) as CollectiblePayload | null);
      } catch (error: unknown) {
        if (mounted) {
          setCollectibles(null);
          setMessage(error instanceof Error ? error.message : 'Could not load Special Character collectibles.');
        }
      } finally {
        if (mounted) setCollectibleLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [effectiveSelectedId, state.circle_rank_order, state.visible_special_character_ids, userId, visible]);

  const selected = PROFILES[effectiveSelectedId];
  const selectedUnlocked = isUnlocked(selected.id);
  const active = state.active_character_id === selected.id;
  const currentLevel = active ? Math.max(1, Math.min(20, state.character_level)) : 1;
  const requiredRank = SPECIAL_REQUIRED_RANK_ORDER[selected.id];
  const progress = Math.max(0, Math.min(1, state.circle_rank_order / Math.max(1, requiredRank)));
  const badgeLevel = selectedUnlocked
    ? Math.max(1, Math.min(20, Number(collectibles?.current_level) || 1))
    : 1;
  const railIds = visibleSpecialRail(state.circle_rank_order, visible);
  const levelItems = showAllLevels
    ? Array.from({ length: 20 }, (_, index) => index + 1)
    : Array.from({ length: 12 }, (_, index) => index + 1);
  const catalogLevelItems = buklodCollectibleNames(effectiveSelectedId, previewLevel);
  const stageBadgeName = buklodStageMasteryBadge(effectiveSelectedId, previewLevel);
  const signatureBadge = BUKLOD_CHARACTER_BADGES[effectiveSelectedId].signature;
  const visibleCollectibles = showAllCollectibles
    ? collectibles?.collectibles ?? []
    : (collectibles?.collectibles ?? []).slice(0, 12);
  const earnedBadges = (collectibles?.collectibles ?? []).filter((item) => item.earned);

  const useCharacter = async () => {
    if (!userId || active || using || !selectedUnlocked) {
      if (!selectedUnlocked) {
        setMessage(`This Special Character opens at Circle Rank ${requiredRank}.`);
      }
      return;
    }
    setUsing(true);
    setMessage(null);
    try {
      const next = await setMyBuklodCharacterActiveV2(userId, selected.id);
      setPreviewLevel(Math.max(1, Math.min(20, next.character_level)));
      await onStateRefresh();
      setBuklodCharacterDisplayOverride({
        character_id: next.active_character_id,
        character_level: next.character_level,
      });
      setMessage(`${selected.name} is now Showing Now at Level ${next.character_level}.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Could not activate Special Character.');
    } finally {
      setUsing(false);
    }
  };

  return (
    <View style={[styles.shell, nativeLayout && styles.shellNative]}>
      <View style={[styles.topHeader, compact && styles.topHeaderCompact]}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>SC</Text></View>
        <View style={[styles.headerCopy, compact && styles.headerCopyCompact]}>
          <Text style={styles.heading}>EIGHT SPECIAL CHARACTERS</Text>
          <Text style={styles.subheading}>
            Unlocked Specials plus the next locked preview. Use puts one on your profile at Level 1. Circle Rank stays. Items and badges are character-specific.
          </Text>
        </View>
        {!compact ? (
          <View style={styles.missionNote}>
            <Text style={styles.missionTitle}>More than a character. A mission.</Text>
            <Text style={styles.missionText}>Grow in character. Serve with purpose. Make an impact.</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.characterRail}>
        {railIds.map((id, index) => {
          const character = PROFILES[id];
          const chosen = id === selected.id;
          const activeNow = state.active_character_id === id;
          const unlocked = isUnlocked(id);
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={unlocked ? `View ${character.name}` : `Next locked preview`}
              onPress={() => setSelectedId(id)}
              style={[styles.characterCard, chosen && styles.characterCardSelected, !unlocked && styles.characterCardLocked]}
            >
              <View style={styles.characterImageFrame}>
                {unlocked ? (
                  <CharacterPhoto source={SPECIAL_CHARACTER_HERO[id] as number} style={styles.characterImage} />
                ) : (
                  <View style={styles.characterImageHidden}>
                    <MaterialCommunityIcons name="lock" size={28} color="#8B95A8" />
                  </View>
                )}
              </View>
              <View style={styles.characterCopy}>
                <Text style={styles.characterName}>
                  {unlocked ? `${index + 1}. ${character.name}` : `${index + 1}. NEXT SPECIAL`}
                </Text>
                <Text style={styles.characterRank} numberOfLines={1}>
                  {unlocked ? character.domain : `Opens at Circle Rank ${SPECIAL_REQUIRED_RANK_ORDER[id]}`}
                </Text>
                <Text style={activeNow ? styles.characterStateActive : unlocked ? styles.characterStateReady : styles.characterStateMuted}>
                  {activeNow ? 'ACTIVE' : unlocked ? `RANK ${SPECIAL_REQUIRED_RANK_ORDER[id]}` : 'LOCKED'}
                </Text>
              </View>
              {!unlocked ? (
                <MaterialCommunityIcons name="lock" size={16} color="#8B95A8" />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.heroPanel, compact && styles.heroPanelCompact]}>
        {compact ? (
          <View style={styles.largeArtFrameCompact}>
            {selectedUnlocked ? (
              <CharacterPhoto
                key={`${selected.id}-${previewLevel}-compact`}
                source={getBuklodSpecialLevelAsset(selected.id, previewLevel) as number}
                style={styles.heroPhoto}
              />
            ) : (
              <View style={styles.characterImageHidden}>
                <MaterialCommunityIcons name="lock" size={36} color="#8B95A8" />
              </View>
            )}
            {selectedUnlocked && earnedBadges.length ? (
              <View style={styles.badgeStack}>
                {earnedBadges.slice(0, 5).map((badge) => (
                  <View key={badge.collectible_id} style={styles.badgePin} accessibilityLabel={badge.badge_name || badge.collectible_name}>
                    <MaterialCommunityIcons name="medal" size={14} color="#E8C56B" />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={[styles.heroCopy, compact && styles.heroCopyCompact]}>
          <View style={styles.titleRow}>
            <Text style={styles.detailTitle}>{selectedUnlocked ? selected.name : 'NEXT SPECIAL'}</Text>
            <View style={styles.specialPill}><Text style={styles.specialPillText}>SPECIAL CHARACTER</Text></View>
          </View>
          <Text style={styles.detailDomain}>
            {selectedUnlocked ? selected.domain : `Opens at Circle Rank ${requiredRank}`}
          </Text>
          <Text style={styles.quoteText}>
            {selectedUnlocked ? `"${selected.quote}"` : 'Keep growing your Circle Rank to reveal the next Special Character.'}
          </Text>
          <Text style={styles.description}>
            {selectedUnlocked
              ? selected.description
              : 'True artwork and identity stay hidden until this Special unlocks.'}
          </Text>
          {selectedUnlocked ? (
            <View style={styles.traitWrap}>
              {selected.traits.map((trait, index) => (
                <View key={trait} style={styles.traitPill}>
                  <View style={[styles.traitDot, index === 1 && styles.traitDotAlt, index === 2 && styles.traitDotGold, index === 3 && styles.traitDotPurple]} />
                  <Text style={styles.traitText}>{trait}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {compact ? null : (
          <View style={styles.largeArtFrame}>
            {selectedUnlocked ? (
              <CharacterPhoto
                key={`${selected.id}-${previewLevel}-wide`}
                source={getBuklodSpecialLevelAsset(selected.id, previewLevel) as number}
                style={styles.heroPhoto}
              />
            ) : (
              <View style={styles.characterImageHidden}>
                <MaterialCommunityIcons name="lock" size={36} color="#8B95A8" />
              </View>
            )}
            {selectedUnlocked && earnedBadges.length ? (
              <View style={styles.badgeStack}>
                {earnedBadges.slice(0, 5).map((badge) => (
                  <View key={badge.collectible_id} style={styles.badgePin} accessibilityLabel={badge.badge_name || badge.collectible_name}>
                    <MaterialCommunityIcons name="medal" size={14} color="#E8C56B" />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}
      </View>

      <View style={[styles.rankPanel, nativeLayout && compact && styles.rankPanelNativeCompact]}>
          <Text style={styles.rankStatus}>{active ? `Level ${currentLevel}` : selectedUnlocked ? 'Unlocked' : 'Locked'}</Text>
          <Text style={styles.rankSubtitle}>
            {active
              ? `Showing on your profile. ${selected.stages[currentLevel - 1]}`
              : selectedUnlocked
                ? `Not on your profile yet. Use this character to show ${selected.name}. They start at Level 1.`
                : `Opens at Circle Rank ${requiredRank}. Artwork stays hidden until unlocked.`}
          </Text>
          <View style={styles.rankLine}>
            <Text style={styles.rankLabel}>Your Current Rank</Text>
            <Text style={styles.rankValue}>{state.circle_rank_order} / {requiredRank}</Text>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
          <Text style={styles.rankHelp}>
            {selectedUnlocked
              ? earnedBadges.length
                ? `${earnedBadges.length} earned ${earnedBadges.length === 1 ? 'badge is' : 'badges are'} beside ${selected.name}. Badges are added automatically.`
                : `No earned badge beside ${selected.name} yet. Badges are added automatically when you finish their tasks.`
              : `Badges open at Circle Rank ${requiredRank}.`}
          </Text>
          <Pressable
            disabled={using || active || !selectedUnlocked}
            onPress={() => void useCharacter()}
            style={[styles.primaryAction, (using || active || !selectedUnlocked) && styles.primaryActionDisabled]}
          >
            <Text style={styles.primaryActionText}>
              {active ? 'SHOWING ON YOUR PROFILE' : !selectedUnlocked ? `OPENS AT RANK ${requiredRank}` : using ? 'SETTING...' : 'USE THIS CHARACTER'}
            </Text>
          </Pressable>
        </View>

      {nativeLayout ? (
        <Pressable onPress={() => setNativeDetailsOpen((value) => !value)} style={styles.nativeDetailsToggle}>
          <Text style={styles.nativeDetailsToggleTitle}>{nativeDetailsOpen ? 'HIDE JOURNEY DETAILS' : 'OPEN JOURNEY DETAILS'}</Text>
          <Text style={styles.nativeDetailsToggleText}>
            {nativeDetailsOpen ? 'Hide the level list and the full badge list.' : 'See every level and the full badge list. Earned badges already stay beside this character.'}
          </Text>
        </Pressable>
      ) : null}

      {(!nativeLayout || nativeDetailsOpen) ? (
        <>
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderCopy}>
                <Text style={styles.sectionTitle}>LEVEL 1 - 20 JOURNEY</Text>
                <Text style={styles.sectionCaption}>Level 1 is always previewable after the Special Character is unlocked. Future level artwork stays hidden until earned.</Text>
              </View>
              <Pressable onPress={() => setShowAllLevels((value) => !value)} style={styles.textAction}>
                <Text style={styles.textActionText}>{showAllLevels ? 'SHOW LESS' : 'VIEW ALL LEVELS'}</Text>
              </Pressable>
            </View>

            <View style={styles.levelRail}>
              {levelItems.map((level) => {
                const badge = collectibles?.collectibles?.find((row) => row.level_no === level);
                const viewable = selectedUnlocked
                  ? (typeof badge?.level_viewable === 'boolean' ? badge.level_viewable : level <= badgeLevel)
                  : level === 1;
                const isCurrent = selectedUnlocked && level === badgeLevel;
                return (
                  <Pressable
                    key={`${selected.id}-${level}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Preview ${selected.name} level ${level}`}
                    onPress={() => setPreviewLevel(level)}
                    style={styles.levelCard}
                  >
                    <View style={[styles.levelCardInner, (isCurrent || previewLevel === level) && styles.levelCardCurrent]}>
                      <View style={styles.levelImageFrame}>
                        {viewable || previewLevel === level ? (
                          <CharacterPhoto
                            source={getBuklodSpecialLevelAsset(selected.id, level) as number}
                            style={styles.levelImage}
                          />
                        ) : (
                          <View style={styles.lockedPreview}>
                            <View style={styles.lockCircle}><Text style={styles.lockCircleText}>L</Text></View>
                          </View>
                        )}
                        <View style={styles.levelNumberBadge}><Text style={styles.levelNumberText}>{level}</Text></View>
                      </View>
                      <Text style={styles.levelTitle} numberOfLines={2}>{selected.stages[level - 1] ?? `Level ${level}`}</Text>
                      <Text style={viewable ? styles.levelOpen : styles.levelLocked}>
                        {previewLevel === level ? 'SHOWING' : viewable ? (isCurrent ? 'CURRENT' : 'PREVIEW') : 'LOCKED'}
                      </Text>
                      <Text style={styles.levelCollectible} numberOfLines={1}>
                        {buklodCollectibleNames(selected.id, level)[0]}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderCopy}>
                <Text style={styles.sectionTitle}>LEVEL {previewLevel} ITEMS</Text>
                <Text style={styles.sectionCaption}>
                  Five real story objects for {selected.name} · {selected.stages[previewLevel - 1]}. Collectibles are not badges.
                </Text>
              </View>
            </View>
            <View style={styles.collectibleGrid}>
              {catalogLevelItems.map((itemName, index) => {
                const owned = selectedUnlocked && previewLevel <= currentLevel && active;
                return (
                  <View key={`${selected.id}-${previewLevel}-${index + 1}`} style={styles.collectibleCard}>
                    <View style={styles.collectibleCardInner}>
                      <View style={[styles.collectibleIcon, !owned && styles.collectibleIconSecret]}>
                        <MaterialCommunityIcons
                          name={owned ? 'package-variant-closed' : 'lock-outline'}
                          size={18}
                          color={owned ? '#16813E' : '#627069'}
                        />
                      </View>
                      <Text style={styles.collectibleName} numberOfLines={2}>{itemName}</Text>
                      <Text style={styles.badgeName} numberOfLines={1}>{BUKLOD_COLLECTIBLE_SLOT_LABELS[index]}</Text>
                      <Text style={owned ? styles.collectibleEarned : styles.collectibleTier}>
                        {owned ? 'OWNED' : active ? `OPENS AT ${selected.name} L${previewLevel}` : 'USE CHARACTER FIRST'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderCopy}>
                <Text style={styles.sectionTitle}>BADGES & TITLES</Text>
                <Text style={styles.sectionCaption}>
                  Badges mark what you accomplished. Signature: {signatureBadge}. This stage: {stageBadgeName}.
                </Text>
              </View>
              <Pressable onPress={() => setShowAllCollectibles((value) => !value)} style={styles.textAction}>
                <Text style={styles.textActionText}>{showAllCollectibles ? 'SHOW LESS' : 'VIEW ALL BADGES'}</Text>
              </Pressable>
            </View>

            {collectibleLoading ? (
              <ActivityIndicator style={styles.collectibleLoader} />
            ) : visibleCollectibles.length ? (
              <View style={styles.collectibleGrid}>
                {visibleCollectibles.map((item) => {
                  const catalogBadge = item.level_no
                    ? buklodStageMasteryBadge(effectiveSelectedId, item.level_no)
                    : item.badge_name;
                  const catalogItem = item.level_no
                    ? buklodCollectibleNames(effectiveSelectedId, item.level_no)[4]
                    : item.collectible_name;
                  return (
                    <View key={item.collectible_id} style={styles.collectibleCard}>
                      <View style={styles.collectibleCardInner}>
                        <View style={[styles.collectibleIcon, item.secret && !item.earned && styles.collectibleIconSecret]}>
                          <MaterialCommunityIcons
                            name={item.secret && !item.earned ? 'help' : item.earned ? 'medal' : 'lock-outline'}
                            size={18}
                            color={item.earned ? '#16813E' : '#627069'}
                          />
                        </View>
                        <Text style={styles.collectibleName} numberOfLines={2}>{catalogBadge}</Text>
                        <Text style={styles.badgeName} numberOfLines={1}>Legacy object: {catalogItem}</Text>
                        <Text style={styles.requirementText} numberOfLines={3}>{friendlyRequirement(item.requirement, item.secret && !item.earned)}</Text>
                        <Text style={item.earned ? styles.collectibleEarned : item.secret ? styles.collectibleSecret : styles.collectibleTier}>
                          {item.earned ? (item.earned_early ? 'EARNED EARLY' : 'EARNED') : item.secret ? 'SECRET' : `TIER ${item.difficulty_tier}`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyBadges}>
                {selectedUnlocked
                  ? 'No badges are recorded for this character yet.'
                  : `Badges open at Circle Rank ${requiredRank}.`}
              </Text>
            )}
          </View>
        </>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { marginTop: 16, marginHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(232,197,107,0.28)', backgroundColor: '#10182A', overflow: 'hidden', maxWidth: '100%' },
  shellNative: { overflow: 'hidden', maxWidth: '100%' },
  topHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10 },
  topHeaderCompact: { flexDirection: 'column', alignItems: 'flex-start' },
  brandMark: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8C56B', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#1A1406', fontSize: 12, fontWeight: '900' },
  headerCopy: { flex: 1, minWidth: 0 },
  headerCopyCompact: { flexGrow: 0, width: '100%' },
  heading: { fontSize: 14, lineHeight: 18, fontWeight: '900', letterSpacing: 0.6, color: '#F4E7C3' },
  subheading: { marginTop: 2, fontSize: 11, lineHeight: 16, color: '#9AA6BD' },
  missionNote: { maxWidth: 360, minWidth: 260, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, backgroundColor: '#F3F7EF', borderWidth: 1, borderColor: '#E1E8DA' },
  missionTitle: { fontSize: 12, fontWeight: '900', color: '#253528' },
  missionText: { marginTop: 2, fontSize: 10.5, color: '#5E6C62' },
  characterRail: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  characterCard: { alignSelf: 'stretch', minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 8, backgroundColor: '#162033', borderWidth: 1, borderColor: '#243044' },
  characterCardSelected: { borderColor: '#E8C56B' },
  characterCardLocked: { opacity: 0.72 },
  characterImageFrame: { width: 48, height: 48, borderRadius: 12, overflow: 'hidden', backgroundColor: '#0E1524', alignItems: 'center', justifyContent: 'center' },
  characterImage: { width: 48, height: 48 },
  characterImageHidden: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0E1524' },
  characterCopy: { flex: 1, minWidth: 0 },
  lockChip: { position: 'absolute', right: 6, top: 6, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.92)' },
  lockChipText: { fontSize: 8, fontWeight: '900', color: '#667069' },
  characterName: { fontSize: 13, fontWeight: '900', color: '#F7F1DE' },
  characterRank: { marginTop: 1, fontSize: 10, color: '#9AA6BD' },
  characterStateActive: { marginTop: 2, fontSize: 8.5, fontWeight: '900', color: '#E8C56B' },
  characterStateNext: { marginTop: 2, fontSize: 8.5, fontWeight: '900', color: '#E8C56B' },
  characterStateMuted: { marginTop: 2, fontSize: 8.5, fontWeight: '900', color: '#8B95A8' },
  characterStateReady: { marginTop: 2, fontSize: 8.5, fontWeight: '900', color: '#C9D2E3' },
  heroPanel: { marginHorizontal: 12, marginBottom: 12, padding: 10, borderRadius: 18, backgroundColor: '#162033', borderWidth: 1, borderColor: 'rgba(232,197,107,0.45)', flexDirection: 'row', gap: 12, alignItems: 'center' },
  heroPanelCompact: { flexDirection: 'column', alignItems: 'stretch' },
  largeArtFrame: { width: 140, height: 160, borderRadius: 14, overflow: 'hidden', backgroundColor: '#0E1524', alignItems: 'center', justifyContent: 'center' },
  badgeStack: { position: 'absolute', left: 6, top: 8, gap: 4 },
  badgePin: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1406', borderWidth: 1, borderColor: '#E8C56B' },
  largeArtFrameCompact: {
    width: 140,
    height: 168,
    alignSelf: 'center',
    marginBottom: 8,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0E1524',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeArt: { width: '100%', height: '100%' },
  largeArtNativeCompact: {},
  heroCopy: { flex: 1, flexShrink: 1, paddingVertical: 4, minWidth: 0, maxWidth: '100%' },
  heroCopyCompact: { flexGrow: 0, flexShrink: 1, width: '100%', maxWidth: '100%' },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  detailTitle: { fontSize: 20, lineHeight: 24, fontWeight: '900', color: '#F7F1DE' },
  specialPill: { backgroundColor: '#F6EBD1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  specialPillText: { fontSize: 9, fontWeight: '900', color: '#8A6517' },
  detailDomain: { marginTop: 4, fontSize: 12, fontWeight: '800', color: '#E8C56B' },
  quoteText: { marginTop: 6, fontSize: 11, lineHeight: 16, fontStyle: 'italic', color: '#9AA6BD' },
  description: { marginTop: 6, fontSize: 11, lineHeight: 16, color: '#C9D2E3' },
  traitWrap: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  traitPill: { maxWidth: '100%', flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#243044', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#10182A' },
  traitDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#1C9A4C' },
  traitDotAlt: { backgroundColor: '#2687D8' },
  traitDotGold: { backgroundColor: '#E3A516' },
  traitDotPurple: { backgroundColor: '#8D48CC' },
  traitText: { flexShrink: 1, fontSize: 9.5, fontWeight: '800', color: '#C9D2E3' },
  rankPanel: { marginHorizontal: 12, marginBottom: 12, width: undefined, minWidth: 0, padding: 12, borderRadius: 14, backgroundColor: '#10182A', justifyContent: 'center' },
  heroPhoto: { width: 112, height: 132 },
  rankPanelNativeCompact: { width: '100%', minWidth: 0 },
  rankStatus: { fontSize: 14, fontWeight: '900', color: '#F7F1DE' },
  rankSubtitle: { marginTop: 2, fontSize: 11, lineHeight: 16, color: '#9AA6BD' },
  rankLine: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  rankLabel: { fontSize: 10, color: '#9AA6BD' },
  rankValue: { fontSize: 12, fontWeight: '900', color: '#E8C56B' },
  progressTrack: { marginTop: 7, height: 8, borderRadius: 5, backgroundColor: '#2A3548', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: '#E8C56B' },
  rankHelp: { marginTop: 10, fontSize: 10, lineHeight: 15, color: '#C9D2E3' },
  primaryAction: { marginTop: 12, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#E8C56B' },
  primaryActionDisabled: { opacity: 0.55 },
  primaryActionText: { fontSize: 9, fontWeight: '900', color: '#1A1406' },
  nativeDetailsToggle: { marginHorizontal: 12, marginBottom: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#243044', backgroundColor: '#162033' },
  nativeDetailsToggleTitle: { fontSize: 11, fontWeight: '900', color: '#E8C56B' },
  nativeDetailsToggleText: { marginTop: 3, fontSize: 9.5, lineHeight: 14, color: '#9AA6BD' },
  sectionCard: { marginHorizontal: 12, marginBottom: 12, padding: 12, borderRadius: 18, backgroundColor: '#162033', borderWidth: 1, borderColor: '#243044' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionHeaderCopy: { flex: 1 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: '#F4E7C3' },
  sectionCaption: { marginTop: 2, fontSize: 10.5, lineHeight: 15, color: '#9AA6BD' },
  textAction: { paddingHorizontal: 9, paddingVertical: 6 },
  textActionText: { fontSize: 9, fontWeight: '900', color: '#E8C56B' },
  levelRail: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap' },
  levelCard: { width: '33.33%', padding: 4 },
  levelCardInner: { minHeight: 156, borderRadius: 14, padding: 6, borderWidth: 1, borderColor: '#243044', backgroundColor: '#121A2B' },
  levelCardCurrent: { borderColor: '#1DA04C', borderWidth: 2 },
  levelImageFrame: { height: 92, borderRadius: 11, overflow: 'hidden', backgroundColor: '#ECF1EE', alignItems: 'center', justifyContent: 'center' },
  levelImage: { width: '100%', height: 92 },
  lockedPreview: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F3F1' },
  lockCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#D8DEDA', alignItems: 'center', justifyContent: 'center' },
  lockCircleText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  levelNumberBadge: { position: 'absolute', bottom: 5, left: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: '#178E45', alignItems: 'center', justifyContent: 'center' },
  levelNumberText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  levelTitle: { marginTop: 6, minHeight: 30, fontSize: 10.5, lineHeight: 14, fontWeight: '800', color: '#F7F1DE' },
  levelOpen: { marginTop: 3, fontSize: 8.5, fontWeight: '900', color: '#E8C56B' },
  levelLocked: { marginTop: 3, fontSize: 8.5, fontWeight: '900', color: '#8B95A8' },
  levelCollectible: { marginTop: 5, fontSize: 8.5, color: '#9AA6BD' },
  collectibleLoader: { marginVertical: 20 },
  collectibleGrid: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap' },
  collectibleCard: { width: '50%', padding: 4 },
  collectibleCardInner: { minHeight: 168, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#243044', backgroundColor: '#121A2B' },
  collectibleIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E0F3E6', alignItems: 'center', justifyContent: 'center' },
  collectibleIconSecret: { backgroundColor: '#E6E8E7' },
  collectibleIconText: { fontSize: 12, fontWeight: '900', color: '#227541' },
  collectibleName: { marginTop: 8, fontSize: 10.5, lineHeight: 14, fontWeight: '900', color: '#F7F1DE' },
  badgeName: { marginTop: 3, fontSize: 8.5, fontWeight: '800', color: '#9AA6BD' },
  requirementText: { marginTop: 7, fontSize: 8.5, lineHeight: 13, color: '#C9D2E3' },
  collectibleEarned: { marginTop: 8, fontSize: 8, fontWeight: '900', color: '#16813E' },
  collectibleSecret: { marginTop: 8, fontSize: 8, fontWeight: '900', color: '#777F79' },
  collectibleTier: { marginTop: 8, fontSize: 8, fontWeight: '900', color: '#9A7118' },
  emptyBadges: { marginTop: 12, fontSize: 10, lineHeight: 15, color: '#9AA6BD' },
  message: { marginHorizontal: 16, marginBottom: 14, fontSize: 10, lineHeight: 15, color: '#C9D2E3' },
});