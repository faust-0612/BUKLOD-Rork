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
  router,
  usePathname,
} from 'expo-router';

import {
  BuklodScope,
} from '@/lib/buklodScope';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

import { colors } from '@/lib/theme';

function iconForScope(
  scope: BuklodScope
): any {
  switch (scope.scope_type) {
    case 'LOCAL':
      return 'map-marker-radius-outline';
    case 'CLUSTER':
      return 'account-group-outline';
    case 'CHURCH':
      return 'church';
    case 'ORGANIZATION':
      return 'domain';
    default:
      return 'earth';
  }
}


function scopeSortWeight(
  scope: BuklodScope
) {
  if (
    scope.scope_type ===
    'PUBLIC'
  ) {
    return 0;
  }

  if (
    scope.scope_type ===
    'LOCAL'
  ) {
    switch (
      scope.geo_level
        ?.toUpperCase()
    ) {
      case 'BARANGAY':
        return 10;
      case 'MUNICIPALITY_CITY':
      case 'MUNICIPALITY':
      case 'CITY':
        return 11;
      case 'PROVINCE':
        return 12;
      case 'COUNTRY':
        return 13;
      default:
        return 19;
    }
  }

  if (
    scope.scope_type ===
    'CLUSTER'
  ) {
    return 20;
  }

  if (
    scope.scope_type ===
    'CHURCH'
  ) {
    return 30;
  }

  if (
    scope.scope_type ===
    'ORGANIZATION'
  ) {
    return 40;
  }

  return 99;
}

function scopeMeta(
  scope: BuklodScope
) {
  if (
    scope.scope_type === 'LOCAL' &&
    scope.geo_level
  ) {
    return scope.geo_level
      .replaceAll('_', ' ')
      .toUpperCase();
  }

  return scope.scope_type;
}

export default function
BuklodScopeBar({
  hideLocalScopes = false,
}: {
  hideLocalScopes?: boolean;
}) {
  const {
    scopes,
    activeScope,
    loading,
    selectScope,
  } =
    useBuklodScope();

  const pathname =
    usePathname();

  const inWorkspace =
    pathname === '/scope' ||
    pathname.startsWith(
      '/scope/'
    );

  const workspaceSection =
    pathname === '/buklod' ||
    pathname.startsWith(
      '/buklod/'
    )
      ? 'community'
      : pathname === '/connect'
      ? 'connect'
      : 'home';

  const [open, setOpen] =
    useState(false);

  const [busyId, setBusyId] =
    useState<string | null>(
      null
    );
  /* PATCH_169F_PROFILE_NO_LOCAL_BUTTONS */
  const isProfileRoute =
    pathname === '/me' ||
    pathname.startsWith('/me/') ||
    pathname === '/profile' ||
    pathname.startsWith('/profile/');
  /* PATCH_172A_MANAGED_SCOPE_VISIBILITY
   * Actual dashboard/profile scope choices:
   * Public / Church / Cluster / Organization / Sub-organization.
   * LOCAL geography is not a Profile scope button.
   */
  const visibleScopes =
    useMemo(
      () =>
        [...scopes]
          .filter(
            scope =>
              scope.scope_type !== 'SYSTEM' &&
              scope.scope_type !== 'LOCAL'
          )
          .sort(
            (a,b) => {
              const diff =
                scopeSortWeight(a) -
                scopeSortWeight(b);

              if (diff !== 0) {
                return diff;
              }

              return a.name.localeCompare(b.name);
            }
          ),
      [scopes]
    );
  const displayScope =
    hideLocalScopes &&
    activeScope?.scope_type ===
      'LOCAL'
      ? (
          visibleScopes.find(
            (scope) =>
              scope.scope_type ===
              'PUBLIC'
          ) ??
          visibleScopes[0] ??
          null
        )
      : activeScope;
if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          size="small"
          color={colors.green}
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Loading communities...
        </Text>
      </View>
    );
  }

  if (!activeScope) {
    return null;
  }

  async function choose(
    scope: BuklodScope
  ) {
    if (
      scope.scope_id === displayScope!.scope_id
    ) {
      setOpen(false);
      return;
    }

    setBusyId(
      scope.scope_id
    );

    
    /* SMOOTH_NAV_R2_SCOPE_DRAWER */
    setOpen(false);

    try {
      await selectScope(
        scope.scope_id
      );

      
    } catch (error) {
      console.warn(
        'BUKLOD scope select:',
        error
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <View style={styles.bar}>
        <Pressable
          style={styles.current}
          onPress={() =>
            setOpen(true)
          }
        >
          <View
            style={
              styles.iconWrap
            }
          >
            <MaterialCommunityIcons
              name={
                iconForScope(displayScope!)
              }
              size={18}
              color={
                colors.greenDark
              }
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={
                styles.eyebrow
              }
            >
              CURRENT COMMUNITY
            </Text>

            <Text
              style={styles.name}
              numberOfLines={1}
            >
              {displayScope!.name}
            </Text>

            <Text
              style={
                styles.meta
              }
            >
              {scopeMeta(displayScope!)}
              {displayScope!.is_admin
                ? ' • ADMIN'
                : ''}
            </Text>
          </View>

          <MaterialCommunityIcons
            name="chevron-down"
            size={22}
            color={
              colors.greenDark
            }
          />
        </Pressable>

        {!inWorkspace && (
          <Pressable
            style={
              styles.workspace
            }
            onPress={() =>
              router.push(
                `/scope?section=${workspaceSection}` as any
              )
            }
          >
            <MaterialCommunityIcons
              name="view-dashboard-outline"
              size={20}
              color={colors.white}
            />

            <Text
              style={
                styles.workspaceText
              }
            >
              OPEN
            </Text>
          </Pressable>
        )}
      </View>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setOpen(false)
        }
      >
        <View style={styles.overlay}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() =>
              setOpen(false)
            }
          />

          <View style={styles.sheet}>
            <View
              style={
                styles.sheetHandle
              }
            />

            <Text
              style={
                styles.sheetTitle
              }
            >
              Switch Community
            </Text>

            <Text
              style={
                styles.sheetHelp
              }
            >
              One account can belong to several BUKLOD communities at the same time.
            </Text>

            <ScrollView
              style={{
                maxHeight: 430,
              }}
              contentContainerStyle={{ paddingLeft: 0, marginLeft: 0, paddingStart: 0, marginStart: 0, gap: 6,
                paddingBottom: 16,
              }}
            >
              {visibleScopes.map(
                (scope) => {
                  const selected =
                    scope.scope_id === displayScope!.scope_id;
                  /* PATCH_169C_R3_SCOPE_BUTTON_HIGHLIGHTS */
                  const isOrganizationButton =
                    scope.scope_type ===
                      'ORGANIZATION' &&
                    !Boolean(
                      (scope as any)
                        .parent_scope_id
                    );

                  const isSubOrganizationButton =
                    scope.scope_type ===
                      'ORGANIZATION' &&
                    Boolean(
                      (scope as any)
                        .parent_scope_id
                    );

                  const isClusterButton =
                    scope.scope_type ===
                    'CLUSTER';

                  return (
                    <Pressable
                      key={
                        scope.scope_id
                      }
                      disabled={
                        busyId !==
                        null
                      }
                      onPress={() =>
                        void choose(
                          scope
                        )
                      }
                      style={[
                        styles.scopeRow,
                        selected &&
                          styles.scopeRowOn,
                        isOrganizationButton &&
                          styles.organizationScopeButton,
                        isSubOrganizationButton &&
                          styles.subOrganizationScopeButton,
                        isClusterButton &&
                          styles.clusterScopeButton,
                        selected &&
                          styles.scopeSelectedRing,
                      ]}
                    >
                      <View
                        style={[
                          styles.scopeIcon,
                          isOrganizationButton &&
                            styles.organizationScopeIcon,
                          isSubOrganizationButton &&
                            styles.subOrganizationScopeIcon,
                          isClusterButton &&
                            styles.clusterScopeIcon,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={
                            iconForScope(
                              scope
                            )
                          }
                          size={21}
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
                          style={[
                            styles.scopeName,
                            isOrganizationButton &&
                              styles.organizationScopeName,
                            isSubOrganizationButton &&
                              styles.subOrganizationScopeName,
                            isClusterButton &&
                              styles.clusterScopeName,
                          ]}
                          numberOfLines={
                            1
                          }
                        >
                          {scope.name}
                        </Text>

                        <Text
                          style={
                            styles.scopeMeta
                          }
                        >
                          {scopeMeta(
                            scope
                          )}
                          {scope.is_admin
                            ? ' • ADMIN'
                            : ''}
                          {scope.member_count !==
                            null &&
                          scope.member_count !==
                            undefined
                            ? ` • ${scope.member_count} members`
                            : ''}
                        </Text>
                      </View>

                      {busyId ===
                      scope.scope_id ? (
                        <ActivityIndicator
                          size="small"
                          color={
                            colors.green
                          }
                        />
                      ) : selected ? (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={22}
                          color={
                            colors.green
                          }
                        />
                      ) : (
                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={21}
                          color={
                            colors.muted
                          }
                        />
                      )}
                    </Pressable>
                  );
                }
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles =
  StyleSheet.create({
    loading: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor:
        colors.line,
      backgroundColor:
        colors.white,
    },
    loadingText: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: '700',
    },
    bar: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderBottomWidth: 1,
      borderBottomColor:
        colors.line,
      backgroundColor:
        colors.white,
    },
    current: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 9,
      borderRadius: 12,
      backgroundColor:
        'rgba(39,93,69,0.06)',
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        'rgba(39,93,69,0.09)',
    },
    eyebrow: {
      color: colors.muted,
      fontSize: 7.5,
      fontWeight: '900',
      letterSpacing: 0.7,
    },
    name: {
      marginTop: 1,
      color: colors.greenDark,
      fontSize: 12,
      fontWeight: '900',
    },
    meta: {
      marginTop: 1,
      color: colors.muted,
      fontSize: 7.5,
      fontWeight: '700',
    },
    workspace: {
      width: 54,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
      borderRadius: 12,
      backgroundColor:
        colors.greenDark,
    },
    workspaceText: {
      color: colors.white,
      fontSize: 7,
      fontWeight: '900',
    },
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor:
        'rgba(0,0,0,0.32)',
    },
    sheet: {
      maxHeight: '72%',
      padding: 14,
      paddingBottom: 28,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      backgroundColor:
        colors.white,
    },
    sheetHandle: {
      width: 42,
      height: 4,
      alignSelf: 'center',
      marginBottom: 6,
      borderRadius: 999,
      backgroundColor:
        colors.line,
    },
    sheetTitle: {
      color: colors.greenDark,
      fontSize: 19,
      fontWeight: '900',
    },
    sheetHelp: {
      marginTop: 3,
      marginBottom: 6,
      color: colors.muted,
      fontSize: 10,
      lineHeight: 15,
    },
    scopeRow: {
      minHeight: 62,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      padding: 9,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 13,
    },
    organizationScopeButton: {
      borderWidth: 1.5,
      borderColor: '#68A97E',
      backgroundColor: '#EAF7EF',
      shadowColor: '#185C34',
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    subOrganizationScopeButton: {
      borderWidth: 1.5,
      borderColor: '#8E9BDD',
      backgroundColor: '#EEF1FF',
      shadowColor: '#4453A7',
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    clusterScopeButton: {
      borderWidth: 1.5,
      borderColor: '#D5A35D',
      backgroundColor: '#FFF4E3',
      shadowColor: '#955A12',
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    scopeSelectedRing: {
      borderWidth: 2,
      borderColor: colors.greenDark,
    },
    organizationScopeIcon: {
      backgroundColor: '#D3EEDC',
    },
    subOrganizationScopeIcon: {
      backgroundColor: '#DDE2FF',
    },
    clusterScopeIcon: {
      backgroundColor: '#FBE3BE',
    },
    organizationScopeName: {
      color: '#185C34',
    },
    subOrganizationScopeName: {
      color: '#4453A7',
    },
    clusterScopeName: {
      color: '#955A12',
    },
    scopeRowOn: {
      borderColor:
        colors.green,
      backgroundColor:
        'rgba(39,93,69,0.06)',
    },
    scopeIcon: {
      width: 39,
      height: 39,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor:
        'rgba(39,93,69,0.08)',
    },
    scopeName: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '900',
    },
    scopeMeta: {
      marginTop: 2,
      color: colors.muted,
      fontSize: 8,
      fontWeight: '700',
    },
  });
