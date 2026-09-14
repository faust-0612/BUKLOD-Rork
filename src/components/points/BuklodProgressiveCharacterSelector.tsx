/* BUKLOD_CHARACTER_R31_APPROVED_LAYOUT_20260905 */
/* Approved Sep. 5 R31 presentation; V2/server Character authority is preserved. */
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

import BuklodProgressiveCharacterArt from '@/components/points/BuklodProgressiveCharacterArt';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { withAlpha } from '@/lib/buklodContrast';
import {
  PROGRESSIVE_CHARACTER_ORDER,
  PROGRESSIVE_CHARACTERS,
  saveProgressiveCharacter,
  collectibleNames,
  type ProgressiveCharacterId,
} from '@/lib/buklodProgressiveCharacter';
import type { BuklodCharacterSelectionV2State } from '@/lib/buklodCharacterSelectionV2';

type Props = {
  userId?: string | null;
  state: BuklodCharacterSelectionV2State;
  onStateRefresh: () => Promise<void> | void;
};

function clampLevel(value: unknown) {
  return Math.max(1, Math.min(20, Math.floor(Number(value) || 1)));
}

export default function BuklodProgressiveCharacterSelector({ userId, state, onStateRefresh }: Props) {
  const { theme } = useBuklodPresentation();
  const activeCore = PROGRESSIVE_CHARACTER_ORDER.includes(state.active_character_id as ProgressiveCharacterId)
    ? (state.active_character_id as ProgressiveCharacterId)
    : null;

  const [draft, setDraft] = useState<ProgressiveCharacterId>(activeCore ?? 'phan');
  const [collectionLevel, setCollectionLevel] = useState(activeCore ? clampLevel(state.character_level) : 1);
  const [zoom, setZoom] = useState<{ id: ProgressiveCharacterId; level: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const profile = PROGRESSIVE_CHARACTERS[draft];
  const availableLevel = draft === activeCore ? clampLevel(state.character_level) : 1;
  const currentCollectibles = useMemo(
    () => collectibleNames(draft, collectionLevel),
    [draft, collectionLevel],
  );

  const save = async () => {
    if (!userId || busy || draft === state.active_character_id) return;
    setBusy(true);
    try {
      await saveProgressiveCharacter(userId, draft);
      setCollectionLevel(1);
      await onStateRefresh();
    } finally {
      setBusy(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    wrap: {
      marginTop: 14,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
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
      justifyContent: 'flex-end',
      overflow: 'hidden',
      borderRadius: 10,
    },
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
      padding: 10,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    collectiblesTitle: { fontSize: 11, fontWeight: '900', color: theme.textPrimary, marginBottom: 5 },
    collectionNote: { marginTop: 3, fontSize: 9, lineHeight: 14, color: theme.textMuted },
    collectionTabs: { paddingTop: 9, paddingBottom: 6, gap: 7 },
    collectionChip: {
      minWidth: 58,
      paddingHorizontal: 8,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center',
    },
    collectionChipActive: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
    collectionChipLocked: { opacity: 0.48 },
    collectionChipLevel: { fontSize: 9, fontWeight: '900', color: theme.textPrimary },
    collectionChipStatus: { marginTop: 2, fontSize: 7, fontWeight: '900', color: theme.textMuted },
    collectionDetail: { marginTop: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
    collectionDetailTitle: { fontSize: 10, fontWeight: '900', color: theme.textPrimary },
    collectionDetailStatus: { marginTop: 2, marginBottom: 5, fontSize: 8, fontWeight: '900', color: theme.accent },
    collectibleItem: { fontSize: 10, lineHeight: 16, color: theme.textMuted },
    save: {
      marginTop: 10,
      marginHorizontal: 14,
      minHeight: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    saveDisabled: { opacity: 0.55 },
    saveText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
    zoomBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center', padding: 20 },
    zoomCard: { width: '100%', maxWidth: 360, height: '82%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    zoomTitle: { fontSize: 14, fontWeight: '900', color: '#FFFFFF', textAlign: 'center' },
    zoomStage: { marginTop: 2, marginBottom: 8, fontSize: 11, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  }), [theme]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Choose Your BUKLOD Character</Text>
      <Text style={styles.hint}>
        Pick Phan, Quin, Van, Christian, or Lhen. Changing Character starts the newly selected Character at Level 1. Circle Points and Circle Rank remain intact.
      </Text>

      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {PROGRESSIVE_CHARACTER_ORDER.map((id) => {
          const item = PROGRESSIVE_CHARACTERS[id];
          const selected = draft === id;
          const active = state.active_character_id === id;
          const level = active ? clampLevel(state.character_level) : 1;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${item.name}`}
              onPress={() => {
                setDraft(id);
                setCollectionLevel(level);
              }}
              style={[styles.tile, selected && styles.tileOn]}
            >
              <View style={styles.art}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${item.name} full screen`}
                  onPress={(event) => {
                    event.stopPropagation?.();
                    setZoom({ id, level });
                  }}
                >
                  <BuklodProgressiveCharacterArt characterId={id} level={level} height={112} viewportWidth={86} />
                </Pressable>
              </View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.level}>Level {level} · {item.stages[level - 1]}</Text>
              {active ? <Text style={styles.saved}>SELECTED</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.progression}>
        <Text style={styles.progressionTitle}>LEVEL 1-20 PROGRESSION</Text>
        <Text style={styles.progressionSummary}>
          {draft === activeCore
            ? `Current Level ${availableLevel} of 20 - ${profile.stages[availableLevel - 1]}`
            : `${profile.name} starts at Level 1 when selected.`}
        </Text>

        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.progressionRow}>
          {Array.from({ length: 20 }, (_, index) => index + 1).map((stageLevel) => {
            const current = draft === activeCore && stageLevel === availableLevel;
            const completed = draft === activeCore && stageLevel < availableLevel;
            const locked = stageLevel > availableLevel;
            return (
              <Pressable
                key={`${draft}-progress-${stageLevel}`}
                accessibilityRole="button"
                accessibilityLabel={`Preview ${profile.name} Level ${stageLevel}`}
                onPress={() => {
                  setCollectionLevel(stageLevel);
                  setZoom({ id: draft, level: stageLevel });
                }}
                style={[
                  styles.progressionCard,
                  current && styles.progressionCardCurrent,
                  locked && styles.progressionCardLocked,
                ]}
              >
                <View style={styles.progressionArt}>
                  <BuklodProgressiveCharacterArt characterId={draft} level={stageLevel} height={136} viewportWidth={88} />
                </View>
                <Text style={styles.progressionLevel}>Level {stageLevel}</Text>
                <Text style={styles.progressionStage} numberOfLines={2}>{profile.stages[stageLevel - 1]}</Text>
                <Text style={styles.progressionPoints}>LEVEL {stageLevel} JOURNEY</Text>
                <Text style={[styles.progressionStatus, current && styles.progressionStatusCurrent]}>
                  {current ? 'CURRENT' : completed ? 'COMPLETED' : 'LOCKED'}
                </Text>
                <Text style={styles.progressionPreview}>{locked ? 'PREVIEW LOCKED' : 'PREVIEW'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.nextUpgrade}>
          {draft === activeCore
            ? `${state.character_points_since_selection.toLocaleString()} points earned since this Character was selected. The server determines the current Character level.`
            : 'Preview only. Selecting this Character starts it at Level 1.'}
        </Text>
      </View>

      <View style={styles.collectibles}>
        <Text style={styles.collectiblesTitle}>COLLECTIBLES - {profile.name}</Text>
        <Text style={styles.collectionNote}>Browse all 20 levels. Collectibles are display rewards and never transfer Character level or Circle Rank.</Text>

        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionTabs}>
          {Array.from({ length: 20 }, (_, index) => index + 1).map((level) => {
            const activeCollection = level === collectionLevel;
            const lockedCollection = level > availableLevel;
            return (
              <Pressable
                key={`${draft}-collection-${level}`}
                accessibilityRole="button"
                accessibilityLabel={`View Level ${level} collectibles`}
                onPress={() => setCollectionLevel(level)}
                style={[
                  styles.collectionChip,
                  activeCollection && styles.collectionChipActive,
                  lockedCollection && styles.collectionChipLocked,
                ]}
              >
                <Text style={styles.collectionChipLevel}>L{level}</Text>
                <Text style={styles.collectionChipStatus}>{lockedCollection ? 'LOCKED' : level < availableLevel ? 'EARNED' : 'CURRENT'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.collectionDetail}>
          <Text style={styles.collectionDetailTitle}>Level {collectionLevel} - {profile.stages[collectionLevel - 1]}</Text>
          <Text style={styles.collectionDetailStatus}>
            {collectionLevel > availableLevel ? 'LOCKED - PREVIEW ONLY' : collectionLevel < availableLevel ? 'EARNED' : 'CURRENT LEVEL'}
          </Text>
          {currentCollectibles.map((item, index) => (
            <Text key={`${draft}-${collectionLevel}-${index}`} style={styles.collectibleItem}>
              {index + 1}. {item}
            </Text>
          ))}
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
          <Text style={styles.saveText}>{draft === state.active_character_id ? 'ACTIVE CHARACTER' : 'Use This Character'}</Text>
        )}
      </Pressable>

      <Modal visible={zoom != null} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoom(null)} accessibilityRole="button" accessibilityLabel="Close full screen character">
          <View style={styles.zoomCard} pointerEvents="none">
            {zoom ? (
              <>
                <Text style={styles.zoomTitle}>{PROGRESSIVE_CHARACTERS[zoom.id].name} - Level {zoom.level}</Text>
                <Text style={styles.zoomStage}>{PROGRESSIVE_CHARACTERS[zoom.id].stages[zoom.level - 1]}</Text>
                <BuklodProgressiveCharacterArt characterId={zoom.id} level={zoom.level} height={500} />
              </>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
