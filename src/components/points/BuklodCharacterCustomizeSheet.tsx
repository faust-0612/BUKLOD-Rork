/* BUKLOD_CHARACTER_WEB_FORMAT_PARITY_R22 */
/* BUKLOD_CHARACTER_R31_R40_LAYOUT_HOST_LOCK_V3 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import BuklodProgressiveCharacterArt from '@/components/points/BuklodProgressiveCharacterArt';
import BuklodProgressiveCharacterSelector from '@/components/points/BuklodProgressiveCharacterSelector';
import BuklodSpecialCharacterSeries from '@/components/points/BuklodSpecialCharacterSeries';
import { type BuklodCharacterState } from '@/lib/buklodCharacter';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';
import { BUKLOD_HIT_SLOP } from '@/lib/buklodTouch';
import {
  CHARACTER_DISPLAY_NAME,
  CORE_CHARACTER_ORDER,
  getMyBuklodCharacterSelectionV2,
  resolveBuklodCharacterDisplay,
  setBuklodCharacterDisplayOverride,
  SPECIAL_CHARACTER_ORDER,
  subscribeBuklodCharacterDisplayOverride,
  subscribeBuklodCharacterSelectionV2,
  type BuklodCharacterSelectionV2State,
  type BuklodCoreCharacterId,
  type BuklodSpecialCharacterId,
} from '@/lib/buklodCharacterSelectionV2';
import { getBuklodSpecialLevelAsset } from '@/lib/buklodSpecialCharacterAssets';

type Props = {
  visible: boolean;
  onClose: () => void;
  userId?: string | null;
  lifetimePoints: number;
  onSaved?: (config: BuklodCharacterState) => void;
  onActiveChanged?: () => void;
};

type Mode = 'five' | 'eight';

export default function BuklodCharacterCustomizeSheet({
  visible,
  onClose,
  userId,
  lifetimePoints,
  onActiveChanged,
}: Props) {
  const drawerBottomInset = useBuklodDrawerBottomInset();
  const [state, setState] = useState<BuklodCharacterSelectionV2State | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('five');
  const [tick, setTick] = useState(0);
  const lastActiveRef = useRef<string | null>(null);

  const applyState = (next: BuklodCharacterSelectionV2State) => {
    setState(next);
    setTick((value) => value + 1);
    if (lastActiveRef.current !== next.active_character_id) {
      lastActiveRef.current = next.active_character_id;
      if (CORE_CHARACTER_ORDER.includes(next.active_character_id as BuklodCoreCharacterId)) {
        setMode('five');
      } else if (
        SPECIAL_CHARACTER_ORDER.includes(next.active_character_id as BuklodSpecialCharacterId)
      ) {
        setMode('eight');
      }
    }
  };

  const refreshState = async () => {
    if (!userId) return;
    const next = await getMyBuklodCharacterSelectionV2(userId, true);
    applyState(next);
  };

  const closeSheet = () => {
    setBuklodCharacterDisplayOverride(null);
    onClose();
  };

  useEffect(() => {
    if (!visible || !userId) return;
    let mounted = true;
    setLoading(true);

    void getMyBuklodCharacterSelectionV2(userId, true)
      .then(
        (next) => {
          if (!mounted) return;
          applyState(next);
        },
        (error: unknown) => {
          if (mounted) {
            Alert.alert(
              'BUKLOD Character',
              error instanceof Error ? error.message : 'Could not load Character Selection.',
            );
          }
        },
      )
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const unsubscribeSelection = subscribeBuklodCharacterSelectionV2((changedUserId, next) => {
      if (mounted && changedUserId === userId) applyState(next);
    });
    const unsubscribeDisplay = subscribeBuklodCharacterDisplayOverride(() => {
      if (mounted) setTick((value) => value + 1);
    });

    return () => {
      mounted = false;
      unsubscribeSelection();
      unsubscribeDisplay();
      setBuklodCharacterDisplayOverride(null);
    };
  }, [userId, visible, lifetimePoints]);

  const display = resolveBuklodCharacterDisplay(state);
  const displayId = display?.character_id ?? state?.active_character_id;
  const displayLevel = display?.character_level ?? state?.character_level ?? 1;
  const activeName = displayId
    ? CHARACTER_DISPLAY_NAME[displayId]
    : 'BUKLOD Character';

  const showingCore = useMemo(
    () => !!displayId && CORE_CHARACTER_ORDER.includes(displayId as BuklodCoreCharacterId),
    [displayId],
  );
  const showingSpecial = useMemo(
    () => !!displayId && SPECIAL_CHARACTER_ORDER.includes(displayId as BuklodSpecialCharacterId),
    [displayId],
  );
  const artKey = `${displayId ?? 'none'}-${displayLevel}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeSheet}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: '#070B14', paddingBottom: drawerBottomInset }]}>
          <View style={[styles.header, { borderBottomColor: 'rgba(232,197,107,0.25)' }]}>
            <View style={styles.headerCopy}>
              <Text style={[styles.title, { color: '#F4E7C3' }]}>CHARACTER PROGRESSION</Text>
              <Text style={[styles.localNote, { color: '#9AA6BD' }]}>
                Select a character and level. Showing Now, Profile, and Home update together. Tap Use to keep it.
              </Text>
            </View>
            <Pressable
              onPress={closeSheet}
              hitSlop={BUKLOD_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Close Character"
            >
              <MaterialCommunityIcons name="close" size={23} color="#E8C56B" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator
            bounces
          >
            {loading && !state ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#E8C56B" />
                <Text style={styles.loadingText}>Loading Character state…</Text>
              </View>
            ) : null}

            {state ? (
              <>
                <View style={styles.banner}>
                  <View style={styles.heroArt}>
                    {showingCore ? (
                      <BuklodProgressiveCharacterArt
                        key={artKey}
                        characterId={displayId as BuklodCoreCharacterId}
                        level={displayLevel}
                        height={92}
                        viewportWidth={88}
                      />
                    ) : showingSpecial ? (
                      <Image
                        key={artKey}
                        source={getBuklodSpecialLevelAsset(
                          displayId as BuklodSpecialCharacterId,
                          displayLevel,
                        )}
                        resizeMode="contain"
                        fadeDuration={0}
                        style={{ width: 88, height: 92 }}
                      />
                    ) : null}
                  </View>
                  <View style={styles.heroMeta}>
                    <Text style={styles.bannerKicker}>SHOWING NOW</Text>
                    <Text style={styles.bannerTitle}>
                      {showingCore ? 'FIVE' : showingSpecial ? 'EIGHT' : 'CHARACTER'}
                    </Text>
                    <Text style={styles.bannerLine}>
                      Same look on Profile and Home. Tap Use to keep this character.
                    </Text>
                    <Text style={styles.bannerName}>
                      {activeName} · Level {displayLevel}
                    </Text>
                    <Text style={styles.bannerRank}>
                      {state.circle_rank_name} · Circle Rank #{state.circle_rank_order}
                    </Text>
                  </View>
                </View>

                <View style={styles.modeRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: mode === 'five' }}
                    onPress={() => setMode('five')}
                    style={[styles.modePill, mode === 'five' && styles.modePillOn]}
                  >
                    <MaterialCommunityIcons
                      name="account-group"
                      size={14}
                      color={mode === 'five' ? '#1A1406' : '#E8C56B'}
                    />
                    <View>
                      <Text style={mode === 'five' ? styles.modeOnTitle : styles.modeTitle}>FIVE</Text>
                      <Text style={mode === 'five' ? styles.modeOnSub : styles.modeSub}>
                        Main Characters
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: mode === 'eight' }}
                    onPress={() => setMode('eight')}
                    style={[styles.modePill, mode === 'eight' && styles.modePillOn]}
                  >
                    <MaterialCommunityIcons
                      name="star-four-points"
                      size={14}
                      color={mode === 'eight' ? '#1A1406' : '#E8C56B'}
                    />
                    <View>
                      <Text style={mode === 'eight' ? styles.modeOnTitle : styles.modeTitle}>EIGHT</Text>
                      <Text style={mode === 'eight' ? styles.modeOnSub : styles.modeSub}>
                        Special Characters
                      </Text>
                    </View>
                  </Pressable>
                </View>

                {mode === 'five' ? (
                  <BuklodProgressiveCharacterSelector
                    userId={userId}
                    state={state}
                    onStateRefresh={async () => {
                      await refreshState();
                      onActiveChanged?.();
                    }}
                  />
                ) : (
                  <BuklodSpecialCharacterSeries
                    userId={userId}
                    state={state}
                    onStateRefresh={async () => {
                      await refreshState();
                      onActiveChanged?.();
                    }}
                  />
                )}
              </>
            ) : !loading ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  Character state is unavailable. No selection, Circle Points, or Circle Rank data was changed.
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: { height: '94%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '900', letterSpacing: 1.1 },
  localNote: { marginTop: 2, fontSize: 10 },
  bodyScroll: { flex: 1 },
  bodyContent: { paddingBottom: 28 },
  loadingBox: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { fontSize: 11, fontWeight: '700', color: '#9AA6BD' },
  banner: {
    marginTop: 12,
    marginHorizontal: 14,
    minHeight: 118,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(232,197,107,0.45)',
    backgroundColor: '#142033',
    overflow: 'hidden',
  },
  heroArt: {
    width: 88,
    height: 96,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderRadius: 14,
  },
  heroMeta: { flex: 1, minWidth: 0 },
  bannerKicker: { color: '#E8C56B', fontSize: 16, fontWeight: '900', letterSpacing: 0.4 },
  bannerTitle: { marginTop: 2, color: '#F7F1DE', fontSize: 13, fontWeight: '800' },
  bannerLine: { marginTop: 4, color: '#C9D2E3', fontSize: 11, fontWeight: '700' },
  bannerName: { marginTop: 6, color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  bannerRank: { marginTop: 2, color: '#9AA6BD', fontSize: 10, fontWeight: '700' },
  modeRow: { marginTop: 12, marginHorizontal: 14, flexDirection: 'row', gap: 10 },
  modePill: {
    flex: 1,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(232,197,107,0.35)',
    backgroundColor: '#10182A',
  },
  modePillOn: { backgroundColor: '#E8C56B', borderColor: '#E8C56B' },
  modeOnTitle: { color: '#1A1406', fontSize: 13, fontWeight: '900' },
  modeOnSub: { color: '#3D3420', fontSize: 9, fontWeight: '700' },
  modeTitle: { color: '#E8C56B', fontSize: 13, fontWeight: '900' },
  modeSub: { color: '#9AA6BD', fontSize: 9, fontWeight: '700' },
  emptyCard: {
    margin: 14,
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
    borderColor: '#243044',
    backgroundColor: '#162033',
  },
  emptyText: { fontSize: 10, lineHeight: 15, fontWeight: '700', color: '#C9D2E3' },
});
