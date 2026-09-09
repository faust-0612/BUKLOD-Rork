/* BUKLOD_CHARACTER_SELECTION_V2_VISIBLE_SELECTOR */
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

import BuklodSpecialCharacterArtV2
  from '@/components/points/BuklodSpecialCharacterArtV2';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';
import { BUKLOD_HIT_SLOP } from '@/lib/buklodTouch';
import {
  CHARACTER_DISPLAY_NAME,
  CORE_CHARACTER_ORDER,
  SPECIAL_CHARACTER_ORDER,
  getMyBuklodCharacterSelectionV2,
  setMyBuklodCharacterActiveV2,
  subscribeBuklodCharacterSelectionV2,
  type BuklodCharacterId,
  type BuklodCharacterSelectionV2State,
  type BuklodSpecialCharacterId,
} from '@/lib/buklodCharacterSelectionV2';
import type { BuklodCharacterState } from '@/lib/buklodCharacter';

type Props = {
  visible: boolean;
  onClose: () => void;
  userId?: string | null;
  lifetimePoints: number;
  onSaved?: (config: BuklodCharacterState) => void;
};

export default function BuklodCharacterCustomizeSheet({
  visible,
  onClose,
  userId,
}: Props) {
  const { theme } = useBuklodPresentation();
  const drawerBottomInset = useBuklodDrawerBottomInset();
  const [state, setState] = useState<BuklodCharacterSelectionV2State | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<BuklodCharacterId | null>(null);

  useEffect(() => {
    if (!visible || !userId) return;
    let mounted = true;
    setLoading(true);

    void getMyBuklodCharacterSelectionV2(userId, true).then(
      (next) => {
        if (mounted) setState(next);
      },
      (error: unknown) => {
        if (mounted) {
          Alert.alert(
            'BUKLOD Character',
            error instanceof Error
              ? error.message
              : 'Could not load Character Selection.',
          );
        }
      },
    ).finally(() => {
      if (mounted) setLoading(false);
    });

    const unsubscribe = subscribeBuklodCharacterSelectionV2(
      (changedUserId, next) => {
        if (mounted && changedUserId === userId) setState(next);
      },
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [userId, visible]);

  const visibleSpecials = useMemo(() => {
    const unlocked = new Set(state?.visible_special_character_ids ?? []);
    return SPECIAL_CHARACTER_ORDER.filter((id) => unlocked.has(id));
  }, [state?.visible_special_character_ids]);

  const choose = async (id: BuklodCharacterId) => {
    if (!userId || busyId || state?.active_character_id === id) return;
    setBusyId(id);
    try {
      const next = await setMyBuklodCharacterActiveV2(userId, id);
      setState(next);
    } catch (error: unknown) {
      Alert.alert(
        'BUKLOD Character',
        error instanceof Error ? error.message : 'Could not change Character.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const renderCore = (id: typeof CORE_CHARACTER_ORDER[number]) => {
    const active = state?.active_character_id === id;
    const level = active ? state?.character_level ?? 1 : 1;

    return (
      <Pressable
        key={id}
        onPress={() => void choose(id)}
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: active ? theme.accent : theme.border },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Select ${CHARACTER_DISPLAY_NAME[id]}`}
      >
        <View
          style={[
            styles.coreBadge,
            { backgroundColor: theme.accentSoft, borderColor: theme.border },
          ]}
        >
          <MaterialCommunityIcons
            name={active ? 'account-star' : 'account-star-outline'}
            size={42}
            color={active ? theme.accent : theme.textSecondary}
          />
          <Text style={[styles.coreInitial, { color: theme.textPrimary }]}>
            {CHARACTER_DISPLAY_NAME[id].slice(0, 1)}
          </Text>
        </View>
        <Text style={[styles.name, { color: theme.textPrimary }]}>
          {CHARACTER_DISPLAY_NAME[id]}
        </Text>
        <Text style={[styles.meta, { color: theme.textMuted }]}>
          {active ? `LEVEL ${level}` : 'STARTS LEVEL 1'}
        </Text>
        {active ? (
          <View style={[styles.activePill, { backgroundColor: theme.accentSoft }]}>
            <MaterialCommunityIcons name="check-circle" size={13} color={theme.accent} />
            <Text style={[styles.activeText, { color: theme.accent }]}>ACTIVE</Text>
          </View>
        ) : busyId === id ? (
          <ActivityIndicator size="small" color={theme.accent} />
        ) : null}
      </Pressable>
    );
  };

  const renderSpecial = (id: BuklodSpecialCharacterId) => {
    const active = state?.active_character_id === id;
    const level = active ? state?.character_level ?? 1 : 1;
    return (
      <Pressable
        key={id}
        onPress={() => void choose(id)}
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: active ? theme.accent : theme.border },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Select ${CHARACTER_DISPLAY_NAME[id]}`}
      >
        <View style={styles.specialArtWrap}>
          <BuklodSpecialCharacterArtV2
            characterId={id}
            height={116}
            viewportWidth={104}
          />
        </View>
        <Text style={[styles.name, { color: theme.textPrimary }]}>
          {CHARACTER_DISPLAY_NAME[id]}
        </Text>
        <Text style={[styles.meta, { color: theme.textMuted }]}>
          SPECIAL · {active ? `LEVEL ${level}` : 'STARTS LEVEL 1'}
        </Text>
        {active ? (
          <View style={[styles.activePill, { backgroundColor: theme.accentSoft }]}>
            <MaterialCommunityIcons name="star-four-points" size={13} color={theme.accent} />
            <Text style={[styles.activeText, { color: theme.accent }]}>ACTIVE</Text>
          </View>
        ) : busyId === id ? (
          <ActivityIndicator size="small" color={theme.accent} />
        ) : null}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, paddingBottom: drawerBottomInset },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>BUKLOD Character Selection</Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>Circle Rank stays. Every newly selected Character starts at Level 1.</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={BUKLOD_HIT_SLOP}>
              <MaterialCommunityIcons name="close" size={24} color={theme.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
            {loading && !state ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={theme.accent} />
                <Text style={[styles.loadingText, { color: theme.textMuted }]}>Loading Character state…</Text>
              </View>
            ) : null}

            {state ? (
              <View style={[styles.statusCard, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}>
                <Text style={[styles.statusEyebrow, { color: theme.accent }]}>CURRENT CHARACTER</Text>
                <Text style={[styles.statusName, { color: theme.textPrimary }]}>
                  {CHARACTER_DISPLAY_NAME[state.active_character_id]} · Level {state.character_level}
                </Text>
                <Text style={[styles.statusMeta, { color: theme.textSecondary }]}>
                  {state.circle_rank_name} · Circle Rank #{state.circle_rank_order}
                </Text>
                <Text style={[styles.statusMeta, { color: theme.textMuted }]}>
                  {state.character_points_since_selection.toLocaleString('en-PH')} Character Points since this selection
                </Text>
              </View>
            ) : null}

            <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>ORIGINAL CHARACTERS</Text>
            <View style={styles.grid}>{CORE_CHARACTER_ORDER.map(renderCore)}</View>

            {visibleSpecials.length > 0 ? (
              <>
                <View style={styles.specialHeadingRow}>
                  <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>SPECIAL CHARACTERS</Text>
                  <MaterialCommunityIcons name="star-four-points-outline" size={17} color={theme.accent} />
                </View>
                <Text style={[styles.specialHint, { color: theme.textSecondary }]}>Only Special Characters already unlocked by your canonical Circle Rank appear here.</Text>
                <View style={styles.grid}>{visibleSpecials.map(renderSpecial)}</View>
              </>
            ) : null}

            <View style={[styles.ruleCard, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
              <MaterialCommunityIcons name="shield-check-outline" size={20} color={theme.accent} />
              <Text style={[styles.ruleText, { color: theme.textSecondary }]}>
                Character switching never resets Circle Points or Circle Rank. Special eligibility is enforced by the server, and locked Special Characters are not shown.
              </Text>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.50)' },
  sheet: { height: '94%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  header: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 19, fontWeight: '900' },
  subtitle: { marginTop: 3, fontSize: 10.5, lineHeight: 14 },
  content: { padding: 14, paddingBottom: 28 },
  loadingBox: { minHeight: 80, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { fontSize: 11, fontWeight: '700' },
  statusCard: { padding: 14, borderRadius: 17, borderWidth: 1, marginBottom: 18 },
  statusEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statusName: { marginTop: 4, fontSize: 18, fontWeight: '900' },
  statusMeta: { marginTop: 3, fontSize: 10.5, fontWeight: '700' },
  sectionEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 0.9, marginBottom: 9 },
  specialHeadingRow: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
  specialHint: { marginTop: -4, marginBottom: 10, fontSize: 10, lineHeight: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '47.8%', minHeight: 190, borderRadius: 17, borderWidth: 1.5, padding: 10, alignItems: 'center' },
  coreBadge: { width: 92, height: 116, alignItems: 'center', justifyContent: 'center', gap: 2, overflow: 'hidden', borderRadius: 14, borderWidth: 1 },
  coreInitial: { marginTop: -3, fontSize: 20, fontWeight: '900' },
  specialArtWrap: { width: 104, height: 116, borderRadius: 13, overflow: 'hidden' },
  name: { marginTop: 7, fontSize: 13, fontWeight: '900' },
  meta: { marginTop: 3, fontSize: 8.5, fontWeight: '900', textAlign: 'center' },
  activePill: { marginTop: 7, minHeight: 25, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, borderRadius: 999 },
  activeText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  ruleCard: { marginTop: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  ruleText: { flex: 1, fontSize: 10, lineHeight: 15, fontWeight: '700' },
});
