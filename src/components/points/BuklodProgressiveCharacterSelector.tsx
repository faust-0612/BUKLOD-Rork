/* BUKLOD_CHARACTER_R31_APPROVED_LAYOUT_20260905 */
/* Approved Sep. 5 R31 presentation; V2/server Character authority is preserved. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import BuklodProgressiveCharacterArt from '@/components/points/BuklodProgressiveCharacterArt';
import BuklodCharacterLevelGuide from '@/components/points/BuklodCharacterLevelGuide';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { withAlpha } from '@/lib/buklodContrast';
import {
  characterTokenIcon,
  clearMyCharacterCollectible,
  getMyCharacterCollectibles,
  isCollectibleLevelOpen,
  isCollectibleShown,
  shownCollectiblePins,
  openMyCharacterCollectible,
  redeemMyCharacterCollectible,
  useMyCharacterCollectible,
  type CharacterCollectibleState,
} from '@/lib/buklodCharacterCollectibles';
import {
  PROGRESSIVE_CHARACTER_ORDER,
  PROGRESSIVE_CHARACTERS,
  collectibleNames,
  type ProgressiveCharacterId,
} from '@/lib/buklodProgressiveCharacter';
import {
  setBuklodCharacterDisplayOverride,
  setMyBuklodCharacterActiveV2,
  type BuklodCharacterSelectionV2State,
} from '@/lib/buklodCharacterSelectionV2';

const CLAIM_SOUND = require('../../../assets/sounds/buklod-points-claim.wav');

type Props = {
  userId?: string | null;
  state: BuklodCharacterSelectionV2State;
  onStateRefresh: () => Promise<void> | void;
};

const ROW_ACCENT: Record<ProgressiveCharacterId, string> = {
  phan: '#3B82F6',
  quin: '#22C55E',
  van: '#A855F7',
  christian: '#EF4444',
  lhen: '#F59E0B',
};

function clampLevel(value: unknown) {
  return Math.max(1, Math.min(20, Math.floor(Number(value) || 1)));
}

export default function BuklodProgressiveCharacterSelector({ userId, state, onStateRefresh }: Props) {
  const { theme } = useBuklodPresentation();
  const claimSound = useAudioPlayer(CLAIM_SOUND);
  const itemPulse = useRef(new Animated.Value(1)).current;
  const [pulseKey, setPulseKey] = useState<string | null>(null);
  const activeCore = PROGRESSIVE_CHARACTER_ORDER.includes(state.active_character_id as ProgressiveCharacterId)
    ? (state.active_character_id as ProgressiveCharacterId)
    : null;

  const [draft, setDraft] = useState<ProgressiveCharacterId>(activeCore ?? 'phan');
  const [collectionLevel, setCollectionLevel] = useState(activeCore ? clampLevel(state.character_level) : 1);
  const [zoom, setZoom] = useState<{ id: ProgressiveCharacterId; level: number } | null>(null);
  const window = useWindowDimensions();
  const lastLiveLevel = useRef({ id: state.active_character_id, level: clampLevel(state.character_level) });
  const zoomHeight = Math.max(1, Math.min(500, window.height * 0.86 - 110, (window.width - 64) * 508 / 247));
  const [busy, setBusy] = useState(false);
  const [collectibleState, setCollectibleState] = useState<CharacterCollectibleState | null>(null);
  const [collectibleLoading, setCollectibleLoading] = useState(false);
  const [itemBusy, setItemBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const profile = PROGRESSIVE_CHARACTERS[draft];
  const availableLevel = draft === activeCore ? clampLevel(state.character_level) : 1;
  const currentCollectibles = useMemo(
    () => collectibleNames(draft, collectionLevel),
    [draft, collectionLevel],
  );

  const reloadCollectibles = async () => {
    if (!userId) {
      setCollectibleState(null);
      return;
    }
    setCollectibleState(await getMyCharacterCollectibles(draft));
  };

  useEffect(() => {
    if (!PROGRESSIVE_CHARACTER_ORDER.includes(state.active_character_id as ProgressiveCharacterId)) {
      return;
    }
    const next = state.active_character_id as ProgressiveCharacterId;
    setDraft(next);
    setCollectionLevel(clampLevel(state.character_level));
    // Sync only when the profile character changes, not while browsing another draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [state.active_character_id]);

  // Sync newly earned levels into the fullscreen/level preview, but do not
  // interrupt a member manually browsing a different unlocked stage.
  useEffect(() => {
    const previous = lastLiveLevel.current;
    const current = { id: state.active_character_id, level: clampLevel(state.character_level) };
    lastLiveLevel.current = current;
    if (previous.id === current.id && previous.level !== current.level && draft === current.id) {
      setCollectionLevel((shown) => shown === previous.level ? current.level : shown);
    }
  }, [draft, state.active_character_id, state.character_level]);

  useEffect(() => {
    let alive = true;
    if (!userId) {
      setCollectibleState(null);
      return;
    }
    setCollectibleLoading(true);
    void getMyCharacterCollectibles(draft)
      .then((next) => {
        if (alive) setCollectibleState(next);
      })
      .catch((error: unknown) => {
        if (alive) setActionMessage(error instanceof Error ? error.message : 'Could not load character items.');
      })
      .finally(() => {
        if (alive) setCollectibleLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [draft, userId, state.active_character_id, state.character_level]);

  useEffect(() => {
    setBuklodCharacterDisplayOverride({
      character_id: draft,
      character_level: clampLevel(collectionLevel),
    });
  }, [collectionLevel, draft]);

  const save = async () => {
    if (!userId || busy || draft === state.active_character_id) return;
    setBusy(true);
    setActionMessage(null);
    try {
      const next = await setMyBuklodCharacterActiveV2(userId, draft);
      setCollectionLevel(clampLevel(next.character_level));
      await onStateRefresh();
      setBuklodCharacterDisplayOverride({
        character_id: next.active_character_id,
        character_level: next.character_level,
      });
      await reloadCollectibles();
      setActionMessage(`${PROGRESSIVE_CHARACTERS[draft].name} is now Showing Now at Level ${next.character_level}. Open their own items from Level 1 up.`);
    } catch (error: unknown) {
      setActionMessage(error instanceof Error ? error.message : 'Could not change character.');
    } finally {
      setBusy(false);
    }
  };

  const runItemAction = async (itemIndex: number, action: 'open' | 'claim' | 'use' | 'remove') => {
    if (!userId || itemBusy) return;
    const key = `${collectionLevel}:${itemIndex}`;
    setItemBusy(key);
    setActionMessage(null);
    try {
      if (action === 'open') await openMyCharacterCollectible(draft, collectionLevel, itemIndex);
      if (action === 'claim') await redeemMyCharacterCollectible(draft, collectionLevel, itemIndex);
      if (action === 'use') {
        // Auto-earn may already own it; redeem is idempotent insurance before Show.
        await redeemMyCharacterCollectible(draft, collectionLevel, itemIndex);
        await useMyCharacterCollectible(draft, collectionLevel, itemIndex);
      }
      if (action === 'remove') {
        const kind = collectibleState?.items.find((item) => item.level === collectionLevel && item.itemIndex === itemIndex)?.rewardKind;
        if (!kind) return;
        await clearMyCharacterCollectible(draft, kind);
      }
      await reloadCollectibles();
      setPulseKey(key);
      itemPulse.setValue(0.9);
      Animated.spring(itemPulse, { toValue: 1, friction: 5, useNativeDriver: true }).start();
      if (action === 'claim' || action === 'use') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        try {
          void claimSound.seekTo(0).catch(() => undefined);
          claimSound.play();
        } catch {
          /* The item still saves if sound is unavailable. */
        }
      } else {
        void Haptics.selectionAsync().catch(() => undefined);
      }
      setActionMessage(
        action === 'use' ? 'It is now beside this character.'
          : action === 'remove' ? 'Taken off. It is still owned.'
            : 'Item updated.',
      );
    } catch (error: unknown) {
      setActionMessage(error instanceof Error ? error.message : 'Could not update this item.');
    } finally {
      setItemBusy(null);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    wrap: { marginTop: 8, paddingBottom: 8, maxWidth: '100%' },
    featured: {
      marginHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: 'rgba(232,197,107,0.55)',
      backgroundColor: '#162033',
      overflow: 'hidden',
    },
    featuredCopy: { flex: 1, minWidth: 0 },
    featuredIndex: { color: '#F7F1DE', fontSize: 16, fontWeight: '900' },
    featuredRole: { marginTop: 2, color: '#E8C56B', fontSize: 12, fontWeight: '800' },
    featuredNote: { marginTop: 6, color: '#C9D2E3', fontSize: 10, lineHeight: 14 },
    levelHead: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    levelLabel: { color: '#F7F1DE', fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
    levelPoints: { color: '#E8C56B', fontSize: 10, fontWeight: '800' },
    levelTrack: { marginTop: 6, height: 8, borderRadius: 999, backgroundColor: '#2A3548', overflow: 'hidden' },
    levelFill: { height: 8, borderRadius: 999, backgroundColor: '#E8C56B' },
    featuredQuote: { marginTop: 8, color: '#9AA6BD', fontSize: 10, fontStyle: 'italic', lineHeight: 14 },
    featuredArt: { width: 108, height: 148, alignItems: 'center', justifyContent: 'flex-end', overflow: 'visible' },
    besideStack: { position: 'absolute', left: 0, top: 8, gap: 4 },
    besidePin: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1A1406',
      borderWidth: 1,
      borderColor: '#E8C56B',
    },
    roster: { marginTop: 10, marginHorizontal: 14, gap: 8 },
    rosterRow: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderLeftWidth: 4,
      borderColor: '#243044',
      backgroundColor: '#121A2B',
    },
    rosterRowOn: { borderColor: '#E8C56B', backgroundColor: '#1B2740' },
    rosterArt: { width: 46, height: 52, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
    rosterCopy: { flex: 1, minWidth: 0 },
    rosterName: { color: '#F7F1DE', fontSize: 12, fontWeight: '900' },
    rosterStage: { marginTop: 2, color: '#9AA6BD', fontSize: 10 },
    rosterMeta: { width: 72, alignItems: 'flex-end' },
    rosterLevel: { color: '#E8C56B', fontSize: 10, fontWeight: '900' },
    rosterTrack: { marginTop: 4, width: 68, height: 5, borderRadius: 999, backgroundColor: '#2A3548', overflow: 'hidden' },
    rosterFill: { height: 5, borderRadius: 999 },
    title: { paddingHorizontal: 14, fontSize: 14, fontWeight: '900', color: theme.textPrimary },
    hint: { marginTop: 4, paddingHorizontal: 14, fontSize: 10, lineHeight: 14, color: theme.textMuted },
    row: { paddingHorizontal: 14, paddingTop: 10, gap: 10 },
    tile: {
      width: 112,
      minHeight: 166,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surfaceElevated,
      overflow: 'hidden',
      alignItems: 'center',
      paddingTop: 7,
      paddingBottom: 8,
    },
    tileOn: { borderColor: theme.accent, backgroundColor: withAlpha(theme.accentSoft, 0.72) },
    art: { width: 92, height: 118, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
    name: { marginTop: 5, fontSize: 11, fontWeight: '900', color: theme.textPrimary },
    level: { marginTop: 2, fontSize: 9, fontWeight: '800', color: theme.textMuted },
    saved: { marginTop: 2, fontSize: 8, fontWeight: '900', color: theme.accent },
    progression: {
      marginTop: 14,
      paddingTop: 12,
      paddingBottom: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    progressionTitle: { marginHorizontal: 14, fontSize: 12, fontWeight: '900', color: theme.textPrimary },
    progressionSummary: { marginTop: 3, marginHorizontal: 14, fontSize: 10, lineHeight: 15, color: theme.textMuted },
    progressionRow: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4, gap: 9 },
    progressionCard: {
      width: 112,
      minHeight: 224,
      padding: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center',
    },
    progressionCardCurrent: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
    progressionCardLocked: { opacity: 0.42 },
    progressionArt: {
      width: 90,
      height: 138,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderRadius: 10,
    },
    lockedArtText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.4, color: theme.textMuted },
    progressionLevel: { marginTop: 7, fontSize: 10, fontWeight: '900', color: theme.textPrimary },
    progressionStage: { marginTop: 2, minHeight: 28, fontSize: 9, lineHeight: 13, textAlign: 'center', color: theme.textSecondary },
    progressionPoints: { marginTop: 4, fontSize: 9, fontWeight: '800', color: theme.textMuted },
    progressionStatus: { marginTop: 3, fontSize: 8, fontWeight: '900', letterSpacing: 0.35, color: theme.textMuted },
    progressionStatusCurrent: { color: theme.accent },
    progressionPreview: { marginTop: 4, fontSize: 8, fontWeight: '900', letterSpacing: 0.3, color: theme.accent },
    nextUpgrade: { marginTop: 6, marginHorizontal: 14, fontSize: 10, lineHeight: 15, fontWeight: '800', color: theme.textSecondary },
    collectibles: {
      marginTop: 10,
      marginHorizontal: 14,
      padding: 12,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: '#243044',
      backgroundColor: '#162033',
    },
    collectiblesTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 0.6, color: '#F4E7C3', marginBottom: 5 },
    giverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
    giverArt: { width: 120, height: 150, alignItems: 'center', justifyContent: 'flex-end' },
    giverCopy: { flex: 1, minWidth: 0 },
    giverName: { fontSize: 16, fontWeight: '900', color: '#F7F1DE' },
    giverNote: { marginTop: 3, fontSize: 10, lineHeight: 14, color: '#9AA6BD' },
    pinRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    pin: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentSoft,
      borderWidth: 1,
      borderColor: theme.accent,
    },
    tokenIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accentSoft,
    },
    collectionNote: { marginTop: 3, fontSize: 9, lineHeight: 14, color: '#9AA6BD' },
    collectionTabs: { marginTop: 9, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    collectionChip: {
      minWidth: 52,
      paddingHorizontal: 8,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#243044',
      backgroundColor: '#121A2B',
      alignItems: 'center',
    },
    collectionChipActive: { borderColor: '#E8C56B', backgroundColor: '#2A2416' },
    collectionChipLocked: { opacity: 0.48 },
    collectionChipLevel: { fontSize: 9, fontWeight: '900', color: '#F7F1DE' },
    collectionChipStatus: { marginTop: 2, fontSize: 7, fontWeight: '900', color: '#9AA6BD' },
    collectionDetail: { marginTop: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#243044' },
    collectionDetailTitle: { fontSize: 10, fontWeight: '900', color: '#F7F1DE' },
    collectionDetailStatus: { marginTop: 2, marginBottom: 5, fontSize: 8, fontWeight: '900', color: '#E8C56B' },
    collectibleItem: { fontSize: 10, lineHeight: 16, color: theme.textMuted },
    collectibleRow: {
      marginTop: 6,
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#243044',
      backgroundColor: '#121A2B',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    collectibleCopy: { flex: 1 },
    collectibleName: { fontSize: 11, fontWeight: '800', color: '#F7F1DE' },
    collectibleKind: { marginTop: 1, fontSize: 9, color: '#9AA6BD' },
    collectibleAction: {
      minWidth: 64,
      minHeight: 28,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      backgroundColor: theme.accent,
    },
    collectibleActionQuiet: { backgroundColor: theme.surfaceElevated, borderWidth: 1, borderColor: theme.border },
    collectibleActionText: { fontSize: 9, fontWeight: '900', color: '#FFFFFF' },
    collectibleActionTextQuiet: { color: theme.textPrimary },
    actionMessage: { marginTop: 8, marginHorizontal: 14, fontSize: 10, lineHeight: 14, fontWeight: '800', color: '#C9D2E3' },
    save: {
      marginTop: 10,
      marginHorizontal: 14,
      minHeight: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#E8C56B',
    },
    saveDisabled: { opacity: 0.55 },
    saveText: { fontSize: 12, fontWeight: '900', color: '#1A1406' },
    zoomBackdrop: { flex: 1, backgroundColor: 'rgba(8,28,19,0.90)', alignItems: 'center', justifyContent: 'center', padding: 16 },
    zoomCard: { width: '100%', maxWidth: 390, height: '86%', borderRadius: 22, borderWidth: 1, borderColor: '#D6E9DC', backgroundColor: '#F8FCF9', paddingVertical: 16, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    zoomTitle: { fontSize: 15, fontWeight: '900', color: '#163E29', textAlign: 'center' },
    zoomStage: { marginTop: 3, marginBottom: 8, fontSize: 12, fontWeight: '800', color: '#335B41', textAlign: 'center' },
  }), [theme]);

  const earnedLevel = draft === activeCore
    ? clampLevel(collectibleState?.characterLevel ?? availableLevel)
    : 1;
  const previewLevel = clampLevel(collectionLevel);
  const featuredIndex = PROGRESSIVE_CHARACTER_ORDER.indexOf(draft) + 1;
  const levelFill = `${Math.round((earnedLevel / 20) * 100)}%` as const;
  const besidePins = shownCollectiblePins(collectibleState, draft);
  const showingNow = state.active_character_id === draft;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${profile.name}`}
        onPress={() => setZoom({ id: draft, level: previewLevel })}
        style={styles.featured}
      >
        <View style={styles.featuredCopy}>
          <Text style={styles.featuredIndex}>{featuredIndex}. {profile.name.toUpperCase()}</Text>
          <Text style={styles.featuredRole}>{profile.stages[previewLevel - 1]}</Text>
          <Text style={styles.featuredNote}>
            {showingNow
              ? `Showing on your profile at Level ${earnedLevel}. Tap a level chip below to preview another look.`
              : 'Not on your profile yet. Tap Use This Character. They start at Level 1. Circle Points and Circle Rank stay.'}
          </Text>
          <View style={styles.levelHead}>
            <Text style={styles.levelLabel}>PREVIEW L{previewLevel}</Text>
            <Text style={styles.levelPoints}>
              {showingNow ? `LIVE L${earnedLevel}` : `${state.character_points_since_selection.toLocaleString()} PTS`}
            </Text>
          </View>
          <View style={styles.levelTrack}>
            <View style={[styles.levelFill, { width: levelFill }]} />
          </View>
          <Text style={styles.featuredQuote}>"{profile.stages[previewLevel - 1]}"</Text>
        </View>
        <View style={styles.featuredArt}>
          <BuklodProgressiveCharacterArt
            key={`${draft}-${previewLevel}-featured`}
            characterId={draft}
            level={previewLevel}
            height={132}
            viewportWidth={96}
          />
          {besidePins.length ? (
            <View style={styles.besideStack}>
              {besidePins.map((pin) => (
                <View key={pin.key} style={styles.besidePin}>
                  <MaterialCommunityIcons name={characterTokenIcon(pin.characterId, pin.itemIndex) as never} size={14} color="#E8C56B" />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.roster}>
        {PROGRESSIVE_CHARACTER_ORDER.map((id, index) => {
          const item = PROGRESSIVE_CHARACTERS[id];
          const selected = draft === id;
          const active = state.active_character_id === id;
          const level = active ? clampLevel(state.character_level) : 1;
          const accent = ROW_ACCENT[id];
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${item.name}`}
              onPress={() => {
                setDraft(id);
                setCollectionLevel(level);
              }}
              style={[styles.rosterRow, selected && styles.rosterRowOn, { borderLeftColor: accent }]}
            >
              <View style={styles.rosterArt}>
                <BuklodProgressiveCharacterArt
                  key={`${id}-${level}-roster`}
                  characterId={id}
                  level={level}
                  height={52}
                  viewportWidth={44}
                />
              </View>
              <View style={styles.rosterCopy}>
                <Text style={styles.rosterName}>{index + 1}. {item.name.toUpperCase()}</Text>
                <Text style={styles.rosterStage} numberOfLines={1}>{item.stages[level - 1]}</Text>
              </View>
              <View style={styles.rosterMeta}>
                <Text style={styles.rosterLevel}>Lv. {level}</Text>
                <View style={styles.rosterTrack}>
                  <View style={[styles.rosterFill, { width: `${Math.round((level / 20) * 100)}%`, backgroundColor: accent }]} />
                </View>
              </View>
              {active ? <Text style={styles.saved}>ON</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {/* BUKLOD_CHARACTER_LEVEL_UP_GUIDE_R1 */}
        <BuklodCharacterLevelGuide
          characterName={profile.name}
          stages={profile.stages}
          currentLevel={availableLevel}
          pointsSinceSelection={state.character_points_since_selection}
          isActive={draft === activeCore}
          onRefresh={onStateRefresh}
        />
        
        <View style={styles.collectibles}>
        <Text style={styles.collectiblesTitle}>ITEMS FOR {profile.name.toUpperCase()}</Text>
        <View style={styles.giverRow}>
          <View style={styles.giverArt}>
            <BuklodProgressiveCharacterArt
              key={`${draft}-${previewLevel}-giver`}
              characterId={draft}
              level={previewLevel}
              height={146}
              viewportWidth={110}
            />
          </View>
          <View style={styles.giverCopy}>
            <Text style={styles.giverName}>{profile.name}</Text>
            <Text style={styles.giverNote}>
              {profile.name} has their own 100 story items. Use {profile.name} first — items for reached levels are earned automatically. Tap Show to place one beside {profile.name}.
            </Text>
            <View style={styles.pinRow}>
              {besidePins.length ? besidePins.map((pin) => (
                <View key={pin.key} style={styles.pin}>
                  <MaterialCommunityIcons name={characterTokenIcon(pin.characterId, pin.itemIndex) as never} size={18} color="#E8C56B" />
                </View>
              )) : (
                <Text style={styles.giverNote}>Nothing is beside {profile.name} yet.</Text>
              )}
            </View>
          </View>
        </View>
        <Text style={styles.collectionNote}>
          {showingNow
            ? `${profile.name} is Showing Now at Level ${earnedLevel}. Unlock uses this character's own level — not shared Circle Points.`
            : `Use ${profile.name} first. Their items stay locked until they are Showing Now.`}
        </Text>

        <View style={styles.collectionTabs}>
          {Array.from({ length: 20 }, (_, index) => index + 1).map((level) => {
            const activeCollection = level === collectionLevel;
            const levelOpen = isCollectibleLevelOpen(collectibleState, level);
            const rows = (collectibleState?.items ?? []).filter((item) => item.level === level && item.characterId === draft);
            const claimed = rows.filter((item) => item.redeemedAt).length;
            const chipStatus = !showingNow
              ? 'USE FIRST'
              : !levelOpen
                ? 'LOCKED'
                : claimed >= 5
                  ? 'OWNED'
                  : 'OPENING';
            return (
              <Pressable
                key={`${draft}-collection-${level}`}
                accessibilityRole="button"
                accessibilityLabel={`View Level ${level} collectibles for ${profile.name}`}
                onPress={() => setCollectionLevel(level)}
                style={[
                  styles.collectionChip,
                  activeCollection && styles.collectionChipActive,
                  !levelOpen && styles.collectionChipLocked,
                ]}
              >
                <Text style={styles.collectionChipLevel}>L{level}</Text>
                <Text style={styles.collectionChipStatus}>{chipStatus}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.collectionDetail}>
          <Text style={styles.collectionDetailTitle}>
            {profile.name} · Level {collectionLevel} · {profile.stages[collectionLevel - 1]}
          </Text>
          <Text style={styles.collectionDetailStatus}>
            {!showingNow
              ? `USE ${profile.name.toUpperCase()} FIRST`
              : isCollectibleLevelOpen(collectibleState, collectionLevel)
                ? 'OWNED — TAP SHOW TO DISPLAY'
                : `OPENS AT ${profile.name.toUpperCase()} LEVEL ${collectionLevel}`}
          </Text>
          {collectibleLoading ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}
          {currentCollectibles.map((item, index) => {
            const itemIndex = index + 1;
            const saved = collectibleState?.items.find(
              (row) => row.characterId === draft && row.level === collectionLevel && row.itemIndex === itemIndex,
            );
            const equipped = saved ? isCollectibleShown(saved, collectibleState) : false;
            const levelOpen = isCollectibleLevelOpen(collectibleState, collectionLevel);
            const owned = Boolean(saved?.redeemedAt) || levelOpen;
            const action = !levelOpen ? null : equipped ? 'remove' : 'use';
            const label = action === 'use' ? 'Show' : action === 'remove' ? 'Shown' : owned ? 'Owned' : 'Locked';
            const busyKey = itemBusy === `${collectionLevel}:${itemIndex}`;
            const rowKey = `${collectionLevel}:${itemIndex}`;
            return (
              <Animated.View
                key={`${draft}-${collectionLevel}-${itemIndex}`}
                style={[styles.collectibleRow, pulseKey === rowKey ? { transform: [{ scale: itemPulse }] } : null]}
              >
                <View style={styles.tokenIcon}>
                  <MaterialCommunityIcons name={characterTokenIcon(draft, itemIndex) as never} size={18} color={theme.accent} />
                </View>
                <View style={styles.collectibleCopy}>
                  <Text style={styles.collectibleName} numberOfLines={2}>{item}</Text>
                  <Text style={styles.collectibleKind}>
                    {equipped
                      ? `Beside ${profile.name}`
                      : owned
                        ? 'Owned. Tap Show to display.'
                        : showingNow
                          ? `Needs ${profile.name} Level ${collectionLevel}`
                          : `Use ${profile.name} first`}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${label} ${item}`}
                  disabled={!action || Boolean(itemBusy)}
                  onPress={() => {
                    if (action) void runItemAction(itemIndex, action);
                  }}
                  style={[styles.collectibleAction, (!action || action === 'remove') && styles.collectibleActionQuiet, (!action || itemBusy) && styles.saveDisabled]}
                >
                  {busyKey ? (
                    <ActivityIndicator size="small" color={action === 'remove' ? theme.textPrimary : '#FFFFFF'} />
                  ) : (
                    <Text style={[styles.collectibleActionText, (!action || action === 'remove') && styles.collectibleActionTextQuiet]}>{label}</Text>
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save selected BUKLOD character"
        disabled={!userId || busy || draft === state.active_character_id}
        onPress={() => void save()}
        style={[styles.save, (!userId || busy || draft === state.active_character_id) && styles.saveDisabled]}
      >
        {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
          <Text style={styles.saveText}>{draft === state.active_character_id ? 'Showing on your profile' : 'Use This Character'}</Text>
        )}
      </Pressable>
      {actionMessage ? <Text style={styles.actionMessage}>{actionMessage}</Text> : null}

      <Modal visible={zoom != null} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoom(null)} accessibilityRole="button" accessibilityLabel="Close full screen character">
          <View style={styles.zoomCard} pointerEvents="none">
            {zoom ? (
              <>
                <Text style={styles.zoomTitle}>{PROGRESSIVE_CHARACTERS[zoom.id].name} - Level {zoom.level}</Text>
                <Text style={styles.zoomStage}>{PROGRESSIVE_CHARACTERS[zoom.id].stages[zoom.level - 1]}</Text>
                <BuklodProgressiveCharacterArt
                  key={`${zoom.id}-${zoom.level}-zoom`}
                  characterId={zoom.id}
                  level={zoom.level}
                  height={zoomHeight}
                  highQuality
                />
              </>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
