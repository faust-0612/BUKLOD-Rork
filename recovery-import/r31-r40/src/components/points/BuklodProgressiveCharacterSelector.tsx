/* BUKLOD_CHARACTER_R26B_PROGRESSIVE_SELECTOR */
import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BuklodProgressiveCharacterArt
  from '@/components/points/BuklodProgressiveCharacterArt';

import {
  collectibleNames,
  PROGRESSIVE_CHARACTER_ORDER,
  PROGRESSIVE_CHARACTERS,
  PROGRESSIVE_LEVEL_THRESHOLDS,
  loadProgressiveCharacter,
  saveProgressiveCharacter,
  loadProgressiveShowcase,
  saveProgressiveShowcase,
  subscribeProgressiveShowcase,
  type ProgressiveShowcaseSelection,
  type ProgressiveCharacterId,
} from '@/lib/buklodProgressiveCharacter';

import {
  useBuklodPresentation,
} from '@/hooks/useBuklodPresentation';

import {
  withAlpha,
} from '@/lib/buklodContrast';
/* BUKLOD_CHARACTER_R35_MANUAL_REDEMPTION_WIRING */
import {
  BuklodCollectibleDetailHost,
  BuklodCollectibleRowEnhancement,
} from '@/components/points/BuklodCollectibleDetail';


/* BUKLOD_CHARACTER_R32_PREVIEW_SYNC */
export type ProgressiveCharacterPreview = {
  characterId: ProgressiveCharacterId;
  level: number;
  showcase: ProgressiveShowcaseSelection | null;
  showcaseSaved: boolean;
};

type Props = {
  userId?: string | null;
  lifetimePoints: number;
  onSelected?: (id: ProgressiveCharacterId) => void;
  onPreview?: (preview: ProgressiveCharacterPreview) => void;
};

function levelForPoints(points: number) {
  const safe = Math.max(0, Number(points) || 0);
  let level = 1;

  PROGRESSIVE_LEVEL_THRESHOLDS.forEach((threshold, index) => {
    if (safe >= threshold) {
      level = index + 1;
    }
  });

  return Math.max(1, Math.min(20, level));
}

export default function BuklodProgressiveCharacterSelector({
  userId,
  lifetimePoints,
  onSelected,
  onPreview,
}: Props) {
  const { theme } = useBuklodPresentation();
  const [saved, setSaved] =
    useState<ProgressiveCharacterId | null>(null);
  const [draft, setDraft] =
    useState<ProgressiveCharacterId>('phan');
  const [busy, setBusy] = useState(false);
  const [zoomId, setZoomId] = useState<ProgressiveCharacterId | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number | null>(null);

  const level = useMemo(
    () => levelForPoints(lifetimePoints),
    [lifetimePoints],
  );
  /* BUKLOD_CHARACTER_R31_COMPLETE_NEW_SYSTEM */
  const [collectionLevel, setCollectionLevel] = useState(level);

  useEffect(() => {
    setCollectionLevel(level);
  }, [draft, level]);

  const [savedShowcase, setSavedShowcase] =
    useState<ProgressiveShowcaseSelection | null>(null);
  const [previewShowcase, setPreviewShowcase] =
    useState<ProgressiveShowcaseSelection | null>(null);
  const [showcaseBusy, setShowcaseBusy] =
    useState(false);

  useEffect(() => {
    let mounted = true;

    if (!userId) {
      setSavedShowcase(null);
      setPreviewShowcase(null);
      return () => {
        mounted = false;
      };
    }

    void loadProgressiveShowcase(userId).then((selection) => {
      if (mounted) {
        setSavedShowcase(selection);
      }
    });

    const unsubscribe =
      subscribeProgressiveShowcase(
        (changedUserId, selection) => {
          if (
            mounted &&
            changedUserId === userId
          ) {
            setSavedShowcase(selection);
          }
        },
      );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    let active = true;

    void loadProgressiveCharacter(userId).then((id) => {
      if (!active) return;
      const next = id ?? 'phan';
      setSaved(id);
      setDraft(next);
    });

    return () => {
      active = false;
    };
  }, [userId]);

  const save = async () => {
    if (!userId || busy) return;

    setBusy(true);
    try {
      await saveProgressiveCharacter(userId, draft);
      setSaved(draft);
      onSelected?.(draft);
    } finally {
      setBusy(false);
    }
  };

  const styles = StyleSheet.create({
    wrap: {
      marginTop: 14,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    title: {
      paddingHorizontal: 14,
      fontSize: 14,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    hint: {
      marginTop: 4,
      paddingHorizontal: 14,
      fontSize: 10,
      lineHeight: 14,
      color: theme.textMuted,
    },
    row: {
      paddingHorizontal: 14,
      paddingTop: 10,
      gap: 10,
    },
    tile: {
      width: 112,
      minHeight: 166,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surfaceElevated,
      overflow: 'hidden',
      alignItems: 'center',
      paddingTop: 7,
      paddingBottom: 8,
    },
    tileOn: {
      borderColor: theme.accent,
      backgroundColor: withAlpha(theme.accentSoft, 0.72),
    },
    art: {
      width: 92,
      height: 118,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    name: {
      marginTop: 5,
      fontSize: 11,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    level: {
      marginTop: 2,
      fontSize: 9,
      fontWeight: '800',
      color: theme.textMuted,
    },
    saved: {
      marginTop: 2,
      fontSize: 8,
      fontWeight: '900',
      color: theme.accent,
    },
    zoomBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.82)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    zoomCard: {
      width: '100%',
      maxWidth: 360,
      height: '82%',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    progressionPreview: {
      marginTop: 4,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.3,
      color: theme.accent,
    },
    collectionNote: {
      marginTop: 3,
      fontSize: 9,
      lineHeight: 14,
      color: theme.textMuted,
    },
    collectionTabs: {
      paddingTop: 9,
      paddingBottom: 6,
      gap: 7,
    },
    collectionChip: {
      minWidth: 58,
      paddingHorizontal: 8,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center',
    },
    collectionChipActive: {
      borderColor: theme.accent,
      backgroundColor: theme.accentSoft,
    },
    collectionChipLocked: {
      opacity: 0.48,
    },
    collectionChipLevel: {
      fontSize: 9,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    collectionChipStatus: {
      marginTop: 2,
      fontSize: 7,
      fontWeight: '900',
      color: theme.textMuted,
    },
    collectiblePress: {
      paddingVertical: 6,
      paddingHorizontal: 7,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    collectiblePressActive: {
      borderColor: theme.accent,
      backgroundColor: theme.accentSoft,
    },
    collectiblePressLocked: {
      opacity: 0.58,
    },
    collectibleState: {
      marginTop: 2,
      fontSize: 7,
      fontWeight: '900',
      color: theme.textMuted,
    },
    showcaseActions: {
      marginTop: 8,
    },
    showcaseButton: {
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      backgroundColor: theme.accent,
      paddingHorizontal: 10,
    },
    showcaseButtonDisabled: {
      opacity: 0.5,
    },
    showcaseButtonText: {
      fontSize: 9,
      fontWeight: '900',
      color: '#FFFFFF',
    },
    showcaseRemove: {
      marginTop: 7,
      minHeight: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    showcaseRemoveText: {
      fontSize: 8,
      fontWeight: '900',
      color: theme.textMuted,
    },
    collectionDetail: {
      marginTop: 6,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    collectionDetailTitle: {
      fontSize: 10,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    collectionDetailStatus: {
      marginTop: 2,
      marginBottom: 5,
      fontSize: 8,
      fontWeight: '900',
      color: theme.accent,
    },
    zoomTitle: {
      fontSize: 14,
      fontWeight: '900',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    zoomStage: {
      marginTop: 2,
      marginBottom: 8,
      fontSize: 11,
      fontWeight: '800',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    saveDisabled: {
      opacity: 0.55,
    },    progression: {
      marginTop: 14,
      paddingTop: 12,
      paddingBottom: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    progressionTitle: {
      marginHorizontal: 14,
      fontSize: 12,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    progressionSummary: {
      marginTop: 3,
      marginHorizontal: 14,
      fontSize: 10,
      lineHeight: 15,
      color: theme.textMuted,
    },
    progressionRow: {
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 4,
      gap: 9,
    },
    progressionCard: {
      width: 112,
      minHeight: 224,
      padding: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: 'center',
    },
    progressionCardCurrent: {
      borderColor: theme.accent,
      backgroundColor: theme.accentSoft,
    },
    progressionCardLocked: {
      opacity: 0.42,
    },
    progressionArt: {
      width: 90,
      height: 138,
      alignItems: 'center',
      justifyContent: 'flex-end',
      overflow: 'hidden',
      borderRadius: 10,
    },
    progressionLevel: {
      marginTop: 7,
      fontSize: 10,
      fontWeight: '900',
      color: theme.textPrimary,
    },
    progressionStage: {
      marginTop: 2,
      minHeight: 28,
      fontSize: 9,
      lineHeight: 13,
      textAlign: 'center',
      color: theme.textSecondary,
    },
    progressionPoints: {
      marginTop: 4,
      fontSize: 9,
      fontWeight: '800',
      color: theme.textMuted,
    },
    progressionStatus: {
      marginTop: 3,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.35,
      color: theme.textMuted,
    },
    progressionStatusCurrent: {
      color: theme.accent,
    },
    nextUpgrade: {
      marginTop: 6,
      marginHorizontal: 14,
      fontSize: 10,
      lineHeight: 15,
      fontWeight: '800',
      color: theme.textSecondary,
    },    collectibles: {
      marginTop: 10,
      marginHorizontal: 14,
      padding: 10,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    collectiblesTitle: {
      fontSize: 11,
      fontWeight: '900',
      color: theme.textPrimary,
      marginBottom: 5,
    },
    collectibleItem: {
      fontSize: 10,
      lineHeight: 16,
      color: theme.textMuted,
    },    save: {
      marginTop: 10,
      marginHorizontal: 14,
      minHeight: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.buttonPrimary,
      opacity: !userId || busy ? 0.55 : 1,
    },
    saveText: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.white,
    },
  });


  const sameShowcase = (
    a: ProgressiveShowcaseSelection | null,
    b: ProgressiveShowcaseSelection | null,
  ) =>
    Boolean(
      a &&
      b &&
      a.characterId === b.characterId &&
      a.level === b.level &&
      a.itemIndex === b.itemIndex,
    );

  const previewShowcaseItem = (
    itemIndex: number,
  ) => {
    const selection: ProgressiveShowcaseSelection = {
      characterId: draft,
      level: collectionLevel,
      itemIndex,
    };

    setPreviewShowcase(selection);

    onPreview?.({
      characterId: draft,
      level: collectionLevel,
      showcase: selection,
      showcaseSaved:
        sameShowcase(savedShowcase, selection),
    });
  };

  const featurePreviewShowcase = async () => {
    if (
      !userId ||
      showcaseBusy ||
      !previewShowcase ||
      previewShowcase.characterId !== draft ||
      previewShowcase.level > level
    ) {
      return;
    }

    setShowcaseBusy(true);
    try {
      await saveProgressiveShowcase(
        userId,
        previewShowcase,
      );
      setSavedShowcase(previewShowcase);

      onPreview?.({
        characterId: draft,
        level: previewShowcase.level,
        showcase: previewShowcase,
        showcaseSaved: true,
      });
    } catch (error: unknown) {
      console.warn(
        'BUKLOD Character featured collectible:',
        error instanceof Error
          ? error.message
          : error,
      );
    } finally {
      setShowcaseBusy(false);
    }
  };

  const removeFeaturedShowcase = async () => {
    if (!userId || showcaseBusy) return;

    setShowcaseBusy(true);
    try {
      await saveProgressiveShowcase(
        userId,
        null,
      );
      setSavedShowcase(null);
      setPreviewShowcase(null);

      onPreview?.({
        characterId: draft,
        level: collectionLevel,
        showcase: null,
        showcaseSaved: false,
      });
    } catch (error: unknown) {
      console.warn(
        'BUKLOD Character remove featured collectible:',
        error instanceof Error
          ? error.message
          : error,
      );
    } finally {
      setShowcaseBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>
        Choose Your BUKLOD Character
      </Text>

      <Text style={styles.hint}>
        Pick Phan, Quin, Van, Christian, or Lhen. Your selected
        full-body character automatically progresses from Level 1
        to Level 20 using your existing lifetime BUKLOD Points.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {PROGRESSIVE_CHARACTER_ORDER.map((id) => {
          const profile = PROGRESSIVE_CHARACTERS[id];
          const selected = draft === id;

          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${profile.name}`}
              onPress={() => {
                setDraft(id);
                setCollectionLevel(level);
                setPreviewShowcase(null);
                onPreview?.({
                  characterId: id,
                  level,
                  showcase:
                    savedShowcase?.characterId === id
                      ? savedShowcase
                      : null,
                  showcaseSaved: true,
                });
              }}
              style={[
                styles.tile,
                selected && styles.tileOn,
              ]}
            >
              <View style={styles.art}>
                <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${profile.name} full screen`}
                onPress={(event) => {
                  event.stopPropagation?.();
                  setZoomId(id);
                  setZoomLevel(level);
                }}
              >
<BuklodProgressiveCharacterArt
                  characterId={id}
                  level={level}
                  height={112}
                  viewportWidth={86}
                />
              </Pressable>
              </View>

              <Text style={styles.name}>
                {profile.name}
              </Text>

              <Text style={styles.level}>
                Level {level} · {profile.stages[level - 1]}
              </Text>

              {saved === id ? (
                <Text style={styles.saved}>SELECTED</Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* BUKLOD_CHARACTER_R28_LEVEL_1_20 */}
      <View style={styles.progression}>
        <Text style={styles.progressionTitle}>
          LEVEL 1-20 PROGRESSION
        </Text>
        <Text style={styles.progressionSummary}>
          Current Level {level} of 20 - {PROGRESSIVE_CHARACTERS[draft].stages[level - 1]}
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.progressionRow}
        >
          {PROGRESSIVE_LEVEL_THRESHOLDS.map((threshold, index) => {
            const stageLevel = index + 1;
            const current = stageLevel === level;
            const completed = stageLevel < level;
            const locked = stageLevel > level;

            return (
              <Pressable
                key={`${draft}-progress-${stageLevel}`}
                accessibilityRole="button"
                accessibilityLabel={`Preview ${PROGRESSIVE_CHARACTERS[draft].name} Level ${stageLevel}: ${PROGRESSIVE_CHARACTERS[draft].stages[index]}`}
                accessibilityState={{ selected: current }}
                onPress={() => {
                  setCollectionLevel(stageLevel);
                  setPreviewShowcase(null);
                  onPreview?.({
                    characterId: draft,
                    level: stageLevel,
                    showcase:
                      savedShowcase?.characterId === draft
                        ? savedShowcase
                        : null,
                    showcaseSaved: true,
                  });
                  setZoomId(draft);
                  setZoomLevel(stageLevel);
                }}
                style={[
                  styles.progressionCard,
                  current && styles.progressionCardCurrent,
                  locked && styles.progressionCardLocked,
                ]}
              >
                <View style={styles.progressionArt}>
                  <BuklodProgressiveCharacterArt
                    characterId={draft}
                    level={stageLevel}
                    height={136}
                    viewportWidth={88}
                  />
                </View>

                <Text style={styles.progressionLevel}>
                  Level {stageLevel}
                </Text>
                <Text
                  style={styles.progressionStage}
                  numberOfLines={2}
                >
                  {PROGRESSIVE_CHARACTERS[draft].stages[index]}
                </Text>
                <Text style={styles.progressionPoints}>
                  {threshold.toLocaleString()} PTS
                </Text>
                <Text
                  style={[
                    styles.progressionStatus,
                    current && styles.progressionStatusCurrent,
                  ]}
                >
                  {current
                    ? 'CURRENT'
                    : completed
                      ? 'COMPLETED'
                      : 'LOCKED'}
                </Text>
                <Text style={styles.progressionPreview}>
                  {locked ? 'PREVIEW LOCKED' : 'PREVIEW'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.nextUpgrade}>
          {level < 20
            ? `Next upgrade: Level ${level + 1} at ${PROGRESSIVE_LEVEL_THRESHOLDS[level].toLocaleString()} PTS`
            : 'All 20 progression levels completed.'}
        </Text>
      </View>
      {/* BUKLOD_CHARACTER_R27A_COLLECTIBLES */}
      {/* BUKLOD_CHARACTER_R31_COLLECTION_BROWSER */}
      <View style={styles.collectibles}>
        <Text style={styles.collectiblesTitle}>
          COLLECTIBLES - {PROGRESSIVE_CHARACTERS[draft].name}
        </Text>
        <Text style={styles.collectionNote}>
          Browse all 20 levels. Collectibles are display rewards and are not wearable.
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.collectionTabs}
        >
          {PROGRESSIVE_LEVEL_THRESHOLDS.map((threshold, index) => {
            const itemLevel = index + 1;
            const activeCollection = itemLevel === collectionLevel;
            const lockedCollection = itemLevel > level;

            return (
              <Pressable
                key={`${draft}-collection-${itemLevel}`}
                accessibilityRole="button"
                accessibilityLabel={`View Level ${itemLevel} collectibles`}
                accessibilityState={{ selected: activeCollection }}
                onPress={() => setCollectionLevel(itemLevel)}
                style={[
                  styles.collectionChip,
                  activeCollection && styles.collectionChipActive,
                  lockedCollection && styles.collectionChipLocked,
                ]}
              >
                <Text style={styles.collectionChipLevel}>
                  L{itemLevel}
                </Text>
                <Text style={styles.collectionChipStatus}>
                  {lockedCollection
                    ? 'LOCKED'
                    : itemLevel < level
                      ? 'EARNED'
                      : 'CURRENT'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.collectionDetail}>
          <Text style={styles.collectionDetailTitle}>
            Level {collectionLevel} - {PROGRESSIVE_CHARACTERS[draft].stages[collectionLevel - 1]}
          </Text>
          <Text style={styles.collectionDetailStatus}>
            {collectionLevel > level
              ? `LOCKED - unlock at ${PROGRESSIVE_LEVEL_THRESHOLDS[collectionLevel - 1].toLocaleString()} PTS`
              : collectionLevel < level
                ? 'EARNED'
                : 'CURRENT LEVEL'}
          </Text>

          {collectibleNames(draft, collectionLevel).map((item, index) => {
            const selection: ProgressiveShowcaseSelection = {
              characterId: draft,
              level: collectionLevel,
              itemIndex: index,
            };
            const lockedItem =
              collectionLevel > level;
            const featured =
              sameShowcase(
                savedShowcase,
                selection,
              );
            const previewed =
              sameShowcase(
                previewShowcase,
                selection,
              );

            return (
              <Pressable
                key={`${draft}-${collectionLevel}-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Preview collectible ${item}`}
                accessibilityState={{ selected: previewed || featured }}
                onPress={() => previewShowcaseItem(index)}
                style={[
                  styles.collectiblePress,
                  (previewed || featured) &&
                    styles.collectiblePressActive,
                  lockedItem &&
                    styles.collectiblePressLocked,
                ]}
              >
                <Text style={styles.collectibleItem}>
                  {index + 1}. {item}
                </Text>
                <Text style={styles.collectibleState}>
                  {featured
                    ? 'FEATURED IN MAIN VIEW'
                    : lockedItem
                      ? 'LOCKED - PREVIEW ONLY'
                      : previewed
                        ? 'PREVIEWING - READY TO FEATURE'
                        : 'TAP TO PREVIEW'}
                </Text>
              
{userId ? (
        <BuklodCollectibleRowEnhancement
          userId={userId}
          characterId={draft}
          level={collectionLevel}
          index={index}
          name={item}
          lifetimePoints={lifetimePoints}
          currentLevel={level}
        />
      ) : null}
</Pressable>
            );
          })}

          {previewShowcase &&
          previewShowcase.characterId === draft ? (
            <View style={styles.showcaseActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Feature collectible in main view"
                disabled={
                  !userId ||
                  showcaseBusy ||
                  previewShowcase.level > level ||
                  sameShowcase(
                    savedShowcase,
                    previewShowcase,
                  )
                }
                onPress={() =>
                  void featurePreviewShowcase()
                }
                style={[
                  styles.showcaseButton,
                  (
                    !userId ||
                    showcaseBusy ||
                    previewShowcase.level > level ||
                    sameShowcase(
                      savedShowcase,
                      previewShowcase,
                    )
                  ) &&
                    styles.showcaseButtonDisabled,
                ]}
              >
                <Text style={styles.showcaseButtonText}>
                  {sameShowcase(
                    savedShowcase,
                    previewShowcase,
                  )
                    ? 'FEATURED'
                    : previewShowcase.level > level
                      ? 'LOCKED - CANNOT FEATURE'
                      : showcaseBusy
                        ? 'SAVING...'
                        : 'FEATURE IN MAIN VIEW'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {savedShowcase?.characterId === draft ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove featured collectible"
              disabled={showcaseBusy}
              onPress={() =>
                void removeFeaturedShowcase()
              }
              style={styles.showcaseRemove}
            >
              <Text style={styles.showcaseRemoveText}>
                REMOVE FEATURED ITEM
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save selected BUKLOD character"
        disabled={!userId || busy || draft === saved}
        accessibilityState={{ disabled: !userId || busy || draft === saved }}
        onPress={() => void save()}
        style={[
          styles.save,
          (!userId || busy || draft === saved) && styles.saveDisabled,
        ]}
      >
        <Text style={styles.saveText}>
          {busy ? 'Saving...' : draft === saved ? 'ACTIVE CHARACTER' : 'Use This Character'}
        </Text>
      </Pressable>

      {/* BUKLOD_CHARACTER_R27B_FULLSCREEN */}
      <Modal
        visible={zoomId != null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setZoomId(null);
          setZoomLevel(null);
        }}
      >
        <Pressable
          style={styles.zoomBackdrop}
          onPress={() => {
            setZoomId(null);
            setZoomLevel(null);
          }}
          accessibilityRole="button"
          accessibilityLabel="Close full screen character"
        >
          <View style={styles.zoomCard} pointerEvents="none">
            {zoomId ? (
              <>
                <Text style={styles.zoomTitle}>
                  {PROGRESSIVE_CHARACTERS[zoomId].name} - Level {zoomLevel ?? level}
                </Text>
                <Text style={styles.zoomStage}>
                  {PROGRESSIVE_CHARACTERS[zoomId].stages[(zoomLevel ?? level) - 1]}
                </Text>
<BuklodProgressiveCharacterArt
                characterId={zoomId}
                level={zoomLevel ?? level}
                height={500}
              />
              </>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    
<BuklodCollectibleDetailHost />
</View>
  );
}