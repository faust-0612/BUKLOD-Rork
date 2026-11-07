import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import {
  BUKLOD_HIT_SLOP,
  BUKLOD_HIT_SLOP_TIGHT,
} from '@/lib/buklodTouch';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  supabase,
} from '@/lib/supabase';

import {
  colors,
} from '@/lib/theme';

/*
 * PATCH_173E_R4_SHARE_SEARCH_SUCCESS
 *
 * - Share sheet opens immediately.
 * - Search button filters all available Wall / Connect targets.
 * - Share count remains optimistic.
 * - Success feedback appears only after Supabase confirms the share.
 * - No loading overlay / blocking spinner is added.
 */

type TargetKind =
  | 'PUBLIC_WALL'
  | 'LOCAL_WALL'
  | 'GROUP_WALL'
  | 'SCOPE_WALL'
  | 'SCOPE_CONNECT'
  | 'DIRECT_CONNECT';

type Target = {
  key: string;
  kind: TargetKind;
  id: string | null;
  label: string;
  detail: string;
  sortOrder: number;
};

type Props = {
  postId: string;
  initialCount?: number;
  compact?: boolean;
  iconOnly?: boolean;
  social?: boolean;
};

const PUBLIC_TARGET: Target = {
  key: 'public-wall',
  kind: 'PUBLIC_WALL',
  id: null,
  label: 'Public Wall',
  detail: 'BUKLOD Public Community',
  sortOrder: 10,
};

function iconFor(
  target: Target,
): React.ComponentProps<
  typeof MaterialCommunityIcons
>['name'] {
  switch (
    target.kind
  ) {
    case 'PUBLIC_WALL':
      return 'earth';

    case 'LOCAL_WALL':
      return 'map-marker-outline';

    case 'GROUP_WALL':
      return 'account-group-outline';

    case 'SCOPE_WALL':
      return target.detail
        .toLowerCase()
        .includes(
          'cluster',
        )
        ? 'account-group-outline'
        : 'domain';

    case 'SCOPE_CONNECT':
      return 'message-text-outline';

    case 'DIRECT_CONNECT':
      return 'message-text-outline';
  }
}

function isMissingRpc(
  message: string,
): boolean {
  const lower =
    message
      .toLowerCase();

  return (
    lower.includes(
      'could not find the function',
    ) ||
    lower.includes(
      'schema cache',
    )
  );
}

function normalized(
  value: string,
): string {
  return String(
    value ??
      '',
  )
    .trim()
    .toLowerCase();
}

export default function
BuklodPostInternalShare({
  postId,
  initialCount = 0,
  compact = false,
  iconOnly = false,
  social = false,
}: Props) {
  const [
    open,
    setOpen,
  ] =
    useState(false);

  const [
    count,
    setCount,
  ] =
    useState(
      Number(
        initialCount ??
          0,
      ),
    );

  const [
    targets,
    setTargets,
  ] =
    useState<Target[]>(
      [
        PUBLIC_TARGET,
      ],
    );

  const [
    targetsLoaded,
    setTargetsLoaded,
  ] =
    useState(false);

  const [
    targetError,
    setTargetError,
  ] =
    useState<
      string | null
    >(null);

  const [
    searchOpen,
    setSearchOpen,
  ] =
    useState(false);

  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState('');

  useEffect(
    () => {
      let alive =
        true;

      void (
        async () => {
          const {
            data,
            error,
          } =
            await (
              supabase as any
            ).rpc(
              'buklod_internal_share_count_v2',
              {
                p_post_id:
                  postId,
              },
            );

          if (
            !alive ||
            error
          ) {
            return;
          }

          const next =
            Number(
              Array.isArray(
                data,
              )
                ? data[0] ??
                    0
                : data ??
                    0,
            );

          if (
            Number.isFinite(
              next,
            )
          ) {
            setCount(
              next,
            );
          }
        }
      )();

      return () => {
        alive =
          false;
      };
    },
    [
      postId,
    ],
  );

  const loadTargets =
    useCallback(
      async () => {
        if (
          targetsLoaded
        ) {
          return;
        }

        setTargetError(
          null,
        );

        const {
          data,
          error,
        } =
          await (
            supabase as any
          ).rpc(
            'buklod_internal_share_targets_v2',
          );

        if (error) {
          const message =
            String(
              error.message ??
                error,
            );

          setTargetError(
            isMissingRpc(
              message,
            )
              ? 'Database Share update is not installed yet.'
              : message,
          );

          return;
        }

        const next:
          Target[] =
          (
            data ?? []
          ).map(
            (
              row: any,
            ) => ({
              key:
                String(
                  row.target_key,
                ),
              kind:
                String(
                  row.target_kind,
                ) as TargetKind,
              id:
                row.target_id
                  ? String(
                      row.target_id,
                    )
                  : null,
              label:
                String(
                  row.label ??
                    'BUKLOD',
                ),
              detail:
                String(
                  row.detail ??
                    '',
                ),
              sortOrder:
                Number(
                  row.sort_order ??
                    99,
                ),
            }),
          );

        setTargets(
          next.length
            ? next
            : [
                PUBLIC_TARGET,
              ],
        );

        setTargetsLoaded(
          true,
        );
      },
      [
        targetsLoaded,
      ],
    );

  const visibleTargets =
    useMemo(
      () => {
        const query =
          normalized(
            searchQuery,
          );

        return [...targets]
          .filter(
            target => {
              if (!query) {
                return true;
              }

              const haystack =
                normalized(
                  `${target.label} ${target.detail} ${target.kind}`,
                );

              return haystack.includes(
                query,
              );
            },
          )
          .sort(
            (
              left,
              right,
            ) =>
              left.sortOrder -
                right.sortOrder ||
              left.label
                .localeCompare(
                  right.label,
                ),
          );
      },
      [
        searchQuery,
        targets,
      ],
    );

  const closeSheet =
    () => {
      setOpen(
        false,
      );

      setSearchOpen(
        false,
      );

      setSearchQuery(
        '',
      );
    };

  const show =
    () => {
      /*
       * PATCH_173E_R4_INSTANT_OPEN
       * Same-tap response. No await before the sheet is shown.
       */
      setOpen(
        true,
      );

      void loadTargets();
    };

  const showSuccess =
    (
      target:
        Target,
    ) => {
      const message =
        `Shared successfully to ${target.label}`;

      /*
       * Android gets a non-blocking native toast.
       * Other platforms use a standard confirmation dialog.
       * No artificial waiting/loading is introduced.
       */
      if (
        Platform.OS ===
          'android'
      ) {
        ToastAndroid.show(
          message,
          ToastAndroid.SHORT,
        );

        return;
      }

      Alert.alert(
        'Shared successfully',
        message,
      );
    };

  const shareTo =
    (
      target:
        Target,
    ) => {
      /*
       * PATCH_173E_R4_OPTIMISTIC_SHARE
       * Close + count first. Save second.
       */
      closeSheet();

      setCount(
        value =>
          value + 1,
      );

      void (
        async () => {
          const {
            data,
            error,
          } =
            await (
              supabase as any
            ).rpc(
              'buklod_internal_share_post_v2',
              {
                p_post_id:
                  postId,
                p_target_kind:
                  target.kind,
                p_target_id:
                  target.id,
              },
            );

          if (error) {
            setCount(
              value =>
                Math.max(
                  0,
                  value - 1,
                ),
            );

            const message =
              String(
                error.message ??
                  error,
              );

            Alert.alert(
              'Share',
              isMissingRpc(
                message,
              )
                ? 'Database Share functions are not installed yet. Apply PATCH 173E-R3 SQL to Supabase.'
                : message,
            );

            return;
          }

          const next =
            Number(
              Array.isArray(
                data,
              )
                ? data[0]
                : data,
            );

          if (
            Number.isFinite(
              next,
            )
          ) {
            setCount(
              next,
            );
          }

          /*
           * PATCH_173E_R4_CONFIRMED_SUCCESS
           * Confirmation is only shown after the database accepts the share.
           */
          showSuccess(
            target,
          );
        }
      )();
    };

  return (
    <>
      <Pressable
        onPress={event => {
          event
            .stopPropagation?.();

          show();
        }}
        style={({ pressed }) => [
          styles.button,
          compact &&
            styles.buttonCompact,
          iconOnly &&
            styles.buttonIconOnly,
          social && styles.buttonSocial,
          pressed && {
            opacity: 0.56,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Share post. ${count} shares`}
      >
        <MaterialCommunityIcons
          name="share-variant-outline"
          size={
            compact
              ? 17
              : 18
          }
          color={
            colors.greenDark
          }
        />

        <Text
          style={
            styles.buttonText
          }
        >
          {social ? 'Share' : iconOnly ? count : `Share ${count}`}
        </Text>
      </Pressable>

      <Modal
        visible={
          open
        }
        transparent
        animationType="none"
        onRequestClose={
          closeSheet
        }
      >
        <Pressable
          style={
            styles.backdrop
          }
          onPress={
            closeSheet
          }
        >
          <Pressable
            style={
              styles.sheet
            }
            onPress={
              event =>
                event
                  .stopPropagation()
            }
          >
            <View
              style={
                styles.handle
              }
            />

            <View
              style={
                styles.titleRow
              }
            >
              <View
                style={{
                  flex: 1,
                }}
              >
                <Text
                  style={
                    styles.title
                  }
                >
                  Share post
                </Text>

                <Text
                  style={
                    styles.subtitle
                  }
                >
                  All available Walls and Connect destinations
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  setSearchOpen(
                    value =>
                      !value,
                  );

                  if (
                    searchOpen
                  ) {
                    setSearchQuery(
                      '',
                    );
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  searchOpen
                    ? 'Close destination search'
                    : 'Search share destinations'
                }
                style={({
                  pressed,
                }) => [
                  styles.searchButton,
                  searchOpen &&
                    styles.searchButtonActive,
                  pressed && {
                    opacity: 0.58,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={
                    searchOpen
                      ? 'close'
                      : 'magnify'
                  }
                  size={21}
                  color={
                    colors.greenDark
                  }
                />
              </Pressable>
            </View>

            {searchOpen && (
              <View
                style={
                  styles.searchBox
                }
              >
                <MaterialCommunityIcons
                  name="magnify"
                  size={18}
                  color={
                    colors.muted
                  }
                />

                <TextInput
                  autoFocus
                  value={
                    searchQuery
                  }
                  onChangeText={
                    setSearchQuery
                  }
                  placeholder="Search Wall or Connect..."
                  placeholderTextColor={
                    colors.muted
                  }
                  style={
                    styles.searchInput
                  }
                  autoCapitalize="none"
                  autoCorrect={
                    false
                  }
                />

                {!!searchQuery && (
                  <Pressable
                    onPress={() =>
                      setSearchQuery(
                        '',
                      )
                    }
                    hitSlop={BUKLOD_HIT_SLOP}
                    accessibilityLabel="Clear destination search"
                  >
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={18}
                      color={
                        colors.muted
                      }
                    />
                  </Pressable>
                )}
              </View>
            )}

            {!!targetError && (
              <Pressable
                onPress={() =>
                  void loadTargets()
                }
                style={
                  styles.errorBox
                }
              >
                <Text
                  style={
                    styles.errorText
                  }
                >
                  {targetError}
                </Text>

                <Text
                  style={
                    styles.retryText
                  }
                >
                  Tap to retry
                </Text>
              </Pressable>
            )}

            <ScrollView
              style={
                styles.list
              }
              contentContainerStyle={
                styles.listContent
              }
              showsVerticalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
            >
              {visibleTargets.length ===
              0 ? (
                <View
                  style={
                    styles.emptySearch
                  }
                >
                  <MaterialCommunityIcons
                    name="magnify"
                    size={24}
                    color={
                      colors.muted
                    }
                  />

                  <Text
                    style={
                      styles.emptySearchText
                    }
                  >
                    No Wall or Connect destination found.
                  </Text>
                </View>
              ) : (
                visibleTargets.map(
                  target => (
                    <Pressable
                      key={
                        target.key
                      }
                      onPress={() =>
                        shareTo(
                          target,
                        )
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.target,
                        pressed && {
                          opacity: 0.6,
                        },
                      ]}
                    >
                      <View
                        style={
                          styles.targetIcon
                        }
                      >
                        <MaterialCommunityIcons
                          name={
                            iconFor(
                              target,
                            )
                          }
                          size={20}
                          color={
                            colors.greenDark
                          }
                        />
                      </View>

                      <View
                        style={{
                          flex: 1,
                        }}
                      >
                        <Text
                          numberOfLines={
                            1
                          }
                          style={
                            styles.targetTitle
                          }
                        >
                          {
                            target.label
                          }
                        </Text>

                        <Text
                          numberOfLines={
                            1
                          }
                          style={
                            styles.targetDetail
                          }
                        >
                          {
                            target.detail
                          }
                        </Text>
                      </View>

                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={
                          colors.muted
                        }
                      />
                    </Pressable>
                  ),
                )
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles =
  StyleSheet.create({
    button: {
      minHeight: 42,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 13,
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        '#FFFFFF',
    },

    buttonCompact: {
      minHeight: 38,
      paddingHorizontal: 9,
      flex: 1,
    },

    buttonSocial: {
      flex: 1,
      minHeight: 40,
      borderWidth: 0,
      borderRadius: 9,
      backgroundColor: 'transparent',
      paddingHorizontal: 4,
    },
    buttonIconOnly: {
      flex: 0,
      minHeight: 32,
      paddingHorizontal: 4,
      gap: 3,
      borderWidth: 0,
      backgroundColor: 'transparent',
    },

    buttonText: {
      fontSize: 9.5,
      fontWeight: '900',
      color:
        colors.greenDark,
    },

    backdrop: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 24,
      backgroundColor:
        'rgba(0,0,0,0.35)',
    },

    sheet: {
      width: '100%',
      maxWidth: 460,
      maxHeight: '72%',
      minHeight: 0,
      paddingTop: 12,
      paddingHorizontal: 14,
      paddingBottom: 18,
      borderRadius: 20,
      backgroundColor:
        '#FFFFFF',
    },

    handle: {
      width: 42,
      height: 4,
      borderRadius: 4,
      alignSelf: 'center',
      marginBottom: 13,
      backgroundColor:
        colors.line,
    },

    titleRow: {
      flexDirection: 'row',
      alignItems:
        'flex-start',
      gap: 10,
    },

    title: {
      fontSize: 17,
      fontWeight: '900',
      color:
        colors.text,
    },

    subtitle: {
      marginTop: 3,
      marginBottom: 10,
      fontSize: 9,
      color:
        colors.muted,
    },

    searchButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent:
        'center',
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        '#FFFFFF',
    },

    searchButtonActive: {
      backgroundColor:
        colors.greenSoft,
    },

    searchBox: {
      minHeight: 44,
      marginBottom: 10,
      paddingHorizontal: 11,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        '#F7FAF8',
    },

    searchInput: {
      flex: 1,
      minHeight: 42,
      paddingVertical: 0,
      fontSize: 11,
      color:
        colors.text,
    },

    errorBox: {
      marginBottom: 9,
      padding: 10,
      borderRadius: 12,
      backgroundColor:
        '#FFF4E5',
    },

    errorText: {
      fontSize: 9,
      fontWeight: '800',
      color:
        '#8A4B08',
    },

    retryText: {
      marginTop: 3,
      fontSize: 8,
      fontWeight: '900',
      color:
        colors.greenDark,
    },

    list: {
      flexGrow: 0,
      flexShrink: 1,
      minHeight: 0,
    },

    listContent: {
      gap: 7,
      paddingBottom: 8,
    },

    emptySearch: {
      minHeight: 110,
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 7,
      paddingHorizontal: 16,
    },

    emptySearchText: {
      textAlign: 'center',
      fontSize: 9,
      color:
        colors.muted,
    },

    target: {
      minHeight: 58,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 15,
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        '#FAFCFA',
    },

    targetIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        colors.greenSoft,
    },

    targetTitle: {
      fontSize: 10.5,
      fontWeight: '900',
      color:
        colors.text,
    },

    targetDetail: {
      marginTop: 2,
      fontSize: 8,
      color:
        colors.muted,
    },
  });