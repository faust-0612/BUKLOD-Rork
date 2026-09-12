/* BUKLOD_CHARACTER_STUDIO3_REAL_ART_R1 */
/* BUKLOD_PROFILE_POINTS_CLAIM_R2_GROUPED */
/* BUKLOD_CHARACTER_R25D_PROFILE_VIEWPORT */
import React, {
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

import BuklodCharacterCustomizeSheet
  from '@/components/points/BuklodCharacterCustomizeSheet';

import BuklodCharacterLayeredArt
  from '@/components/points/BuklodCharacterLayeredArt';

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
  claimBuklodRewardGroup,
  loadBuklodClaimGroups,
  type BuklodClaimGroup,
} from '@/lib/buklodRewards';

import {
  withAlpha,
} from '@/lib/buklodContrast';

type Props = {
  lifetimePoints?: number;
  rankName?: string | null;
};

export default function BuklodProfileCharacterCard({
  lifetimePoints = 0,
  rankName = null,
}: Props) {
  const { theme } = useBuklodPresentation();
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
  const [claimingGroup, setClaimingGroup] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

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

  const loadClaimGroups = useCallback(async () => {
    if (!userId) {
      setClaimGroups([]);
      return;
    }

    try {
      const groups = await loadBuklodClaimGroups();
      setClaimGroups(groups);
      setClaimError(null);
    } catch (error: unknown) {
      console.warn(
        'Profile BUKLOD claim groups:',
        error instanceof Error ? error.message : error,
      );
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void loadClaimGroups();

      return () => setFocused(false);
    }, [loadClaimGroups]),
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

  const claimGroup = async (group: BuklodClaimGroup) => {
    if (claimingGroup) {
      return;
    }

    setClaimingGroup(group.group_key);
    setClaimError(null);

    try {
      const result = await claimBuklodRewardGroup(group.group_key);

      setDisplayPoints(result.lifetime_points);
      if (result.rank_name) {
        setDisplayRank(result.rank_name);
      }

      // Remove the claimed section immediately. Reconciliation below quietly
      // refreshes any rewards that may have arrived while the request ran.
      setClaimGroups((current) =>
        current.filter((item) => item.group_key !== group.group_key),
      );

      if (result.claimed_points > 0) {
        characterEvents?.emit({
          type: CharacterEventType.POINTS_CLAIMED,
          success: true,
          points: result.claimed_points,
          spokenText:
            `${group.group_label}: ${result.claimed_points.toLocaleString('en-PH')} points claimed.`,
        });
      }

      void loadClaimGroups();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not claim these points.';

      console.warn('Profile BUKLOD group claim:', message);
      setClaimError(message);
    } finally {
      setClaimingGroup(null);
    }
  };

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
      borderColor: theme.border,
      backgroundColor: withAlpha(theme.cardSurface, 0.88),
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
      backgroundColor: theme.accentSoft,
      borderWidth: 1,
      borderColor: withAlpha(theme.accent, 0.25),
    },
    customizeText: {
      fontSize: 11,
      fontWeight: '900',
      color: theme.accent,
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
      marginBottom: hasClaimGroups ? 10 : 0,
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
    claimPanel: {
      gap: 8,
    },
    claimPanelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    claimPanelTitle: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.85,
      color: theme.textMuted,
    },
    claimPanelHint: {
      fontSize: 9,
      fontWeight: '800',
      color: theme.accent,
    },
    claimGroupCard: {
      minHeight: 66,
      paddingHorizontal: 11,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: withAlpha(theme.accent, 0.2),
      backgroundColor: withAlpha(theme.accentSoft, 0.5),
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    claimIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    claimCopy: {
      flex: 1,
      minWidth: 0,
    },
    claimLabel: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    claimMeta: {
      marginTop: 2,
      fontSize: 9,
      lineHeight: 13,
      color: theme.textMuted,
    },
    claimPoints: {
      marginTop: 3,
      fontSize: 12,
      fontWeight: '900',
      color: theme.accent,
    },
    claimButton: {
      minHeight: 38,
      minWidth: 82,
      paddingHorizontal: 11,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      backgroundColor: theme.buttonPrimary,
    },
    claimButtonBusy: {
      opacity: 0.62,
    },
    claimButtonText: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.45,
      color: theme.white,
    },
    claimError: {
      fontSize: 9,
      lineHeight: 13,
      color: theme.danger,
    },
  });

  return (
    <>
      <ProfileMotionFadeUp delay={55}>
        <View style={styles.wrap}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>
              MY BUKLOD CHARACTER
            </Text>

            <View style={styles.body}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open ranking and BUKLOD Points"
                onPress={() => router.push('/points')}
                style={({ pressed }) => [
                  styles.artPress,
                  pressed && { opacity: 0.92 },
                ]}
              >
                <BuklodCharacterLayeredArt
                  body={config.body}
                  equipment={config.equipment}
                  height={124}
                  viewportWidth={82}
                  showStage={false}
                  showEffects={false}
                />
              </Pressable>

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
                    {rankLabel || 'BUKLOD Character'}
                  </Text>

                  <Text style={styles.pointsMeta}>
                    {formatPoints(displayPoints)} lifetime pts
                  </Text>

                  <Text style={styles.helper}>
                    Rank, points, and ready rewards are visible directly in Profile.
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
                    color={theme.accent}
                  />
                  <Text style={styles.customizeText}>
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
                    Full ranking →
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
                    {rankLabel || 'BUKLOD Rank'}
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

              {hasClaimGroups ? (
                <View style={styles.claimPanel}>
                  <View style={styles.claimPanelHeader}>
                    <Text style={styles.claimPanelTitle}>
                      READY TO CLAIM
                    </Text>
                    <Text style={styles.claimPanelHint}>
                      Claim by activity
                    </Text>
                  </View>

                  {claimGroups.map((group, index) => {
                    const busy = claimingGroup === group.group_key;
                    const anyBusy = claimingGroup !== null;

                    return (
                      <ProfileMotionFadeUp
                        key={group.group_key}
                        delay={70 + index * 25}
                        duration={220}
                        fromY={6}
                        fromOpacity={0.82}
                      >
                        <View style={styles.claimGroupCard}>
                          <View style={styles.claimIcon}>
                            <MaterialCommunityIcons
                              name="star-four-points"
                              size={17}
                              color={theme.accent}
                            />
                          </View>

                          <View style={styles.claimCopy}>
                            <Text
                              numberOfLines={1}
                              style={styles.claimLabel}
                            >
                              {group.group_label}
                            </Text>
                            <Text style={styles.claimMeta}>
                              {group.event_count.toLocaleString('en-PH')}{' '}
                              {group.event_count === 1 ? 'reward' : 'rewards'} ready
                            </Text>
                            <Text style={styles.claimPoints}>
                              +{formatPoints(group.total_points)} pts
                            </Text>
                          </View>

                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Claim all ${group.group_label} points`}
                            disabled={anyBusy}
                            onPress={() => void claimGroup(group)}
                            style={({ pressed }) => [
                              styles.claimButton,
                              busy && styles.claimButtonBusy,
                              pressed && !anyBusy && { transform: [{ scale: 0.97 }] },
                            ]}
                          >
                            <Text style={styles.claimButtonText}>
                              {busy ? 'CLAIMING…' : 'CLAIM ALL'}
                            </Text>
                            <MaterialCommunityIcons
                              name={busy ? 'progress-clock' : 'gift-outline'}
                              size={14}
                              color={theme.white}
                            />
                          </Pressable>
                        </View>
                      </ProfileMotionFadeUp>
                    );
                  })}

                  {claimError ? (
                    <Text style={styles.claimError}>
                      {claimError}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </ProfileMotionFadeUp>

      <BuklodCharacterCustomizeSheet
        visible={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        userId={userId}
        lifetimePoints={displayPoints}
        onSaved={setConfig}
      />
    </>
  );
}
