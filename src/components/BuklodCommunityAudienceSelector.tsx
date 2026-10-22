import React, {
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

import {
  colors,
} from '@/lib/theme';
import { useBuklodDrawerBottomInset } from '@/lib/buklodSafeArea';

type LocalScope = {
  scope_id: string;
  scope_type: string;
  name: string;
  geo_level?:
    | 'BARANGAY'
    | 'MUNICIPALITY_CITY'
    | 'PROVINCE'
    | 'COUNTRY'
    | null;
  membership_status?:
    | string
    | null;
};

type Props = {
  selectedScopeId:
    | string
    | null;
  onChange:
    (scopeId: string | null) => void;
};

function geoWeight(
  scope: LocalScope,
) {
  switch (scope.geo_level) {
    case 'BARANGAY':
      return 10;
    case 'MUNICIPALITY_CITY':
      return 20;
    case 'PROVINCE':
      return 30;
    case 'COUNTRY':
      return 40;
    default:
      return 99;
  }
}

function geoLabel(
  scope: LocalScope,
) {
  switch (scope.geo_level) {
    case 'BARANGAY':
      return 'Barangay';
    case 'MUNICIPALITY_CITY':
      return 'Town / City';
    case 'PROVINCE':
      return 'Province';
    case 'COUNTRY':
      return 'Country';
    default:
      return 'Location';
  }
}

function geoIcon(
  scope: LocalScope,
) {
  switch (scope.geo_level) {
    case 'BARANGAY':
      return 'home-group' as const;
    case 'MUNICIPALITY_CITY':
      return 'city-variant-outline' as const;
    case 'PROVINCE':
      return 'map-marker-radius-outline' as const;
    case 'COUNTRY':
      return 'earth' as const;
    default:
      return 'map-marker-outline' as const;
  }
}

/*
 * PATCH_169G_PUBLIC_LOCATION_FILTER_ONLY
 *
 * IMPORTANT:
 * - This component NEVER calls selectScope().
 * - PUBLIC is the only dashboard represented here.
 * - LOCAL rows are filter values only.
 * - Selecting Barangay/Town/Province/Country changes only
 *   which PUBLIC posts are visible in the current feed.
 */
export default function
BuklodCommunityAudienceSelector({
  selectedScopeId,
  onChange,
}: Props) {
  const drawerBottomInset = useBuklodDrawerBottomInset();
  const {
    scopes,
    loading,
  } =
    useBuklodScope();

  const [
    open,
    setOpen,
  ] =
    useState(false);

  const localScopes =
    useMemo(
      () =>
        (
          scopes as LocalScope[]
        )
          .filter(
            (scope) =>
              scope.scope_type ===
                'LOCAL' &&
              (
                !scope.membership_status ||
                scope.membership_status ===
                  'ACTIVE'
              ),
          )
          .sort(
            (a, b) =>
              geoWeight(a) -
              geoWeight(b),
          ),
      [scopes],
    );

  const selected =
    useMemo(
      () =>
        localScopes.find(
          (scope) =>
            scope.scope_id ===
            selectedScopeId,
        ) ??
        null,
      [
        localScopes,
        selectedScopeId,
      ],
    );

  const choosePublic = () => {
    onChange(null);
    setOpen(false);
  };

  const chooseLocation = (
    scope: LocalScope,
  ) => {
    onChange(scope.scope_id);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() =>
          setOpen(true)
        }
        accessibilityRole="button"
        accessibilityLabel="Filter Public Community posts by location"
        style={({ pressed }) => [
          styles.selector,
          pressed && {
            opacity: 0.75,
          },
        ]}
      >
        <View
          style={
            styles.selectorIcon
          }
        >
          <MaterialCommunityIcons
            name={
              selected
                ? geoIcon(
                    selected,
                  )
                : 'earth'
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
            style={
              styles.eyebrow
            }
          >
            PUBLIC FEED FILTER
          </Text>

          <Text
            style={
              styles.currentName
            }
            numberOfLines={1}
          >
            {selected?.name ??
              'Public'}
          </Text>

          <Text
            style={
              styles.currentType
            }
          >
            {selected
              ? geoLabel(selected)
              : 'All Public posts'}
          </Text>
        </View>

        <MaterialCommunityIcons
          name="filter-variant"
          size={21}
          color={colors.greenDark}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setOpen(false)
        }
      >
        <View
          style={
            styles.backdrop
          }
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() =>
              setOpen(false)
            }
          />

          <View
            style={[
              styles.drawer,
              { paddingBottom: drawerBottomInset + 12 },
            ]}
          >
            <View
              style={
                styles.handle
              }
            />

            <View
              style={
                styles.header
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
                  Filter Public Community
                </Text>

                <Text
                  style={
                    styles.subtitle
                  }
                >
                  Choose a location to filter posts in this same Public Community. This does not change your dashboard.
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  setOpen(false)
                }
                style={
                  styles.close
                }
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={colors.text}
                />
              </Pressable>
            </View>

            {loading ? (
              <View
                style={
                  styles.loading
                }
              >
                <ActivityIndicator
                  color={
                    colors.green
                  }
                />
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={
                  styles.list
                }
                showsVerticalScrollIndicator={
                  false
                }
              >
                <Pressable
                  onPress={
                    choosePublic
                  }
                  style={[
                    styles.row,
                    selectedScopeId ===
                      null &&
                      styles.rowOn,
                  ]}
                >
                  <View
                    style={
                      styles.rowIcon
                    }
                  >
                    <MaterialCommunityIcons
                      name="earth"
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
                      style={
                        styles.rowName
                      }
                    >
                      Public
                    </Text>

                    <Text
                      style={
                        styles.rowMeta
                      }
                    >
                      All Public Community posts
                    </Text>
                  </View>

                  {selectedScopeId ===
                    null && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={20}
                      color={
                        colors.green
                      }
                    />
                  )}
                </Pressable>

                {localScopes.map(
                  (scope) => {
                    const isSelected =
                      selectedScopeId ===
                      scope.scope_id;

                    return (
                      <Pressable
                        key={
                          scope.scope_id
                        }
                        onPress={() =>
                          chooseLocation(
                            scope,
                          )
                        }
                        style={[
                          styles.row,
                          isSelected &&
                            styles.rowOn,
                        ]}
                      >
                        <View
                          style={
                            styles.rowIcon
                          }
                        >
                          <MaterialCommunityIcons
                            name={
                              geoIcon(
                                scope,
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
                            style={
                              styles.rowName
                            }
                            numberOfLines={1}
                          >
                            {scope.name}
                          </Text>

                          <Text
                            style={
                              styles.rowMeta
                            }
                          >
                            {geoLabel(
                              scope,
                            )}{' '}
                            • filter only
                          </Text>
                        </View>

                        {isSelected && (
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={20}
                            color={
                              colors.green
                            }
                          />
                        )}
                      </Pressable>
                    );
                  },
                )}

                {localScopes.length ===
                  0 && (
                  <View
                    style={
                      styles.empty
                    }
                  >
                    <MaterialCommunityIcons
                      name="map-marker-off-outline"
                      size={25}
                      color={
                        colors.muted
                      }
                    />
                    <Text
                      style={
                        styles.emptyTitle
                      }
                    >
                      No location filters available
                    </Text>
                    <Text
                      style={
                        styles.emptyText
                      }
                    >
                      Public Community remains available with all Public posts.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles =
  StyleSheet.create({
    selector: {
      minHeight: 66,
      marginBottom: 6,
      paddingHorizontal: 13,
      paddingVertical: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        colors.white,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    selectorIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.greenSoft,
    },
    eyebrow: {
      color: colors.muted,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
    },
    currentName: {
      marginTop: 2,
      color: colors.text,
      fontSize: 14,
      fontWeight: '900',
    },
    currentType: {
      marginTop: 1,
      color: colors.muted,
      fontSize: 9,
      fontWeight: '700',
    },
    backdrop: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.34)',
      justifyContent:
        'flex-end',
    },
    drawer: {
      maxHeight: '72%',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor:
        colors.background,
      paddingHorizontal: 14,
      paddingBottom: 24,
    },
    handle: {
      width: 42,
      height: 4,
      borderRadius: 999,
      alignSelf: 'center',
      marginTop: 6,
      marginBottom: 6,
      backgroundColor:
        colors.line,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      paddingBottom: 12,
    },
    title: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '900',
    },
    subtitle: {
      display: 'none',
      marginTop: 4,
      color: colors.muted,
      fontSize: 10,
      lineHeight: 15,
    },
    close: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.white,
    },
    loading: {
      minHeight: 110,
      alignItems: 'center',
      justifyContent:
        'center',
    },
    list: {
      gap: 6,
      paddingBottom: 8,
    },
    row: {
      minHeight: 62,
      paddingHorizontal: 11,
      paddingVertical: 9,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        colors.white,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    rowOn: {
      borderColor:
        colors.green,
      backgroundColor:
        colors.greenSoft,
    },
    rowIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.background,
    },
    rowName: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '900',
    },
    rowMeta: {
      marginTop: 2,
      color: colors.muted,
      fontSize: 9,
      fontWeight: '700',
    },
    empty: {
      paddingVertical: 24,
      alignItems: 'center',
      gap: 5,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '900',
    },
    emptyText: {
      maxWidth: 270,
      color: colors.muted,
      fontSize: 10,
      lineHeight: 15,
      textAlign: 'center',
    },
  });