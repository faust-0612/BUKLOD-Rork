/* BUKLOD_CHARACTER_SELECTION_V2_R31_R40_FORWARD_PORT */
import React, { useEffect, useState } from 'react';
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

import BuklodProgressiveCharacterSelector
  from '@/components/points/BuklodProgressiveCharacterSelector';
import BuklodSpecialCharacterSeries
  from '@/components/points/BuklodSpecialCharacterSeries';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';
import { BUKLOD_HIT_SLOP } from '@/lib/buklodTouch';
import {
  CHARACTER_DISPLAY_NAME,
  CORE_CHARACTER_ORDER,
  getMyBuklodCharacterSelectionV2,
  setMyBuklodCharacterActiveV2,
  subscribeBuklodCharacterSelectionV2,
  type BuklodCharacterId,
  type BuklodCharacterSelectionV2State,
} from '@/lib/buklodCharacterSelectionV2';
import type { BuklodCharacterState } from '@/lib/buklodCharacter';
import type { ProgressiveCharacterId } from '@/lib/buklodProgressiveCharacter';

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

  const choose = async (id: BuklodCharacterId) => {
    if (!userId || busyId || state?.active_character_id === id) return;
    setBusyId(id);
    try {
      // V2 is the single activation authority. The server validates Special eligibility,
      // preserves Circle Rank/lifetime points, and resets the newly selected character to Level 1.
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

  const activeCoreId = state && CORE_CHARACTER_ORDER.includes(
    state.active_character_id as ProgressiveCharacterId,
  )
    ? state.active_character_id as ProgressiveCharacterId
    : null;

  const busyCoreId = busyId && CORE_CHARACTER_ORDER.includes(
    busyId as ProgressiveCharacterId,
  )
    ? busyId as ProgressiveCharacterId
    : null;

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

            {state ? (
              <BuklodProgressiveCharacterSelector
                activeCharacterId={activeCoreId}
                characterLevel={activeCoreId ? state.character_level : 1}
                characterPointsSinceSelection={activeCoreId ? state.character_points_since_selection : 0}
                busyCharacterId={busyCoreId}
                onUseCharacter={(id) => choose(id)}
              />
            ) : null}

            {visible && state ? (
              <BuklodSpecialCharacterSeries
                userId={userId}
                selectionState={state}
                onSelectionStateChange={setState}
              />
            ) : null}

            <View style={[styles.ruleCard, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
              <MaterialCommunityIcons name="shield-check-outline" size={20} color={theme.accent} />
              <Text style={[styles.ruleText, { color: theme.textSecondary }]}>
                Character switching never resets Circle Points or Circle Rank. Special eligibility is enforced by the server, locked Special Characters stay hidden, and each newly selected Character begins its own progression at Level 1.
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
  content: { padding: 14, paddingBottom: 28, gap: 14 },
  loadingBox: { minHeight: 80, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { fontSize: 11, fontWeight: '700' },
  statusCard: { padding: 14, borderRadius: 17, borderWidth: 1 },
  statusEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statusName: { marginTop: 4, fontSize: 18, fontWeight: '900' },
  statusMeta: { marginTop: 3, fontSize: 10.5, fontWeight: '700' },
  ruleCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  ruleText: { flex: 1, fontSize: 10, lineHeight: 15, fontWeight: '700' },
});
