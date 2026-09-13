/* BUKLOD_CHARACTER_R31_FORWARD_PORT_V2_SAFE */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BuklodProgressiveCharacterArt from '@/components/points/BuklodProgressiveCharacterArt';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
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
  const [previewId, setPreviewId] = useState<ProgressiveCharacterId>(activeCore ?? 'phan');
  const [previewLevel, setPreviewLevel] = useState(activeCore ? state.character_level : 1);
  const [busyId, setBusyId] = useState<ProgressiveCharacterId | null>(null);

  const currentLevel = activeCore === previewId ? state.character_level : 1;
  const profile = PROGRESSIVE_CHARACTERS[previewId];
  const collectibles = useMemo(
    () => collectibleNames(previewId, previewLevel),
    [previewId, previewLevel],
  );

  const choose = async (id: ProgressiveCharacterId) => {
    if (!userId || busyId || state.active_character_id === id) return;
    setBusyId(id);
    try {
      /* V2/server authority: switching Character atomically starts the new selection at Level 1. */
      await saveProgressiveCharacter(userId, id);
      setPreviewId(id);
      setPreviewLevel(1);
      await onStateRefresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[styles.shell, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>Core Character Journey</Text>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>
        Browse all 20 levels. Circle Rank and lifetime points stay intact, while every newly selected Character starts at Level 1.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.characterRail}>
        {PROGRESSIVE_CHARACTER_ORDER.map((id) => {
          const selected = previewId === id;
          const active = state.active_character_id === id;
          const level = active ? state.character_level : 1;
          return (
            <Pressable
              key={id}
              onPress={() => {
                setPreviewId(id);
                setPreviewLevel(level);
              }}
              style={[
                styles.characterCard,
                { borderColor: selected ? theme.accent : theme.border, backgroundColor: theme.surface },
              ]}
            >
              <BuklodProgressiveCharacterArt characterId={id} level={level} height={110} viewportWidth={78} />
              <Text style={[styles.characterName, { color: theme.textPrimary }]}>{PROGRESSIVE_CHARACTERS[id].name}</Text>
              <Text style={[styles.meta, { color: active ? theme.accent : theme.textMuted }]}>
                {active ? `ACTIVE · LEVEL ${level}` : 'STARTS LEVEL 1'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.preview, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <View style={styles.previewArt}>
          <BuklodProgressiveCharacterArt characterId={previewId} level={previewLevel} height={220} viewportWidth={150} />
        </View>
        <View style={styles.previewCopy}>
          <Text style={[styles.previewName, { color: theme.textPrimary }]}>
            {profile.name} · Level {previewLevel}
          </Text>
          <Text style={[styles.stage, { color: theme.textSecondary }]}>{profile.stages[previewLevel - 1]}</Text>
          <Text style={[styles.previewRule, { color: theme.textMuted }]}>
            {previewLevel <= currentLevel
              ? previewLevel === currentLevel
                ? 'CURRENT / AVAILABLE LEVEL'
                : 'EARLIER LEVEL'
              : 'FUTURE ART PREVIEW — NOT YET EARNED'}
          </Text>
          {state.active_character_id !== previewId ? (
            <Pressable
              disabled={!userId || Boolean(busyId)}
              onPress={() => void choose(previewId)}
              style={[styles.useButton, { backgroundColor: theme.accent }, busyId && styles.disabled]}
            >
              {busyId === previewId ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
                <Text style={styles.useButtonText}>Use This Character</Text>
              )}
            </Pressable>
          ) : (
            <View style={[styles.activePill, { backgroundColor: theme.accentSoft }]}>
              <Text style={[styles.activePillText, { color: theme.accent }]}>ACTIVE CHARACTER</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelRail}>
        {Array.from({ length: 20 }, (_, index) => index + 1).map((level) => {
          const current = level === previewLevel;
          const earned = level <= currentLevel;
          return (
            <Pressable
              key={`${previewId}-${level}`}
              onPress={() => setPreviewLevel(level)}
              style={[
                styles.levelChip,
                { borderColor: current ? theme.accent : theme.border, backgroundColor: current ? theme.accentSoft : theme.surface },
              ]}
            >
              <Text style={[styles.levelNumber, { color: current ? theme.accent : theme.textPrimary }]}>L{level}</Text>
              <Text style={[styles.levelState, { color: theme.textMuted }]}>{earned ? 'VIEW' : 'PREVIEW'}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.collectibleBox, { borderColor: theme.border }]}>
        <Text style={[styles.collectibleTitle, { color: theme.textPrimary }]}>Level {previewLevel} Collectibles</Text>
        {collectibles.map((item, index) => (
          <Text key={`${item}-${index}`} style={[styles.collectibleText, { color: theme.textSecondary }]}>
            {index + 1}. {item}{previewLevel > currentLevel ? ' · PREVIEW' : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { marginTop: 12, padding: 12, borderWidth: 1, borderRadius: 18 },
  title: { fontSize: 14, fontWeight: '900' },
  hint: { marginTop: 4, fontSize: 10, lineHeight: 15 },
  characterRail: { gap: 8, paddingVertical: 10 },
  characterCard: { width: 102, minHeight: 154, borderWidth: 1, borderRadius: 14, padding: 8, alignItems: 'center' },
  characterName: { marginTop: 5, fontSize: 11, fontWeight: '900' },
  meta: { marginTop: 2, fontSize: 8, fontWeight: '900', textAlign: 'center' },
  preview: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 16, padding: 10, alignItems: 'center' },
  previewArt: { width: 154, height: 224, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  previewCopy: { flex: 1, minWidth: 0 },
  previewName: { fontSize: 14, fontWeight: '900' },
  stage: { marginTop: 3, fontSize: 11, fontWeight: '800' },
  previewRule: { marginTop: 6, fontSize: 9, lineHeight: 13, fontWeight: '800' },
  useButton: { marginTop: 10, minHeight: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  useButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  activePill: { marginTop: 10, minHeight: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  activePillText: { fontSize: 9, fontWeight: '900' },
  levelRail: { gap: 6, paddingVertical: 10 },
  levelChip: { minWidth: 48, paddingHorizontal: 8, paddingVertical: 7, borderWidth: 1, borderRadius: 10, alignItems: 'center' },
  levelNumber: { fontSize: 10, fontWeight: '900' },
  levelState: { marginTop: 2, fontSize: 7, fontWeight: '800' },
  collectibleBox: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 9 },
  collectibleTitle: { fontSize: 11, fontWeight: '900', marginBottom: 5 },
  collectibleText: { fontSize: 9, lineHeight: 15 },
});
