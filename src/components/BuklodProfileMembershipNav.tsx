import React, {
  useMemo,
} from 'react';

import {
  ActivityIndicator,
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
  enterScopedWorkspace,
} from '@/lib/buklodScopeRoute';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

import {
  useBuklodTheme,
} from '@/providers/BuklodThemeProvider';
import {
  type BuklodThemeRoles,
} from '@/lib/buklodTheme';

import {
  BuklodProfileGlassCard,
  BuklodProfileGlassRow,
} from '@/components/BuklodProfileGlassCard';
import {
  ProfileMotionFadeUp,
} from '@/components/BuklodProfileMotion';

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

  parent_scope_id?:
    | string
    | null;

  is_mzb_organization?: boolean;
};

type CommunityKind =
  | 'organization'
  | 'suborg'
  | 'cluster'
  | 'location';

type NavTile = {
  key: string;
  label: string;
  kind: CommunityKind;
  scopeId: string | null;
  geoLevel?: string | null;
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

function kindWeight(
  kind: CommunityKind,
) {
  if (kind === 'organization') return 0;
  if (kind === 'suborg') return 1;
  if (kind === 'cluster') return 2;
  return 3;
}

function kindLabel(
  kind: CommunityKind,
) {
  if (kind === 'organization') return 'Organization';
  if (kind === 'suborg') return 'Sub-organization';
  if (kind === 'cluster') return 'Cluster';
  return 'Location';
}

function tileIcon(
  tile: NavTile,
): React.ComponentProps<
  typeof MaterialCommunityIcons
>['name'] {
  if (tile.kind === 'organization') {
    return 'domain';
  }

  if (tile.kind === 'suborg') {
    return 'sitemap';
  }

  if (tile.kind === 'cluster') {
    return 'account-group-outline';
  }

  const level = normalize(tile.geoLevel);

  if (level.includes('country')) {
    return 'earth';
  }

  if (level.includes('province')) {
    return 'map-outline';
  }

  if (
    level.includes('city') ||
    level.includes('town') ||
    level.includes('municip')
  ) {
    return 'city-variant-outline';
  }

  return 'map-marker-outline';
}

export default function
BuklodProfileMembershipNav() {
  const {
    theme,
  } = useBuklodTheme();
  const styles = useMemo(
    () => createMembershipStyles(theme),
    [theme]
  );

  const {
    scopes,
    activeScope,
    loading,
    selectScope,
  } =
    useBuklodScope();

  const scopeRows =
    (
      scopes ?? []
    ) as ScopeRow[];

  const activeScopes =
    useMemo(
      () =>
        scopeRows.filter(
          scope => {
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
                'CLUSTER',
              ].includes(
                scope.scope_type
              )
          )
          .map(
            scope => {
              const isMzb = Boolean(scope.is_mzb_organization);

              const kind: CommunityKind =
                scope.scope_type === 'CLUSTER'
                  ? 'cluster'
                  : scope.scope_type === 'CHURCH'
                    ? 'location'
                    : scope.parent_scope_id
                      ? 'suborg'
                      : 'organization';

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
                        : kindLabel(kind)
                    )
                  ).trim(),
                kind,
                scopeId:
                  scope.scope_id,
                isMzb,
              } satisfies NavTile;
            }
          )
          .sort(
            (a, b) => {
              const weight =
                kindWeight(a.kind) -
                kindWeight(b.kind);

              if (weight) {
                return weight;
              }

              return a.label.localeCompare(
                b.label
              );
            }
          ),
      [activeScopes],
    );

  const openTile = (tile: NavTile) => {
    if (
      tile.scopeId &&
      (
        tile.isMzb ||
        tile.kind === 'cluster' ||
        tile.kind === 'organization' ||
        tile.kind === 'suborg'
      )
    ) {
      void enterScopedWorkspace(
        selectScope,
        tile.scopeId,
        { section: 'home' },
      ).catch((error) => {
        console.warn(
          'BUKLOD membership nav:',
          error,
        );
      });

      return;
    }

    router.push('/(tabs)/buklod' as any);
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
            theme.accent
          }
        />
      </View>
    );
  }

  if (
    !membershipTiles.length
  ) {
    return null;
  }

  return (
    <ProfileMotionFadeUp delay={80} duration={240} fromY={10} fromOpacity={0.78}>
      <View style={styles.wrap}>
        <Text style={styles.eyebrow}>
          MY COMMUNITIES
        </Text>

        <BuklodProfileGlassCard>
          {membershipTiles.map((tile, index) => {
            const selected =
              tile.scopeId ===
              activeScope
                ?.scope_id;

            return (
              <View
                key={tile.key}
                style={
                  index > 0
                    ? styles.rowBorder
                    : undefined
                }
              >
                <BuklodProfileGlassRow
                  icon={tileIcon(tile)}
                  title={tile.label}
                  subtitle={kindLabel(tile.kind)}
                  onPress={() => openTile(tile)}
                  trailing={
                    selected ? (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={18}
                        color={theme.accent}
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={theme.textMuted}
                      />
                    )
                  }
                />
              </View>
            );
          })}
        </BuklodProfileGlassCard>
      </View>
    </ProfileMotionFadeUp>
  );
}

function createMembershipStyles(
  theme: BuklodThemeRoles
) {
  return StyleSheet.create({
    loading: {
      minHeight: 34,
      marginTop: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },

    wrap: {
      width: '100%',
      paddingHorizontal: 12,
      marginTop: 4,
    },

    eyebrow: {
      marginBottom: 8,
      marginLeft: 4,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: theme.textMuted,
    },

    rowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
  });
}
