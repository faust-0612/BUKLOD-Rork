import React, {
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  MaterialCommunityIcons,
} from '@expo/vector-icons';

import {
  router,
} from 'expo-router';

import {
  useAuth,
} from '@/providers/AuthProvider';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

import {
  colors,
} from '@/lib/theme';

/* PATCH_169D_PROFILE_MEMBERSHIP_NAV */

type ScopeRow = {
  scope_id: string;
  scope_type: string;
  name: string;

  geo_level?:
    | string
    | null;

  membership_status?:
    | string
    | null;

  metadata?:
    | Record<string, unknown>
    | null;
};

type NavTile = {
  key: string;
  label: string;

  type:
    | 'ORGANIZATION'
    | 'CHURCH'
    | 'CLUSTER'
    | 'LOCAL';

  scopeId:
    | string
    | null;

  geoLevel?:
    | string
    | null;

  isMzb?: boolean;
};

function normalize(
  value: unknown,
) {
  return String(
    value ?? ''
  )
    .trim()
    .toLowerCase();
}

function firstValue(
  source: any,
  keys: string[],
) {
  for (
    const key of keys
  ) {
    const value =
      source?.[key];

    if (
      typeof value ===
        'string' &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return '';
}

function locationWeight(
  geoLevel:
    | string
    | null
    | undefined,
) {
  const level =
    normalize(
      geoLevel
    );

  if (
    level.includes(
      'barangay'
    )
  ) {
    return 0;
  }

  if (
    level.includes('city') ||
    level.includes('town') ||
    level.includes(
      'municip'
    )
  ) {
    return 1;
  }

  if (
    level.includes(
      'province'
    )
  ) {
    return 2;
  }

  if (
    level.includes(
      'country'
    )
  ) {
    return 3;
  }

  return 9;
}

function membershipWeight(
  type: string,
) {
  if (
    type ===
    'ORGANIZATION'
  ) {
    return 0;
  }

  if (
    type ===
    'CHURCH'
  ) {
    return 1;
  }

  if (
    type ===
    'CLUSTER'
  ) {
    return 2;
  }

  return 9;
}

function tileIcon(
  tile: NavTile,
): React.ComponentProps<
  typeof MaterialCommunityIcons
>['name'] {
  if (
    tile.type ===
    'ORGANIZATION'
  ) {
    return tile.isMzb
      ? 'church'
      : 'domain';
  }

  if (
    tile.type ===
    'CHURCH'
  ) {
    return 'church-outline';
  }

  if (
    tile.type ===
    'CLUSTER'
  ) {
    return 'account-group-outline';
  }

  const level =
    normalize(
      tile.geoLevel
    );

  if (
    level.includes(
      'country'
    )
  ) {
    return 'earth';
  }

  if (
    level.includes(
      'province'
    )
  ) {
    return 'map-outline';
  }

  if (
    level.includes('city') ||
    level.includes('town') ||
    level.includes(
      'municip'
    )
  ) {
    return 'city-variant-outline';
  }

  return 'map-marker-outline';
}

export default function
BuklodProfileMembershipNav() {
  const {
    profile,
  } =
    useAuth();

  const {
    scopes,
    activeScope,
    selectScope,
    loading,
  } =
    useBuklodScope();

  const [
    switchingId,
    setSwitchingId,
  ] =
    useState<
      string | null
    >(null);

  const scopeRows =
    (
      scopes ?? []
    ) as ScopeRow[];

  const activeScopes =
    useMemo(
      () =>
        scopeRows.filter(
          scope => {
            /*
             * PATCH_169D_R2_STRICT_MEMBERSHIP_ONLY
             *
             * PUBLIC and system-owned LOCAL scopes
             * may not require a membership_status.
             *
             * ORGANIZATION / CHURCH / CLUSTER
             * must have ACTIVE membership.
             */
            if (
              scope.scope_type ===
                'PUBLIC' ||
              scope.scope_type ===
                'LOCAL'
            ) {
              return true;
            }

            if (
              [
                'ORGANIZATION',
                'CHURCH',
                'CLUSTER',
              ].includes(
                scope.scope_type
              )
            ) {
              return (
                scope
                  .membership_status ===
                'ACTIVE'
              );
            }

            return false;
          }
        ),
      [scopeRows],
    );

  const membershipTiles =
    useMemo(
      () =>
        activeScopes
          .filter(
            scope =>
              [
                'ORGANIZATION',
                'CHURCH',
                'CLUSTER',
              ].includes(
                scope.scope_type
              )
          )
          .sort(
            (
              a,
              b,
            ) => {
              const weight =
                membershipWeight(
                  a.scope_type
                ) -
                membershipWeight(
                  b.scope_type
                );

              if (weight) {
                return weight;
              }

              return a.name.localeCompare(
                b.name
              );
            }
          )
          .map(
            scope => {
              const isMzb =
                scope.scope_type ===
                  'ORGANIZATION' &&
                (
                  normalize(
                    scope.name
                  ).includes(
                    'mzb ministry'
                  ) ||
                  normalize(
                    scope.metadata
                      ?.is_mzb
                  ) === 'true'
                );

              return {
                key:
                  `membership:${scope.scope_id}`,
                label:
                  String(
                    scope.name ||
                    scope.metadata?.cluster_name ||
                    scope.metadata?.name ||
                    (
                      scope.scope_type === 'CLUSTER'
                        ? 'Cluster'
                        : ''
                    )
                  ).trim(),
                type:
                  scope.scope_type as
                    | 'ORGANIZATION'
                    | 'CHURCH'
                    | 'CLUSTER',
                scopeId:
                  scope.scope_id,
                isMzb,
              } satisfies NavTile;
            }
          ),
      [activeScopes],
    );

  const localScopes =
    useMemo(
      () =>
        activeScopes
          .filter(
            scope =>
              scope.scope_type ===
              'LOCAL'
          )
          .sort(
            (
              a,
              b,
            ) =>
              locationWeight(
                a.geo_level
              ) -
              locationWeight(
                b.geo_level
              )
          ),
      [activeScopes],
    );

  const fallbackLocations =
    useMemo(
      () => {
        const raw = [
          {
            key: 'barangay',
            value:
              firstValue(
                profile,
                [
                  'barangay',
                  'barangay_name',
                  'brgy',
                ]
              ),
          },

          {
            key: 'town',
            value:
              firstValue(
                profile,
                [
                  'town_city',
                  'town',
                  'city',
                  'municipality',
                  'municipality_city',
                ]
              ),
          },

          {
            key: 'province',
            value:
              firstValue(
                profile,
                [
                  'province',
                  'province_name',
                ]
              ),
          },

          {
            key: 'country',
            value:
              firstValue(
                profile,
                [
                  'country',
                  'country_name',
                ]
              ),
          },
        ];

        return raw.filter(
          item =>
            Boolean(
              item.value
            )
        );
      },
      [profile],
    );

  const locationTiles =
    useMemo(
      () => {
        if (
          localScopes.length
        ) {
          return localScopes.map(
            scope => ({
              key:
                `local:${scope.scope_id}`,
              label:
                scope.name,
              type:
                'LOCAL' as const,
              scopeId:
                scope.scope_id,
              geoLevel:
                scope.geo_level ??
                null,
            })
          );
        }

        return fallbackLocations.map(
          item => ({
            key:
              `fallback:${item.key}`,
            label:
              item.value,
            type:
              'LOCAL' as const,
            scopeId:
              null,
            geoLevel:
              item.key,
          })
        );
      },
      [
        fallbackLocations,
        localScopes,
      ],
    );

  const allTiles =
    [
      ...membershipTiles,
      ...locationTiles,
    ];

  const openTile =
    async (
      tile: NavTile,
    ) => {
      if (
        switchingId
      ) {
        return;
      }

      if (
        tile.isMzb
      ) {
        router.push(
          '/mzb/home' as any
        );
        return;
      }

      if (
        tile.scopeId
      ) {
        setSwitchingId(
          tile.scopeId
        );

        try {
          if (
            tile.scopeId !==
            activeScope
              ?.scope_id
          ) {
            await selectScope(
              tile.scopeId
            );
          }

          /*
           * Generic Church / Cluster /
           * Organization / Local navigation
           * uses the canonical scope workspace.
           */
          router.push(
            '/scope' as any
          );
        }
        finally {
          setSwitchingId(
            null
          );
        }

        return;
      }

      /*
       * Address fallback:
       * there is no canonical scope ID
       * available yet, so open Community.
       */
      router.push(
        '/(tabs)/buklod' as any
      );
    };

  if (loading) {
    return (
      <View
        style={
          styles.loading
        }
      >
        <ActivityIndicator
          size="small"
          color={
            colors.green
          }
        />
      </View>
    );
  }

  if (
    !allTiles.length
  ) {
    return null;
  }

  return (
    <View
      style={styles.wrap}
    >
      {(
        allTiles.filter(
          (profileTile: any) => {
            if (
              String(
                profileTile?.key ?? ''
              ).startsWith('local:')
            ) {
              return false;
            }

            const isMzbOrganization =
              String(
                profileTile?.type ?? ''
              ).toUpperCase() ===
                'ORGANIZATION' &&
              (
                profileTile?.isMzb === true ||
                String(
                  profileTile?.label ?? ''
                )
                  .toLowerCase()
                  .includes(
                    'mzb ministry'
                  )
              );

            if (isMzbOrganization) {
              return false;
            }

            return true;
          }
        )
      ).map(
        tile => {
          const selected =
            tile.scopeId ===
            activeScope
              ?.scope_id;

          const switching =
            switchingId ===
            tile.scopeId;

          return (
            <Pressable
              key={tile.key}
              disabled={
                switchingId !==
                null
              }
              onPress={() =>
                void openTile(
                  tile
                )
              }
              style={({
                pressed,
              }) => [
                styles.tile,

                tile.type ===
                  'ORGANIZATION' &&
                  styles
                    .organizationTile,

                selected &&
                  styles.selectedTile,

                pressed &&
                  styles.pressed,
              ]}
            >
              {switching ? (
                <ActivityIndicator
                  size="small"
                  color={
                    colors.greenDark
                  }
                />
              ) : (
                <MaterialCommunityIcons
                  name={
                    tileIcon(
                      tile
                    )
                  }
                  size={13}
                  color={
                    selected
                      ? colors
                          .greenDark
                      : '#53645B'
                  }
                />
              )}

              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  selected &&
                    styles
                      .selectedLabel,
                ]}
              >
                {tile.label}
              </Text>
            </Pressable>
          );
        }
      )}
    </View>
  );
}

const styles =
  StyleSheet.create({
    loading: {
      minHeight: 34,
      marginTop: 6,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    wrap: {
      width: '100%',
      marginTop: 6,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent:
        'center',
      gap: 5,
    },

    tile: {
      minHeight: 36,
      maxWidth: 170,
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 5,
      borderWidth: 2,
      borderColor: '#275D45',
      borderRadius: 0,
      backgroundColor: '#FFFFFF',
      opacity: 1,
      shadowColor: '#000000',
      shadowOpacity: 0.28,
      shadowRadius: 5,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      elevation: 6,
    },

    organizationTile: {
      borderColor:
        'rgba(39,93,69,0.25)',
      backgroundColor: '#FFFFFF',
    },

    selectedTile: {
      borderWidth: 2,
      borderColor: '#0B5D2A',
      backgroundColor: '#FFFFFF',
      opacity: 1,
    },

    pressed: {
      opacity: 0.70,
      transform: [
        {
          scale: 0.985,
        },
      ],
    },

    label: {
      flexShrink: 1,
      fontSize: 12,
      fontWeight: '900',
      color: '#0B5D2A',
    },

    selectedLabel: {
      color:
        colors.greenDark,
      fontWeight: '900',
    },
  });