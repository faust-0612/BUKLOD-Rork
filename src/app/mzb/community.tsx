import React, {
  useMemo,
} from 'react';

import {
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

import BuklodExclusiveScopeCommunity
  from '@/components/BuklodExclusiveScopeCommunity';


import {
  colors,
} from '@/lib/theme';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

/* PATCH_173B_MZB_EXACT_SCOPE_COMMUNITY */

export default function
MzbCommunityScreen() {
  const {
    scopes,
    loading,
    refresh,
  } =
    useBuklodScope();

  const mzbScope =
    useMemo(
      () =>
        (
          scopes as any[]
        ).find(
          scope =>
            scope?.scope_type ===
              'ORGANIZATION' &&
            (
              String(
                scope?.name ??
                  '',
              )
                .toLowerCase()
                .includes(
                  'mzb ministry',
                ) ||
              String(
                scope?.metadata
                  ?.is_mzb ??
                  '',
              )
                .toLowerCase() ===
                'true'
            ) &&
            (
              !scope
                ?.membership_status ||
              scope
                ?.membership_status ===
                'ACTIVE'
            ),
        ) ?? null,
      [scopes],
    );

  if (!mzbScope) {
    return (
      
        <View
          style={
            styles.center
          }
        >
          <View
            style={
              styles.emptyIcon
            }
          >
            <MaterialCommunityIcons
              name="account-group-outline"
              size={27}
              color={colors.greenDark}
            />
          </View>

          <Text
            style={
              styles.emptyTitle
            }
          >
            {loading
              ? 'Syncing MZB Community'
              : 'MZB Community unavailable'}
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            {loading
              ? 'Your MZB membership is refreshing in the background. Navigation is already active.'
              : 'This wall is available to active members of the MZB Ministry Organization environment.'}
          </Text>

          <Pressable
            onPress={() =>
              void refresh()
            }
            style={
              styles.refreshButton
            }
          >
            <MaterialCommunityIcons
              name="refresh"
              size={17}
              color="#FFFFFF"
            />
            <Text
              style={
                styles.refreshText
              }
            >
              REFRESH
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              router.push(
                '/(tabs)/me' as any,
              )
            }
            style={
              styles.profileButton
            }
          >
            <Text
              style={
                styles.profileText
              }
            >
              OPEN MY BUKLOD
            </Text>
          </Pressable>
        </View>
      
    );
  }

  return (
    
      <View style={styles.screen}>
        <View
          style={
            styles.wallHeader
          }
        >
          <View
            style={
              styles.wallHeaderIcon
            }
          >
            <MaterialCommunityIcons
              name="account-group-outline"
              size={20}
              color={colors.greenDark}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={
                styles.wallTitle
              }
            >
              MZB Community Wall
            </Text>

            <Text
              style={
                styles.wallSubtitle
              }
            >
              Posts, photos, Reels, reactions and conversations for this MZB Organization only
            </Text>
          </View>

          <View
            style={
              styles.privatePill
            }
          >
            <MaterialCommunityIcons
              name="shield-lock-outline"
              size={13}
              color={colors.greenDark}
            />
            <Text
              style={
                styles.privateText
              }
            >
              MZB
            </Text>
          </View>
        </View>

        <View
          style={
            styles.wallBody
          }
        >
          <BuklodExclusiveScopeCommunity
            scope={
              mzbScope as any
            }
          />
        </View>
      </View>
    
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    wallHeader: {
      minHeight: 68,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderBottomWidth: 1,
      borderBottomColor:
        colors.line,
      backgroundColor:
        colors.white,
    },

    wallHeaderIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        colors.greenSoft,
    },

    wallTitle: {
      fontSize: 12,
      fontWeight: '900',
      color:
        colors.greenDark,
    },

    wallSubtitle: {
      marginTop: 2,
      fontSize: 8.3,
      lineHeight: 11.5,
      color:
        colors.muted,
    },

    privatePill: {
      minHeight: 28,
      paddingHorizontal: 8,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor:
        colors.greenSoft,
    },

    privateText: {
      fontSize: 7.5,
      fontWeight: '900',
      color:
        colors.greenDark,
    },

    wallBody: {
      flex: 1,
    },

    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 28,
    },

    loadingText: {
      marginTop: 10,
      fontSize: 9.5,
      fontWeight: '800',
      color:
        colors.muted,
    },

    emptyIcon: {
      width: 54,
      height: 54,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        colors.greenSoft,
    },

    emptyTitle: {
      marginTop: 13,
      fontSize: 18,
      fontWeight: '900',
      color:
        colors.greenDark,
    },

    emptyText: {
      marginTop: 7,
      maxWidth: 310,
      textAlign: 'center',
      fontSize: 10,
      lineHeight: 15,
      color:
        colors.muted,
    },

    refreshButton: {
      marginTop: 16,
      minHeight: 40,
      paddingHorizontal: 16,
      borderRadius: 13,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      backgroundColor:
        colors.greenDark,
    },

    refreshText: {
      fontSize: 9,
      fontWeight: '900',
      color: '#FFFFFF',
    },

    profileButton: {
      marginTop: 8,
      minHeight: 36,
      paddingHorizontal: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor:
        colors.line,
      backgroundColor:
        colors.white,
    },

    profileText: {
      fontSize: 8.5,
      fontWeight: '900',
      color:
        colors.greenDark,
    },
  });