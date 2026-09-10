/* BUKLOD_CHARACTER_STUDIO3_REAL_ART_R1 */
/* BUKLOD_PROFILE_POINTS_CLAIM_R1 */
/* BUKLOD_CHARACTER_R25D_PROFILE_VIEWPORT */
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Modal,
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

/* BUKLOD_CHARACTER_R26D_PROFILE_WIRING */
import BuklodProgressiveCharacterArt
  from '@/components/points/BuklodProgressiveCharacterArt';

import {
  loadProgressiveCharacter,
  PROGRESSIVE_LEVEL_THRESHOLDS,
  subscribeProgressiveCharacter,
  collectibleNames,
  loadProgressiveShowcase,
  subscribeProgressiveShowcase,
  type ProgressiveShowcaseSelection,
  type ProgressiveCharacterId,
} from '@/lib/buklodProgressiveCharacter';
import BuklodCharacterCustomizeSheet
  from '@/components/points/BuklodCharacterCustomizeSheet';

import BuklodCharacterLayeredArt
  from '@/components/points/BuklodCharacterLayeredArt';

import BuklodClaimRewardCard, {
  type ClaimRewardItem,
} from '@/components/points/BuklodClaimRewardCard';

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
  claimBuklodRewardEvent,
  loadPendingBuklodRewardEvent,
  type BuklodRewardEvent,
} from '@/lib/buklodRewards';

import {
  withAlpha,
} from '@/lib/buklodContrast';

type Props = {
  lifetimePoints?: number;
  rankName?: string | null;
};


/* BUKLOD_CHARACTER_R29_LEVEL_AUTHORITY */
function r29LevelForPoints(points: number) {
  const safe = Math.max(0, Number(points) || 0);
  let level = 1;

  PROGRESSIVE_LEVEL_THRESHOLDS.forEach((threshold, index) => {
    if (safe >= threshold) {
      level = index + 1;
    }
  });

  return Math.max(1, Math.min(20, level));
}
export default function
BuklodProfileCharacterCard({
  lifetimePoints = 0,
  rankName = null,
}: Props) {
  const {
    theme,
  } = useBuklodPresentation();

  const {
    session,
  } = useAuth();

  const [
    focused,
    setFocused,
  ] = useState(false);

  const characterEvents =
    useBuklodCharacterEventsOptional();

  const greetedRef =
    useRef(false);

  const userId =
    session?.user?.id ??
    null;

  const [
    config,
    setConfig,
  ] =
    useState<BuklodCharacterState>({
      ...DEFAULT_CHARACTER,
    });

  const [
    customizeOpen,
    setCustomizeOpen,
  ] =
    useState(false);

  /* BUKLOD_CHARACTER_R27C_PROFILE_ZOOM */
  const [characterZoomOpen, setCharacterZoomOpen] =
    useState(false);
  const [
    progressiveId,
    setProgressiveId,
  ] = useState<ProgressiveCharacterId | null>(null);
  /* BUKLOD_CHARACTER_R32_PROFILE_SHOWCASE */
  const [
    progressiveShowcase,
    setProgressiveShowcase,
  ] =
    useState<ProgressiveShowcaseSelection | null>(
      null,
    );

  useEffect(() => {
    let active = true;

    void loadProgressiveCharacter(userId).then((id) => {
      if (active) {
        setProgressiveId(id);
      }
    });

    const unsubscribe = subscribeProgressiveCharacter(
      (changedUserId, id) => {
        if (active && changedUserId === userId) {
          setProgressiveId(id);
        }
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    let active = true;

    if (!userId) {
      setProgressiveShowcase(null);
      return () => {
        active = false;
      };
    }

    void loadProgressiveShowcase(userId).then(
      (selection) => {
        if (active) {
          setProgressiveShowcase(selection);
        }
      },
    );

    const unsubscribe =
      subscribeProgressiveShowcase(
        (changedUserId, selection) => {
          if (
            active &&
            changedUserId === userId
          ) {
            setProgressiveShowcase(selection);
          }
        },
      );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  const [
    displayPoints,
    setDisplayPoints,
  ] = useState(lifetimePoints);

  const [
    displayRank,
    setDisplayRank,
  ] = useState<string | null>(rankName);

  const [
    rewardEvent,
    setRewardEvent,
  ] = useState<BuklodRewardEvent | null>(null);

  const [
    claimBusy,
    setClaimBusy,
  ] = useState(false);

  const [
    claimStatus,
    setClaimStatus,
  ] = useState<
    'claimable' | 'claiming' | 'claimed' | 'failed'
  >('claimable');

  useEffect(() => {
    setDisplayPoints(lifetimePoints);
  }, [lifetimePoints]);

  useEffect(() => {
    setDisplayRank(rankName);
  }, [rankName]);

  useEffect(() => {
    void loadBuklodCharacter(
      userId,
    ).then(
      (loaded) => {
        const reconciled =
          reconcileCharacterForPoints(
            loaded,
            displayPoints,
          );

        setConfig(
          reconciled,
        );
      },
    );
  }, [
    displayPoints,
    userId,
  ]);

  const loadPendingReward =
    useCallback(async () => {
      if (!userId) {
        setRewardEvent(null);
        return;
      }

      try {
        const pending =
          await loadPendingBuklodRewardEvent();

        setRewardEvent(pending);
        setClaimStatus('claimable');
      } catch (error: unknown) {
        console.warn(
          'Profile BUKLOD reward:',
          error instanceof Error
            ? error.message
            : error,
        );
      }
    }, [userId]);

  useFocusEffect(
    useCallback(
      () => {
        setFocused(true);
        void loadPendingReward();

        return () =>
          setFocused(false);
      },
      [loadPendingReward],
    ),
  );

  useEffect(() => {
    if (
      !focused ||
      greetedRef.current
    ) {
      return;
    }

    greetedRef.current =
      true;

    characterEvents?.emit({
      type:
        CharacterEventType
          .PROFILE_CHARACTER_VISIBLE,
      success: true,
    });
  }, [
    characterEvents,
    focused,
  ]);

  const claimReward = async () => {
    if (!rewardEvent || claimBusy) {
      return;
    }

    const eventId = rewardEvent.id;
    const fallbackPoints = Number(rewardEvent.points ?? 0);

    setClaimBusy(true);
    setClaimStatus('claiming');

    try {
      const result =
        await claimBuklodRewardEvent(eventId);

      const earnedPoints =
        result.claimed_points > 0
          ? result.claimed_points
          : fallbackPoints;

      setDisplayPoints(result.lifetime_points);

      if (result.rank_name) {
        setDisplayRank(result.rank_name);
      }

      if (earnedPoints > 0) {
        characterEvents?.emit({
          type: CharacterEventType.POINTS_CLAIMED,
          success: true,
          points: earnedPoints,
          spokenText:
            rewardEvent.spoken_message ??
            rewardEvent.message ??
            undefined,
        });
      }

      setClaimStatus('claimed');
      setRewardEvent(null);
    } catch (error: unknown) {
      console.warn(
        'Profile BUKLOD claim:',
        error instanceof Error
          ? error.message
          : error,
      );

      setClaimStatus('failed');
    } finally {
      setClaimBusy(false);
    }
  };

  const rankLabel =
    String(
      displayRank ?? '',
    ).trim();

  const pendingClaim: ClaimRewardItem | null =
    rewardEvent
      ? {
          id: rewardEvent.id,
          title: rewardEvent.title,
          message: rewardEvent.message,
          points: rewardEvent.points,
          eventType: rewardEvent.event_type,
          status: claimStatus,
        }
      : null;

  const progressiveShowcaseName =
    progressiveId &&
    progressiveShowcase &&
    progressiveShowcase.characterId ===
      progressiveId
      ? collectibleNames(
          progressiveShowcase.characterId,
          progressiveShowcase.level,
        )[
          progressiveShowcase.itemIndex
        ] ?? null
      : null;

  const styles =
    StyleSheet.create({
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
        borderColor:
          theme.border,
        backgroundColor:
          withAlpha(
            theme.cardSurface,
            0.88,
          ),
      },

      eyebrow: {
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1.15,
        color:
          theme.textMuted,
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
        justifyContent:
          'flex-end',
        overflow: 'hidden',
        borderRadius: 14,
      },

      copyCol: {
        flex: 1,
        minWidth: 0,
        justifyContent:
          'center',
      },

      rankTitle: {
        fontSize: 16,
        fontWeight: '900',
        color:
          theme.textPrimary,
      },

      pointsMeta: {
        marginTop: 3,
        fontSize: 12,
        fontWeight: '800',
        color:
          theme.textSecondary,
      },

      helper: {
        marginTop: 5,
        fontSize: 10,
        lineHeight: 14,
        color:
          theme.textMuted,
      },

      characterZoomBackdrop: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backgroundColor: 'rgba(0,0,0,0.78)',
      },
      characterZoomCard: {
        width: '100%',
        maxWidth: 420,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: 24,
      },
      progressiveShowcaseRow: {
        marginTop: 5,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
      },
      progressiveShowcaseText: {
        flex: 1,
        fontSize: 9,
        lineHeight: 12,
        fontWeight: '800',
        color: theme.accent,
      },
      characterZoomShowcase: {
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        minHeight: 34,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 7,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.58)',
      },
      characterZoomShowcaseText: {
        flexShrink: 1,
        fontSize: 10,
        lineHeight: 14,
        fontWeight: '900',
        color: '#FFFFFF',
        textAlign: 'center',
      },
      customize: {
        alignSelf: 'flex-start',
        marginTop: 10,
        minHeight: 38,
        paddingHorizontal: 13,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent:
          'center',
        gap: 6,
        backgroundColor:
          theme.accentSoft,
        borderWidth: 1,
        borderColor:
          withAlpha(
            theme.accent,
            0.25,
          ),
      },

      customizeText: {
        fontSize: 11,
        fontWeight: '900',
        color:
          theme.accent,
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
        color: theme.accent,
      },

      summaryRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: pendingClaim ? 10 : 0,
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
    });

  return (
    <>
      <ProfileMotionFadeUp
        delay={55}
      >
        <View
          style={
            styles.wrap
          }
        >
          <View
            style={
              styles.card
            }
          >
            <Text
              style={
                styles.eyebrow
              }
            >
              MY BUKLOD CHARACTER
            </Text>

            <View
              style={
                styles.body
              }
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View character full screen"
                onPress={() =>
                  setCharacterZoomOpen(
                    true,
                  )
                }
                style={({
                  pressed,
                }) => [
                  styles.artPress,
                  pressed && {
                    opacity: 0.92,
                  },
                ]}
              >
                {progressiveId ? (
                  <BuklodProgressiveCharacterArt
                    characterId={progressiveId}
                    level={r29LevelForPoints(lifetimePoints)}
                    height={124}
                    viewportWidth={82}
                  />
                ) : (
                  <BuklodCharacterLayeredArt
                  body={
                    config.body
                  }
                  equipment={
                    config.equipment
                  }
                  height={124}
                  viewportWidth={82}
                  showStage={
                    false
                  }
                  showEffects={false}
                />
                )}
              </Pressable>

              <View
                style={
                  styles.copyCol
                }
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open ranking and BUKLOD Points"
                  onPress={() =>
                    router.push(
                      '/points',
                    )
                  }
                >
                  <Text
                    style={
                      styles.rankTitle
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {rankLabel ||
                      'BUKLOD Character'}
                  </Text>

                  <Text
                    style={
                      styles.pointsMeta
                    }
                  >
                    {formatPoints(
                      displayPoints,
                    )}{' '}
                    lifetime pts
                  </Text>

                  {progressiveShowcaseName ? (
                    <View
                      style={
                        styles.progressiveShowcaseRow
                      }
                    >
                      <MaterialCommunityIcons
                        name="star-circle"
                        size={13}
                        color={theme.accent}
                      />
                      <Text
                        style={
                          styles.progressiveShowcaseText
                        }
                        numberOfLines={2}
                      >
                        Featured: {progressiveShowcaseName}
                      </Text>
                    </View>
                  ) : null}

                  <Text
                    style={
                      styles.helper
                    }
                  >
                    Rank, points, and ready rewards are now visible directly in Profile.
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    setCustomizeOpen(
                      true,
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Customize character"
                  style={({
                    pressed,
                  }) => [
                    styles.customize,
                    pressed && {
                      opacity: 0.88,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="palette-outline"
                    size={16}
                    color={
                      theme.accent
                    }
                  />

                  <Text
                    style={
                      styles.customizeText
                    }
                  >
                    Customize
                  </Text>
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
                  accessibilityLabel="Open full ranking dashboard"
                  onPress={() => router.push('/points')}
                >
                  <Text style={styles.fullRankingText}>
                    Full ranking â†’
                  </Text>
                </Pressable>
              </View>

              <View style={styles.summaryRow}>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryLabel}>
                    CURRENT RANK
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={styles.summaryValue}
                  >
                    {rankLabel || 'Loading rankâ€¦'}
                  </Text>
                </View>

                <View style={styles.summaryChip}>
                  <Text style={styles.summaryLabel}>
                    LIFETIME POINTS
                  </Text>
                  <Text style={styles.summaryValue}>
                    {formatPoints(displayPoints)}
                  </Text>
                </View>
              </View>

              {pendingClaim ? (
                <BuklodClaimRewardCard
                  reward={pendingClaim}
                  onClaim={() => void claimReward()}
                  onRetry={() => {
                    setClaimStatus('claimable');
                    void claimReward();
                  }}
                />
              ) : null}
            </View>
          </View>
        </View>
      </ProfileMotionFadeUp>

            {/* BUKLOD_CHARACTER_R27C_PROFILE_ZOOM_MODAL */}
      <Modal
        visible={characterZoomOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCharacterZoomOpen(false)}
      >
        <Pressable
          style={styles.characterZoomBackdrop}
          onPress={() => setCharacterZoomOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close full screen character"
        >
          <View style={styles.characterZoomCard} pointerEvents="none">
            {progressiveId ? (
              <BuklodProgressiveCharacterArt
                characterId={progressiveId}
                level={r29LevelForPoints(lifetimePoints)}
                height={500}
              />
            ) : (
<BuklodCharacterLayeredArt
                  body={
                    config.body
                  }
                  equipment={
                    config.equipment
                  }
                  height={500}
                  viewportWidth={330}
                  showStage={
                    false
                  }
                  showEffects={false}
                />
            )}
          
            {progressiveShowcaseName ? (
              <View
                style={
                  styles.characterZoomShowcase
                }
              >
                <MaterialCommunityIcons
                  name="star-circle"
                  size={16}
                  color="#FFFFFF"
                />
                <Text
                  style={
                    styles.characterZoomShowcaseText
                  }
                >
                  Featured: {progressiveShowcaseName}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Modal>

<BuklodCharacterCustomizeSheet
        visible={
          customizeOpen
        }
        onClose={() =>
          setCustomizeOpen(
            false,
          )
        }
        userId={userId}
        lifetimePoints={
          displayPoints
        }
        onSaved={
          setConfig
        }
      />
    </>
  );
}
