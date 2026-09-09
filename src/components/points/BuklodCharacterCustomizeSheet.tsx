/* BUKLOD_CHARACTER_ENVIRONMENT_SYSTEM_PHASE1 */
/* R31 GOLDEN CHARACTER BASELINE PROTECTED */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import BuklodR31CharacterArt from '@/components/points/BuklodR31CharacterArt';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';
import { BUKLOD_HIT_SLOP } from '@/lib/buklodTouch';
import { R31_LEVEL_THRESHOLDS, r31StageName } from '@/lib/buklodR31Stages';
import {
  CORE_WORLD_IDS,
  WORLD_NAMES,
  WORLD_SIGNATURES,
  getMyBuklodWorldV3,
  initializeMyBuklodWorldV3,
  isCoreWorldCharacter,
  setMyBuklodCharacterActiveV3,
  setMyBuklodWorldDisplayModeV1,
  unlockMyBuklodCharacterV3,
  type BuklodWorldCharacter,
  type BuklodWorldCharacterId,
  type BuklodWorldDisplayMode,
  type BuklodWorldState,
} from '@/lib/buklodCharacterWorldV3';
import type { BuklodCharacterState } from '@/lib/buklodCharacter';

type Props = {
  visible: boolean;
  onClose: () => void;
  userId?: string | null;
  lifetimePoints: number;
  onSaved?: (config: BuklodCharacterState) => void;
};

const ENV_BANDS = [
  { key: 'STARTER', range: 'L1–L4', title: 'Starter Space', copy: 'Simple personal Character corner.' },
  { key: 'GROWING', range: 'L5–L8', title: 'Growing Space', copy: 'Desk, shelf, tools and first decorations.' },
  { key: 'IDENTITY', range: 'L9–L12', title: 'Identity Space', copy: 'Profession and passion become visible.' },
  { key: 'IMPACT', range: 'L13–L16', title: 'Impact Space', copy: 'Community and service objects appear.' },
  { key: 'LEGACY', range: 'L17–L20', title: 'Legacy Space', copy: 'Full signature environment and legacy presentation.' },
] as const;

function CharacterVisual({
  id,
  level,
  height,
  width,
}: {
  id: BuklodWorldCharacterId;
  level: number;
  height: number;
  width: number;
}) {
  const { theme } = useBuklodPresentation();
  if (isCoreWorldCharacter(id)) {
    return <BuklodR31CharacterArt characterId={id} level={level} height={height} viewportWidth={width} />;
  }
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center', padding: 6 }}>
      <MaterialCommunityIcons name="star-four-points-outline" size={Math.min(52, width * 0.48)} color={theme.accent} />
      <Text style={{ marginTop: 6, fontSize: 12, fontWeight: '900', color: theme.textPrimary }}>{WORLD_NAMES[id]}</Text>
      <Text style={{ marginTop: 3, fontSize: 8, lineHeight: 11, textAlign: 'center', color: theme.textMuted }}>{WORLD_SIGNATURES[id]}</Text>
    </View>
  );
}

export default function BuklodCharacterCustomizeSheet({
  visible,
  onClose,
  userId,
}: Props) {
  const { theme } = useBuklodPresentation();
  const drawerBottomInset = useBuklodDrawerBottomInset();
  const [world, setWorld] = useState<BuklodWorldState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [previewLevel, setPreviewLevel] = useState(1);

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.overlay },
    sheet: { height: '95%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', backgroundColor: theme.surface },
    header: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
    headerCopy: { flex: 1 },
    title: { fontSize: 20, fontWeight: '900', color: theme.textPrimary },
    subtitle: { marginTop: 3, fontSize: 10, lineHeight: 14, color: theme.textMuted },
    body: { padding: 14, paddingBottom: 28 },
    loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 10 },
    loadingText: { fontSize: 11, fontWeight: '800', color: theme.textMuted },
    hero: { borderRadius: 20, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceElevated, padding: 12 },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: 13 },
    artBox: { width: 114, height: 186, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentSoft },
    heroCopy: { flex: 1, minWidth: 0 },
    eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 0.9, color: theme.accent },
    heroName: { marginTop: 3, fontSize: 21, fontWeight: '900', color: theme.textPrimary },
    heroMeta: { marginTop: 4, fontSize: 10, lineHeight: 15, fontWeight: '700', color: theme.textSecondary },
    pillRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    pill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.border },
    pillText: { fontSize: 8, fontWeight: '900', color: theme.accent },
    modeRow: { marginTop: 11, flexDirection: 'row', gap: 8 },
    modeButton: { flex: 1, minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface },
    modeOn: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
    modeText: { fontSize: 9, fontWeight: '900', color: theme.textSecondary },
    modeTextOn: { color: theme.accent },
    section: { marginTop: 18 },
    sectionTitle: { fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8, color: theme.textMuted, marginBottom: 9 },
    starterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    starterCard: { width: '47.8%', borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceElevated, padding: 10, alignItems: 'center' },
    starterName: { marginTop: 7, fontSize: 13, fontWeight: '900', color: theme.textPrimary },
    starterMeta: { marginTop: 3, fontSize: 8, lineHeight: 11, fontWeight: '700', textAlign: 'center', color: theme.textMuted },
    action: { marginTop: 8, minHeight: 34, paddingHorizontal: 10, borderRadius: 10, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
    actionText: { fontSize: 8.5, fontWeight: '900', color: '#fff' },
    unlockedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
    charChip: { minWidth: 96, maxWidth: 132, minHeight: 78, padding: 9, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
    charChipOn: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
    charName: { marginTop: 5, fontSize: 10.5, fontWeight: '900', color: theme.textPrimary },
    charStatus: { marginTop: 2, fontSize: 7.5, fontWeight: '900', color: theme.textMuted },
    nextUnlock: { padding: 12, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceElevated },
    nextRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    nextCopy: { flex: 1 },
    nextName: { fontSize: 14, fontWeight: '900', color: theme.textPrimary },
    nextMeta: { marginTop: 3, fontSize: 9, lineHeight: 14, color: theme.textMuted },
    levelScroll: { gap: 8, paddingBottom: 4 },
    levelCard: { width: 92, minHeight: 142, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceElevated, overflow: 'hidden', alignItems: 'center', paddingBottom: 8 },
    levelCardOn: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
    levelDim: { opacity: 0.48 },
    levelLabel: { marginTop: 4, fontSize: 9, fontWeight: '900', color: theme.textPrimary },
    stageLabel: { marginTop: 2, paddingHorizontal: 4, fontSize: 7.5, lineHeight: 10, fontWeight: '700', textAlign: 'center', color: theme.textMuted },
    preview: { marginTop: 10, minHeight: 306, borderRadius: 18, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceElevated, padding: 12, alignItems: 'center', overflow: 'hidden' },
    previewTitle: { fontSize: 15, fontWeight: '900', color: theme.textPrimary },
    previewMeta: { marginTop: 3, fontSize: 9, color: theme.textMuted },
    environment: { padding: 13, borderRadius: 18, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceElevated },
    envHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    envCopy: { flex: 1 },
    envName: { fontSize: 15, fontWeight: '900', color: theme.textPrimary },
    envMeta: { marginTop: 3, fontSize: 9, lineHeight: 14, color: theme.textSecondary },
    bandRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    band: { minWidth: 94, flexGrow: 1, flexBasis: '30%', padding: 8, borderRadius: 11, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
    bandOn: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
    bandRange: { fontSize: 8, fontWeight: '900', color: theme.accent },
    bandTitle: { marginTop: 2, fontSize: 9, fontWeight: '900', color: theme.textPrimary },
    bandCopy: { marginTop: 2, fontSize: 7.5, lineHeight: 10, color: theme.textMuted },
    mystery: { marginTop: 10, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.accentSoft },
    mysteryTitle: { fontSize: 10, fontWeight: '900', color: theme.accent },
    mysteryBody: { marginTop: 3, fontSize: 9, lineHeight: 13, color: theme.textSecondary },
    worldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
    worldCard: { width: '47.8%', minHeight: 90, padding: 11, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceElevated },
    worldCardTitle: { marginTop: 7, fontSize: 10.5, fontWeight: '900', color: theme.textPrimary },
    worldCardMeta: { marginTop: 3, fontSize: 8.5, lineHeight: 12, color: theme.textMuted },
    rule: { marginTop: 18, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.accentSoft, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
    ruleText: { flex: 1, fontSize: 9.5, lineHeight: 14, fontWeight: '700', color: theme.textSecondary },
  }), [theme]);

  const reload = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const next = await getMyBuklodWorldV3(true);
      setWorld(next);
      setPreviewLevel(Math.max(1, Math.min(20, next.character_level ?? 1)));
    } catch (error: unknown) {
      Alert.alert('MY BUKLOD WORLD', error instanceof Error ? error.message : 'Could not load your Character World.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && userId) void reload();
  }, [visible, userId]);

  const mutate = async (key: string, run: () => Promise<BuklodWorldState>) => {
    if (busy) return;
    setBusy(key);
    try {
      const next = await run();
      setWorld(next);
      setPreviewLevel(Math.max(1, Math.min(20, next.character_level ?? 1)));
    } catch (error: unknown) {
      Alert.alert('BUKLOD Character', error instanceof Error ? error.message : 'Action could not be completed.');
    } finally {
      setBusy(null);
    }
  };

  const activeId = world?.active_character_id;
  const activeLevel = Math.max(1, Math.min(20, world?.character_level ?? 1));
  const stageKey = world?.environment?.stage?.key ?? 'STARTER';
  const unlocked = world?.unlocked_characters ?? [];
  const starterChoices = world?.starter_choices ?? CORE_WORLD_IDS.map((id) => ({
    character_id: id,
    display_name: WORLD_NAMES[id],
    character_kind: 'CORE' as const,
  }));

  const setMode = (mode: BuklodWorldDisplayMode) => {
    if (!world?.initialized || world.display_mode === mode) return;
    void mutate(`mode-${mode}`, () => setMyBuklodWorldDisplayModeV1(mode));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: drawerBottomInset }]} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>MY BUKLOD WORLD</Text>
              <Text style={styles.subtitle}>Character identity • Stage • Collectibles • Environment • Progress</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={BUKLOD_HIT_SLOP} accessibilityLabel="Close My BUKLOD World">
              <MaterialCommunityIcons name="close" size={24} color={theme.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator>
            {loading && !world ? (
              <View style={styles.loading}>
                <ActivityIndicator color={theme.accent} />
                <Text style={styles.loadingText}>Loading your BUKLOD World…</Text>
              </View>
            ) : null}

            {!loading && !userId ? (
              <View style={styles.loading}>
                <MaterialCommunityIcons name="account-lock-outline" size={38} color={theme.textMuted} />
                <Text style={styles.loadingText}>Sign in to open MY BUKLOD WORLD.</Text>
              </View>
            ) : null}

            {world && !world.initialized ? (
              <>
                <View style={styles.hero}>
                  <Text style={styles.eyebrow}>START YOUR CHARACTER JOURNEY</Text>
                  <Text style={styles.heroName}>Choose one starter Character</Text>
                  <Text style={styles.heroMeta}>Only your chosen starter unlocks now. Other Characters unlock manually, one at a time, every +2 Circle Rank steps. Circle Rank and Lifetime Points never reset.</Text>
                </View>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>STARTER CHARACTERS</Text>
                  <View style={styles.starterGrid}>
                    {starterChoices.map((row) => (
                      <View key={row.character_id} style={styles.starterCard}>
                        <CharacterVisual id={row.character_id} level={1} height={132} width={86} />
                        <Text style={styles.starterName}>{row.display_name}</Text>
                        <Text style={styles.starterMeta}>{WORLD_SIGNATURES[row.character_id]}</Text>
                        <Pressable style={styles.action} disabled={!!busy} onPress={() => void mutate(`starter-${row.character_id}`, () => initializeMyBuklodWorldV3(row.character_id))}>
                          {busy === `starter-${row.character_id}` ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.actionText}>START WITH {row.display_name.toUpperCase()}</Text>}
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            ) : null}

            {world?.initialized && activeId ? (
              <>
                <View style={styles.hero}>
                  <View style={styles.heroTop}>
                    <View style={styles.artBox}><CharacterVisual id={activeId} level={activeLevel} height={186} width={114} /></View>
                    <View style={styles.heroCopy}>
                      <Text style={styles.eyebrow}>MY CHARACTER</Text>
                      <Text style={styles.heroName}>{WORLD_NAMES[activeId]}</Text>
                      <Text style={styles.heroMeta}>Level {activeLevel} · {r31StageName(activeId, activeLevel)}</Text>
                      <Text style={styles.heroMeta}>{world.circle_rank_name} · Circle Rank #{world.circle_rank_order}</Text>
                      <View style={styles.pillRow}>
                        <View style={styles.pill}><Text style={styles.pillText}>{world.environment?.stage?.title ?? 'Starter Space'}</Text></View>
                        <View style={styles.pill}><Text style={styles.pillText}>{world.display_mode ?? 'FULL'} MODE</Text></View>
                      </View>
                    </View>
                  </View>
                  <View style={styles.modeRow}>
                    {(['FULL', 'MINIMAL'] as BuklodWorldDisplayMode[]).map((mode) => (
                      <Pressable key={mode} style={[styles.modeButton, world.display_mode === mode && styles.modeOn]} onPress={() => setMode(mode)} disabled={!!busy}>
                        <Text style={[styles.modeText, world.display_mode === mode && styles.modeTextOn]}>{mode === 'FULL' ? 'FULL CHARACTER MODE' : 'MINIMAL MODE'}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>UNLOCKED CHARACTERS</Text>
                  <View style={styles.unlockedRow}>
                    {unlocked.map((row: BuklodWorldCharacter) => {
                      const active = row.character_id === activeId;
                      return (
                        <Pressable key={row.character_id} style={[styles.charChip, active && styles.charChipOn]} disabled={!!busy || active} onPress={() => void mutate(`active-${row.character_id}`, () => setMyBuklodCharacterActiveV3(row.character_id))}>
                          <MaterialCommunityIcons name={row.character_kind === 'SPECIAL' ? 'star-four-points-outline' : 'account-star-outline'} size={24} color={active ? theme.accent : theme.textSecondary} />
                          <Text style={styles.charName}>{row.display_name}</Text>
                          <Text style={styles.charStatus}>{active ? `ACTIVE · L${activeLevel}` : 'SELECT → LEVEL 1'}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {world.next_unlock ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>NEXT CHARACTER UNLOCK</Text>
                    <View style={styles.nextUnlock}>
                      <View style={styles.nextRow}>
                        <MaterialCommunityIcons name={world.next_unlock.revealed ? 'account-star-outline' : 'lock-question'} size={30} color={world.next_unlock.can_unlock ? theme.accent : theme.textMuted} />
                        <View style={styles.nextCopy}>
                          <Text style={styles.nextName}>{world.next_unlock.display_name}</Text>
                          <Text style={styles.nextMeta}>Required Circle Rank #{world.next_unlock.required_rank_order}. Eligibility does not auto-unlock the Character.</Text>
                        </View>
                        {world.next_unlock.can_unlock && world.next_unlock.character_id ? (
                          <Pressable style={styles.action} disabled={!!busy} onPress={() => void mutate(`unlock-${world.next_unlock?.character_id}`, () => unlockMyBuklodCharacterV3(world.next_unlock!.character_id!))}>
                            {busy?.startsWith('unlock-') ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.actionText}>UNLOCK</Text>}
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ) : null}

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>JOURNEY MAP · LEVEL 1–20</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelScroll}>
                    {R31_LEVEL_THRESHOLDS.map((threshold, index) => {
                      const level = index + 1;
                      const current = level === previewLevel;
                      const locked = level > activeLevel;
                      return (
                        <Pressable key={level} style={[styles.levelCard, current && styles.levelCardOn, locked && styles.levelDim]} onPress={() => setPreviewLevel(level)}>
                          <CharacterVisual id={activeId} level={level} height={104} width={76} />
                          <Text style={styles.levelLabel}>LEVEL {level}</Text>
                          <Text style={styles.stageLabel}>{r31StageName(activeId, level)}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <View style={styles.preview}>
                    <Text style={styles.previewTitle}>{WORLD_NAMES[activeId]} · Level {previewLevel}</Text>
                    <Text style={styles.previewMeta}>{r31StageName(activeId, previewLevel)} · {R31_LEVEL_THRESHOLDS[previewLevel - 1].toLocaleString()} PTS</Text>
                    <CharacterVisual id={activeId} level={previewLevel} height={250} width={166} />
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>MY SPACE · ENVIRONMENT EVOLUTION</Text>
                  <View style={styles.environment}>
                    <View style={styles.envHeader}>
                      <MaterialCommunityIcons name="home-variant-outline" size={28} color={theme.accent} />
                      <View style={styles.envCopy}>
                        <Text style={styles.envName}>{world.environment?.signature_name ?? `${WORLD_NAMES[activeId]} Journey Space`}</Text>
                        <Text style={styles.envMeta}>{WORLD_SIGNATURES[activeId]}</Text>
                      </View>
                    </View>
                    <View style={styles.bandRow}>
                      {ENV_BANDS.map((band) => (
                        <View key={band.key} style={[styles.band, stageKey === band.key && styles.bandOn]}>
                          <Text style={styles.bandRange}>{band.range}</Text>
                          <Text style={styles.bandTitle}>{band.title}</Text>
                          <Text style={styles.bandCopy}>{band.copy}</Text>
                        </View>
                      ))}
                    </View>
                    {activeLevel < 20 ? (
                      <View style={styles.mystery}>
                        <Text style={styles.mysteryTitle}>ENVIRONMENT PREVIEW</Text>
                        <Text style={styles.mysteryBody}>A future space upgrade is waiting ahead. Continue your Character Journey to reveal the next environment stage.</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>MY BUKLOD WORLD</Text>
                  <View style={styles.worldGrid}>
                    <View style={styles.worldCard}><MaterialCommunityIcons name="map-marker-path" size={23} color={theme.accent} /><Text style={styles.worldCardTitle}>Journey Map</Text><Text style={styles.worldCardMeta}>Stage {activeLevel} of 20</Text></View>
                    <View style={styles.worldCard}><MaterialCommunityIcons name="bookshelf" size={23} color={theme.accent} /><Text style={styles.worldCardTitle}>Collection Shelf</Text><Text style={styles.worldCardMeta}>Visible world-building foundation</Text></View>
                    <View style={styles.worldCard}><MaterialCommunityIcons name="medal-outline" size={23} color={theme.accent} /><Text style={styles.worldCardTitle}>Badges & Titles</Text><Text style={styles.worldCardMeta}>Achievement display foundation</Text></View>
                    <View style={styles.worldCard}><MaterialCommunityIcons name="chart-timeline-variant" size={23} color={theme.accent} /><Text style={styles.worldCardTitle}>My Progress</Text><Text style={styles.worldCardMeta}>{(world.character_points_since_selection ?? 0).toLocaleString()} Character pts since selection</Text></View>
                  </View>
                </View>

                <View style={styles.rule}>
                  <MaterialCommunityIcons name="shield-check-outline" size={21} color={theme.accent} />
                  <Text style={styles.ruleText}>Changing Character resets only that Character journey to Level 1. Circle Rank and Lifetime Points remain unchanged. Characters become eligible sequentially every +2 Circle Rank steps and still require manual unlock.</Text>
                </View>
              </>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
