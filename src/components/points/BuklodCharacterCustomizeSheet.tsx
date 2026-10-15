/* BUKLOD_CHARACTER_WEB_FORMAT_PARITY_R22 */
/* BUKLOD_CHARACTER_R31_R40_LAYOUT_HOST_LOCK_V3 */
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

import BuklodActiveCharacterArt from '@/components/points/BuklodActiveCharacterArt';
import BuklodProgressiveCharacterSelector from '@/components/points/BuklodProgressiveCharacterSelector';
import BuklodSpecialCharacterSeries from '@/components/points/BuklodSpecialCharacterSeries';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { DEFAULT_CHARACTER, type BuklodCharacterState } from '@/lib/buklodCharacter';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';
import { BUKLOD_HIT_SLOP } from '@/lib/buklodTouch';
import {
  CHARACTER_DISPLAY_NAME,
  getMyBuklodCharacterSelectionV2,
  subscribeBuklodCharacterSelectionV2,
  type BuklodCharacterSelectionV2State,
} from '@/lib/buklodCharacterSelectionV2';

type Props = {
  visible: boolean;
  onClose: () => void;
  userId?: string | null;
  lifetimePoints: number;
  onSaved?: (config: BuklodCharacterState) => void;
};

export default function BuklodCharacterCustomizeSheet({ visible, onClose, userId }: Props) {
  const { theme } = useBuklodPresentation();
  const drawerBottomInset = useBuklodDrawerBottomInset();
  const [state, setState] = useState<BuklodCharacterSelectionV2State | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshState = async () => {
    if (!userId) return;
    const next = await getMyBuklodCharacterSelectionV2(userId, true);
    setState(next);
  };

  useEffect(() => {
    if (!visible || !userId) return;
    let mounted = true;
    setLoading(true);

    void getMyBuklodCharacterSelectionV2(userId, true)
      .then(
        (next) => { if (mounted) setState(next); },
        (error: unknown) => {
          if (mounted) {
            Alert.alert(
              'BUKLOD Character',
              error instanceof Error ? error.message : 'Could not load Character Selection.',
            );
          }
        },
      )
      .finally(() => { if (mounted) setLoading(false); });

    const unsubscribe = subscribeBuklodCharacterSelectionV2((changedUserId, next) => {
      if (mounted && changedUserId === userId) setState(next);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [userId, visible]);

  const activeName = state
    ? CHARACTER_DISPLAY_NAME[state.active_character_id]
    : 'BUKLOD Character';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: drawerBottomInset }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Customize Character</Text>
              <Text style={[styles.localNote, { color: theme.textMuted }]}>R31 Core + R40 Special Character Journey</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={BUKLOD_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Close Character"
            >
              <MaterialCommunityIcons name="close" size={23} color={theme.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {loading && !state ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={theme.accent} />
                <Text style={[styles.loadingText, { color: theme.textMuted }]}>Loading Character state…</Text>
              </View>
            ) : null}

            {state ? (
              <>
                <View style={[styles.heroRow, { borderColor: theme.border, backgroundColor: theme.accentSoft }]}>
                  <View style={styles.heroArt}>
                    <BuklodActiveCharacterArt
                      fallbackCharacter={DEFAULT_CHARACTER}
                      height={154}
                      viewportWidth={128}
                      showStage
                      showEffects
                    />
                  </View>
                  <View style={styles.heroMeta}>
                    <View style={[styles.levelPill, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                      <MaterialCommunityIcons name="star-circle" size={13} color={theme.accent} />
                      <Text style={[styles.levelText, { color: theme.accent }]}>LEVEL {state.character_level}</Text>
                    </View>
                    <Text style={[styles.heroTitle, { color: theme.textPrimary }]}>{activeName}</Text>
                    <Text style={[styles.heroHint, { color: theme.textSecondary }]}>
                      Your current Character is server-authoritative. Changing Character starts the newly selected Character at Level 1; Circle Points and Circle Rank stay intact.
                    </Text>
                    <Text style={[styles.rankMeta, { color: theme.textMuted }]}>
                      {state.circle_rank_name} · Circle Rank #{state.circle_rank_order}
                    </Text>
                  </View>
                </View>

                <BuklodProgressiveCharacterSelector userId={userId} state={state} onStateRefresh={refreshState} />
                <BuklodSpecialCharacterSeries userId={userId} state={state} onStateRefresh={refreshState} />
              </>
            ) : !loading ? (
              <View style={[styles.emptyCard, { borderColor: theme.border }]}>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  Character state is unavailable. No selection, Circle Points, or Circle Rank data was changed.
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.50)' },
  sheet: { height: '94%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 19, fontWeight: '900' },
  localNote: { marginTop: 2, fontSize: 10 },
  bodyScroll: { flex: 1 },
  bodyContent: { paddingBottom: 22 },
  loadingBox: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { fontSize: 11, fontWeight: '700' },
  heroRow: { marginTop: 12, marginHorizontal: 14, minHeight: 188, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  heroArt: { width: 128, height: 170, flexShrink: 0, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 18 },
  heroMeta: { flex: 1, minWidth: 0 },
  levelPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  levelText: { fontSize: 10, fontWeight: '900' },
  heroTitle: { marginTop: 9, fontSize: 14, fontWeight: '900' },
  heroHint: { marginTop: 4, fontSize: 10, lineHeight: 14 },
  rankMeta: { marginTop: 7, fontSize: 9, lineHeight: 13, fontWeight: '800' },
  emptyCard: { margin: 14, padding: 14, borderWidth: 1, borderRadius: 14 },
  emptyText: { fontSize: 10, lineHeight: 15, fontWeight: '700' },
});
