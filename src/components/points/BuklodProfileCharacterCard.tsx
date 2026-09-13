/* BUKLOD_CHARACTER_STUDIO3_REAL_ART_R1 */
/* BUKLOD_PROFILE_POINTS_CLAIM_R2_GROUPED */
/* BUKLOD_CHARACTER_R25D_PROFILE_VIEWPORT */
/* BUKLOD_CHARACTER_VISIBLE_SYNC_R31_R40_V2 */
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

import BuklodActiveCharacterArt
  from '@/components/points/BuklodActiveCharacterArt';

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
                <BuklodActiveCharacterArt
                  fallbackCharacter={config}
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