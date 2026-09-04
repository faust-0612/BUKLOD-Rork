import React, {
  useMemo,
} from 'react';

import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
  usePathname,
} from 'expo-router';

import {
  buildScopedWorkspacePath,
  firstRouteParam,
} from '@/lib/buklodScopeRoute';

import {
  isBuklodProfileRoute,
  isBuklodScopedWorkspacePath,
  isBuklodScopedWorkspaceScopeType,
} from '@/lib/buklodSafeArea';

import {
  useAuth,
} from '@/providers/AuthProvider';

import {
  useBuklodScope,
} from '@/providers/BuklodScopeProvider';

import {
  useNotifications,
} from '@/providers/NotificationProvider';

const GUIDE = {
  male: require('../../assets/buklod-guide/wave.png'),
  female: require('../../assets/buklod-guide/female-wave.png'),
} as const;

/*
 * BUKLOD_WEB_PROFILE_AVATAR_R22
 *
 * Desktop/web deliberately avoids the native GestureDetector/Pan wrapper.
 * A normal Pressable owns the pointer event so mouse/touch click always opens
 * Profile / My BUKLOD. Native drag/animation behavior remains unchanged in
 * BuklodGuideAvatar.tsx.
 */
export function BuklodGuideAvatar() {
  const pathname =
    usePathname();

  const params =
    useLocalSearchParams<{
      returnScopeId?:
        | string
        | string[];
    }>();

  const {
    session,
    profile,
  } =
    useAuth();

  const {
    activeScope,
    scopes,
    selectScope,
  } =
    useBuklodScope();

  const {
    unreadCount,
  } =
    useNotifications();

  const isProfileRoute =
    isBuklodProfileRoute(pathname);

  const scopedWorkspaceActive =
    isBuklodScopedWorkspaceScopeType(
      activeScope?.scope_type
    );

  const explicitReturnScopeId =
    firstRouteParam(
      params.returnScopeId
    );

  const profileReturnScopeId =
    useMemo(
      () =>
        explicitReturnScopeId ||
        (
          isProfileRoute &&
          scopedWorkspaceActive
            ? activeScope?.scope_id ?? ''
            : ''
        ),
      [
        explicitReturnScopeId,
        isProfileRoute,
        scopedWorkspaceActive,
        activeScope?.scope_id,
      ]
    );

  const profileReturnMode =
    isProfileRoute &&
    Boolean(profileReturnScopeId);

  const visible =
    Boolean(session) &&
    !pathname.includes('/privacy') &&
    !pathname.includes('/delete-account') &&
    !pathname.includes('/points') &&
    (!isProfileRoute || profileReturnMode);

  if (!visible) {
    return null;
  }

  const openProfileOrReturn = () => {
    if (
      profileReturnMode &&
      profileReturnScopeId
    ) {
      void (async () => {
        try {
          await selectScope(
            profileReturnScopeId
          );
        } catch (error) {
          console.warn(
            'BUKLOD web profile return scope select:',
            error
          );
        }

        router.replace(
          buildScopedWorkspacePath(
            'home',
            profileReturnScopeId
          ) as any
        );
      })();

      return;
    }

    const openingFromScopedWorkspace =
      !isProfileRoute &&
      scopedWorkspaceActive &&
      isBuklodScopedWorkspacePath(
        pathname
      );

    if (
      openingFromScopedWorkspace &&
      activeScope?.scope_id
    ) {
      const returnScopeId =
        activeScope.scope_id;

      void (async () => {
        const publicScope =
          scopes.find(
            scope =>
              scope.scope_type === 'PUBLIC'
          );

        if (publicScope) {
          try {
            await selectScope(
              publicScope.scope_id
            );
          } catch (error) {
            console.warn(
              'BUKLOD web avatar Public reset:',
              error
            );
          }
        }

        router.replace(
          `/me?returnScopeId=${encodeURIComponent(returnScopeId)}` as any
        );
      })();

      return;
    }

    const publicScope =
      scopes.find(
        scope =>
          scope.scope_type === 'PUBLIC'
      );

    if (
      scopedWorkspaceActive &&
      publicScope
    ) {
      void selectScope(
        publicScope.scope_id
      ).catch(error => {
        console.warn(
          'BUKLOD web avatar global reset:',
          error
        );
      });
    }

    router.replace(
      '/me' as any
    );
  };

  const source =
    (profile as any)?.sex === 'female'
      ? GUIDE.female
      : GUIDE.male;

  return (
    <View
      pointerEvents="box-none"
      style={styles.root}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          profileReturnMode
            ? 'Return to organization home'
            : 'Open BUKLOD Profile'
        }
        accessibilityHint={
          profileReturnMode
            ? 'Returns to your organization workspace.'
            : 'Opens Profile and My BUKLOD.'
        }
        onPress={openProfileOrReturn}
        style={({ pressed }) => [
          styles.pressable,
          pressed && styles.pressed,
        ]}
      >
        <Image
          source={source}
          style={styles.avatar}
          resizeMode="cover"
        />

        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99
                ? '99+'
                : String(unreadCount)}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <Text
        pointerEvents="none"
        style={styles.label}
      >
        {profileReturnMode
          ? 'HOME'
          : 'PROFILE'}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    root: {
      position: 'absolute',
      right: 18,
      bottom: 18,
      zIndex: 9999,
      alignItems: 'center',
      gap: 4,
    },

    pressable: {
      width: 58,
      height: 58,
      borderRadius: 29,
      borderWidth: 3,
      borderColor: '#FFFFFF',
      backgroundColor: '#FFFFFF',
      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 3,
      },
      shadowOpacity: 0.18,
      shadowRadius: 7,
      elevation: 8,
      position: 'relative',
    },

    pressed: {
      opacity: 0.72,
      transform: [
        { scale: 0.96 },
      ],
    },

    avatar: {
      width: '100%',
      height: '100%',
      borderRadius: 29,
    },

    badge: {
      position: 'absolute',
      right: -5,
      top: -5,
      minWidth: 22,
      height: 22,
      paddingHorizontal: 5,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#FFFFFF',
      backgroundColor: '#B45309',
    },

    badgeText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '900',
    },

    label: {
      color: '#14532D',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.5,
      backgroundColor: 'rgba(255,255,255,0.94)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
    },
  });
