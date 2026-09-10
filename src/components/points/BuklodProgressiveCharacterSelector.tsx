/* BUKLOD_CHARACTER_R31_PROGRESSIVE_SELECTOR_V2_FORWARD_PORT */
import React, { useMemo } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import {
  CHARACTER_DISPLAY_NAME,
  type BuklodCoreCharacterId,
} from '@/lib/buklodCharacterSelectionV2';
import {
  getProgressiveCharacterDisplayState,
  getProgressiveLevelPoints,
  type BuklodProgressiveDisplayState,
  type ProgressiveCharacterId,
} from '@/lib/buklodProgressiveCharacter';

const CHARACTER_ART: Record<ProgressiveCharacterId, any> = {
  phan: require('../../../assets/images/characters/phan_r26.jpg'),
  quin: require('../../../assets/images/characters/quin_r26.jpg'),
  van: require('../../../assets/images/characters/van_r26.jpg'),
  christian: require('../../../assets/images/characters/christian_r26.jpg'),
  lhen: require('../../../assets/images/characters/lhen_r26.jpg'),
};

type Props = {
  displayState?: BuklodProgressiveDisplayState | null;
  activeCharacterId?: ProgressiveCharacterId | null;
  characterLevel?: number;
  characterPointsSinceSelection?: number;
  onUseCharacter?: (id: ProgressiveCharacterId) => void | Promise<void>;
  busyCharacterId?: ProgressiveCharacterId | null;
};

export default function BuklodProgressiveCharacterSelector({
  displayState,
  activeCharacterId = null,
  characterLevel = 1,
  characterPointsSinceSelection = 0,
  onUseCharacter,
  busyCharacterId,
}: Props) {
  const { theme } = useBuklodPresentation();

  const state = useMemo(
    () => displayState ?? getProgressiveCharacterDisplayState({
      activeCharacterId,
      characterLevel,
      characterPointsSinceSelection,
    }),
    [activeCharacterId, characterLevel, characterPointsSinceSelection, displayState],
  );

  const previewLevel = state.currentLevel;
  const pointsAtLevel = getProgressiveLevelPoints(previewLevel);

  return (
    <View style={[styles.shell, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
      <Text style={[styles.eyebrow, { color: theme.accent }]}>ORIGINAL CHARACTER JOURNEY</Text>
      <Text style={[styles.title, { color: theme.textPrimary }]}>Browse all 20 levels</Text>
      <Text style={[styles.helper, { color: theme.textSecondary }]}>
        Level progress follows Character Points earned after the current character was selected. Circle Rank and lifetime points are never reset here.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.characterRow}>
        {state.characters.map((character) => {
          const id = character.id;
          const active = id === state.activeCharacterId;
          const label = CHARACTER_DISPLAY_NAME[id as BuklodCoreCharacterId] ?? id;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`Use ${label}`}
              disabled={!onUseCharacter || busyCharacterId != null || active}
              onPress={() => void onUseCharacter?.(id)}
              style={[
                styles.characterCard,
                {
                  borderColor: active ? theme.accent : theme.border,
                  backgroundColor: theme.surface,
                  opacity: busyCharacterId && busyCharacterId !== id ? 0.55 : 1,
                },
              ]}
            >
              <Image source={CHARACTER_ART[id]} resizeMode="contain" style={styles.characterArt} />
              <Text style={[styles.characterName, { color: theme.textPrimary }]}>{label}</Text>
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                {active ? `Level ${state.currentLevel}` : 'Starts Level 1'}
              </Text>
              <View style={[styles.usePill, { backgroundColor: active ? theme.accentSoft : theme.surfaceElevated }]}>
                <Text style={[styles.useText, { color: active ? theme.accent : theme.textSecondary }]}>
                  {active ? 'ACTIVE' : busyCharacterId === id ? 'SWITCHING…' : 'Use This Character'}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.levelSection}>
        <View style={styles.levelHeadingRow}>
          <Text style={[styles.levelHeading, { color: theme.textPrimary }]}>Level {previewLevel}</Text>
          <Text style={[styles.levelPoints, { color: theme.textMuted }]}>{pointsAtLevel.toLocaleString('en-PH')} Character Points</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelRow}>
          {Array.from({ length: 20 }, (_, index) => index + 1).map((level) => {
            const reached = Boolean(state.activeCharacterId) && level <= state.currentLevel;
            return (
              <View
                key={level}
                accessibilityLabel={`Character level ${level}${reached ? ', reached' : ', preview'}`}
                style={[
                  styles.levelBadge,
                  {
                    borderColor: state.activeCharacterId && level === state.currentLevel ? theme.accent : theme.border,
                    backgroundColor: reached ? theme.accentSoft : theme.surface,
                  },
                ]}
              >
                <Text style={[styles.levelNumber, { color: reached ? theme.accent : theme.textSecondary }]}>{level}</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 7 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 16, fontWeight: '900' },
  helper: { fontSize: 11, lineHeight: 16 },
  characterRow: { gap: 10, paddingVertical: 8, paddingRight: 12 },
  characterCard: { width: 118, borderWidth: 1, borderRadius: 14, padding: 9, alignItems: 'center', gap: 4 },
  characterArt: { width: 76, height: 104 },
  characterName: { fontSize: 12, fontWeight: '900' },
  meta: { fontSize: 9, fontWeight: '800' },
  usePill: { marginTop: 3, minHeight: 28, borderRadius: 9, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  useText: { fontSize: 9, fontWeight: '900' },
  levelSection: { gap: 8 },
  levelHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  levelHeading: { fontSize: 12, fontWeight: '900' },
  levelPoints: { fontSize: 9, fontWeight: '800' },
  levelRow: { gap: 6, paddingRight: 12 },
  levelBadge: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  levelNumber: { fontSize: 11, fontWeight: '900' },
});
