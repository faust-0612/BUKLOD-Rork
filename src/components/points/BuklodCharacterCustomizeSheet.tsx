/* BUKLOD_CHARACTER_STUDIO3_REAL_ART_R1 */
/* BUKLOD_CHARACTER_R25C_CONTAINMENT */
import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_HIT_SLOP_TIGHT,
} from '@/lib/buklodTouch';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import type {
  ComponentProps,
} from 'react';

import BuklodCharacterItemThumb
  from '@/components/points/BuklodCharacterItemThumb';

import BuklodCharacterLayeredArt
  from '@/components/points/BuklodCharacterLayeredArt';

import BuklodCharacterSettingsRow
  from '@/components/points/BuklodCharacterSettingsRow';

import {
  useBuklodCharacterEventsOptional,
} from '@/components/character/BuklodCharacterEventProvider';

import {
  useBuklodPresentation,
} from '@/hooks/useBuklodPresentation';

import {
  markRorkAvatarOnboardingCompleted,
} from '@/lib/buklodRorkAvatarOnboarding';

import {
  withAlpha,
} from '@/lib/buklodContrast';

import {
  useBuklodDrawerBottomInset,
} from '@/lib/buklodSafeArea';

import {
  buildUnlockContext,
  CHARACTER_SLOT_LABELS,
  CHARACTER_SLOT_ORDER,
  DEFAULT_CHARACTER,
  equipItem,
  loadBuklodCharacter,
  reconcileCharacterForPoints,
  saveBuklodCharacter,
  type BuklodCharacterState,
  reactionForEquip,
} from '@/lib/buklodCharacter';

import {
  getItem,
} from '@/lib/character-lab-core/catalog';

import {
  CharacterEventType,
} from '@/lib/buklodCharacterEvents';

import {
  formatPoints,
} from '@/lib/character-lab-core/tiers';

import {
  itemPointsLabel,
  warriorRankLabel,
} from '@/lib/character-lab-core/warrior';

import {
  nextUnlock,
  resolveSlot,
} from '@/lib/character-lab-core/unlock';

import type {
  BodyId,
  ResolvedItem,
  SlotId,
} from '@/lib/character-lab-core/types';

type IconName =
  ComponentProps<
    typeof MaterialCommunityIcons
  >['name'];

const SLOT_ICONS:
  Record<
    SlotId,
    IconName
  > = {
    base:
      'account-outline',
    face:
      'emoticon-happy-outline',
    hair:
      'content-cut',
    top:
      'tshirt-crew-outline',
    bottom:
      'human-male-height-variant',
    shoes:
      'shoe-formal',
    accessory:
      'bag-personal-outline',
    badge:
      'medal-outline',
    special:
      'shimmer',
    background:
      'image-outline',
  };

type Props = {
  visible: boolean;
  onClose: () => void;
  userId?:
    | string
    | null;
  lifetimePoints:
    number;
  onSaved?: (
    config:
      BuklodCharacterState,
  ) => void;
};

function equippedId(
  equipment:
    BuklodCharacterState['equipment'],
  slot: SlotId,
): string | null {
  const raw =
    equipment[slot];

  if (
    slot ===
      'accessory' &&
    !raw
  ) {
    return 'acc_none';
  }

  return raw;
}

export default function
BuklodCharacterCustomizeSheet({
  visible,
  onClose,
  userId,
  lifetimePoints,
  onSaved,
}: Props) {
  const {
    theme,
  } = useBuklodPresentation();

  const drawerBottomInset =
    useBuklodDrawerBottomInset();

  const {
    width:
      screenWidth,
  } =
    useWindowDimensions();

  const characterEvents =
    useBuklodCharacterEventsOptional();

  const [
    draft,
    setDraft,
  ] =
    useState<BuklodCharacterState>({
      ...DEFAULT_CHARACTER,
    });

  const [
    savedSnapshot,
    setSavedSnapshot,
  ] =
    useState<BuklodCharacterState>({
      ...DEFAULT_CHARACTER,
    });

  const [
    slot,
    setSlot,
  ] =
    useState<SlotId>(
      'hair',
    );

  const [
    swapKey,
    setSwapKey,
  ] =
    useState(0);

  useEffect(() => {
    if (!visible) {
      return;
    }

    void loadBuklodCharacter(
      userId,
    ).then(
      (loaded) => {
        const reconciled =
          reconcileCharacterForPoints(
            loaded,
            lifetimePoints,
          );

        setDraft(
          reconciled,
        );

        setSavedSnapshot(
          reconciled,
        );
      },
    );
  }, [
    lifetimePoints,
    userId,
    visible,
  ]);

  const unlockCtx =
    useMemo(
      () =>
        buildUnlockContext(
          lifetimePoints,
          draft,
        ),
      [
        draft,
        lifetimePoints,
      ],
    );

  const resolvedItems =
    useMemo(
      () =>
        resolveSlot(
          slot,
          draft.body,
          unlockCtx,
        ),
      [
        draft.body,
        slot,
        unlockCtx,
      ],
    );

  const slotStats =
    useMemo(
      () => {
        const unlocked =
          resolvedItems.filter(
            (row) =>
              row.isUnlocked,
          ).length;

        return {
          unlocked,
          total:
            resolvedItems.length,
        };
      },
      [
        resolvedItems,
      ],
    );

  const nextWarriorUnlock =
    useMemo(
      () =>
        nextUnlock(
          lifetimePoints,
          draft.body,
        ),
      [
        draft.body,
        lifetimePoints,
      ],
    );

  const sidePad = 14;
  const gap = 10;

  const tileWidth =
    Math.max(
      138,
      (
        screenWidth -
        sidePad * 2 -
        gap
      ) /
        2,
    );

  const styles =
    StyleSheet.create({
      overlay: {
        flex: 1,
        justifyContent:
          'flex-end',
        backgroundColor:
          theme.overlay,
      },

      sheet: {
        height: '94%',
        borderTopLeftRadius:
          24,
        borderTopRightRadius:
          24,
        overflow: 'hidden',
        backgroundColor:
          theme.surface,
      },

      header: {
        minHeight: 60,
        flexDirection: 'row',
        alignItems:
          'center',
        paddingHorizontal: 16,
        borderBottomWidth:
          StyleSheet.hairlineWidth,
        borderBottomColor:
          theme.border,
      },

      headerCopy: {
        flex: 1,
        minWidth: 0,
      },

      title: {
        fontSize: 19,
        fontWeight: '900',
        color:
          theme.textPrimary,
      },

      localNote: {
        marginTop: 2,
        fontSize: 10,
        color:
          theme.textMuted,
      },

      bodyScroll: {
        flex: 1,
      },

      bodyContent: {
        paddingBottom: 18,
      },

      heroRow: {
        marginTop: 12,
        marginHorizontal:
          14,
        minHeight: 188,
        flexDirection: 'row',
        alignItems:
          'center',
        gap: 14,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor:
          withAlpha(
            theme.accent,
            0.18,
          ),
        backgroundColor:
          withAlpha(
            theme.accentSoft,
            0.34,
          ),
        overflow: 'hidden',
      },

      heroArt: {
        width: 128,
        height: 170,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent:
          'flex-end',
        overflow: 'hidden',
        borderRadius: 18,
      },

      heroMeta: {
        flex: 1,
        minWidth: 0,
      },

      pointsPill: {
        alignSelf:
          'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor:
          theme.accentSoft,
        borderWidth: 1,
        borderColor:
          withAlpha(
            theme.accent,
            0.22,
          ),
      },

      pointsText: {
        fontSize: 10,
        fontWeight: '900',
        color:
          theme.accent,
      },

      heroTitle: {
        marginTop: 9,
        fontSize: 14,
        fontWeight: '900',
        color:
          theme.textPrimary,
      },

      heroHint: {
        marginTop: 4,
        fontSize: 10,
        lineHeight: 14,
        color:
          theme.textSecondary,
      },

      section: {
        marginTop: 14,
        paddingHorizontal:
          14,
      },

      sectionEyebrow: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.9,
        color:
          theme.textMuted,
        marginBottom: 7,
      },

      bodyRow: {
        flexDirection: 'row',
        gap: 10,
      },

      bodyChoice: {
        flex: 1,
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent:
          'center',
        gap: 7,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor:
          theme.border,
        backgroundColor:
          theme.surfaceElevated,
      },

      bodyChoiceOn: {
        borderColor:
          theme.accent,
        backgroundColor:
          theme.accentSoft,
      },

      bodyChoiceText: {
        fontSize: 12,
        fontWeight: '900',
        color:
          theme.textSecondary,
      },

      bodyChoiceTextOn: {
        color:
          theme.accent,
      },

      categories: {
        paddingHorizontal: 14,
        paddingVertical: 4,
        gap: 8,
      },

      catChip: {
        minHeight: 38,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor:
          theme.border,
        backgroundColor:
          theme.surface,
      },

      catChipOn: {
        borderColor:
          theme.accent,
        backgroundColor:
          theme.accentSoft,
      },

      catText: {
        fontSize: 10,
        fontWeight: '900',
        color:
          theme.textSecondary,
      },

      catTextOn: {
        color:
          theme.accent,
      },

      slotHeader: {
        marginTop: 12,
        paddingHorizontal: 14,
      },

      slotTitle: {
        fontSize: 15,
        fontWeight: '900',
        color:
          theme.textPrimary,
      },

      slotMeta: {
        marginTop: 3,
        fontSize: 10,
        color:
          theme.textMuted,
      },

      nextUnlock: {
        marginTop: 10,
        marginHorizontal: 14,
        padding: 10,
        borderRadius: 13,
        borderWidth: 1,
        borderColor:
          withAlpha(
            theme.accent,
            0.22,
          ),
        backgroundColor:
          withAlpha(
            theme.accent,
            0.07,
          ),
      },

      nextUnlockTitle: {
        fontSize: 10,
        fontWeight: '900',
        color:
          theme.accent,
      },

      nextUnlockBody: {
        marginTop: 3,
        fontSize: 10,
        lineHeight: 14,
        color:
          theme.textSecondary,
      },

      grid: {
        marginTop: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap,
        paddingHorizontal:
          sidePad,
      },

      tile: {
        width: tileWidth,
        minHeight: 136,
        alignItems:
          'center',
        paddingHorizontal: 8,
        paddingVertical: 9,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor:
          theme.border,
        backgroundColor:
          theme.surfaceElevated,
      },

      tileOn: {
        borderColor:
          theme.accent,
        backgroundColor:
          theme.accentSoft,
      },

      tileNew: {
        borderColor:
          theme.warning,
      },

      tileLocked: {
        opacity: 0.88,
      },

      thumbWrap: {
        position:
          'relative',
      },

      badge: {
        position:
          'absolute',
        right: -5,
        top: -5,
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent:
          'center',
        backgroundColor:
          theme.accent,
      },

      badgeNew: {
        backgroundColor:
          theme.warning,
      },

      tileName: {
        marginTop: 7,
        fontSize: 11,
        fontWeight: '900',
        color:
          theme.textPrimary,
        textAlign: 'center',
        lineHeight: 14,
      },

      tileNameLocked: {
        color:
          theme.textMuted,
      },

      rankTag: {
        marginTop: 5,
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.45,
        textTransform:
          'uppercase',
        color:
          theme.textSecondary,
        textAlign: 'center',
      },

      tileStatus: {
        marginTop: 3,
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.45,
        textTransform:
          'uppercase',
        color:
          theme.textMuted,
        textAlign: 'center',
      },

      tileStatusOn: {
        color:
          theme.accent,
      },

      tileStatusNew: {
        color:
          theme.warning,
      },

      settingsWrap: {
        marginTop: 14,
      },

      actions: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 14,
        paddingTop: 10,
        borderTopWidth:
          StyleSheet.hairlineWidth,
        borderTopColor:
          theme.border,
        backgroundColor:
          theme.surface,
      },

      cancel: {
        flex: 1,
        minHeight: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent:
          'center',
        borderWidth: 1,
        borderColor:
          theme.border,
        backgroundColor:
          theme.surface,
      },

      cancelText: {
        fontSize: 12,
        fontWeight: '900',
        color:
          theme.textSecondary,
      },

      save: {
        flex: 1.25,
        minHeight: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent:
          'center',
        backgroundColor:
          theme.buttonPrimary,
      },

      saveText: {
        fontSize: 12,
        fontWeight: '900',
        color:
          theme.white,
      },
    });

  const showLockedAlert =
    (
      resolved:
        ResolvedItem,
    ) => {
      Alert.alert(
        resolved.item.name,
        `${resolved.item.blurb}\n\n${resolved.requirementLabel}\n${formatPoints(
          resolved.pointsRemaining,
        )} more lifetime BUKLOD Points needed.`,
        [
          {
            text:
              'OK',
          },
        ],
      );
    };

  const selectItem =
    (
      resolved:
        ResolvedItem,
    ) => {
      if (
        resolved.state ===
        'locked'
      ) {
        showLockedAlert(
          resolved,
        );
        return;
      }

      const itemId =
        resolved.item.id;

      const item =
        getItem(
          itemId,
        );

      setDraft(
        (prev) => {
          const next =
            equipItem(
              prev,
              slot,
              itemId,
              lifetimePoints,
            );

          setSwapKey(
            (key) =>
              key + 1,
          );

          const reaction =
            reactionForEquip(
              itemId,
              prev,
            );

          characterEvents?.emit({
            type:
              reaction ===
              'new_item'
                ? CharacterEventType
                    .ITEM_UNLOCKED
                : CharacterEventType
                    .ITEM_EQUIPPED,
            success: true,
            itemId,
            itemName:
              item?.name,
          });

          return next;
        },
      );
    };

  const chooseBody =
    (
      bodyOption:
        BodyId,
    ) => {
      const baseId =
        bodyOption ===
        'female'
          ? 'base_female'
          : 'base_male';

      setDraft(
        (prev) => {
          const next =
            equipItem(
              prev,
              'base',
              baseId,
              lifetimePoints,
            );

          return {
            ...next,
            bodyChosen:
              true,
          };
        },
      );

      setSwapKey(
        (key) =>
          key + 1,
      );
    };

  const save =
    async () => {
      const toSave = {
        ...draft,
        bodyChosen:
          draft.bodyChosen ??
          true,
      };

      await saveBuklodCharacter(
        toSave,
        userId,
      );

      if (userId) {
        await markRorkAvatarOnboardingCompleted(
          userId,
        );
      }

      setSavedSnapshot(
        toSave,
      );

      onSaved?.(
        toSave,
      );

      onClose();
    };

  const cancel =
    () => {
      setDraft(
        savedSnapshot,
      );
      onClose();
    };

  const renderTile =
    (
      resolved:
        ResolvedItem,
    ) => {
      const selected =
        equippedId(
          draft.equipment,
          slot,
        ) ===
        resolved.item.id;

      const locked =
        resolved.state ===
        'locked';

      const isNew =
        resolved.state ===
        'newly_unlocked';

      const pointsLabel =
        itemPointsLabel(
          resolved.item,
          locked,
          resolved.pointsRemaining,
        );

      const rank =
        warriorRankLabel(
          resolved.item,
        );

      const stateLabel =
        selected
          ? 'Equipped'
          : locked
            ? `Locked · ${pointsLabel}`
            : isNew
              ? `New · ${pointsLabel}`
              : 'Owned';

      return (
        <Pressable
          key={
            resolved.item.id
          }
          onPress={() =>
            selectItem(
              resolved,
            )
          }
          style={[
            styles.tile,
            selected &&
              styles.tileOn,
            isNew &&
              !selected &&
              styles.tileNew,
            locked &&
              styles.tileLocked,
          ]}
        >
          <View
            style={
              styles.thumbWrap
            }
          >
            <BuklodCharacterItemThumb
              item={
                resolved.item
              }
              body={
                draft.body
              }
              locked={
                locked
              }
              size={64}
            />

            {selected ? (
              <View
                style={
                  styles.badge
                }
              >
                <MaterialCommunityIcons
                  name="check"
                  size={13}
                  color={
                    theme.white
                  }
                />
              </View>
            ) : isNew ? (
              <View
                style={[
                  styles.badge,
                  styles.badgeNew,
                ]}
              >
                <MaterialCommunityIcons
                  name="star-four-points"
                  size={12}
                  color={
                    theme.white
                  }
                />
              </View>
            ) : null}
          </View>

          <Text
            style={[
              styles.tileName,
              locked &&
                styles.tileNameLocked,
            ]}
            numberOfLines={
              2
            }
          >
            {resolved.item.name}
          </Text>

          <Text
            style={
              styles.rankTag
            }
          >
            {rank} ·{' '}
            {formatPoints(
              resolved.item
                .unlockAtLifetime,
            )}{' '}
            pts
          </Text>

          <Text
            style={[
              styles.tileStatus,
              selected &&
                styles.tileStatusOn,
              isNew &&
                !selected &&
                styles.tileStatusNew,
            ]}
            numberOfLines={
              2
            }
          >
            {stateLabel}
          </Text>
        </Pressable>
      );
    };

  const visibleSlots =
    CHARACTER_SLOT_ORDER.filter(
      (row) =>
        row !== 'base',
    );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={
        onClose
      }
    >
      <Pressable
        style={
          styles.overlay
        }
        onPress={
          onClose
        }
      >
        <Pressable
          style={[
            styles.sheet,
            {
              paddingBottom:
                drawerBottomInset,
            },
          ]}
          onPress={(
            event,
          ) =>
            event.stopPropagation()
          }
        >
          <View
            style={
              styles.header
            }
          >
            <View
              style={
                styles.headerCopy
              }
            >
              <Text
                style={
                  styles.title
                }
              >
                Customize Character
              </Text>

              <Text
                style={
                  styles.localNote
                }
              >
                Rank and lifetime points unlock your wardrobe.
              </Text>
            </View>

            <Pressable
              onPress={
                onClose
              }
              hitSlop={BUKLOD_HIT_SLOP}
            >
              <MaterialCommunityIcons
                name="close"
                size={23}
                color={
                  theme.textMuted
                }
              />
            </Pressable>
          </View>

          <ScrollView
            style={
              styles.bodyScroll
            }
            contentContainerStyle={
              styles.bodyContent
            }
            showsVerticalScrollIndicator
          >
            <View
              style={
                styles.heroRow
              }
            >
              <View
                style={
                  styles.heroArt
                }
              >
                <BuklodCharacterLayeredArt
                  key={
                    swapKey
                  }
                  body={
                    draft.body
                  }
                  equipment={
                    draft.equipment
                  }
                  height={154}
                  showStage
                  showEffects
                />
              </View>

              <View
                style={
                  styles.heroMeta
                }
              >
                <View
                  style={
                    styles.pointsPill
                  }
                >
                  <MaterialCommunityIcons
                    name="star-circle"
                    size={13}
                    color={
                      theme.accent
                    }
                  />

                  <Text
                    style={
                      styles.pointsText
                    }
                  >
                    {formatPoints(
                      lifetimePoints,
                    )}{' '}
                    lifetime pts
                  </Text>
                </View>

                <Text
                  style={
                    styles.heroTitle
                  }
                >
                  Live full-body preview
                </Text>

                <Text
                  style={
                    styles.heroHint
                  }
                >
                  Tap an owned item to preview it. Save only when you are happy with the look.
                </Text>
              </View>
            </View>

            <View
              style={
                styles.section
              }
            >
              <Text
                style={
                  styles.sectionEyebrow
                }
              >
                CHARACTER BUILD
              </Text>

              <View
                style={
                  styles.bodyRow
                }
              >
                {(
                  [
                    [
                      'male',
                      'Male',
                      'human-male',
                    ],
                    [
                      'female',
                      'Female',
                      'human-female',
                    ],
                  ] as const
                ).map(
                  ([
                    bodyOption,
                    label,
                    icon,
                  ]) => {
                    const selected =
                      draft.body ===
                      bodyOption;

                    return (
                      <Pressable
                        key={
                          bodyOption
                        }
                        onPress={() =>
                          chooseBody(
                            bodyOption,
                          )
                        }
                        style={[
                          styles.bodyChoice,
                          selected &&
                            styles.bodyChoiceOn,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={
                            icon
                          }
                          size={18}
                          color={
                            selected
                              ? theme.accent
                              : theme.textMuted
                          }
                        />

                        <Text
                          style={[
                            styles.bodyChoiceText,
                            selected &&
                              styles.bodyChoiceTextOn,
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </View>
            </View>

            <View
              style={
                styles.section
              }
            >
              <Text
                style={
                  styles.sectionEyebrow
                }
              >
                CUSTOMIZE BY RANK
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.categories
              }
            >
              {visibleSlots.map(
                (row) => (
                  <Pressable
                    key={row}
                    onPress={() =>
                      setSlot(
                        row,
                      )
                    }
                    style={[
                      styles.catChip,
                      slot ===
                        row &&
                        styles.catChipOn,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={
                        SLOT_ICONS[
                          row
                        ]
                      }
                      size={15}
                      color={
                        slot ===
                        row
                          ? theme.accent
                          : theme.textMuted
                      }
                    />

                    <Text
                      style={[
                        styles.catText,
                        slot ===
                          row &&
                          styles.catTextOn,
                      ]}
                    >
                      {
                        CHARACTER_SLOT_LABELS[
                          row
                        ]
                      }
                    </Text>
                  </Pressable>
                ),
              )}
            </ScrollView>

            <View
              style={
                styles.slotHeader
              }
            >
              <Text
                style={
                  styles.slotTitle
                }
              >
                {
                  CHARACTER_SLOT_LABELS[
                    slot
                  ]
                }{' '}
                Styles
              </Text>

              <Text
                style={
                  styles.slotMeta
                }
              >
                {
                  slotStats.unlocked
                }
                /
                {
                  slotStats.total
                }{' '}
                owned · locked items show the rank/points still needed
              </Text>
            </View>

            {nextWarriorUnlock ? (
              <View
                style={
                  styles.nextUnlock
                }
              >
                <Text
                  style={
                    styles.nextUnlockTitle
                  }
                >
                  NEXT UNLOCK ·{' '}
                  {formatPoints(
                    nextWarriorUnlock
                      .threshold,
                  )}{' '}
                  PTS
                </Text>

                <Text
                  style={
                    styles.nextUnlockBody
                  }
                >
                  {formatPoints(
                    nextWarriorUnlock
                      .pointsAway,
                  )}{' '}
                  pts away:{' '}
                  {nextWarriorUnlock
                    .items
                    .slice(
                      0,
                      3,
                    )
                    .map(
                      (item) =>
                        item.name,
                    )
                    .join(
                      ', ',
                    )}
                  {nextWarriorUnlock
                    .items
                    .length >
                  3
                    ? '…'
                    : ''}
                </Text>
              </View>
            ) : null}

            <View
              style={
                styles.grid
              }
            >
              {resolvedItems.map(
                renderTile,
              )}
            </View>

            <View
              style={
                styles.settingsWrap
              }
            >
              <BuklodCharacterSettingsRow
                compact
              />
            </View>
          </ScrollView>

          <View
            style={
              styles.actions
            }
          >
            <Pressable
              onPress={
                cancel
              }
              style={({
                pressed,
              }) => [
                styles.cancel,
                pressed && {
                  opacity: 0.88,
                },
              ]}
            >
              <Text
                style={
                  styles.cancelText
                }
              >
                CANCEL
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                void save()
              }
              style={({
                pressed,
              }) => [
                styles.save,
                pressed && {
                  opacity: 0.88,
                },
              ]}
            >
              <Text
                style={
                  styles.saveText
                }
              >
                SAVE CHARACTER
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}