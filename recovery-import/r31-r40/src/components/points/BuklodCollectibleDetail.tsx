/* BUKLOD_CHARACTER_R35_MANUAL_REDEMPTION_CLIENT */
/* BUKLOD_CHARACTER_R35C_POSTPATCH_TYPESCRIPT_FIXES */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, G, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { useAudioPlayer } from 'expo-audio';

import { useBuklodReduceMotion } from '@/components/HomeMotion';
import BuklodCharacterStarBurst from '@/components/points/BuklodCharacterStarBurst';
import BuklodProgressiveCharacterArt from '@/components/points/BuklodProgressiveCharacterArt';
import { supabase } from '@/lib/supabase';

type CharacterId = 'phan' | 'quin' | 'van' | 'christian' | 'lhen';
type RewardKind = 'expression' | 'speech' | 'profile_frame' | 'visual_effect' | 'title_badge';

type CollectibleInput = {
  userId: string;
  characterId: CharacterId;
  level: number;
  index: number;
  name: string;
  lifetimePoints: number;
  currentLevel: number;
};

type ServerItem = {
  collectible_id: string;
  character_id: CharacterId;
  level: number;
  item_index: number;
  reward_kind: RewardKind;
  reward_key: string;
  discovered_at: string | null;
  redeemed_at: string | null;
};

type ServerLoadout = {
  character_id: CharacterId;
  reward_kind: RewardKind;
  collectible_id: string;
  activated_at: string;
};

type ServerState = {
  lifetime_points: number;
  current_level: number;
  items: ServerItem[];
  loadout: ServerLoadout[];
};

type DetailState = CollectibleInput & {
  visible: boolean;
};

type RedeemPresentationPhase = 'idle' | 'burst' | 'character';

const detailListeners = new Set<() => void>();
let detailState: DetailState | null = null;

const stateCache = new Map<string, ServerState>();
const stateInFlight = new Map<string, Promise<ServerState>>();
const stateListeners = new Set<() => void>();

function emitDetail() {
  detailListeners.forEach((listener) => listener());
}

function emitState() {
  stateListeners.forEach((listener) => listener());
}

function cacheKey(userId: string, characterId: CharacterId) {
  return `${userId}:${characterId}`;
}

function collectibleId(characterId: CharacterId, level: number, index: number) {
  return `${characterId}:l${level}:c${index + 1}`;
}

function rewardKindForIndex(index: number): RewardKind {
  switch (index + 1) {
    case 1: return 'expression';
    case 2: return 'speech';
    case 3: return 'profile_frame';
    case 4: return 'visual_effect';
    case 5: return 'title_badge';
    default: return 'expression';
  }
}

function requiredPoints(level: number) {
  const thresholds = [
    0, 50, 100, 250, 500,
    1000, 2500, 5000, 10000, 25000,
    50000, 75000, 100000, 150000, 200000,
    250000, 300000, 350000, 400000, 500000,
  ];
  return thresholds[Math.max(0, Math.min(19, level - 1))] ?? 0;
}

function rarity(level: number) {
  if (level >= 20) return 'LEGENDARY';
  if (level >= 16) return 'EPIC';
  if (level >= 11) return 'RARE';
  if (level >= 6) return 'UNCOMMON';
  return 'COMMON';
}

function categoryForIndex(index: number) {
  return ['TOKEN', 'NOTE', 'TOOL', 'KEEPSAKE', 'EMBLEM'][index] ?? 'TOKEN';
}

function rewardTitle(input: CollectibleInput) {
  const kind = rewardKindForIndex(input.index);
  const suffix: Record<RewardKind, string> = {
    expression: 'Expression',
    speech: 'Voice Line',
    profile_frame: 'Profile Frame',
    visual_effect: 'Visual Effect',
    title_badge: 'Title Badge',
  };
  return `${input.name} ${suffix[kind]}`;
}

function rewardDescription(input: CollectibleInput) {
  const kind = rewardKindForIndex(input.index);
  const descriptions: Record<RewardKind, string> = {
    expression: 'Unlocks this collectible as an expression reward for the selected BUKLOD Character.',
    speech: 'Unlocks this collectible as a character voice-line reward. The animation/speaking presentation will be wired in the next animation phase.',
    profile_frame: 'Unlocks a persistent profile-frame reward that can be activated for this character.',
    visual_effect: 'Unlocks a persistent visual-effect reward that can be activated for this character.',
    title_badge: 'Unlocks a persistent title/badge reward that can be activated for this character.',
  };
  return descriptions[kind];
}

async function loadServerState(input: Pick<CollectibleInput, 'userId' | 'characterId'>, force = false) {
  const key = cacheKey(input.userId, input.characterId);
  if (!force) {
    const cached = stateCache.get(key);
    if (cached) return cached;
    const pending = stateInFlight.get(key);
    if (pending) return pending;
  }

  const request = (async () => {
    const { data, error } = await supabase.rpc('get_my_buklod_character_collectible_state_v1', {
      p_character_id: input.characterId,
    });
    if (error) throw error;
    const state = data as ServerState;
    stateCache.set(key, state);
    emitState();
    return state;
  })().finally(() => {
    stateInFlight.delete(key);
  });

  stateInFlight.set(key, request);
  return request;
}

function itemFrom(state: ServerState | undefined, input: CollectibleInput) {
  const id = collectibleId(input.characterId, input.level, input.index);
  return state?.items?.find((item) => item.collectible_id === id) ?? null;
}

function activeFrom(state: ServerState | undefined, input: CollectibleInput) {
  const item = itemFrom(state, input);
  if (!item) return false;
  return Boolean(state?.loadout?.some((loadout) => loadout.collectible_id === item.collectible_id));
}

function statusFrom(state: ServerState | undefined, input: CollectibleInput) {
  const currentLevel = state?.current_level ?? input.currentLevel;
  if (input.level > currentLevel) return 'LOCKED';
  const item = itemFrom(state, input);
  if (item?.redeemed_at) return activeFrom(state, input) ? 'ACTIVE' : 'REDEEMED';
  if (item?.discovered_at) return 'READY TO REDEEM';
  return 'COLLECTED · OPEN';
}

export function openBuklodCollectibleDetail(input: CollectibleInput) {
  detailState = { ...input, visible: true };
  emitDetail();

  if (input.level <= input.currentLevel) {
    void (async () => {
      try {
        const { error } = await supabase.rpc('open_my_buklod_character_collectible_v1', {
          p_character_id: input.characterId,
          p_level: input.level,
          p_item_index: input.index + 1,
        });
        if (error) throw error;
        await loadServerState(input, true);
      } catch (error: unknown) {
        console.warn('BUKLOD collectible open failed:', error);
      }
    })();
  }
}

function useDetailState() {
  const [, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion((value) => value + 1);
    detailListeners.add(listener);
    return () => { detailListeners.delete(listener); };
  }, []);
  return detailState;
}

function useServerState(input: CollectibleInput | null) {
  const [, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion((value) => value + 1);
    stateListeners.add(listener);
    return () => { stateListeners.delete(listener); };
  }, []);

  useEffect(() => {
    if (!input) return;
    void loadServerState(input).catch((error) => {
      console.warn('BUKLOD collectible state failed:', error);
    });
  }, [input?.userId, input?.characterId]);

  if (!input) return undefined;
  return stateCache.get(cacheKey(input.userId, input.characterId));
}

function CollectibleGlyph({ input, size = 72 }: { input: CollectibleInput; size?: number }) {
  const hue = (input.level * 29 + input.index * 47) % 360;
  const base = `hsl(${hue}, 54%, 42%)`;
  const light = `hsl(${hue}, 58%, 92%)`;
  const dark = `hsl(${hue}, 48%, 24%)`;
  const rarityName = rarity(input.level);
  const accent = rarityName === 'LEGENDARY'
    ? '#D5A021'
    : rarityName === 'EPIC'
      ? '#8B5FBF'
      : rarityName === 'RARE'
        ? '#2C72B8'
        : '#2F7D48';
  const category = categoryForIndex(input.index);

  return (
    <View pointerEvents="none" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="46" fill={light} stroke={accent} strokeWidth="3" />
        <Circle cx="50" cy="50" r="38" fill="#FFFFFF" opacity={0.96} />
        {category === 'TOKEN' ? (
          <G>
            <Circle cx="50" cy="43" r="22" fill={base} stroke={dark} strokeWidth="3" />
            <Path d="M38 61 L32 88 L50 77 L68 88 L62 61" fill={accent} opacity={0.92} />
            <Polygon points="50,28 55,39 67,40 58,48 61,60 50,54 39,60 42,48 33,40 45,39" fill="#FFF3B0" />
          </G>
        ) : null}
        {category === 'NOTE' ? (
          <G>
            <Rect x="26" y="22" width="48" height="58" rx="7" fill={light} stroke={dark} strokeWidth="3" />
            <Path d="M50 25 L50 78" stroke={base} strokeWidth="2.5" />
            <Path d="M31 35 C38 32 43 32 49 35 M51 35 C57 32 62 32 69 35 M31 45 C38 42 43 42 49 45 M51 45 C57 42 62 42 69 45 M31 55 C38 52 43 52 49 55 M51 55 C57 52 62 52 69 55" stroke={base} strokeWidth="2.2" fill="none" />
            <Circle cx="50" cy="66" r="6" fill={accent} />
          </G>
        ) : null}
        {category === 'TOOL' ? (
          <G>
            <Circle cx="50" cy="50" r="23" fill={base} stroke={dark} strokeWidth="3" />
            {[0,45,90,135,180,225,270,315].map((deg) => (
              <Rect key={deg} x="46" y="15" width="8" height="18" rx="3" fill={accent} transform={`rotate(${deg} 50 50)`} />
            ))}
            <Circle cx="50" cy="50" r="10" fill="#FFFFFF" stroke={dark} strokeWidth="3" />
            <Path d="M43 51 L48 56 L59 43" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </G>
        ) : null}
        {category === 'KEEPSAKE' ? (
          <G>
            <Rect x="25" y="34" width="50" height="42" rx="8" fill={base} stroke={dark} strokeWidth="3" />
            <Path d="M25 45 L75 45" stroke="#FFFFFF" strokeWidth="3" opacity={0.8} />
            <Rect x="45" y="27" width="10" height="49" rx="3" fill={accent} />
            <Path d="M50 28 C40 17 29 23 34 34 C39 37 45 34 50 30 C55 34 61 37 66 34 C71 23 60 17 50 28 Z" fill={accent} stroke={dark} strokeWidth="2" />
          </G>
        ) : null}
        {category === 'EMBLEM' ? (
          <G>
            <Path d="M50 18 L76 29 L72 59 C69 73 59 82 50 87 C41 82 31 73 28 59 L24 29 Z" fill={base} stroke={dark} strokeWidth="3" />
            <Path d="M50 28 L56 43 L72 44 L60 54 L64 70 L50 61 L36 70 L40 54 L28 44 L44 43 Z" fill={accent} />
            <Circle cx="50" cy="50" r="7" fill="#FFF5C4" />
          </G>
        ) : null}
        <Circle cx="82" cy="18" r="12" fill={accent} stroke="#FFFFFF" strokeWidth="2" />
        <SvgText x="82" y="22" textAnchor="middle" fontSize="10" fontWeight="900" fill="#FFFFFF">L{input.level}</SvgText>
        <SvgText x="50" y="95" textAnchor="middle" fontSize="7" fontWeight="900" fill={dark}>{rarityName}</SvgText>
      </Svg>
    </View>
  );
}

export function BuklodCollectibleRowEnhancement(input: CollectibleInput) {
  const state = useServerState(input);
  const status = statusFrom(state, input);
  const locked = status === 'LOCKED';
  return (
    <View style={styles.rowEnhancement}>
      <CollectibleGlyph input={input} size={50} />
      <View pointerEvents="none" style={styles.rowMeta}>
        <Text style={[styles.rowStatus, locked && styles.lockedText]}>{status}</Text>
        <Text style={styles.rowReward} numberOfLines={1}>{rewardTitle(input)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${locked ? 'Preview' : 'Open'} ${input.name}`}
        hitSlop={6}
        onPress={(event) => {
          event.stopPropagation?.();
          openBuklodCollectibleDetail(input);
        }}
        style={styles.openButton}
      >
        <Text style={styles.openButtonText}>{locked ? 'PREVIEW' : 'OPEN'}</Text>
      </Pressable>
    </View>
  );
}

export function BuklodCollectibleDetailHost() {
  const detail = useDetailState();
  const state = useServerState(detail);
  const reduceMotion = useBuklodReduceMotion();
  const redeemSfx = useAudioPlayer(
    require('../../../assets/sounds/buklod-points-claim.wav'),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [redeemPhase, setRedeemPhase] =
    useState<RedeemPresentationPhase>('idle');

  const redeemItemScale = useRef(new Animated.Value(1)).current;
  const redeemItemY = useRef(new Animated.Value(0)).current;
  const redeemItemOpacity = useRef(new Animated.Value(1)).current;
  const redeemCharacterScale = useRef(new Animated.Value(0.9)).current;
  const redeemCharacterOpacity = useRef(new Animated.Value(0)).current;
  const redeemAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const resetRedeemPresentation = useCallback(() => {
    redeemAnimationRef.current?.stop();
    redeemAnimationRef.current = null;
    redeemItemScale.setValue(1);
    redeemItemY.setValue(0);
    redeemItemOpacity.setValue(1);
    redeemCharacterScale.setValue(0.9);
    redeemCharacterOpacity.setValue(0);
    setRedeemPhase('idle');
  }, [
    redeemCharacterOpacity,
    redeemCharacterScale,
    redeemItemOpacity,
    redeemItemScale,
    redeemItemY,
  ]);

  useEffect(() => () => {
    redeemAnimationRef.current?.stop();
    redeemAnimationRef.current = null;
  }, []);

  const runRedeemPresentation = useCallback(() => {
    redeemAnimationRef.current?.stop();
    redeemItemScale.setValue(1);
    redeemItemY.setValue(0);
    redeemItemOpacity.setValue(1);
    redeemCharacterScale.setValue(0.9);
    redeemCharacterOpacity.setValue(0);
    setRedeemPhase('burst');

    try {
      redeemSfx.seekTo(0);
      redeemSfx.play();
    } catch {
      // A blocked/missing sound must never invalidate a successful redemption.
    }

    if (reduceMotion) {
      redeemItemScale.setValue(0.8);
      redeemItemY.setValue(20);
      redeemItemOpacity.setValue(0);
      redeemCharacterScale.setValue(1);
      redeemCharacterOpacity.setValue(1);
      setRedeemPhase('character');
      return;
    }

    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(redeemItemScale, {
          toValue: 1.12,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(redeemItemY, {
          toValue: -8,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(redeemItemScale, {
          toValue: 0.28,
          duration: 500,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(redeemItemY, {
          toValue: 54,
          duration: 500,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(redeemItemOpacity, {
          toValue: 0,
          duration: 460,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(redeemCharacterOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(redeemCharacterScale, {
          toValue: 1.04,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(redeemCharacterScale, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]);

    redeemAnimationRef.current = animation;
    animation.start(({ finished }) => {
      redeemAnimationRef.current = null;
      if (finished) setRedeemPhase('character');
    });
  }, [
    redeemCharacterOpacity,
    redeemCharacterScale,
    redeemItemOpacity,
    redeemItemScale,
    redeemItemY,
    redeemSfx,
    reduceMotion,
  ]);

  const close = useCallback(() => {
    resetRedeemPresentation();
    detailState = null;
    emitDetail();
    setMessage(null);
  }, [resetRedeemPresentation]);

  const status = useMemo(() => detail ? statusFrom(state, detail) : 'LOCKED', [detail, state]);
  const kind = detail ? rewardKindForIndex(detail.index) : 'expression';
  const isActive = Boolean(detail && activeFrom(state, detail));
  const redeemPresentationActive = redeemPhase !== 'idle';

  if (!detail) return null;

  const refresh = async () => {
    await loadServerState(detail, true);
  };

  const redeem = async () => {
    if (busy || detail.level > (state?.current_level ?? detail.currentLevel)) return;
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.rpc('redeem_my_buklod_character_collectible_v1', {
        p_character_id: detail.characterId,
        p_level: detail.level,
        p_item_index: detail.index + 1,
      });
      if (error) throw error;
      await refresh();
      const result = data as { already_redeemed?: boolean; first_redemption?: boolean } | null;
      if (result?.first_redemption && !result?.already_redeemed) {
        setMessage('Reward redeemed successfully.');
        runRedeemPresentation();
      } else {
        setMessage('Reward was already redeemed. No duplicate reward was granted.');
      }
    } catch (error: any) {
      Alert.alert('Collectible', error?.message ?? 'Unable to redeem this reward.');
    } finally {
      setBusy(false);
    }
  };

  const activate = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.rpc('set_my_buklod_character_reward_active_v1', {
        p_character_id: detail.characterId,
        p_level: detail.level,
        p_item_index: detail.index + 1,
      });
      if (error) throw error;
      await refresh();
      setMessage('Reward is now active for this character.');
    } catch (error: any) {
      Alert.alert('Collectible', error?.message ?? 'Unable to activate this reward.');
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.rpc('clear_my_buklod_character_reward_active_v1', {
        p_character_id: detail.characterId,
        p_reward_kind: kind,
      });
      if (error) throw error;
      await refresh();
      setMessage('Active reward removed.');
    } catch (error: any) {
      Alert.alert('Collectible', error?.message ?? 'Unable to remove this active reward.');
    } finally {
      setBusy(false);
    }
  };

  const earnedAt = requiredPoints(detail.level);
  const currentPoints = state?.lifetime_points ?? detail.lifetimePoints;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.topLine}>
              <View>
                <Text style={styles.kicker}>LEVEL {detail.level} · {rarity(detail.level)}</Text>
                <Text style={styles.title}>{detail.name}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={close} hitSlop={12} style={styles.closeButton}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            <View style={styles.artStage}>
              {redeemPresentationActive ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.redeemCharacterReveal,
                    {
                      opacity: redeemCharacterOpacity,
                      transform: [{ scale: redeemCharacterScale }],
                    },
                  ]}
                >
                  <BuklodProgressiveCharacterArt
                    characterId={detail.characterId}
                    level={state?.current_level ?? detail.currentLevel}
                    height={190}
                  />
                </Animated.View>
              ) : null}

              <Animated.View
                pointerEvents="none"
                style={{
                  opacity: redeemItemOpacity,
                  transform: [
                    { translateY: redeemItemY },
                    { scale: redeemItemScale },
                  ],
                }}
              >
                <CollectibleGlyph input={detail} size={190} />
              </Animated.View>

              <BuklodCharacterStarBurst
                active={redeemPhase === 'burst'}
              />
            </View>

            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{status}</Text>
            </View>

            <Text style={styles.sectionLabel}>HOW IT WAS EARNED</Text>
            <Text style={styles.bodyText}>
              Reach Level {detail.level} with at least {earnedAt.toLocaleString()} lifetime BUKLOD points. Current server-tracked lifetime points: {Number(currentPoints).toLocaleString()}.
            </Text>

            <Text style={styles.sectionLabel}>SPECIFIC REWARD</Text>
            <Text style={styles.rewardHeading}>{rewardTitle(detail)}</Text>
            <Text style={styles.bodyText}>{rewardDescription(detail)}</Text>

            {status === 'LOCKED' ? (
              <View style={styles.lockBox}>
                <Text style={styles.lockTitle}>HOW TO UNLOCK</Text>
                <Text style={styles.bodyText}>Continue earning BUKLOD points until Level {detail.level}. Previewing never redeems a locked reward.</Text>
              </View>
            ) : null}

            {message ? <Text style={styles.message}>{message}</Text> : null}

            {redeemPhase === 'character' ? (
              <View style={styles.redeemCompleteBox}>
                <Text style={styles.redeemCompleteTitle}>REWARD JOINED YOUR CHARACTER</Text>
                <Text style={styles.bodyText}>
                  The server redemption is complete. This animation is visual acknowledgment only and does not grant a second reward.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={resetRedeemPresentation}
                  style={styles.celebrationContinueButton}
                >
                  <Text style={styles.primaryText}>CONTINUE</Text>
                </Pressable>
              </View>
            ) : null}

            {busy ? <ActivityIndicator style={{ marginVertical: 10 }} /> : null}

            {!redeemPresentationActive && (status === 'READY TO REDEEM' || status === 'COLLECTED · OPEN') ? (
              <Pressable accessibilityRole="button" disabled={busy} onPress={redeem} style={[styles.primaryButton, busy && styles.disabled]}>
                <Text style={styles.primaryText}>REDEEM REWARD</Text>
              </Pressable>
            ) : null}

            {!redeemPresentationActive && (status === 'REDEEMED' || status === 'ACTIVE') && !isActive ? (
              <Pressable accessibilityRole="button" disabled={busy} onPress={activate} style={[styles.primaryButton, busy && styles.disabled]}>
                <Text style={styles.primaryText}>USE REWARD</Text>
              </Pressable>
            ) : null}

            {!redeemPresentationActive && isActive ? (
              <Pressable accessibilityRole="button" disabled={busy} onPress={deactivate} style={[styles.secondaryButton, busy && styles.disabled]}>
                <Text style={styles.secondaryText}>REMOVE ACTIVE REWARD</Text>
              </Pressable>
            ) : null}

            <Text style={styles.note}>
              Redemption and active reward state are saved on the BUKLOD server. The redeem burst, ting and Character reveal are presentation only; they never repeat the reward mutation.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  rowEnhancement: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  rowMeta: { flex: 1, minWidth: 0 },
  rowStatus: { fontSize: 10, fontWeight: '900', color: '#176B3A', letterSpacing: 0.4 },
  lockedText: { color: '#777' },
  rowReward: { fontSize: 10, fontWeight: '700', color: '#5B5B5B', marginTop: 1 },
  openButton: { borderWidth: 1, borderColor: '#2C7A4B', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#F7FBF8' },
  openButtonText: { fontSize: 9.5, fontWeight: '900', color: '#1E6B40', letterSpacing: 0.35 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.52)', justifyContent: 'center', padding: 18 },
  modalCard: { maxHeight: '92%', backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden' },
  modalContent: { padding: 20, paddingBottom: 26 },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  kicker: { fontSize: 11, fontWeight: '900', color: '#287548', letterSpacing: 0.8 },
  title: { fontSize: 22, lineHeight: 27, fontWeight: '900', color: '#17231C', marginTop: 3 },
  closeButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F2F0' },
  closeText: { fontSize: 25, lineHeight: 27, color: '#39443D' },
  artStage: { minHeight: 226, alignItems: 'center', justifyContent: 'center', paddingVertical: 18, position: 'relative', overflow: 'hidden' },
  redeemCharacterReveal: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  redeemCompleteBox: { marginTop: 10, borderWidth: 1, borderColor: '#CFE4D6', borderRadius: 14, padding: 12, backgroundColor: '#F7FBF8' },
  redeemCompleteTitle: { marginBottom: 4, fontSize: 10, fontWeight: '900', letterSpacing: 0.45, color: '#176B3A' },
  celebrationContinueButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderRadius: 12, backgroundColor: '#1E6B40' },
  statusPill: { alignSelf: 'center', backgroundColor: '#EAF6EE', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, marginBottom: 14 },
  statusText: { fontSize: 11, fontWeight: '900', color: '#176B3A', letterSpacing: 0.6 },
  sectionLabel: { fontSize: 10, fontWeight: '900', color: '#6B746E', letterSpacing: 0.9, marginTop: 12 },
  rewardHeading: { fontSize: 16, fontWeight: '900', color: '#18241D', marginTop: 4 },
  bodyText: { fontSize: 13, lineHeight: 19, color: '#465149', marginTop: 4 },
  lockBox: { marginTop: 14, backgroundColor: '#F7F4EA', borderRadius: 14, padding: 13 },
  lockTitle: { fontSize: 11, fontWeight: '900', color: '#7B661D' },
  message: { marginTop: 14, fontSize: 12, fontWeight: '800', color: '#176B3A', textAlign: 'center' },
  primaryButton: { backgroundColor: '#1F7A45', borderRadius: 14, alignItems: 'center', paddingVertical: 13, marginTop: 14 },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  secondaryButton: { borderWidth: 1.5, borderColor: '#1F7A45', borderRadius: 14, alignItems: 'center', paddingVertical: 12, marginTop: 10 },
  secondaryText: { color: '#1F7A45', fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  note: { marginTop: 16, fontSize: 10.5, lineHeight: 16, color: '#7A837D', textAlign: 'center' },
});
