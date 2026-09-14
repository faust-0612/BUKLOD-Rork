/* BUKLOD_CHARACTER_R31_LAYOUT_LOCK_V3 */
/* Approved R26B presentation forward-ported onto V2/server Character authority. */
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
  collectibleNames,
  saveProgressiveCharacter,
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

export default function BuklodProgressiveCharacterSelector({
  userId,
  state,
  onStateRefresh,
}: Props) {
  const { theme } = useBuklodPresentation();
  const activeCore = PROGRESSIVE_CHARACTER_ORDER.includes(
    state.active_character_id as ProgressiveCharacterId,
  )
    ? (state.active_character_id as ProgressiveCharacterId)
    : null;

  const [draft, setDraft] = useState<ProgressiveCharacterId>(activeCore ?? 'phan');
  const [previewLevel, setPreviewLevel] = useState(activeCore ? clampLevel(state.character_level) : 1);
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
      /* Canonical V2 rule: switching Character atomically starts it at Level 1. */
      await saveProgressiveCharacter(userId, draft);
      setPreviewLevel(1);
      setCollectionLevel(1);
      await onStateRefresh();
    } finally {
      setBusy(false);
    }
  };

  const styles = useMemo(
    () => StyleSheet.create({
      wrap: {
        marginTop: 14,
        paddingVertical: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: theme.border,
      },
      title: { paddingHorizontal: 14, fontSize: 16, fontWeight: '900', color: theme.textPrimary },
      hint: { marginTop: 4, paddingHorizontal: 14, fontSize: 10, lineHeight: 15, color: theme.textMuted },
      row: { paddingHorizontal: 14, paddingTop: 10, gap: 10 },
      tile: {
        width: 116,
        minHeight: 172,
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
      art: { width: 94, height: 120, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
      name: { marginTop: 5, fontSize: 11, fontWeight: '900', color: theme.textPrimary },
      level: { marginTop: 2, paddingHorizontal: 4, fontSize: 8.5, lineHeight: 12, fontWeight: '800', color: theme.textMuted, textAlign: 'center' },
      saved: { marginTop: 3, fontSize: 8, fontWeight: '900', color: theme.accent },
      progression: {
        marginTop: 14,
        paddingTop: 12,
        paddingBottom: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.border,
      },
      sectionTitle: { marginHorizontal: 14, fontSize: 12, fontWeight: '900', color: theme.textPrimary },
      sectionSummary: { marginTop: 3, marginHorizontal: 14, fontSize: 10, lineHeight: 15, color: theme.textMuted },
      progressionRow: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4, gap: 9 },
      progressionCard: {
        width: 114,
        minHeight: 220,
        padding: 8,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        alignItems: 'center',
      },
      progressionCurrent: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
      progressionLocked: { opacity: 0.56 },
      progressionArt: { width: 92, height: 140, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 10 },
      progressionLevel: { marginTop: 7, fontSize: 10, fontWeight: '900', color: theme.textPrimary },
      progressionStage: { marginTop: 2, minHeight: 28, fontSize: 9, lineHeight: 13, textAlign: 'center', color: theme.textSecondary },
      progressionStatus: { marginTop: 3, fontSize: 8, fontWeight: '900', color: theme.textMuted },
      progressionStatusCurrent: { color: theme.accent },
      nextUpgrade: { marginTop: 7, marginHorizontal: 14, fontSize: 9.5, lineHeight: 14, fontWeight: '800', color: theme.textSecondary },
      collectibles: {
        marginTop: 10,
        marginHorizontal: 14,
        padding: 11,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.border,
        backgroundColor: theme.surface,
      },
      collectionTabs: { paddingTop: 9, paddingBottom: 7, gap: 7 },
      collectionChip: { minWidth: 58, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: theme.border, alignItems: 'center' },
      collectionChipActive: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
      collectionChipLocked: { opacity: 0.48 },
      collectionChipLevel: { fontSize: 9, fontWeight: '900', color: theme.textPrimary },
      collectionChipStatus: { marginTop: 2, fontSize: 7, fontWeight: '900', color: theme.textMuted },
      collectionDetail: { marginTop: 5, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
      collectionTitle: { fontSize: 10, fontWeight: '900', color: theme.textPrimary },
      collectionState: { marginTop: 2, marginBottom: 5, fontSize: 8, fontWeight: '900', color: theme.accent },
      collectible: { paddingVertical: 5, fontSize: 9.5, lineHeight: 15, color: theme.textSecondary },
      save: { marginTop: 10, marginHorizontal: 14, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accent },
      saveDisabled: { opacity: 0.55 },
      saveText: { fontSize: 12, fontWeight: '900', color: '#FFFFFF' },
      zoomBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.84)', alignItems: 'center', justifyContent: 'center', padding: 20 },
      zoomCard: { width: '100%', maxWidth: 390, height: '84%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
      zoomTitle: { fontSize: 15, fontWeight: '900', color: '#FFFFFF', textAlign: 'center' },
      zoomStage: { marginTop: 3, marginBottom: 9, fontSize: 11, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
    }),
    [theme],
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Choose Your BUKLOD Character</Text>
      <Text style={styles.hint}>
        Pick Phan, Quin, Van, Christian, or Lhen. Changing Character starts the newly selected Character at Level 1. Circle Points, Circle Rank, and lifetime points remain intact.
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
                setPreviewLevel(level);
                setCollectionLevel(level);
              }}
              style={[styles.tile, selected && styles.tileOn]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${item.name} full screen`}
                onPress={(event) => {
                  event.stopPropagation?.();
                  setZoom({ id, level });
                }}
                style={styles.art}
              >
                <BuklodProgressiveCharacterArt characterId={id} level={level} height={112} viewportWidth={86} />
              </Pressable>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.level}>Level {level} · {item.stages[level - 1]}</Text>
              {active ? <Text style={styles.saved}>SELECTED</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.progression}>
        <Text style={styles.sectionTitle}>LEVEL 1-20 PROGRESSION</Text>
        <Text style={styles.sectionSummary}>
          {draft === activeCore
            ? `Current Level ${availableLevel} of 20 · ${profile.stages[availableLevel - 1]}`
            : `${profile.name} starts at Level 1 when selected.`}
        </Text>

        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.progressionRow}>
          {Array.from({ length: 20 }, (_, index) => index + 1).map((level) => {
            const current = draft === activeCore && level === availableLevel;
            const completed = draft === activeCore && level < availableLevel;
            const locked = level > availableLevel;
            return (
              <Pressable
                key={`${draft}-progress-${level}`}
                accessibilityRole="button"
                accessibilityLabel={`Preview ${profile.name} Level ${level}`}
                onPress={() => {
                  setPreviewLevel(level);
                  setZoom({ id: draft, level });
                }}
                style={[
                  styles.progressionCard,
                  current && styles.progressionCurrent,
                  locked && styles.progressionLocked,
                ]}
              >
                <View style={styles.progressionArt}>
                  <BuklodProgressiveCharacterArt characterId={draft} level={level} height={136} viewportWidth={88} />
                </View>
                <Text style={styles.progressionLevel}>Level {level}</Text>
                <Text style={styles.progressionStage} numberOfLines={2}>{profile.stages[level - 1]}</Text>
                <Text style={[styles.progressionStatus, current && styles.progressionStatusCurrent]}>
                  {current ? 'CURRENT' : completed ? 'COMPLETED' : locked ? 'PREVIEW LOCKED' : 'PREVIEW'}
                </Text>
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
        <Text style={styles.sectionTitle}>COLLECTIBLES - {profile.name.toUpperCase()}</Text>
        <Text style={styles.sectionSummary}>Browse all 20 levels. Collectibles are display rewards and never transfer Character level or Circle Rank.</Text>

        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionTabs}>
          {Array.from({ length: 20 }, (_, index) => index + 1).map((level) => {
            const selected = level === collectionLevel;
            const locked = level > availableLevel;
            return (
              <Pressable
                key={`${draft}-collection-${level}`}
                onPress={() => setCollectionLevel(level)}
                style={[styles.collectionChip, selected && styles.collectionChipActive, locked && styles.collectionChipLocked]}
              >
                <Text style={styles.collectionChipLevel}>L{level}</Text>
                <Text style={styles.collectionChipStatus}>{locked ? 'PREVIEW' : level < availableLevel ? 'EARNED' : 'CURRENT'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.collectionDetail}>
          <Text style={styles.collectionTitle}>Level {collectionLevel} · {profile.stages[collectionLevel - 1]}</Text>
          <Text style={styles.collectionState}>
            {collectionLevel > availableLevel ? 'FUTURE LEVEL · PREVIEW ONLY' : collectionLevel < availableLevel ? 'EARNED LEVEL' : 'CURRENT LEVEL'}
          </Text>
          {currentCollectibles.map((item, index) => (
            <Text key={`${draft}-${collectionLevel}-${index}`} style={styles.collectible}>
              {index + 1}. {item}{collectionLevel > availableLevel ? ' · PREVIEW' : ''}
            </Text>
          ))}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Use selected BUKLOD character"
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
                <Text style={styles.zoomTitle}>{PROGRESSIVE_CHARACTERS[zoom.id].name} · Level {zoom.level}</Text>
                <Text style={styles.zoomStage}>{PROGRESSIVE_CHARACTERS[zoom.id].stages[zoom.level - 1]}</Text>
                <BuklodProgressiveCharacterArt characterId={zoom.id} level={zoom.level} height={500} viewportWidth={300} />
              </>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
