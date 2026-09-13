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

import BuklodProgressiveCharacterSelector from '@/components/points/BuklodProgressiveCharacterSelector';
import BuklodSpecialCharacterSeries from '@/components/points/BuklodSpecialCharacterSeries';
import { useBuklodPresentation } from '@/hooks/useBuklodPresentation';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';
import { BUKLOD_HIT_SLOP } from '@/lib/buklodTouch';
import {
  CHARACTER_DISPLAY_NAME,
  getMyBuklodCharacterSelectionV2,
  subscribeBuklodCharacterSelectionV2,
  type BuklodCharacterSelectionV2State,
} from '@/lib/buklodCharacterSelectionV2';
import type { BuklodCharacterState } from '@/lib/buklodCharacter';

type Props = {
  visible: boolean;
  onClose: () => void;
  userId?: string | null;
  lifetimePoints: number;
  onSaved?: (config: BuklodCharacterState) => void;
};

type JourneyPanel = 'core' | 'special' | null;

export default function BuklodCharacterCustomizeSheet({
  visible,
  onClose,
  userId,
}: Props) {
  const { theme } = useBuklodPresentation();
  const drawerBottomInset = useBuklodDrawerBottomInset();
  const [state, setState] = useState<BuklodCharacterSelectionV2State | null>(null);
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState<JourneyPanel>(null);

  const refreshState = async () => {
    if (!userId) return;
    const next = await getMyBuklodCharacterSelectionV2(userId, true);
    setState(next);
  };

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

  useEffect(() => {
    if (!visible) setPanel(null);
  }, [visible]);

  const activeName = state
    ? CHARACTER_DISPLAY_NAME[state.active_character_id]
    : 'BUKLOD Character';
  const unlockedSpecialCount = state?.visible_special_character_ids.length ?? 0;

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
              <Text style={[styles.title, { color: theme.textPrimary }]}>BUKLOD Character</Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>One selection authority · protected R31/R40 art · 20-level journeys</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={BUKLOD_HIT_SLOP} accessibilityRole="button" accessibilityLabel="Close Character">
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
              <>
                <View style={[styles.statusCard, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}>
                  <View style={styles.statusIcon}>
                    <MaterialCommunityIcons name="account-star" size={28} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.statusEyebrow, { color: theme.accent }]}>ACTIVE CHARACTER</Text>
                    <Text style={[styles.statusName, { color: theme.textPrimary }]}>{activeName} · Level {state.character_level}</Text>
                    <Text style={[styles.statusMeta, { color: theme.textSecondary }]}>{state.circle_rank_name} · Circle Rank #{state.circle_rank_order}</Text>
                    <Text style={[styles.statusMeta, { color: theme.textMuted }]}>{state.character_points_since_selection.toLocaleString('en-PH')} Character Points since selection</Text>
                  </View>
                </View>

                <View style={[styles.ruleCard, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}>
                  <MaterialCommunityIcons name="shield-check-outline" size={20} color={theme.accent} />
                  <Text style={[styles.ruleText, { color: theme.textSecondary }]}>
                    Changing Character never resets Circle Points or Circle Rank. The newly selected Character starts at Level 1, levels do not transfer, and locked Special Characters remain hidden.
                  </Text>
                </View>

                <View style={styles.launchRow}>
                  <Pressable
                    onPress={() => setPanel((value) => value === 'core' ? null : 'core')}
                    style={[
                      styles.launchCard,
                      { borderColor: panel === 'core' ? theme.accent : theme.border, backgroundColor: panel === 'core' ? theme.accentSoft : theme.surfaceElevated },
                    ]}
                  >
                    <MaterialCommunityIcons name="account-group-outline" size={22} color={panel === 'core' ? theme.accent : theme.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.launchTitle, { color: theme.textPrimary }]}>Core Journey</Text>
                      <Text style={[styles.launchMeta, { color: theme.textMuted }]}>Phan · Quin · Van · Christian · Lhen</Text>
                    </View>
                    <MaterialCommunityIcons name={panel === 'core' ? 'chevron-up' : 'chevron-down'} size={22} color={theme.textMuted} />
                  </Pressable>

                  <Pressable
                    onPress={() => setPanel((value) => value === 'special' ? null : 'special')}
                    style={[
                      styles.launchCard,
                      { borderColor: panel === 'special' ? theme.accent : theme.border, backgroundColor: panel === 'special' ? theme.accentSoft : theme.surfaceElevated },
                    ]}
                  >
                    <MaterialCommunityIcons name="star-four-points-outline" size={22} color={panel === 'special' ? theme.accent : theme.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.launchTitle, { color: theme.textPrimary }]}>Special Journey</Text>
                      <Text style={[styles.launchMeta, { color: theme.textMuted }]}>{unlockedSpecialCount > 0 ? `${unlockedSpecialCount} unlocked by Circle Rank` : 'Locked characters stay invisible'}</Text>
                    </View>
                    <MaterialCommunityIcons name={panel === 'special' ? 'chevron-up' : 'chevron-down'} size={22} color={theme.textMuted} />
                  </Pressable>
                </View>

                {panel === 'core' ? (
                  <BuklodProgressiveCharacterSelector
                    userId={userId}
                    state={state}
                    onStateRefresh={refreshState}
                  />
                ) : null}

                {panel === 'special' ? (
                  <BuklodSpecialCharacterSeries
                    userId={userId}
                    state={state}
                    onStateRefresh={refreshState}
                  />
                ) : null}
              </>
            ) : !loading ? (
              <View style={[styles.emptyCard, { borderColor: theme.border }]}>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>Character state is unavailable. No selection or points data was changed.</Text>
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
  header: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 19, fontWeight: '900' },
  subtitle: { marginTop: 3, fontSize: 10.5, lineHeight: 14 },
  content: { padding: 14, paddingBottom: 28 },
  loadingBox: { minHeight: 90, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { fontSize: 11, fontWeight: '700' },
  statusCard: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 17, borderWidth: 1, marginBottom: 10 },
  statusIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  statusEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  statusName: { marginTop: 3, fontSize: 17, fontWeight: '900' },
  statusMeta: { marginTop: 3, fontSize: 10, fontWeight: '700' },
  ruleCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  ruleText: { flex: 1, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  launchRow: { marginTop: 12, gap: 8 },
  launchCard: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 15, borderWidth: 1 },
  launchTitle: { fontSize: 12, fontWeight: '900' },
  launchMeta: { marginTop: 2, fontSize: 9, lineHeight: 13, fontWeight: '700' },
  emptyCard: { padding: 14, borderWidth: 1, borderRadius: 14 },
  emptyText: { fontSize: 10, lineHeight: 15, fontWeight: '700' },
});
