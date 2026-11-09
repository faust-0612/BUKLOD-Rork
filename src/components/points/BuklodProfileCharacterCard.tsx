/* BUKLOD_CHARACTER_STUDIO3_REAL_ART_R1 */
/* BUKLOD_PROFILE_POINTS_CLAIM_R2_GROUPED */
/* BUKLOD_CHARACTER_R25D_PROFILE_VIEWPORT */
/* BUKLOD_CHARACTER_VISIBLE_SYNC_R31_R40_V2 */
/* BUKLOD_PROFILE_TOP10_R1 */
import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
  useFocusEffect,
} from 'expo-router';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

// Isolate the Character Studio's heavy scene and render exceptions.
const BuklodCharacterCustomizeSheet = React.lazy(
  () => import('@/components/points/BuklodCharacterCustomizeSheet')
);
class CharacterStudioBoundary extends React.Component<{
  children: React.ReactNode; onClose: () => void;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) {
    console.warn('BUKLOD Character Studio render error:', error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={{ padding: 18, gap: 10, alignItems: 'center' }}>
        <Text style={{ fontSize: 14, fontWeight: '900' }}>
          Character Studio could not load. Your selection is unchanged.
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Retry Character Studio"
          onPress={() => this.setState({ failed: false })}>
          <Text style={{ color: '#076B39', fontWeight: '800' }}>Try Again</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Close Character Studio"
          onPress={this.props.onClose}>
          <Text style={{ color: '#076B39', fontWeight: '800' }}>Close</Text>
        </Pressable>
      </View>
    );
  }
}

import BuklodActiveCharacterArt
  from '@/components/points/BuklodActiveCharacterArt';

import BuklodAdLightRewardCard
  from '@/components/BuklodAdLightRewardCard';
import BuklodCircleRankBadge from '@/components/points/BuklodCircleRankBadge';
import BuklodCharacterLevelRecognition from '@/components/points/BuklodCharacterLevelRecognition';

import {
  CHARACTER_DISPLAY_NAME,
  getCachedBuklodCharacterSelectionV2,
  getMyBuklodCharacterSelectionV2,
  resolveBuklodCharacterDisplay,
  subscribeBuklodCharacterDisplayOverride,
  subscribeBuklodCharacterSelectionV2,
  type BuklodCharacterSelectionV2State,
} from '@/lib/buklodCharacterSelectionV2';

import {
  ProfileMotionFadeUp,
} from '@/components/BuklodProfileMotion';

import {
  useBuklodCharacterEventsOptional,
} from '@/components/character/BuklodCharacterEventProvider';

import {
  useAuth,
} from '@/providers/AuthProvider';

import {
  useBuklodPresentation,
} from '@/hooks/useBuklodPresentation';

import {
  DEFAULT_CHARACTER,
  loadBuklodCharacter,
  reconcileCharacterForPoints,
  type BuklodCharacterState,
} from '@/lib/buklodCharacter';

import {
  formatPoints,
} from '@/lib/character-lab-core/tiers';

import {
  CharacterEventType,
} from '@/lib/buklodCharacterEvents';

import {
  loadBuklodClaimGroups,
  type BuklodClaimGroup,
} from '@/lib/buklodRewards';

import {
  resolvePersonDisplayName,
} from '@/lib/buklodPersonDisplay';

import {
  supabase,
} from '@/lib/supabase';

import {
  withBuklodTimeout,
} from '@/lib/buklodAsyncTimeout';

import {
  withAlpha,
} from '@/lib/buklodContrast';
import { getBuklodCardTone, isBuklodDarkPaletteId } from '@/lib/buklodCardTones';

type Props = {
  lifetimePoints?: number;
  rankName?: string | null;
};

type ProfileLeaderboardRow = {
  user_id: string;
  full_name: string | null;
  church_name: string | null;
  rank_position: number;
  total_points: number;
};

export default function BuklodProfileCharacterCard({
  lifetimePoints = 0,
  rankName = null,
}: Props) {
  const { theme, paletteId } = useBuklodPresentation();
  const darkCards = isBuklodDarkPaletteId(paletteId);
  const characterTone = getBuklodCardTone('sky', darkCards);
  const customizeTone = getBuklodCardTone('lavender', darkCards);
  const pointsTone = getBuklodCardTone('amber', darkCards);
  const { session } = useAuth();
  const [focused, setFocused] = useState(false);
  const characterEvents = useBuklodCharacterEventsOptional();
  const greetedRef = useRef(false);
  const userId = session?.user?.id ?? null;

  const [config, setConfig] = useState<BuklodCharacterState>({
    ...DEFAULT_CHARACTER,
  });
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [displayPoints, setDisplayPoints] = useState(lifetimePoints);
  const [displayRank, setDisplayRank] = useState<string | null>(rankName);
  const [claimGroups, setClaimGroups] = useState<BuklodClaimGroup[]>([]);
  const [topTen, setTopTen] = useState<ProfileLeaderboardRow[]>([]);
  const [topTenBusy, setTopTenBusy] = useState(false);
  const [selection, setSelection] = useState<BuklodCharacterSelectionV2State | null>(() =>
    getCachedBuklodCharacterSelectionV2(userId),
  );
  const [, setSelectionTick] = useState(0);

  useEffect(() => {
    setDisplayPoints(lifetimePoints);
  }, [lifetimePoints]);

  useEffect(() => {
    setDisplayRank(rankName);
  }, [rankName]);

  useEffect(() => {
    void loadBuklodCharacter(userId).then((loaded) => {
      const reconciled = reconcileCharacterForPoints(
        loaded,
        displayPoints,
      );
      setConfig(reconciled);
    });
  }, [displayPoints, userId]);

  useEffect(() => {
    if (!userId) {
      setSelection(null);
      return;
    }
    let mounted = true;
    void getMyBuklodCharacterSelectionV2(userId, true).then(
      (next) => {
        if (mounted) setSelection(next);
      },
      () => undefined,
    );
    const unsubscribeSelection = subscribeBuklodCharacterSelectionV2((changedUserId, next) => {
      if (mounted && changedUserId === userId) {
        setSelection(next);
        setSelectionTick((value) => value + 1);
      }
    });
    const unsubscribeDisplay = subscribeBuklodCharacterDisplayOverride(() => {
      if (mounted) setSelectionTick((value) => value + 1);
    });
    return () => {
      mounted = false;
      unsubscribeSelection();
      unsubscribeDisplay();
    };
  }, [userId]);

  const liveDisplay = resolveBuklodCharacterDisplay(selection);
  const liveName = liveDisplay
    ? CHARACTER_DISPLAY_NAME[liveDisplay.character_id]
    : null;
  const liveLevel = liveDisplay?.character_level ?? null;

  const loadClaimGroups = useCallback(async () => {
    if (!userId) {
      setClaimGroups([]);
      return;
    }

    try {
      const groups = await loadBuklodClaimGroups();
      setClaimGroups(groups);
    } catch (error: unknown) {
      console.warn(
        'Profile BUKLOD claim groups:',
        error instanceof Error ? error.message : error,
      );
    }
  }, [userId]);

  const loadTopTen = useCallback(async () => {
    if (!userId) {
      setTopTen([]);
      setTopTenBusy(false);
      return;
    }

    setTopTenBusy(true);

    try {
      const { data, error } = await withBuklodTimeout<any>(
        (supabase as any).rpc(
          'get_buklod_points_leaderboard',
          {
            p_period: 'all_time',
            p_limit: 10,
            p_church_id: null,
          },
        ),
        8_000,
        'Profile Points leaderboard',
      );

      if (error) {
        throw error;
      }

      setTopTen(
        Array.isArray(data)
          ? data.slice(0, 10) as ProfileLeaderboardRow[]
          : [],
      );
    } catch (error: unknown) {
      console.warn(
        'Profile Top 10 leaderboard:',
        error instanceof Error ? error.message : error,
      );
      setTopTen([]);
    } finally {
      setTopTenBusy(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void loadClaimGroups();
      void loadTopTen();

      return () => setFocused(false);
    }, [loadClaimGroups, loadTopTen]),
  );

  useEffect(() => {
    if (!focused || greetedRef.current) {
      return;
    }

    greetedRef.current = true;
    characterEvents?.emit({
      type: CharacterEventType.PROFILE_CHARACTER_VISIBLE,
      success: true,
    });
  }, [characterEvents, focused]);

  const rankLabel = String(displayRank ?? '').trim();
  const hasClaimGroups = claimGroups.length > 0;

  const styles = StyleSheet.create({
    wrap: {
      marginHorizontal: 12,
      marginBottom: 6,
    },
    card: {
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 13,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: characterTone.border,
      backgroundColor: characterTone.surface,
    },
    eyebrow: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.15,
      color: theme.textMuted,
      marginBottom: 5,
    },
    body: {
      minHeight: 132,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    artPress: {
      width: 82,
      height: 130,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'flex-end',
      overflow: 'hidden',
      borderRadius: 14,
    },
    copyCol: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
    },
    rankTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    pointsMeta: {
      marginTop: 3,
      fontSize: 12,
      fontWeight: '800',
      color: theme.textSecondary,
    },
    helper: {
      marginTop: 5,
      fontSize: 10,
      lineHeight: 14,
      color: theme.textMuted,
    },
    customize: {
      alignSelf: 'flex-start',
      marginTop: 10,
      minHeight: 38,
      paddingHorizontal: 13,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: customizeTone.soft,
      borderWidth: 1,
      borderColor: customizeTone.border,
    },
    customizeText: {
      fontSize: 11,
      fontWeight: '900',
      color: customizeTone.ink,
    },
    pointsSection: {
      marginTop: 10,
      paddingTop: 11,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    pointsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 8,
    },
    pointsHeaderTitle: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.8,
      color: theme.textMuted,
    },
    fullRankingText: {
      fontSize: 10,
      fontWeight: '900',
      color: characterTone.ink,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: 8,
    },
    summaryChip: {
      flex: 1,
      minHeight: 54,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    rankSummaryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
    },
    summaryLabel: {
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.7,
      color: theme.textMuted,
    },
    summaryValue: {
      marginTop: 3,
      fontSize: 12,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    claimNotice: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: withAlpha(theme.accent, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(theme.accent, 0.22),
    },
    claimNoticeText: {
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.55,
      color: theme.accent,
    },
    topTenSection: {
      marginTop: 11,
      paddingTop: 11,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    topTenHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 5,
    },
    topTenTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    topTenTitle: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.8,
      color: theme.textMuted,
    },
    topTenPeriod: {
      fontSize: 8,
      fontWeight: '900',
      color: theme.accent,
    },
    topTenState: {
      paddingVertical: 12,
      textAlign: 'center',
      fontSize: 10,
      color: theme.textMuted,
    },
    topTenRow: {
      minHeight: 47,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 7,
      paddingVertical: 6,
      borderRadius: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    topTenRowMine: {
      backgroundColor: withAlpha(theme.accent, 0.08),
      borderWidth: 1,
      borderColor: withAlpha(theme.accent, 0.2),
    },
    topTenPosition: {
      width: 28,
      fontSize: 11,
      fontWeight: '900',
      color: theme.accent,
    },
    topTenPerson: {
      flex: 1,
      minWidth: 0,
    },
    topTenName: {
      fontSize: 10.5,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    topTenChurch: {
      marginTop: 1,
      fontSize: 8.5,
      color: theme.textMuted,
    },
    topTenPoints: {
      fontSize: 10,
      fontWeight: '900',
      color: theme.textSecondary,
    },
    youTag: {
      marginLeft: 4,
      fontSize: 7,
      fontWeight: '900',
      color: theme.accent,
    },
  });

  return (
    <>
      <BuklodCharacterLevelRecognition userId={userId} selection={selection} />
      <ProfileMotionFadeUp delay={55}>
        <View style={styles.wrap}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>
              MY BUKLOD CHARACTER
            </Text>

            <View style={styles.body}>
              <View style={styles.artPress}>
                <BuklodActiveCharacterArt
                  key={`profile-art-${liveDisplay?.character_id ?? 'none'}-${liveLevel ?? 0}`}
                  fallbackCharacter={config}
                  height={124}
                  viewportWidth={82}
                  showStage={false}
                  showEffects={false}
                />
              </View>

              <View style={styles.copyCol}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open ranking and BUKLOD Points"
                  onPress={() => router.push('/points')}
                >
                  <Text
                    style={styles.rankTitle}
                    numberOfLines={1}
                  >
                    {liveName
                      ? `${liveName} · Level ${liveLevel ?? 1}`
                      : rankLabel || 'BUKLOD Character'}
                  </Text>

                  <Text style={styles.pointsMeta}>
                    {formatPoints(displayPoints)} lifetime pts
                    {rankLabel ? ` · ${rankLabel}` : ''}
                  </Text>

                  <Text style={styles.helper}>
                    This is the character and level on your profile right now.
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setCustomizeOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Customize character"
                  style={({ pressed }) => [
                    styles.customize,
                    pressed && { opacity: 0.88 },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="palette-outline"
                    size={16}
                    color={customizeTone.ink}
                  />
                  <Text style={styles.customizeText}>
                    Customize
                  </Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Open BUKLOD Points and Claim Center"
                  onPress={()=>router.push('/points')} style={[styles.customize,{backgroundColor:pointsTone.soft,
                    borderColor:pointsTone.border,marginTop:7}]}>
                  <MaterialCommunityIcons name="star-circle-outline" size={16} color={pointsTone.ink}/>
                  <Text style={[styles.customizeText,{color:pointsTone.ink}]}>BUKLOD POINTS · OPEN CLAIM CENTER</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.pointsSection}>
              <View style={styles.pointsHeader}>
                <Text style={styles.pointsHeaderTitle}>
                  RANK & POINTS
                </Text>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open Circle Rank progression"
                  onPress={() => router.push('/points/progression' as any)}
                >
                  <Text style={styles.fullRankingText}>
                    Circle progression →
                  </Text>
                </Pressable>
              </View>

              <View style={styles.summaryRow}>
                <View style={[styles.summaryChip, { backgroundColor: customizeTone.surface, borderColor: customizeTone.border }]}>
                  <View style={styles.rankSummaryHeader}>
                    <Text style={styles.summaryLabel}>
                      CURRENT RANK
                    </Text>
                    {hasClaimGroups ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Open points ready to claim"
                        onPress={() => router.push('/points')}
                        style={({ pressed }) => [
                          styles.claimNotice,
                          pressed && { opacity: 0.82 },
                        ]}
                      >
                        <Text style={styles.claimNoticeText}>
                          TO CLAIM
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 }}>
                    {rankLabel ? <BuklodCircleRankBadge rankName={rankLabel} size={32} /> : null}
                    <Text numberOfLines={2} style={[styles.summaryValue, { flex: 1 }]}>
                      {rankLabel || 'BUKLOD Rank'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.summaryChip, { backgroundColor: pointsTone.surface, borderColor: pointsTone.border }]}>
                  <Text style={styles.summaryLabel}>
                    LIFETIME POINTS
                  </Text>
                  <Text style={styles.summaryValue}>
                    {formatPoints(displayPoints)}
                  </Text>
                </View>
              </View>

              <View style={styles.topTenSection}>
                <View style={styles.topTenHeader}>
                  <View style={styles.topTenTitleWrap}>
                    <MaterialCommunityIcons
                      name="trophy-outline"
                      size={15}
                      color={theme.accent}
                    />
                    <Text style={styles.topTenTitle}>
                      TOP 10
                    </Text>
                    <Text style={styles.topTenPeriod}>
                      ALL-TIME
                    </Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open complete Top 10 ranking"
                    onPress={() => router.push('/points')}
                  >
                    <Text style={styles.fullRankingText}>
                      View ranking →
                    </Text>
                  </Pressable>
                </View>

                {topTenBusy ? (
                  <Text style={styles.topTenState}>
                    Loading Top 10…
                  </Text>
                ) : topTen.length === 0 ? (
                  <Text style={styles.topTenState}>
                    No ranking data yet.
                  </Text>
                ) : (
                  topTen.map((item) => {
                    const mine = item.user_id === userId;
                    const points = Number(item.total_points ?? 0);

                    return (
                      <Pressable
                        key={item.user_id}
                        accessibilityRole="button"
                        accessibilityLabel={`Rank ${item.rank_position}: ${resolvePersonDisplayName(item.full_name, item.user_id)}`}
                        onPress={() => router.push('/points')}
                        style={({ pressed }) => [
                          styles.topTenRow,
                          mine && styles.topTenRowMine,
                          pressed && { opacity: 0.86 },
                        ]}
                      >
                        <Text style={styles.topTenPosition}>
                          #{item.rank_position}
                        </Text>

                        <View style={styles.topTenPerson}>
                          <Text
                            numberOfLines={1}
                            style={styles.topTenName}
                          >
                            {resolvePersonDisplayName(
                              item.full_name,
                              item.user_id,
                            )}
                            {mine ? (
                              <Text style={styles.youTag}> · YOU</Text>
                            ) : null}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={styles.topTenChurch}
                          >
                            {item.church_name || 'No Local'}
                          </Text>
                        </View>

                        <Text style={styles.topTenPoints}>
                          {Number.isFinite(points)
                            ? points.toLocaleString('en-PH')
                            : '0'} pts
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            </View>

            <BuklodAdLightRewardCard />
          </View>
        </View>
      </ProfileMotionFadeUp>

      {customizeOpen ? (
        <CharacterStudioBoundary onClose={() => setCustomizeOpen(false)}>
          <Suspense fallback={<View style={{ padding: 12 }}>
            <Text>Opening Character Studio…</Text>
          </View>}>
            <BuklodCharacterCustomizeSheet
        visible={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        userId={userId}
        lifetimePoints={displayPoints}
        onSaved={setConfig}
        onActiveChanged={() => {
          if (!userId) return;
          void getMyBuklodCharacterSelectionV2(userId, true).then(
            (next) => {
              setSelection(next);
              setSelectionTick((value) => value + 1);
            },
            () => undefined,
          );
        }}
            />
          </Suspense>
        </CharacterStudioBoundary>
      ) : null}
    </>
  );
}